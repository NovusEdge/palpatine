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

function checkSourceOrder(relativePath, source, orderedMarkers, description) {
  let previousIndex = -1;
  for (const marker of orderedMarkers) {
    const index = source.indexOf(marker);
    if (index === -1 || index <= previousIndex) {
      errors.push(`${relativePath} must ${description}`);
      return;
    }
    previousIndex = index;
  }
}

function checkExplicitModelOverrides(relativePath, source) {
  const overrides = source.match(/\bmodel:\s*[^,}\n]+/g) ?? [];
  check(
    overrides.length > 0 && overrides.every((override) => override.trim() === "model: userRequestedModel"),
    `${relativePath} must not set an implicit Codex model override`,
  );
}

const claudeManifest = readJson(".claude-plugin/plugin.json");
const codexManifest = readJson(".codex-plugin/plugin.json");
const claudeMarketplace = readJson(".claude-plugin/marketplace.json");
const codexMarketplace = readJson(".agents/plugins/marketplace.json");
const lawData = readJson("plugins/palpatine/skills/laws/references/law_index.json");
const warData = readJson("plugins/palpatine/skills/war/references/war_index.json");
const seductionData = readJson("plugins/palpatine/skills/seduce/references/seduction_index.json");

checkManifest(claudeManifest, "Claude");
checkManifest(codexManifest, "Codex");

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
    /await followup_task\([\s\S]*?\);\s*await wait_agent\(\s*\{\s*timeout_ms\s*:[\s\S]*?response\s*=\s*readDeliveredFinal\(workerTask\)/,
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
  [
    "terminate stalled with an explicit capacity gap when no worker slot is available",
    /if \(availableWorkerSlots <= 0\) \{[\s\S]*?return terminate\(\s*"stalled",\s*"No worker capacity is available; retry when a worker slot opens\."\s*\);/,
  ],
  [
    "terminate stalled with an explicit plan gap when decomposition produces no runnable tasks",
    /if \(plan\.length === 0\) \{[\s\S]*?"No runnable tasks were produced for the objective\."[\s\S]*?return terminate\("stalled", gap\);/,
  ],
]);
checkSourceOrder(
  unlimitedPowerPath,
  unlimitedPowerSkill,
  [
    "if (plan.length === 0)",
    "if (availableWorkerSlots <= 0)",
    "dispatchWorker(task, done)",
    "dispatched += batch.length",
  ],
  "check empty plans and worker capacity before dispatching or consuming dispatch budget",
);
check(
  !/\bwait_agent\s*\(\s*\{\s*target\s*:/.test(unlimitedPowerSkill),
  `${unlimitedPowerPath} must not pass an unsupported target parameter to wait_agent`,
);
checkExplicitModelOverrides(unlimitedPowerPath, unlimitedPowerSkill);

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
]);

const readme = readText("README.md");
check(
  !readme.includes("`/palpatine` takes"),
  "README overview must not imply an unnamespaced /palpatine invocation",
);
for (const command of [
  "/palpatine:palpatine on",
  "/palpatine:palpatine off",
  "$palpatine:palpatine on",
  "$palpatine:palpatine off",
]) {
  check(readme.includes(command), `README must document ${command}`);
}

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
