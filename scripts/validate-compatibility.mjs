import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

function fencedJavaScriptBlocks(source) {
  return [...source.matchAll(/```javascript\s*\n([\s\S]*?)```/g)]
    .map((match) => match[1]);
}

function javaScriptSyntaxError(source) {
  // --check parses stdin as an ES module and never evaluates the Markdown code.
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--check", "-"],
    {
      input: source,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.status === 0) return null;
  const diagnostic = (result.stderr || result.error?.message || "syntax check failed")
    .split("\n")
    .find((line) => line.trim().length > 0);
  return diagnostic ?? "syntax check failed";
}

function extractFencedJavaScript(source, marker) {
  const block = fencedJavaScriptBlocks(source)
    .find((candidate) => candidate.includes(marker)) ?? null;
  return block !== null && javaScriptSyntaxError(block) === null ? block : null;
}

function checkFencedJavaScriptSyntax(relativePath, source) {
  fencedJavaScriptBlocks(source).forEach((block, index) => {
    const syntaxError = javaScriptSyntaxError(block);
    check(
      syntaxError === null,
      `${relativePath} JavaScript fence ${index + 1} must parse without execution: ${syntaxError}`,
    );
  });
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

function getFunctionBodyAt(source, start) {
  const functionSignatureEnd = source.indexOf(") {", start);
  const openingBrace = functionSignatureEnd === -1 ? -1 : functionSignatureEnd + 2;
  if (openingBrace === -1) return null;
  const closingBrace = findMatchingBrace(source, openingBrace);
  return closingBrace === -1 ? null : source.slice(openingBrace + 1, closingBrace);
}

function getFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  return start === -1 ? null : getFunctionBodyAt(source, start);
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
  const malformedFenceFixture = "```javascript\nconst broken = ;\n```";
  check(
    extractFencedJavaScript(malformedFenceFixture, "broken") === null,
    "JavaScript fence extractor must reject malformed JavaScript without evaluating it",
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
    .split("${runComponent}").join("r0")
    .split(`\${${waveName}}`).join("0")
    .split(`\${${counterName}++}`).join("0");
  const initialSnapshot = "const initialAgentSnapshot = await list_agents({});";
  const runComponentAssignment =
    `const runComponent = chooseUnusedRunComponent(initialAgentSnapshot.agents, "${prefix}");`;
  const initialSnapshotIndex = source.indexOf(initialSnapshot);
  const runComponentIndex = source.indexOf(runComponentAssignment);

  if (
    !taskNameTemplate ||
    renderedTemplate.includes("${") ||
    !/^[a-z0-9_]+$/.test(renderedTemplate) ||
    !taskNameTemplate.startsWith(`${prefix}_\${runComponent}_w\${${waveName}}_`)
  ) {
    violations.push("generate controller-owned task names that match ^[a-z0-9_]+$");
  }
  if (
    initialSnapshotIndex === -1 ||
    runComponentIndex === -1 ||
    initialSnapshotIndex >= runComponentIndex ||
    runComponentIndex >= loopIndex ||
    !taskNameTemplate.includes("${runComponent}")
  ) {
    violations.push("derive an unused run component from list_agents for cross-invocation uniqueness");
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
  check(
    controllerTaskNameViolations(validFixture, fixtureOptions).includes(
      "derive an unused run component from list_agents for cross-invocation uniqueness",
    ),
    "Codex task-name checker must reject names reused by a later invocation",
  );
  const collisionSafeFixture = [
    "const initialAgentSnapshot = await list_agents({});",
    'const runComponent = chooseUnusedRunComponent(initialAgentSnapshot.agents, "worker");',
    "let nextWorkerDispatchIndex = 0;",
    "for (let wave = 0; wave < 5; wave++) {",
    "  const workerTaskName = `worker_${runComponent}_w${wave}_${nextWorkerDispatchIndex++}`;",
    "  return dispatchWorker(workerTaskName, task);",
    "}",
    "async function dispatchWorker(workerTaskName, task) {",
    "  return spawn_agent({",
    "    task_name: workerTaskName,",
    "    message: `Task: ${task.name}`,",
    "  });",
    "}",
  ].join("\n");
  check(
    controllerTaskNameViolations(collisionSafeFixture, fixtureOptions).length === 0,
    "Codex task-name checker must accept an unused list_agents-derived run component",
  );

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
  const cleanSource = stripJavaScriptComments(source);
  const overrides = cleanSource.match(/\bmodel:\s*[^,}\n]+/g) ?? [];
  const assignments = [
    ...cleanSource.matchAll(
      /\b(?:const|let|var)\s+userRequestedModel\s*=\s*([^;]+);/g,
    ),
  ].map((match) => match[1].trim());
  const assignmentOperators =
    cleanSource.match(/\buserRequestedModel\s*(?:=(?!=)|\|\|=|&&=|\?\?=)/g) ?? [];
  check(
    overrides.length > 0 &&
      overrides.every((override) => override.trim() === "model: userRequestedModel") &&
      assignments.length === 1 &&
      assignments[0] === "explicitlyRequestedModel" &&
      assignmentOperators.length === 1,
    `${relativePath} must not set an implicit Codex model override`,
  );
}

function checkExplicitModelOverrideFixtures() {
  const forcedModelWithDeadDecoy = [
    "async function run({ explicitlyRequestedModel }) {",
    "  if (false) { const userRequestedModel = explicitlyRequestedModel; }",
    '  const userRequestedModel = "forced-model";',
    "  return spawn_agent({",
    "    ...(userRequestedModel ? { model: userRequestedModel } : {}),",
    "  });",
    "}",
  ].join("\n");
  const previousErrorCount = errors.length;
  checkExplicitModelOverrides("forced-model fixture", forcedModelWithDeadDecoy);
  const fixturePassed = errors.length === previousErrorCount;
  errors.splice(previousErrorCount);
  check(
    !fixturePassed,
    "explicit-model checker must reject a forced model with a dead explicit-assignment decoy",
  );
}

function codexAgentConsumesSlot(agent) {
  const status = agent.agent_status;
  if (["pending", "running", "working"].includes(status)) return true;
  return status !== null &&
    typeof status === "object" &&
    !Object.prototype.hasOwnProperty.call(status, "completed");
}

function fixtureAvailableCodexWorkerSlots(agents) {
  return Math.max(0, 4 - agents.filter(codexAgentConsumesSlot).length);
}

function codexCapacityHelperViolations(source) {
  const fencedBlocks = [
    ...source.matchAll(/```javascript[^\S\r\n]*\r?\n([\s\S]*?)```/g),
  ].map((match) => match[1]);
  const analysisSource = fencedBlocks.length > 0 ? fencedBlocks.join("\n") : source;
  const cleanSource = stripJavaScriptComments(analysisSource);
  const searchableSource = stripJavaScriptComments(analysisSource, {
    maskLiterals: true,
  });
  const functionStarts = (functionName) => [
    ...searchableSource.matchAll(
      new RegExp(`\\bfunction\\s+${functionName}\\s*\\(`, "g"),
    ),
  ].map((match) => match.index);
  const classifierDefinitions = functionStarts("agentConsumesCodexSlot");
  const capacityDefinitions = functionStarts("availableCodexWorkerSlots");
  const classifierBody = classifierDefinitions.length === 1
    ? getFunctionBodyAt(cleanSource, classifierDefinitions[0])
    : null;
  const capacityBody = capacityDefinitions.length === 1
    ? getFunctionBodyAt(cleanSource, capacityDefinitions[0])
    : null;
  const hasCanonicalClassifier =
    classifierDefinitions.length === 1 &&
    /^\s*const status = agent\.agent_status;\s*if \(\["pending", "running", "working"\]\.includes\(status\)\) return true;\s*return status !== null &&\s*typeof status === "object" &&\s*!Object\.prototype\.hasOwnProperty\.call\(status, "completed"\);\s*$/s.test(
      classifierBody ?? "",
    );
  const hasCanonicalCapacityHelper =
    capacityDefinitions.length === 1 &&
    /^\s*const activeAgentCount = agents\.filter\(agentConsumesCodexSlot\)\.length;\s*return Math\.max\(0, CODEX_TEAM_SLOT_LIMIT - activeAgentCount\);\s*$/s.test(
      capacityBody ?? "",
    );
  return hasCanonicalClassifier && hasCanonicalCapacityHelper
    ? []
    : ["count active string statuses and every non-completed object status against the four-slot Codex limit"];
}

function checkCodexCapacityFixtures() {
  const observedStatusFixture = [
    { agent_name: "/root", agent_status: "running" },
    { agent_name: "/root/worker", agent_status: "running" },
    {
      agent_name: "/root/done",
      agent_status: { completed: "finished" },
    },
  ];
  check(
    fixtureAvailableCodexWorkerSlots(observedStatusFixture) === 2,
    "Codex capacity fixture must count root and running workers but not completed agents",
  );
  const objectStatusFixture = [
    { agent_name: "/root", agent_status: "running" },
    { agent_name: "/root/queued", agent_status: { pending: true } },
    {
      agent_name: "/root/done",
      agent_status: { completed: "finished" },
    },
  ];
  check(
    fixtureAvailableCodexWorkerSlots(objectStatusFixture) === 2,
    "Codex capacity fixture must count non-completed object statuses",
  );
  const completedPropertyFixture = [
    { agent_name: "/root", agent_status: "running" },
    {
      agent_name: "/root/done",
      agent_status: { completed: undefined },
    },
  ];
  check(
    fixtureAvailableCodexWorkerSlots(completedPropertyFixture) === 3,
    "Codex capacity fixture must exclude every object carrying a completed property",
  );
  const incompleteHelperFixture = [
    "function availableCodexWorkerSlots(agents) {",
    "  const activeAgentCount = agents.filter((agent) =>",
    '    ["pending", "running", "working"].includes(agent.agent_status)',
    "  ).length;",
    "  return Math.max(0, CODEX_TEAM_SLOT_LIMIT - activeAgentCount);",
    "}",
  ].join("\n");
  check(
    codexCapacityHelperViolations(incompleteHelperFixture).length > 0,
    "Codex capacity checker must reject helpers that ignore non-completed object statuses",
  );
  const deadDecoyCapacityFixture = [
    "function agentConsumesCodexSlot(agent) {",
    "  if (false) {",
    "    const status = agent.agent_status;",
    '    if (["pending", "running", "working"].includes(status)) return true;',
    '    return status !== null && typeof status === "object" && typeof status.completed !== "string";',
    "  }",
    "  return false;",
    "}",
    "function availableCodexWorkerSlots(agents) {",
    "  void agents.filter(agentConsumesCodexSlot).length;",
    "  return 4;",
    "}",
  ].join("\n");
  check(
    codexCapacityHelperViolations(deadDecoyCapacityFixture).length > 0,
    "Codex capacity checker must reject dead classifier and capacity decoys",
  );
  const deadStringCapacityFixture = [
    "const documentationOnly = `",
    "function agentConsumesCodexSlot(agent) {",
    "  const status = agent.agent_status;",
    '  if (["pending", "running", "working"].includes(status)) return true;',
    "  return status !== null &&",
    '    typeof status === "object" &&',
    '    !Object.prototype.hasOwnProperty.call(status, "completed");',
    "}",
    "function availableCodexWorkerSlots(agents) {",
    "  const activeAgentCount = agents.filter(agentConsumesCodexSlot).length;",
    "  return Math.max(0, CODEX_TEAM_SLOT_LIMIT - activeAgentCount);",
    "}",
    "`;",
  ].join("\n");
  check(
    codexCapacityHelperViolations(deadStringCapacityFixture).length > 0,
    "Codex capacity checker must reject canonical helpers hidden inside string literals",
  );
  const canonicalCapacityFixture = [
    "function agentConsumesCodexSlot(agent) {",
    "  const status = agent.agent_status;",
    '  if (["pending", "running", "working"].includes(status)) return true;',
    "  return status !== null &&",
    '    typeof status === "object" &&',
    '    !Object.prototype.hasOwnProperty.call(status, "completed");',
    "}",
    "function availableCodexWorkerSlots(agents) {",
    "  const activeAgentCount = agents.filter(agentConsumesCodexSlot).length;",
    "  return Math.max(0, CODEX_TEAM_SLOT_LIMIT - activeAgentCount);",
    "}",
  ].join("\n");
  check(
    codexCapacityHelperViolations(canonicalCapacityFixture).length === 0,
    "Codex capacity checker must accept the canonical active-versus-completed classifier",
  );
}

function stripJavaScriptComments(source, { maskLiterals = false } = {}) {
  let result = "";
  let index = 0;
  let canStartRegex = true;
  let pendingControlParenthesis = false;
  let functionHeaderKind = null;
  let pendingAsyncFunctionDeclaration = false;
  let previousToken = "start";
  const parenthesisStack = [];
  const braceStack = [];
  const controlHeadKeywords = new Set(["catch", "for", "if", "switch", "while", "with"]);
  const blockPrefixKeywords = new Set(["do", "else", "finally", "try"]);
  const functionDeclarationContexts = new Set([
    "block-close",
    "block-opening",
    "block-prefix",
    "control-close",
    "start",
    "statement-start",
  ]);
  const expressionPrefixKeywords = new Set([
    "await",
    "case",
    "delete",
    "do",
    "else",
    "in",
    "instanceof",
    "new",
    "of",
    "return",
    "throw",
    "typeof",
    "void",
    "yield",
  ]);
  const isIdentifierStart = (character) => /[A-Za-z_$]/.test(character ?? "");
  const isIdentifierPart = (character) => /[A-Za-z0-9_$]/.test(character ?? "");
  const isLineTerminator = (character) =>
    ["\n", "\r", "\u2028", "\u2029"].includes(character);

  while (index < source.length) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (/\s/.test(character)) {
      result += character;
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      index += 2;
      while (index < source.length && !isLineTerminator(source[index])) index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        if (isLineTerminator(source[index])) result += source[index];
        index += 1;
      }
      if (index < source.length) index += 2;
      continue;
    }

    if (["\"", "'", "`"].includes(character)) {
      const quote = character;
      let escaped = false;
      result += maskLiterals ? " " : character;
      index += 1;
      while (index < source.length) {
        const quotedCharacter = source[index];
        result += maskLiterals && !isLineTerminator(quotedCharacter)
          ? " "
          : quotedCharacter;
        index += 1;
        if (escaped) {
          escaped = false;
        } else if (quotedCharacter === "\\") {
          escaped = true;
        } else if (quotedCharacter === quote) {
          break;
        }
      }
      canStartRegex = false;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "operand";
      continue;
    }

    if (isIdentifierStart(character)) {
      const identifierStart = index;
      index += 1;
      while (isIdentifierPart(source[index])) index += 1;
      const identifier = source.slice(identifierStart, index);
      result += identifier;
      const isProperty = previousToken === "dot";
      const isFunctionKeyword = !isProperty && identifier === "function";
      if (isFunctionKeyword) {
        functionHeaderKind =
          pendingAsyncFunctionDeclaration ||
          functionDeclarationContexts.has(previousToken)
            ? "function-declaration"
            : "function-expression";
      } else if (functionHeaderKind === null) {
        functionHeaderKind = null;
      }
      pendingAsyncFunctionDeclaration =
        !isProperty &&
        identifier === "async" &&
        functionDeclarationContexts.has(previousToken);
      pendingControlParenthesis =
        !isProperty && controlHeadKeywords.has(identifier);
      canStartRegex =
        !isProperty &&
        (pendingControlParenthesis || expressionPrefixKeywords.has(identifier));
      previousToken = isFunctionKeyword
        ? "function-keyword"
        : !isProperty && blockPrefixKeywords.has(identifier)
          ? "block-prefix"
          : canStartRegex
            ? "prefix"
            : "operand";
      continue;
    }

    if (/[0-9]/.test(character)) {
      const numberStart = index;
      index += 1;
      while (/[A-Za-z0-9_.]/.test(source[index] ?? "")) index += 1;
      result += source.slice(numberStart, index);
      canStartRegex = false;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "operand";
      continue;
    }

    if (character === "/" && canStartRegex) {
      let escaped = false;
      let inCharacterClass = false;
      result += maskLiterals ? " " : character;
      index += 1;
      while (index < source.length) {
        const regexCharacter = source[index];
        result += maskLiterals && !isLineTerminator(regexCharacter)
          ? " "
          : regexCharacter;
        index += 1;
        if (escaped) {
          escaped = false;
        } else if (regexCharacter === "\\") {
          escaped = true;
        } else if (regexCharacter === "[" && !inCharacterClass) {
          inCharacterClass = true;
        } else if (regexCharacter === "]" && inCharacterClass) {
          inCharacterClass = false;
        } else if (regexCharacter === "/" && !inCharacterClass) {
          break;
        } else if (isLineTerminator(regexCharacter)) {
          break;
        }
      }
      while (/[A-Za-z]/.test(source[index] ?? "")) {
        result += maskLiterals ? " " : source[index];
        index += 1;
      }
      canStartRegex = false;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "operand";
      continue;
    }

    if (character === "/") {
      result += character;
      index += 1;
      if (source[index] === "=") {
        result += source[index];
        index += 1;
      }
      canStartRegex = true;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "operator";
      continue;
    }

    if (character === "(") {
      const parenthesisKind = pendingControlParenthesis
        ? "control"
        : functionHeaderKind ?? "ordinary";
      parenthesisStack.push(parenthesisKind);
      result += character;
      index += 1;
      canStartRegex = true;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "paren-opening";
      continue;
    }

    if (character === ")") {
      const parenthesisKind = parenthesisStack.pop() ?? "ordinary";
      result += character;
      index += 1;
      canStartRegex = parenthesisKind !== "ordinary";
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = parenthesisKind === "control"
        ? "control-close"
        : parenthesisKind === "function-declaration"
          ? "function-declaration-close"
          : parenthesisKind === "function-expression"
            ? "function-expression-close"
            : "operand";
      continue;
    }

    if (character === "[") {
      result += character;
      index += 1;
      canStartRegex = true;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "bracket-opening";
      continue;
    }

    if (character === "]") {
      result += character;
      index += 1;
      canStartRegex = false;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "operand";
      continue;
    }

    if (character === "{") {
      const isFunctionBody = [
        "function-declaration-close",
        "function-expression-close",
      ].includes(previousToken);
      const isStatementBlock = [
        "block-close",
        "block-prefix",
        "control-close",
        "function-declaration-close",
        "start",
        "statement-start",
      ].includes(previousToken);
      braceStack.push(isStatementBlock);
      result += character;
      index += 1;
      canStartRegex = true;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = isStatementBlock || isFunctionBody
        ? "block-opening"
        : "object-opening";
      continue;
    }

    if (character === "}") {
      const closesStatementBlock = braceStack.pop() ?? false;
      result += character;
      index += 1;
      canStartRegex = closesStatementBlock;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = closesStatementBlock ? "block-close" : "operand";
      continue;
    }

    if (character === "." || (character === "?" && nextCharacter === ".")) {
      result += character;
      index += 1;
      if (character === "?") {
        result += source[index];
        index += 1;
      }
      canStartRegex = false;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "dot";
      continue;
    }

    if (
      (character === "+" && nextCharacter === "+") ||
      (character === "-" && nextCharacter === "-")
    ) {
      result += `${character}${nextCharacter}`;
      index += 2;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = canStartRegex ? "operator" : "operand";
      continue;
    }

    if (character === ";") {
      result += character;
      index += 1;
      canStartRegex = true;
      pendingControlParenthesis = false;
      functionHeaderKind = null;
      pendingAsyncFunctionDeclaration = false;
      previousToken = "statement-start";
      continue;
    }

    if ([",", ":", "?"].includes(character) || /[=+\-*%&|^!~<>]/.test(character)) {
      result += character;
      index += 1;
      canStartRegex = true;
      pendingControlParenthesis = false;
      if (!(character === "*" && functionHeaderKind !== null)) {
        functionHeaderKind = null;
      }
      pendingAsyncFunctionDeclaration = false;
      previousToken = "operator";
      continue;
    }

    result += character;
    index += 1;
    pendingControlParenthesis = false;
    functionHeaderKind = null;
    pendingAsyncFunctionDeclaration = false;
    previousToken = "other";
  }

  return result;
}

