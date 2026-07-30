import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const pluginRoot = path.join(root, "plugins", "palpatine");

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

function readText(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return "";
  }
}

function check(condition, message) {
  if (!condition) errors.push(message);
}

function resolvesTo(relativeLink, relativeTarget) {
  const link = path.join(root, relativeLink);
  const target = path.join(root, relativeTarget);
  try {
    check(fs.lstatSync(link).isSymbolicLink(), `${relativeLink} must be a symlink`);
    const linkText = fs.readlinkSync(link);
    check(!path.isAbsolute(linkText), `${relativeLink} must use a relative symlink`);
    const resolvedLink = path.resolve(root, path.dirname(relativeLink), linkText);
    check(
      fs.realpathSync(resolvedLink) === fs.realpathSync(target),
      `${relativeLink} resolves incorrectly`,
    );
  } catch (error) {
    errors.push(`${relativeLink}: ${error.message}`);
  }
}

function checkManifest(manifest, host) {
  if (!manifest) return;

  check(manifest.name === "palpatine", `${host} manifest name must be palpatine`);
  check(manifest.version === "2.1.0", `${host} manifest version must be 2.1.0`);
  check(
    manifest.license === "LicenseRef-SPL-1.0",
    `${host} manifest license must be LicenseRef-SPL-1.0`,
  );
}

function findPlugin(marketplace, marketplaceName) {
  if (!marketplace) return null;
  check(Array.isArray(marketplace.plugins), `${marketplaceName} marketplace plugins must be an array`);
  return Array.isArray(marketplace.plugins)
    ? marketplace.plugins.find((plugin) => plugin.name === "palpatine")
    : null;
}

function checkSkillMetadata() {
  const skillsPath = path.join(pluginRoot, "skills");
  let entries;
  try {
    entries = fs.readdirSync(skillsPath, { withFileTypes: true });
  } catch (error) {
    errors.push(`plugins/palpatine/skills: ${error.message}`);
    return [];
  }

  const skillNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const skillName of skillNames) {
    const skillPath = path.join("plugins", "palpatine", "skills", skillName);
    check(fs.existsSync(path.join(root, skillPath, "SKILL.md")), `${skillPath}/SKILL.md is missing`);
    check(
      fs.existsSync(path.join(root, skillPath, "agents", "openai.yaml")),
      `${skillPath}/agents/openai.yaml is missing`,
    );
  }

  return skillNames;
}

function countSteps(seductionData) {
  if (!Array.isArray(seductionData?.phases)) return 0;
  return seductionData.phases.reduce(
    (total, phase) => total + (Array.isArray(phase.steps) ? phase.steps.length : 0),
    0,
  );
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });
}

function checkStaticContract(relativePath, source, requirements) {
  for (const [description, pattern] of requirements) {
    check(pattern.test(source), `${relativePath} must ${description}`);
  }
}

function extractFencedJavaScript(source, marker) {
  return [...source.matchAll(/```javascript\s*\n([\s\S]*?)```/g)]
    .map((match) => match[1])
    .find((block) => block.includes(marker)) ?? null;
}

function findMatchingBrace(source, openingBraceIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "/" && nextCharacter === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (["\"", "'", "`"].includes(character)) {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function getIfBlock(source, condition) {
  const start = source.indexOf(`if (${condition})`);
  if (start === -1) return null;
  const openingBrace = source.indexOf("{", start);
  if (openingBrace === -1) return null;
  const closingBrace = findMatchingBrace(source, openingBrace);
  if (closingBrace === -1) return null;
  return {
    start,
    body: source.slice(openingBrace + 1, closingBrace),
  };
}

function getFunctionBody(source, functionName) {
  const start = source.indexOf(`async function ${functionName}(`);
  if (start === -1) return null;
  const functionSignatureEnd = source.indexOf(") {", start);
  const openingBrace = functionSignatureEnd === -1 ? -1 : functionSignatureEnd + 2;
  if (openingBrace === -1) return null;
  const closingBrace = findMatchingBrace(source, openingBrace);
  return closingBrace === -1 ? null : source.slice(openingBrace + 1, closingBrace);
}

function checkFunctionBodyFixtures() {
  const destructuredParameterFixture = [
    "async function run({ situation, explicitlyRequestedModel }) {",
    "  return synthesizeBoard({ situation, explicitlyRequestedModel });",
    "}",
  ].join("\n");
  check(
    getFunctionBody(destructuredParameterFixture, "run")?.includes("return synthesizeBoard"),
    "function-body extractor must handle destructured parameters",
  );
}

function controllerTaskNameViolations(source, {
  counterName,
  dispatchFunction,
  humanNameExpression,
  loopMarker,
  prefix,
  taskNameVariable,
  waveName,
}) {
  const violations = [];
  const counterInitialization = `let ${counterName} = 0;`;
  const counterInitializationIndex = source.indexOf(counterInitialization);
  const loopIndex = source.indexOf(loopMarker);
  const assignmentPattern = new RegExp(
    `const\\s+${taskNameVariable}\\s*=\\s*\`([^\`]*)\`;`,
  );
  const assignment = source.match(assignmentPattern);
  const taskNameTemplate = assignment?.[1] ?? "";
  const renderedTemplate = taskNameTemplate
    .split(`\${${waveName}}`).join("0")
    .split(`\${${counterName}++}`).join("0");

  if (
    !taskNameTemplate ||
    renderedTemplate.includes("${") ||
    !/^[a-z0-9_]+$/.test(renderedTemplate) ||
    !taskNameTemplate.startsWith(`${prefix}_w\${${waveName}}_`)
  ) {
    violations.push("generate controller-owned task names that match ^[a-z0-9_]+$");
  }
  if (
    counterInitializationIndex === -1 ||
    loopIndex === -1 ||
    counterInitializationIndex >= loopIndex ||
    !taskNameTemplate.includes(`\${${counterName}++}`)
  ) {
    violations.push("use one monotonic dispatch index across all waves");
  }

  const dispatchBody = getFunctionBody(source, dispatchFunction);
  if (
    !source.includes(`return ${dispatchFunction}(${taskNameVariable},`) ||
    !dispatchBody?.includes(`task_name: ${taskNameVariable}`)
  ) {
    violations.push("pass the controller-owned task name to spawn_agent");
  }
  if (!dispatchBody?.includes(humanNameExpression)) {
    violations.push("keep the human task name in the worker message");
  }

  return violations;
}

function checkControllerTaskNameFixtures() {
  const validFixture = [
    "let nextWorkerDispatchIndex = 0;",
    "for (let wave = 0; wave < 5; wave++) {",
    "  const workerTaskName = `worker_w${wave}_${nextWorkerDispatchIndex++}`;",
    "  return dispatchWorker(workerTaskName, task);",
    "}",
    "async function dispatchWorker(workerTaskName, task) {",
    "  return spawn_agent({",
    "    task_name: workerTaskName,",
    "    message: `Task: ${task.name}`,",
    "  });",
    "}",
  ].join("\n");
  const fixtureOptions = {
    counterName: "nextWorkerDispatchIndex",
    dispatchFunction: "dispatchWorker",
    humanNameExpression: "${task.name}",
    loopMarker: "for (let wave = 0;",
    prefix: "worker",
    taskNameVariable: "workerTaskName",
    waveName: "wave",
  };

  const invalidNameFixture = validFixture.replace(
    "`worker_w${wave}_${nextWorkerDispatchIndex++}`",
    "`worker-${task.name}`",
  );
  check(
    controllerTaskNameViolations(invalidNameFixture, fixtureOptions).includes(
      "generate controller-owned task names that match ^[a-z0-9_]+$",
    ),
    "Codex task-name checker must reject invalid task names",
  );

  const reusedNameFixture = validFixture.replace(
    "${nextWorkerDispatchIndex++}",
    "${wave}",
  );
  check(
    controllerTaskNameViolations(reusedNameFixture, fixtureOptions).includes(
      "use one monotonic dispatch index across all waves",
    ),
    "Codex task-name checker must reject reused task names",
  );
}

function hooksConfigViolations(hooksConfig, targetExists) {
  const violations = [];
  const sessionStart = hooksConfig?.hooks?.SessionStart;

  if (!Array.isArray(sessionStart) || sessionStart.length === 0) {
    return ["define hooks.SessionStart as a non-empty array"];
  }

  for (const sessionHook of sessionStart) {
    if (!Array.isArray(sessionHook?.hooks) || sessionHook.hooks.length === 0) {
      violations.push("define each SessionStart entry with a non-empty hooks array");
      continue;
    }

    for (const commandHook of sessionHook.hooks) {
      if (
        commandHook?.type !== "command" ||
        typeof commandHook.command !== "string" ||
        typeof commandHook.timeout !== "number" ||
        commandHook.timeout <= 0
      ) {
        violations.push("define each SessionStart hook as a timed command");
        continue;
      }

      const commandMatch = commandHook.command.match(
        /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([^"]+)"$/,
      );
      if (!commandMatch || commandMatch[1] !== "activate.js") {
        violations.push("invoke the packaged hooks/activate.js target");
        continue;
      }
      if (!targetExists(commandMatch[1])) {
        violations.push("reference an existing activation target");
      }
    }
  }

  return violations;
}

function checkHooksConfigFixture() {
  const missingTargetFixture = {
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: "command",
              command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/missing.js"',
              timeout: 5,
            },
          ],
        },
      ],
    },
  };
  check(
    hooksConfigViolations(missingTargetFixture, () => false).includes(
      "invoke the packaged hooks/activate.js target",
    ),
    "hooks structural checker must reject an invalid activation target",
  );
}