function checkJavaScriptCommentStrippingFixtures() {
  const regexCommentMarkers = [
    "const lineMarker = /[//]/;",
    "const blockMarker = /[/*]/;",
  ].join("\n");
  check(
    stripJavaScriptComments(regexCommentMarkers) === regexCommentMarkers,
    "comment stripper must preserve // and /* inside regex character classes",
  );

  const escapedRegexAndClass = String.raw`const escaped = /https?:\/\/example\.com/;
const slashes = /[/][/]/;
const escapedSlash = /a\/b[/*]/;`;
  check(
    stripJavaScriptComments(escapedRegexAndClass) === escapedRegexAndClass,
    "comment stripper must preserve escaped slashes and regex character classes",
  );

  const divisionAndComments = [
    "const quotient = total / divisor; // remove line comment",
    "const ratio = quotient /* remove block comment */ / scale;",
  ].join("\n");
  const expectedDivision = [
    "const quotient = total / divisor; ",
    "const ratio = quotient  / scale;",
  ].join("\n");
  check(
    stripJavaScriptComments(divisionAndComments) === expectedDivision,
    "comment stripper must distinguish division from regex starts while removing real comments",
  );

  const slashContext = [
    "const direct = /[//]/giu;",
    "function pick() { return /[/*]/; }",
    "if (ready) /[//]/.test(value);",
    "const quotient = total / divisor;",
    "const callDivision = fn() / divisor;",
    "const objectDivision = ({}) / divisor;",
    "const mixed = total / /[/*]/.test(value);",
    "assigned /= divisor; // tail",
    "const tail = /[/*]/; /* block */",
  ].join("\n");
  const expectedSlashContext = [
    "const direct = /[//]/giu;",
    "function pick() { return /[/*]/; }",
    "if (ready) /[//]/.test(value);",
    "const quotient = total / divisor;",
    "const callDivision = fn() / divisor;",
    "const objectDivision = ({}) / divisor;",
    "const mixed = total / /[/*]/.test(value);",
    "assigned /= divisor; ",
    "const tail = /[/*]/; ",
  ].join("\n");
  check(
    stripJavaScriptComments(slashContext) === expectedSlashContext,
    "comment stripper must classify regex and division from token context",
  );

  const controlBlockThenRegex =
    "if (ready) {} /[/*]/.test(value); // remove tail";
  check(
    stripJavaScriptComments(controlBlockThenRegex) ===
      "if (ready) {} /[/*]/.test(value); ",
    "comment stripper must preserve regex expression statements after control blocks",
  );

  const functionBlockThenRegex =
    "function pick() {} /[//]/.test(value); // remove tail";
  check(
    stripJavaScriptComments(functionBlockThenRegex) ===
      "function pick() {} /[//]/.test(value); ",
    "comment stripper must preserve regex expression statements after function blocks",
  );

  const functionExpressionDivision =
    "const quotient = function () {} / divisor; // remove tail";
  check(
    stripJavaScriptComments(functionExpressionDivision) ===
      "const quotient = function () {} / divisor; ",
    "comment stripper must keep division after function expressions",
  );
}