function unlimitedPowerLoopViolations(loopSource) {
  const violations = [];
  const emptyPlanGuard = getIfBlock(loopSource, "plan.length === 0");
  const noCapacityGuard = getIfBlock(loopSource, "availableWorkerSlots <= 0");
  const dispatchIndex = loopSource.indexOf("batch.map(task => {");
  const accountingIndex = loopSource.indexOf("dispatched += batch.length");

  if (
    !emptyPlanGuard ||
    !emptyPlanGuard.body.includes("No runnable tasks were produced for the objective.") ||
    !/return terminate\("stalled", gap\);/.test(emptyPlanGuard?.body ?? "")
  ) {
    violations.push("keep the empty-plan stalled return inside its guard");
  }
  if (
    !noCapacityGuard ||
    !/return terminate\(\s*"stalled",\s*"No worker capacity is available; retry when a worker slot opens\."\s*\);/.test(
      noCapacityGuard?.body ?? "",
    )
  ) {
    violations.push("keep the no-capacity stalled return inside its guard");
  }
  if (
    dispatchIndex === -1 ||
    accountingIndex === -1 ||
    !emptyPlanGuard ||
    !noCapacityGuard ||
    emptyPlanGuard.start >= dispatchIndex ||
    emptyPlanGuard.start >= accountingIndex ||
    noCapacityGuard.start >= dispatchIndex ||
    noCapacityGuard.start >= accountingIndex
  ) {
    violations.push("check both guards before dispatching or consuming dispatch budget");
  }

  return violations;
}

function checkUnlimitedPowerLoopFixtures(loopSource) {
  const movedEmptyPlanReturn = loopSource
    .replace('return terminate("stalled", gap);', "")
    .replace(
      "\n\n  const remainingDispatchBudget",
      "\n\n  return terminate(\"stalled\", gap);\n\n  const remainingDispatchBudget",
    );
  check(
    unlimitedPowerLoopViolations(movedEmptyPlanReturn).includes(
      "keep the empty-plan stalled return inside its guard",
    ),
    "unlimited-power structural checker must reject an empty-plan return moved outside its guard",
  );

  const noCapacityGuard = getIfBlock(loopSource, "availableWorkerSlots <= 0");
  const noCapacityReturn = noCapacityGuard?.body.match(
    /return terminate\(\s*"stalled",\s*"No worker capacity is available; retry when a worker slot opens\."\s*\);/,
  )?.[0];
  const emptiedNoCapacityGuard = noCapacityReturn
    ? loopSource.replace(noCapacityReturn, "")
    : loopSource;
  check(
    unlimitedPowerLoopViolations(emptiedNoCapacityGuard).includes(
      "keep the no-capacity stalled return inside its guard",
    ),
    "unlimited-power structural checker must reject an emptied no-capacity guard",
  );
}

function checkExplicitModelOverrides(relativePath, source) {
  const overrides = source.match(/\bmodel:\s*[^,}\n]+/g) ?? [];
  check(
    overrides.length > 0 && overrides.every((override) => override.trim() === "model: userRequestedModel"),
    `${relativePath} must not set an implicit Codex model override`,
  );
}

function stripJavaScriptComments(source) {
  let result = "";
  let quote = null;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (quote) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (["\"", "'", "`"].includes(character)) {
      quote = character;
      result += character;
      continue;
    }
    if (character === "/" && nextCharacter === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      if (source[index] === "\n") result += "\n";
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (source[index] === "\n") result += "\n";
        index += 1;
      }
      index += 1;
      continue;
    }
    result += character;
  }

  return result;
}

function getBoundedPendingWorkerLoop(source) {
  const marker = "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline)";
  const start = source.indexOf(marker);
  if (start === -1) return null;
  const openingBrace = source.indexOf("{", start);
  if (openingBrace === -1) return null;
  const closingBrace = findMatchingBrace(source, openingBrace);
  return closingBrace === -1 ? null : { start, end: closingBrace + 1, body: source.slice(openingBrace + 1, closingBrace) };
}

function topLevelKeywordIndices(source, keyword) {
  const indices = [];
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (["\"", "'", "`"].includes(character)) {
      quote = character;
      continue;
    }
    if (character === "{") {
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      continue;
    }
    if (
      depth === 0 &&
      source.startsWith(keyword, index) &&
      !/[A-Za-z0-9_$]/.test(source[index - 1] ?? "") &&
      !/[A-Za-z0-9_$]/.test(source[index + keyword.length] ?? "")
    ) {
      indices.push(index);
      index += keyword.length - 1;
    }
  }

  return indices;
}

function collectorDeadlineViolations(source) {
  const cleanSource = stripJavaScriptComments(source);
  const pendingLoops = [...cleanSource.matchAll(
    /\bwhile\s*\(\s*pendingWorkerTasks\.size\s*>\s*0(?:\s*&&\s*Date\.now\(\)\s*<\s*collectionDeadline)?\s*\)/g,
  )];
  const hasDeadline = /const collectionDeadline = Date\.now\(\) \+ COLLECTION_TIMEOUT_MS;/.test(cleanSource);
  const boundedLoop = getBoundedPendingWorkerLoop(cleanSource);
  const hasRemainingWait = /const remainingMs = collectionDeadline - Date\.now\(\);[\s\S]*?if \(remainingMs <= 0\) break;[\s\S]*?const waitMs = Math\.max\(10_000, Math\.min\(60_000, remainingMs\)\);[\s\S]*?await wait_agent\(\{ timeout_ms: waitMs \}\);/.test(boundedLoop?.body ?? "");

  if (!hasDeadline || pendingLoops.length !== 1 || !boundedLoop || !hasRemainingWait) {
    return ["use exactly one deadline-bounded pending-worker collection loop"];
  }
  return [];
}

function timeoutDescriptionIsDerived(source) {
  return /const COLLECTION_TIMEOUT_DESCRIPTION = `\$\{COLLECTION_TIMEOUT_MS \/ 1_000\} seconds`;/.test(
    stripJavaScriptComments(source),
  );
}

function getPendingWorkerFallback(source, loop) {
  const marker = "for (const workerTask of pendingWorkerTasks)";
  const start = source.indexOf(marker, loop?.end ?? 0);
  if (start === -1) return null;
  const openingBrace = source.indexOf("{", start);
  if (openingBrace === -1) return null;
  const closingBrace = findMatchingBrace(source, openingBrace);
  return closingBrace === -1 ? null : { start, end: closingBrace + 1, body: source.slice(openingBrace + 1, closingBrace) };
}

function workerTimeoutResultViolations(source) {
  const cleanSource = stripJavaScriptComments(source);
  const loop = getBoundedPendingWorkerLoop(cleanSource);
  const fallback = getPendingWorkerFallback(cleanSource, loop);
  const topLevelReturns = topLevelKeywordIndices(cleanSource, "return");
  const returnIndex = topLevelReturns[0] ?? -1;
  const hasCompleteSchema = ["result", "done", "gap", "evidence", "confidence"].every((key) =>
    new RegExp(`\\b${key}\\s*:`).test(fallback?.body ?? ""),
  ) &&
    /\bdone\s*:\s*false\s*,/.test(fallback?.body ?? "") &&
    /\bconfidence\s*:\s*"low"\s*,/.test(fallback?.body ?? "");
  const fallbackPrecedesSoleReturn =
    topLevelReturns.length === 1 &&
    fallback !== null &&
    fallback.start > (loop?.end ?? Number.POSITIVE_INFINITY) &&
    fallback.end < returnIndex;

  return timeoutDescriptionIsDerived(cleanSource) && hasCompleteSchema && fallbackPrecedesSoleReturn
    ? []
    : ["place a complete low-confidence WORKER_SCHEMA timeout fallback before the collector's sole top-level return"];
}

function playerCollectionGapViolations(collectorSource, runSource) {
  const cleanCollector = stripJavaScriptComments(collectorSource);
  const cleanRun = stripJavaScriptComments(runSource);
  const loop = getBoundedPendingWorkerLoop(cleanCollector);
  const topLevelCollectorReturns = topLevelKeywordIndices(cleanCollector, "return");
  const collectorReturnIndex = topLevelCollectorReturns[0] ?? -1;
  const gapStart = cleanCollector.indexOf("const collectionGaps = [...pendingWorkerTasks].map", loop?.end ?? 0);
  const gapPrecedesSoleCollectorReturn =
    topLevelCollectorReturns.length === 1 &&
    gapStart > (loop?.end ?? Number.POSITIVE_INFINITY) &&
    gapStart < collectorReturnIndex &&
    /return \{ resultsByWorkerTask, collectionGaps \};/.test(cleanCollector.slice(gapStart, collectorReturnIndex + "return { resultsByWorkerTask, collectionGaps };".length));
  const invalidResponseBlock = getIfBlock(cleanCollector, "!hasExactKeys(response, PLAYER_OUTPUT_KEYS)");
  const deadlineCheckIndex = invalidResponseBlock?.body.indexOf("if (Date.now() >= collectionDeadline) break;") ?? -1;
  const followupIndex = invalidResponseBlock?.body.indexOf("await followup_task(") ?? -1;
  const checksDeadlineBeforeFollowup = deadlineCheckIndex !== -1 && followupIndex !== -1 && deadlineCheckIndex < followupIndex;
  const topLevelRunReturns = topLevelKeywordIndices(cleanRun, "return");
  const runReturnIndex = topLevelRunReturns[0] ?? -1;
  const waveGapPushIndex = cleanRun.indexOf("collectionGaps.push(...waveCollectionGaps);");
  const carriesGapsToSoleSynthesisReturn =
    topLevelRunReturns.length === 1 &&
    /const \{ resultsByWorkerTask, collectionGaps: waveCollectionGaps \} =\s*await collectCodexPlayerFinals\(workerTasks\);/.test(cleanRun) &&
    waveGapPushIndex !== -1 &&
    waveGapPushIndex < runReturnIndex &&
    /return synthesizeBoard\(\{ players, results, collectionGaps \}\);/.test(cleanRun.slice(runReturnIndex));

  return timeoutDescriptionIsDerived(cleanRun) &&
    gapPrecedesSoleCollectorReturn &&
    checksDeadlineBeforeFollowup &&
    carriesGapsToSoleSynthesisReturn
    ? []
    : ["create pending-player gaps before the collector return, guard followups by the deadline, and carry gaps to the sole synthesis return"];
}