function findMatchingDelimiter(source, openingIndex, openingDelimiter, closingDelimiter) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openingIndex; index < source.length; index += 1) {
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
    if (character === openingDelimiter) depth += 1;
    if (character === closingDelimiter) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function getJavaScriptWhileLoops(source) {
  const loops = [];
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
    if (
      !source.startsWith("while", index) ||
      /[A-Za-z0-9_$]/.test(source[index - 1] ?? "") ||
      /[A-Za-z0-9_$]/.test(source[index + "while".length] ?? "")
    ) {
      continue;
    }

    let openingParenthesis = index + "while".length;
    while (/\s/.test(source[openingParenthesis] ?? "")) openingParenthesis += 1;
    if (source[openingParenthesis] !== "(") continue;
    const closingParenthesis = findMatchingDelimiter(source, openingParenthesis, "(", ")");
    if (closingParenthesis === -1) continue;
    let openingBrace = closingParenthesis + 1;
    while (/\s/.test(source[openingBrace] ?? "")) openingBrace += 1;
    const closingBrace = source[openingBrace] === "{"
      ? findMatchingDelimiter(source, openingBrace, "{", "}")
      : -1;
    const normalizedCondition = source
      .slice(openingParenthesis + 1, closingParenthesis)
      .replace(/\s+/g, "")
      .replace(/pendingWorkerTasks\[(?:"size"|'size'|`size`)\]/g, "pendingWorkerTasks.size")
      .replace(/pendingWorkerTasks\?\.size/g, "pendingWorkerTasks.size");
    loops.push({
      start: index,
      condition: source.slice(openingParenthesis + 1, closingParenthesis),
      normalizedCondition,
      body: closingBrace === -1 ? null : source.slice(openingBrace + 1, closingBrace),
      bodyStart: closingBrace === -1 ? -1 : openingBrace + 1,
      end: closingBrace === -1 ? closingParenthesis + 1 : closingBrace + 1,
    });
    index = closingParenthesis;
  }

  return loops;
}