function checkCollectorDeadlineFixtures() {
  const boundedFixture = [
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {",
    "  const remainingMs = collectionDeadline - Date.now();",
    "  if (remainingMs <= 0) break;",
    "  const waitMs = Math.max(10_000, Math.min(60_000, remainingMs));",
    "  await wait_agent({ timeout_ms: waitMs });",
    "}",
  ].join("\n");
  const replacedBoundFixture = boundedFixture.replace(
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline)",
    "while (pendingWorkerTasks.size > 0)",
  );
  const appendedUnboundedFixture = `${boundedFixture}\nwhile (pendingWorkerTasks.size > 0) { await wait_agent({ timeout_ms: 60_000 }); }`;
  for (const fixture of [replacedBoundFixture, appendedUnboundedFixture]) {
    check(
      collectorDeadlineViolations(fixture).includes(
        "use exactly one deadline-bounded pending-worker collection loop",
      ),
      "mailbox collector checker must reject every unbounded pending-worker loop",
    );
  }
}

function checkTimeoutFallbackFixtures() {
  const workerEarlyReturnFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {}",
    "return workerTasks.map((workerTask) => resultsByWorkerTask.get(workerTask));",
    "// for (const workerTask of pendingWorkerTasks) { resultsByWorkerTask.set(workerTask, { result: \"x\", done: false, gap: \"x\", evidence: \"x\", confidence: \"low\" }); }",
  ].join("\n");
  check(
    workerTimeoutResultViolations(workerEarlyReturnFixture).length > 0,
    "worker timeout checker must reject an early return with only commented fallback text",
  );

  const playerEarlyReturnFixture = [
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {",
    "  if (!hasExactKeys(response, PLAYER_OUTPUT_KEYS)) {",
    "    if (Date.now() >= collectionDeadline) break;",
    "    await followup_task({ target: workerTask });",
    "  }",
    "}",
    "return { resultsByWorkerTask, collectionGaps };",
    "// const collectionGaps = [...pendingWorkerTasks].map((workerTask) => `No final was delivered for canonical player task ${workerTask}.`);",
  ].join("\n");
  const playerRunFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "const { resultsByWorkerTask, collectionGaps: waveCollectionGaps } = await collectCodexPlayerFinals(workerTasks);",
    "collectionGaps.push(...waveCollectionGaps);",
    "return synthesizeBoard({ players, results, collectionGaps });",
  ].join("\n");
  check(
    playerCollectionGapViolations(playerEarlyReturnFixture, playerRunFixture).length > 0,
    "player timeout checker must reject an early return with only commented gap text",
  );

  const playerValidCollectorFixture = [
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {",
    "  if (!hasExactKeys(response, PLAYER_OUTPUT_KEYS)) {",
    "    if (Date.now() >= collectionDeadline) break;",
    "    await followup_task({ target: workerTask });",
    "  }",
    "}",
    "const collectionGaps = [...pendingWorkerTasks].map((workerTask) => `No final was delivered for canonical player task ${workerTask}.`);",
    "return { resultsByWorkerTask, collectionGaps };",
  ].join("\n");
  check(
    playerCollectionGapViolations(playerValidCollectorFixture, playerRunFixture).length === 0,
    "player timeout checker must accept gaps created before the collector return",
  );
  const playerRunWithoutGapCarryFixture = playerRunFixture.replace(
    "collectionGaps.push(...waveCollectionGaps);\n",
    "",
  );
  check(
    playerCollectionGapViolations(playerValidCollectorFixture, playerRunWithoutGapCarryFixture).length > 0,
    "player timeout checker must reject a synthesis return that drops collection gaps",
  );
}

const claudeManifest = readJson(".claude-plugin/plugin.json");
const codexManifest = readJson(".codex-plugin/plugin.json");
const claudeMarketplace = readJson(".claude-plugin/marketplace.json");
const codexMarketplace = readJson(".agents/plugins/marketplace.json");
const lawData = readJson("plugins/palpatine/skills/laws/references/law_index.json");
const warData = readJson("plugins/palpatine/skills/war/references/war_index.json");
const seductionData = readJson("plugins/palpatine/skills/seduce/references/seduction_index.json");
const hooksConfig = readJson("plugins/palpatine/hooks/hooks.json");

checkManifest(claudeManifest, "Claude");
checkManifest(codexManifest, "Codex");
checkFunctionBodyFixtures();
checkControllerTaskNameFixtures();
checkHooksConfigFixture();
checkCollectorDeadlineFixtures();
checkTimeoutFallbackFixtures();

if (hooksConfig) {
  for (const violation of hooksConfigViolations(
    hooksConfig,
    (target) => fs.existsSync(path.join(pluginRoot, "hooks", target)),
  )) {
    errors.push(`plugins/palpatine/hooks/hooks.json must ${violation}`);
  }
}

if (claudeManifest) {
  check(claudeManifest.hooks === "./hooks/hooks.json", "Claude manifest hooks must be ./hooks/hooks.json");
}