function getBoundedPendingWorkerLoop(source) {
  return getJavaScriptWhileLoops(source).find(
    (loop) => loop.normalizedCondition === "pendingWorkerTasks.size>0&&Date.now()<collectionDeadline",
  ) ?? null;
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
  const pendingLoops = getJavaScriptWhileLoops(cleanSource).filter(
    (loop) => loop.normalizedCondition.includes("pendingWorkerTasks.size"),
  );
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

function isDirectStatementStart(source, start) {
  const precedingSource = source.slice(0, start).trimEnd();
  return precedingSource.length === 0 || [";", "}"].includes(precedingSource.at(-1));
}

function getPendingWorkerFallback(source, loop) {
  const marker = "for (const workerTask of pendingWorkerTasks)";
  const starts = topLevelKeywordIndices(source, "for").filter(
    (start) => start > (loop?.end ?? Number.POSITIVE_INFINITY) && source.startsWith(marker, start),
  );
  const start = starts[0] ?? -1;
  if (
    starts.length !== 1 ||
    start === -1 ||
    !isDirectStatementStart(source, start)
  ) {
    return null;
  }
  const openingBrace = source.indexOf("{", start);
  if (openingBrace === -1) return null;
  const closingBrace = findMatchingDelimiter(source, openingBrace, "{", "}");
  return closingBrace === -1 ? null : { start, end: closingBrace + 1, body: source.slice(openingBrace + 1, closingBrace) };
}

function topLevelObjectProperties(source) {
  const segments = [];
  let segmentStart = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenthesisDepth = 0;
  let quote = null;
  let escaped = false;

  for (let index = 0; index <= source.length; index += 1) {
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
    if (character === "{") braceDepth += 1;
    if (character === "}") braceDepth -= 1;
    if (character === "[") bracketDepth += 1;
    if (character === "]") bracketDepth -= 1;
    if (character === "(") parenthesisDepth += 1;
    if (character === ")") parenthesisDepth -= 1;

    const atTopLevel =
      braceDepth === 0 &&
      bracketDepth === 0 &&
      parenthesisDepth === 0;
    if ((character === "," && atTopLevel) || index === source.length) {
      const segment = source.slice(segmentStart, index).trim();
      if (segment) segments.push(segment);
      segmentStart = index + 1;
    }
  }

  const properties = new Map();
  for (const segment of segments) {
    const property = segment.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*([\s\S]+)$/);
    if (property) properties.set(property[1], property[2].trim());
  }
  return properties;
}