if (codexManifest) {
  check(codexManifest.skills === "./skills/", "Codex manifest skills must be ./skills/");
  const requiredInterfaceFields = [
    "displayName",
    "shortDescription",
    "longDescription",
    "developerName",
    "category",
    "capabilities",
    "websiteURL",
    "defaultPrompt",
    "brandColor",
  ];
  check(
    codexManifest.interface && typeof codexManifest.interface === "object",
    "Codex manifest interface is required",
  );
  for (const field of requiredInterfaceFields) {
    check(
      Object.hasOwn(codexManifest.interface ?? {}, field),
      `Codex manifest interface.${field} is required`,
    );
  }
  for (const field of ["hooks", "apps", "mcpServers"]) {
    check(!(field in codexManifest), `Codex manifest must omit ${field}`);
  }
}

const claudePlugin = findPlugin(claudeMarketplace, "Claude");
check(claudePlugin, "Claude marketplace must include palpatine");
if (claudePlugin) {
  check(claudePlugin.source === "./plugins/palpatine", "Claude marketplace source must be ./plugins/palpatine");
}

const codexPlugin = findPlugin(codexMarketplace, "Codex");
check(codexPlugin, "Codex marketplace must include palpatine");
if (codexPlugin) {
  check(
    codexPlugin.source?.path === "./plugins/palpatine",
    "Codex marketplace source path must be ./plugins/palpatine",
  );
  check(codexPlugin.policy?.installation === "AVAILABLE", "Codex installation policy must be AVAILABLE");
  check(codexPlugin.policy?.authentication === "ON_INSTALL", "Codex authentication policy must be ON_INSTALL");
  check(codexPlugin.category === "Productivity", "Codex marketplace category must be Productivity");
}

resolvesTo("skills", "plugins/palpatine/skills");
resolvesTo("hooks", "plugins/palpatine/hooks");
resolvesTo(".claude-plugin/plugin.json", "plugins/palpatine/.claude-plugin/plugin.json");
resolvesTo(".codex-plugin", "plugins/palpatine/.codex-plugin");
resolvesTo(".github/plugin/marketplace.json", ".claude-plugin/marketplace.json");
resolvesTo("law_index.json", "plugins/palpatine/skills/laws/references/law_index.json");
resolvesTo("war_index.json", "plugins/palpatine/skills/war/references/war_index.json");
resolvesTo("seduction_index.json", "plugins/palpatine/skills/seduce/references/seduction_index.json");

const skillNames = checkSkillMetadata();

for (const skillName of skillNames) {
  const skillPath = `plugins/palpatine/skills/${skillName}/SKILL.md`;
  const skill = readText(skillPath);
  check(
    skill.includes(`/palpatine:${skillName}`),
    `${skillPath} must document the Claude invocation`,
  );
  check(
    skill.includes(`$palpatine:${skillName}`),
    `${skillPath} must document the Codex invocation`,
  );
}

const adversaryPath = "plugins/palpatine/skills/adversary/SKILL.md";
const adversarySkill = readText(adversaryPath);
checkStaticContract(adversaryPath, adversarySkill, [
  ["document Codex spawn_agent dispatches", /\bspawn_agent\s*\(/],
  [
    "capture the task_name returned by spawn_agent",
    /\{\s*task_name:\s*workerTask\s*\}\s*=\s*await spawn_agent\s*\(/,
  ],
  ["set Codex fork_turns to none", /fork_turns:\s*["']none["']/],
  [
    "forward a model only when the user explicitly requested one",
    /\.\.\.\(userRequestedModel\s*\?\s*\{\s*model:\s*userRequestedModel\s*\}\s*:\s*\{\s*\}\)/,
  ],
  [
    "derive the adversary situation and model request from user input",
    /async function runMultiPartyAdversary\(\{\s*situation,\s*explicitlyRequestedModel,\s*\}\) \{[\s\S]*?const userRequestedModel = explicitlyRequestedModel;/,
  ],
  [
    "require the exact Codex player output keys",
    /\["move",\s*"alliance",\s*"threat",\s*"price",\s*"threatLevel"\]/,
  ],
  [
    "use wait_agent without an unsupported target parameter",
    /\bwait_agent\s*\(\s*\{\s*timeout_ms\s*:/,
  ],
  ["use followup_task to correct Codex workers", /\bfollowup_task\s*\(/],
  ["target followup_task with the returned worker task name", /target:\s*workerTask/],
  [
    "wait for a corrected Codex worker response after followup_task",
    /await followup_task\([\s\S]*?\);\s*correctionRequested\.add\(workerTask\);/,
  ],
  [
    "fail explicitly when a corrected Codex player response is still invalid",
    /if \(correctionRequested\.has\(workerTask\)\) \{\s*throw new Error\(/,
  ],
  [
    "collect Codex player finals in one controller mailbox loop",
    /async function collectCodexPlayerFinals\(workerTasks\)/,
  ],
  [
    "key Codex player collection by returned canonical task names",
    /const pendingWorkerTasks = new Set\(workerTasks\);/,
  ],
  [
    "consume newly delivered player finals keyed by canonical task name",
    /const deliveredFinals = readDeliveredFinals\(\);/,
  ],
  ["cap player models at five", /MAX_PLAYER_MODELS\s*=\s*5/],
  [
    "bound each Codex dispatch wave by worker capacity and the five-worker cap",
    /Math\.min\(\s*MAX_PLAYER_MODELS,\s*availableWorkerSlots,\s*remainingPlayers\.length\s*\)/s,
  ],
]);
check(
  !/\bwait_agent\s*\(\s*\{\s*target\s*:/.test(adversarySkill),
  `${adversaryPath} must not pass an unsupported target parameter to wait_agent`,
);
checkExplicitModelOverrides(adversaryPath, adversarySkill);
for (const violation of controllerTaskNameViolations(adversarySkill, {
  counterName: "nextPlayerDispatchIndex",
  dispatchFunction: "dispatchCodexPlayer",
  humanNameExpression: "${player.name}",
  loopMarker: "while (remainingPlayers.length > 0)",
  prefix: "player",
  taskNameVariable: "workerTaskName",
  waveName: "waveIndex",
})) {
  errors.push(`${adversaryPath} must ${violation}`);
}
const adversaryDispatchBody = getFunctionBody(adversarySkill, "dispatchCodexPlayer");
const adversaryCollectorBody = getFunctionBody(adversarySkill, "collectCodexPlayerFinals");
const adversaryRunBody = getFunctionBody(adversarySkill, "runMultiPartyAdversary");
check(
  !adversaryDispatchBody?.includes("wait_agent"),
  `${adversaryPath} must not wait per player while a wave dispatches`,
);
for (const violation of collectorDeadlineViolations(adversaryCollectorBody ?? "")) {
  errors.push(`${adversaryPath} must ${violation}`);
}
for (const violation of playerCollectionGapViolations(adversaryCollectorBody ?? "", adversaryRunBody ?? "")) {
  errors.push(`${adversaryPath} must ${violation}`);
}
check(
  adversaryCollectorBody?.includes("for (const [workerTask, response] of deliveredFinals)") &&
    !adversaryCollectorBody.includes("readDeliveredFinal("),
  `${adversaryPath} must consume newly delivered player finals in its controller loop`,
);

const unlimitedPowerPath = "plugins/palpatine/skills/unlimited-power/SKILL.md";
const unlimitedPowerSkill = readText(unlimitedPowerPath);
checkStaticContract(unlimitedPowerPath, unlimitedPowerSkill, [
  ["bound orchestration waves with BUDGET.maxWidth", /BUDGET\.maxWidth/],
  [
    "combine BUDGET.maxWidth, available worker slots, and remaining dispatch budget",
    /Math\.min\(\s*BUDGET\.maxWidth,\s*availableWorkerSlots,\s*remainingDispatchBudget\s*\)/s,
  ],
  ["document a Codex spawn_agent adapter", /\bspawn_agent\s*\(/],
  [
    "capture the task_name returned by spawn_agent",
    /\{\s*task_name:\s*workerTask\s*\}\s*=\s*await spawn_agent\s*\(/,
  ],
  ["set Codex fork_turns to none", /fork_turns:\s*["']none["']/],
  [
    "forward a Codex model only when the user explicitly requested one",
    /\.\.\.\(userRequestedModel\s*\?\s*\{\s*model:\s*userRequestedModel\s*\}\s*:\s*\{\s*\}\)/,
  ],
  [
    "use wait_agent without an unsupported target parameter",
    /\bwait_agent\s*\(\s*\{\s*timeout_ms\s*:/,
  ],
  ["explain that wait_agent returns a mailbox update rather than the worker payload", /wait_agent` signals a mailbox update/],
  ["pass an explicit user-requested model through the dispatch loop", /dispatchWorker\(workerTaskName, task, done, userRequestedModel\)/],
  ["collect Codex worker finals in one controller mailbox loop", /async function collectCodexWorkerFinals\(workerTasks\)/],
  ["key Codex worker collection by returned canonical task names", /const pendingWorkerTasks = new Set\(workerTasks\);/],
  ["consume newly delivered worker finals keyed by canonical task name", /const deliveredFinals = readDeliveredFinals\(\);/],
]);
const unlimitedPowerLoop = extractFencedJavaScript(unlimitedPowerSkill, "defineAcceptanceCheck");
check(
  unlimitedPowerLoop !== null,
  `${unlimitedPowerPath} must document the unlimited-power orchestration loop`,
);
if (unlimitedPowerLoop) {
  for (const violation of unlimitedPowerLoopViolations(unlimitedPowerLoop)) {
    errors.push(`${unlimitedPowerPath} must ${violation}`);
  }
  checkUnlimitedPowerLoopFixtures(unlimitedPowerLoop);
}
check(
  !/\bwait_agent\s*\(\s*\{\s*target\s*:/.test(unlimitedPowerSkill),
  `${unlimitedPowerPath} must not pass an unsupported target parameter to wait_agent`,
);
checkExplicitModelOverrides(unlimitedPowerPath, unlimitedPowerSkill);
for (const violation of controllerTaskNameViolations(unlimitedPowerSkill, {
  counterName: "nextWorkerDispatchIndex",
  dispatchFunction: "dispatchWorker",
  humanNameExpression: "${task.name}",
  loopMarker: "for (let wave = 0;",
  prefix: "worker",
  taskNameVariable: "workerTaskName",
  waveName: "wave",
})) {
  errors.push(`${unlimitedPowerPath} must ${violation}`);
}
const unlimitedPowerDispatchBody = getFunctionBody(unlimitedPowerSkill, "dispatchWorker");
const unlimitedPowerCollectorBody = getFunctionBody(unlimitedPowerSkill, "collectCodexWorkerFinals");
check(
  !unlimitedPowerDispatchBody?.includes("wait_agent"),
  `${unlimitedPowerPath} must not wait per worker while a wave dispatches`,
);
for (const violation of collectorDeadlineViolations(unlimitedPowerCollectorBody ?? "")) {
  errors.push(`${unlimitedPowerPath} must ${violation}`);
}
for (const violation of workerTimeoutResultViolations(unlimitedPowerCollectorBody ?? "")) {
  errors.push(`${unlimitedPowerPath} must ${violation}`);
}
check(
  unlimitedPowerCollectorBody?.includes("for (const [workerTask, response] of deliveredFinals)") &&
    !unlimitedPowerCollectorBody.includes("readDeliveredFinal("),
  `${unlimitedPowerPath} must consume newly delivered worker finals in its controller loop`,
);

const palpatinePath = "plugins/palpatine/skills/palpatine/SKILL.md";
const palpatineSkill = readText(palpatinePath);
checkStaticContract(palpatinePath, palpatineSkill, [
  [
    "explain that Claude Code and Codex intentionally share ~/.claude/palpatine-enabled",
    /Claude Code and Codex intentionally share `~\/\.claude\/palpatine-enabled`/,
  ],
  [
    "frame legal, consent, retaliation, and material-harm risks contextually",
    /legal, consent, retaliation, or material harm/i,
  ],
  [
    "create the shared always-on state directory before the POSIX file",
    /mkdir -p ~\/\.claude && touch ~\/\.claude\/palpatine-enabled/,
  ],
  [
    "make the POSIX always-on removal idempotent",
    /rm -f ~\/\.claude\/palpatine-enabled/,
  ],
  [
    "create the shared always-on state directory and file in PowerShell",
    /New-Item -ItemType Directory -Force[\s\S]*?New-Item -ItemType File -Force/,
  ],
  [
    "make the PowerShell always-on removal idempotent",
    /Remove-Item -Force -ErrorAction SilentlyContinue/,
  ],
]);

const readme = readText("README.md");
check(
  !readme.includes("`/palpatine` takes"),
  "README overview must not imply an unnamespaced /palpatine invocation",
);
check(
  readme.includes("Node.js must be installed and available as `node` on `PATH`") &&
    readme.includes("node --version"),
  "README must declare and show how to validate the Node.js hook prerequisite",
);
const readmeBashBlocks = [...readme.matchAll(/```bash\s*\n([\s\S]*?)```/g)]
  .map((match) => match[1]);
check(
  readmeBashBlocks.every((block) => !block.includes("/plugin ")),
  "README must not put Claude Code in-app slash commands in a bash block",
);
for (const command of [
  "/palpatine:palpatine on",
  "/palpatine:palpatine off",
  "$palpatine:palpatine on",
  "$palpatine:palpatine off",
]) {
  check(readme.includes(command), `README must document ${command}`);
}

const contributing = readText("CONTRIBUTING.md");
const developerModeIndex = contributing.indexOf("Developer Mode");
const globalSymlinkConfigIndex = contributing.indexOf(
  "git config --global core.symlinks true",
);
const cloneIndex = contributing.indexOf("git clone");
check(
  developerModeIndex !== -1 &&
    globalSymlinkConfigIndex !== -1 &&
    cloneIndex !== -1 &&
    developerModeIndex < cloneIndex &&
    globalSymlinkConfigIndex < cloneIndex,
  "CONTRIBUTING must document Windows true-symlink prerequisites before cloning",
);
check(
  contributing.includes("git reset --hard HEAD") &&
    /commit or stash/i.test(contributing),
  "CONTRIBUTING must document safe existing-clone symlink recovery",
);

const activationHook = readText("plugins/palpatine/hooks/activate.js");
for (const command of [
  "/palpatine:palpatine off",
  "$palpatine:palpatine off",
]) {
  check(activationHook.includes(command), `activate.js must document ${command}`);
}

const packagedTextFiles = [
  path.join(root, "README.md"),
  ...listFiles(pluginRoot).filter((file) =>
    [".js", ".json", ".md", ".yaml", ".yml"].includes(path.extname(file)),
  ),
];
for (const absolutePath of packagedTextFiles) {
  const contents = fs.readFileSync(absolutePath, "utf8");
  check(
    !/(?:\/palpatine|\$palpatine)\s+(?:on|off)\b/.test(contents),
    `${path.relative(root, absolutePath)} must use namespaced always-on commands`,
  );
}

if (lawData) check(lawData.laws?.length === 48, "Law data must contain 48 laws");
if (warData) check(warData.strategies?.length === 33, "War data must contain 33 strategies");
if (seductionData) {
  check(seductionData.seducer_types?.length === 9, "Seduction data must contain 9 types");
  check(countSteps(seductionData) === 24, "Seduction data must contain 24 total steps");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Compatibility validation passed.");