function getStoredWorkerSchemaObject(fallback) {
  const source = fallback?.body ?? "";
  const setMarker = "resultsByWorkerTask.set(workerTask,";
  const setStart = source.indexOf(setMarker);
  if (setStart === -1 || !topLevelKeywordIndices(source, "resultsByWorkerTask").includes(setStart)) {
    return null;
  }
  let openingBrace = setStart + setMarker.length;
  while (/\s/.test(source[openingBrace] ?? "")) openingBrace += 1;
  if (source[openingBrace] !== "{") return null;
  const closingBrace = findMatchingDelimiter(source, openingBrace, "{", "}");
  if (closingBrace === -1) return null;
  let closingParenthesis = closingBrace + 1;
  while (/\s/.test(source[closingParenthesis] ?? "")) closingParenthesis += 1;
  return source[closingParenthesis] === ")" ? source.slice(openingBrace + 1, closingBrace) : null;
}

function workerTimeoutResultViolations(source) {
  const cleanSource = stripJavaScriptComments(source);
  const loop = getBoundedPendingWorkerLoop(cleanSource);
  const fallback = getPendingWorkerFallback(cleanSource, loop);
  const topLevelReturns = topLevelKeywordIndices(cleanSource, "return");
  const returnIndex = topLevelReturns[0] ?? -1;
  const storedSchemaObject = getStoredWorkerSchemaObject(fallback);
  const storedProperties = topLevelObjectProperties(storedSchemaObject ?? "");
  const requiredKeys = ["result", "done", "gap", "evidence", "confidence"];
  const hasCompleteSchema =
    storedProperties.size === requiredKeys.length &&
    requiredKeys.every((key) => storedProperties.has(key)) &&
    storedProperties.get("done") === "false" &&
    storedProperties.get("confidence") === '"low"';
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
  const legacyGapStart = cleanCollector.indexOf(
    "const collectionGaps = [...pendingWorkerTasks].map",
    loop?.end ?? 0,
  );
  const legacyGapSource = legacyGapStart === -1 || collectorReturnIndex === -1
    ? ""
    : cleanCollector.slice(legacyGapStart, collectorReturnIndex);
  const hasValidLegacyGap =
    topLevelCollectorReturns.length === 1 &&
    topLevelKeywordIndices(cleanCollector, "const").includes(legacyGapStart) &&
    legacyGapStart > (loop?.end ?? Number.POSITIVE_INFINITY) &&
    legacyGapStart < collectorReturnIndex &&
    /\.map\(\(workerTask\)\s*=>\s*(?!undefined\b)[\s\S]+\);/.test(legacyGapSource);
  const pendingFallback = getPendingWorkerFallback(cleanCollector, loop);
  const hasValidInterruptedGapFallback =
    pendingFallback !== null &&
    pendingFallback.end < collectorReturnIndex &&
    /await interrupt_agent\(\{ target: workerTask \}\);/.test(pendingFallback.body) &&
    /collectionGaps\.push\(\s*\{\s*workerTask,\s*player:\s*player\.name,\s*gap:\s*`[^`]+`\s*\}\s*\);/s.test(
      pendingFallback.body,
    );
  const gapPrecedesSoleCollectorReturn =
    topLevelCollectorReturns.length === 1 &&
    /return \{ resultsByWorkerTask, collectionGaps \};/.test(
      cleanCollector.slice(collectorReturnIndex),
    ) &&
    (hasValidLegacyGap || hasValidInterruptedGapFallback);
  const invalidResponseBlock = getIfBlock(cleanCollector, "!hasExactKeys(response, PLAYER_OUTPUT_KEYS)");
  const deadlineCheckIndex = invalidResponseBlock?.body.indexOf("if (Date.now() >= collectionDeadline) continue;") ?? -1;
  const followupIndex = invalidResponseBlock?.body.indexOf("await followup_task(") ?? -1;
  const checksDeadlineBeforeFollowup = deadlineCheckIndex !== -1 && followupIndex !== -1 && deadlineCheckIndex < followupIndex;
  const topLevelRunReturns = topLevelKeywordIndices(cleanRun, "return");
  const runReturnIndex = topLevelRunReturns[0] ?? -1;
  const playerWaveLoop = getJavaScriptWhileLoops(cleanRun).find(
    (candidate) => candidate.normalizedCondition === "remainingPlayers.length>0",
  );
  const waveBody = playerWaveLoop?.body ?? "";
  const collectIndex = waveBody.indexOf("const { resultsByWorkerTask, collectionGaps: waveCollectionGaps }");
  const waveGapPushIndex = waveBody.indexOf("collectionGaps.push(...waveCollectionGaps);");
  const hasSoleSynthesisReturn =
    topLevelRunReturns.length === 1 &&
    /return synthesizeBoard\(\{ players, results, collectionGaps \}\);/.test(cleanRun.slice(runReturnIndex));
  const carriesGapsToSoleSynthesisReturn =
    hasSoleSynthesisReturn &&
    playerWaveLoop !== undefined &&
    topLevelKeywordIndices(cleanRun, "while").includes(playerWaveLoop.start) &&
    playerWaveLoop.end < runReturnIndex &&
    topLevelKeywordIndices(waveBody, "const").includes(collectIndex) &&
    /const \{ resultsByWorkerTask, collectionGaps: waveCollectionGaps \} =\s*await collectCodexPlayerFinals\(workerTasks\);/.test(waveBody) &&
    waveGapPushIndex !== -1 &&
    topLevelKeywordIndices(waveBody, "collectionGaps").includes(waveGapPushIndex) &&
    isDirectStatementStart(waveBody, waveGapPushIndex) &&
    collectIndex < waveGapPushIndex;

  return timeoutDescriptionIsDerived(cleanRun) &&
    gapPrecedesSoleCollectorReturn &&
    checksDeadlineBeforeFollowup &&
    carriesGapsToSoleSynthesisReturn
    ? []
    : ["interrupt pending players, create player-keyed gaps before the collector return, guard followups by the deadline, and carry gaps to the sole synthesis return"];
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
  const appendedBarePendingFixture = `${boundedFixture}\nwhile (pendingWorkerTasks.size) { await wait_agent({ timeout_ms: 60_000 }); }`;
  const appendedCommentSeparatedPendingFixture = `${boundedFixture}\nwhile (pendingWorkerTasks /* still pending */ . size) { await wait_agent({ timeout_ms: 60_000 }); }`;
  const appendedBracketPendingFixture = `${boundedFixture}\nwhile (pendingWorkerTasks["size"]) { await wait_agent({ timeout_ms: 60_000 }); }`;
  for (const fixture of [
    replacedBoundFixture,
    appendedUnboundedFixture,
    appendedBarePendingFixture,
    appendedCommentSeparatedPendingFixture,
    appendedBracketPendingFixture,
  ]) {
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
  const workerFreeFloatingObjectFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {}",
    "for (const workerTask of pendingWorkerTasks) {",
    "  const timeoutResult = { result: \"x\", done: false, gap: \"x\", evidence: \"x\", confidence: \"low\" };",
    "}",
    "return workerTasks.map((workerTask) => resultsByWorkerTask.get(workerTask));",
  ].join("\n");
  check(
    workerTimeoutResultViolations(workerFreeFloatingObjectFixture).length > 0,
    "worker timeout checker must reject a free-floating timeout object",
  );
  const workerNestedFallbackFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {}",
    "if (false) {",
    "  for (const workerTask of pendingWorkerTasks) {",
    "    resultsByWorkerTask.set(workerTask, { result: \"x\", done: false, gap: \"x\", evidence: \"x\", confidence: \"low\" });",
    "  }",
    "}",
    "return workerTasks.map((workerTask) => resultsByWorkerTask.get(workerTask));",
  ].join("\n");
  check(
    workerTimeoutResultViolations(workerNestedFallbackFixture).length > 0,
    "worker timeout checker must reject a fallback nested in if (false)",
  );
  const workerDeadUnbracedFallbackFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {}",
    "if (false) for (const workerTask of pendingWorkerTasks) {",
    '  resultsByWorkerTask.set(workerTask, { result: "x", done: false, gap: "x", evidence: "x", confidence: "low", });',
    "}",
    "return workerTasks.map((workerTask) => resultsByWorkerTask.get(workerTask));",
  ].join("\n");
  check(
    workerTimeoutResultViolations(workerDeadUnbracedFallbackFixture).length > 0,
    "worker timeout checker must reject a dead unbraced fallback",
  );
  const workerNestedSchemaFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {}",
    "for (const workerTask of pendingWorkerTasks) {",
    '  resultsByWorkerTask.set(workerTask, { result: { done: false, gap: "x", evidence: "x", confidence: "low", } });',
    "}",
    "return workerTasks.map((workerTask) => resultsByWorkerTask.get(workerTask));",
  ].join("\n");
  check(
    workerTimeoutResultViolations(workerNestedSchemaFixture).length > 0,
    "worker timeout checker must reject nested keys masquerading as WORKER_SCHEMA",
  );
  const workerUnstoredSchemaFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {}",
    "for (const workerTask of pendingWorkerTasks) {",
    "  resultsByWorkerTask.set(workerTask, undefined);",
    "  const timeoutResult = { result: \"x\", done: false, gap: \"x\", evidence: \"x\", confidence: \"low\", };",
    "}",
    "return workerTasks.map((workerTask) => resultsByWorkerTask.get(workerTask));",
  ].join("\n");
  check(
    workerTimeoutResultViolations(workerUnstoredSchemaFixture).length > 0,
    "worker timeout checker must reject an unstored schema object after an undefined set argument",
  );

  const playerEarlyReturnFixture = [
    "const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;",
    "while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {",
    "  if (!hasExactKeys(response, PLAYER_OUTPUT_KEYS)) {",
    "    if (Date.now() >= collectionDeadline) continue;",
    "    await followup_task({ target: workerTask });",
    "  }",
    "}",
    "return { resultsByWorkerTask, collectionGaps };",
    "// const collectionGaps = [...pendingWorkerTasks].map((workerTask) => `No final was delivered for canonical player task ${workerTask}.`);",
  ].join("\n");
  const playerRunFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "while (remainingPlayers.length > 0) {",
    "const { resultsByWorkerTask, collectionGaps: waveCollectionGaps } = await collectCodexPlayerFinals(workerTasks);",
    "collectionGaps.push(...waveCollectionGaps);",
    "}",
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
    "    if (Date.now() >= collectionDeadline) continue;",
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
  const playerRunWithinWaveFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "while (remainingPlayers.length > 0) {",
    "  const { resultsByWorkerTask, collectionGaps: waveCollectionGaps } = await collectCodexPlayerFinals(workerTasks);",
    "  collectionGaps.push(...waveCollectionGaps);",
    "}",
    "return synthesizeBoard({ players, results, collectionGaps });",
  ].join("\n");
  check(
    playerCollectionGapViolations(playerValidCollectorFixture, playerRunWithinWaveFixture).length === 0,
    "player timeout checker must accept direct collection handling in the wave loop",
  );
  const playerEarlySynthesisReturnFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    `const leadingRunPreamble = "${"x".repeat(240)}";`,
    "return synthesizeBoard({ players, results, collectionGaps });",
    "while (remainingPlayers.length > 0) {",
    "  const { resultsByWorkerTask, collectionGaps: waveCollectionGaps } = await collectCodexPlayerFinals(workerTasks);",
    "  collectionGaps.push(...waveCollectionGaps);",
    "}",
  ].join("\n");
  check(
    playerCollectionGapViolations(playerValidCollectorFixture, playerEarlySynthesisReturnFixture).length > 0,
    "player timeout checker must reject a synthesis return before the wave loop",
  );
  const playerRunWithoutGapCarryFixture = playerRunFixture.replace(
    "collectionGaps.push(...waveCollectionGaps);\n",
    "",
  );
  check(
    playerCollectionGapViolations(playerValidCollectorFixture, playerRunWithoutGapCarryFixture).length > 0,
    "player timeout checker must reject a synthesis return that drops collection gaps",
  );
  const playerUndefinedGapCollectorFixture = playerValidCollectorFixture.replace(
    "(workerTask) => `No final was delivered for canonical player task ${workerTask}.`",
    "() => undefined",
  );
  check(
    playerCollectionGapViolations(playerUndefinedGapCollectorFixture, playerRunFixture).length > 0,
    "player timeout checker must reject undefined collection gaps",
  );
  const playerDeadUnbracedGapRunFixture = playerRunFixture.replace(
    "collectionGaps.push(...waveCollectionGaps);",
    "if (false) collectionGaps.push(...waveCollectionGaps);",
  );
  check(
    playerCollectionGapViolations(playerValidCollectorFixture, playerDeadUnbracedGapRunFixture).length > 0,
    "player timeout checker must reject dead unbraced gap propagation",
  );
  const playerNestedGapCollectorFixture = playerValidCollectorFixture.replace(
    "const collectionGaps = [...pendingWorkerTasks].map((workerTask) => `No final was delivered for canonical player task ${workerTask}.`);",
    "if (false) { const collectionGaps = [...pendingWorkerTasks].map((workerTask) => `No final was delivered for canonical player task ${workerTask}.`); }",
  );
  check(
    playerCollectionGapViolations(playerNestedGapCollectorFixture, playerRunFixture).length > 0,
    "player timeout checker must reject collection gaps nested in if (false)",
  );
  const playerNestedRunFixture = [
    "const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;",
    "while (remainingPlayers.length > 0) {",
    "if (false) {",
    "  const { resultsByWorkerTask, collectionGaps: waveCollectionGaps } = await collectCodexPlayerFinals(workerTasks);",
    "  collectionGaps.push(...waveCollectionGaps);",
    "}",
    "}",
    "return synthesizeBoard({ players, results, collectionGaps });",
  ].join("\n");
  check(
    playerCollectionGapViolations(playerValidCollectorFixture, playerNestedRunFixture).length > 0,
    "player timeout checker must reject collection handling nested in if (false)",
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
checkExplicitModelOverrideFixtures();
checkCodexCapacityFixtures();
checkJavaScriptCommentStrippingFixtures();

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
  checkFencedJavaScriptSyntax(skillPath, skill);
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
    "turn a second invalid Codex player response into an explicit keyed gap",
    /if \(correctionRequested\.has\(workerTask\)\) \{[\s\S]*?collectionGaps\.push\(\{[\s\S]*?workerTask,[\s\S]*?player:\s*player\.name,[\s\S]*?pendingWorkerTasks\.delete\(workerTask\);/,
  ],
  [
    "inspect Codex agent status through list_agents",
    /\blist_agents\s*\(\s*\{\s*\}\s*\)/,
  ],
  [
    "collect Codex player finals in one controller mailbox loop",
    /async function collectCodexPlayerFinals\(workerTasks\)/,
  ],
  [
    "key Codex player collection by returned canonical task names",
    /const pendingWorkerTasks = new Set\(workerTasks\.map\(\(\{ workerTask \}\) => workerTask\)\);/,
  ],
  ["interrupt player agents still pending at the deadline", /\binterrupt_agent\s*\(/],
  ["preserve player identity beside every returned task", /resultsByWorkerTask\.set\(workerTask,\s*\{\s*workerTask,\s*player,\s*response/],
  ["record an explicit gap for every undispatched player", /remainingPlayers\.splice\(0\)[\s\S]*?collectionGaps\.push/],
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
check(
  !/\b(?:readDeliveredFinals|getAvailableWorkerSlots)\s*\(/.test(adversarySkill),
  `${adversaryPath} must use only exposed Codex agent tools`,
);
check(
  !/\bAgent\s*\(\s*\{[\s\S]*?\bschema\s*:/.test(adversarySkill),
  `${adversaryPath} Claude Agent calls must not pass the unsupported schema field`,
);
check(
  !adversarySkill.includes("No caveats"),
  `${adversaryPath} must not instruct Claude agents to omit caveats`,
);
for (const violation of codexCapacityHelperViolations(adversarySkill)) {
  errors.push(`${adversaryPath} must ${violation}`);
}
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
  adversaryCollectorBody?.includes("agent.agent_status.completed"),
  `${adversaryPath} must collect completed player payloads from list_agents status`,
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
    "derive the unlimited-power model request from an explicit invocation field",
    /async function runUnlimitedPower\(\{\s*objective,\s*explicitlyRequestedModel,\s*\}\) \{[\s\S]*?const userRequestedModel = explicitlyRequestedModel;/,
  ],
  [
    "inspect Codex agent status through list_agents",
    /\blist_agents\s*\(\s*\{\s*\}\s*\)/,
  ],
  [
    "use wait_agent without an unsupported target parameter",
    /\bwait_agent\s*\(\s*\{\s*timeout_ms\s*:/,
  ],
  ["explain that wait_agent returns a mailbox update rather than the worker payload", /wait_agent` signals a mailbox update/],
  ["pass an explicit user-requested model through the dispatch loop", /dispatchWorker\(workerTaskName, task, done, userRequestedModel\)/],
  ["collect Codex worker finals in one controller mailbox loop", /async function collectCodexWorkerFinals\(workerTasks\)/],
  ["key Codex worker collection by returned canonical task names", /const pendingWorkerTasks = new Set\(workerTasks\);/],
  ["interrupt worker agents still pending at the deadline", /\binterrupt_agent\s*\(/],
  ["document a Claude Agent call with valid required fields", /\bAgent\s*\(\s*\{\s*description:[\s\S]*?prompt:/],
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
check(
  !/\b(?:readDeliveredFinals|getAvailableWorkerSlots)\s*\(/.test(unlimitedPowerSkill),
  `${unlimitedPowerPath} must use only exposed Codex agent tools`,
);
check(
  !/\bAgent\s*\(\s*\{[\s\S]*?\bschema\s*:/.test(unlimitedPowerSkill),
  `${unlimitedPowerPath} Claude Agent calls must not pass the unsupported schema field`,
);
check(
  unlimitedPowerSkill.includes("**Codex `dispatchWorker`:**\n\n```javascript"),
  `${unlimitedPowerPath} must keep a blank line before the Codex dispatchWorker fence`,
);
check(
  unlimitedPowerSkill.includes("**Claude `dispatchWorker`:**\n\n```javascript"),
  `${unlimitedPowerPath} must keep a blank line before the Claude dispatchWorker fence`,
);
for (const violation of codexCapacityHelperViolations(unlimitedPowerSkill)) {
  errors.push(`${unlimitedPowerPath} must ${violation}`);
}
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
  unlimitedPowerCollectorBody?.includes("agent.agent_status.completed"),
  `${unlimitedPowerPath} must collect completed worker payloads from list_agents status`,
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
const nodePrerequisiteIndex = readme.indexOf("Node.js must be installed and available as `node` on `PATH`");
const codexInstallIndex = readme.indexOf("### Codex (shell)");
check(
  nodePrerequisiteIndex !== -1 &&
    codexInstallIndex !== -1 &&
    nodePrerequisiteIndex < codexInstallIndex,
  "README must check the Node.js hook prerequisite before plugin installation",
);
check(
  readme.includes("/reload-plugins"),
  "README must reload Claude plugins after installation",
);
check(
  /start a new Codex task/i.test(readme),
  "README must tell Codex users to start a new task after installation",
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

check(
  !fs.existsSync(path.join(root, "docs", "superpowers")) ||
    listFiles(path.join(root, "docs", "superpowers")).length === 0,
  "repository must not recreate docs/superpowers planning documentation",
);

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
