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
    return;
  }

  for (const entry of entries.filter((entry) => entry.isDirectory())) {
    const skillPath = path.join("plugins", "palpatine", "skills", entry.name);
    check(fs.existsSync(path.join(root, skillPath, "SKILL.md")), `${skillPath}/SKILL.md is missing`);
    check(
      fs.existsSync(path.join(root, skillPath, "agents", "openai.yaml")),
      `${skillPath}/agents/openai.yaml is missing`,
    );
  }
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

async function exerciseUnlimitedPowerLoop({ plan, availableWorkerSlots }) {
  const skill = readText("plugins/palpatine/skills/unlimited-power/SKILL.md");
  const loopSource = [...skill.matchAll(/```javascript\s*([\s\S]*?)```/g)]
    .map((match) => match[1])
    .find(
      (source) =>
        source.includes("defineAcceptanceCheck") &&
        source.includes("getAvailableWorkerSlots"),
    );

  if (!loopSource) {
    errors.push("unlimited-power must document an executable orchestration loop");
    return null;
  }

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  let dispatches = 0;

  try {
    const runLoop = new AsyncFunction(
      "BUDGET",
      "objective",
      "defineAcceptanceCheck",
      "decompose",
      "getAvailableWorkerSlots",
      "dispatchWorker",
      "synthesizeGap",
      "replan",
      "terminate",
      loopSource,
    );
    const result = await runLoop(
      { maxWaves: 5, maxWidth: 5, maxDispatch: 20, maxDepth: 1 },
      "objective",
      () => ({ passes: () => false }),
      () => plan,
      () => availableWorkerSlots,
      async () => {
        dispatches += 1;
        return { done: false, gap: "remaining work" };
      },
      () => "remaining work",
      () => [],
      (status, gap) => ({ status, gap }),
    );
    return { ...result, dispatches };
  } catch (error) {
    errors.push(`unlimited-power loop could not execute: ${error.message}`);
    return null;
  }
}

const claudeManifest = readJson("plugins/palpatine/.claude-plugin/plugin.json");
const codexManifest = readJson("plugins/palpatine/.codex-plugin/plugin.json");
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
resolvesTo(".codex-plugin", "plugins/palpatine/.codex-plugin");
resolvesTo("law_index.json", "plugins/palpatine/skills/laws/references/law_index.json");
resolvesTo("war_index.json", "plugins/palpatine/skills/war/references/war_index.json");
resolvesTo("seduction_index.json", "plugins/palpatine/skills/seduce/references/seduction_index.json");

checkSkillMetadata();

for (const skillName of ["adversary", "defense", "unlimited-power", "wargame"]) {
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

const noCapacityResult = await exerciseUnlimitedPowerLoop({
  plan: ["task"],
  availableWorkerSlots: 0,
});
check(
  noCapacityResult?.status === "stalled",
  "unlimited-power must terminate stalled when no worker capacity is available",
);
check(
  typeof noCapacityResult?.gap === "string" &&
    /capacity|worker slot/i.test(noCapacityResult.gap),
  "unlimited-power must report an explicit capacity gap when no worker slot is available",
);
check(
  noCapacityResult?.dispatches === 0,
  "unlimited-power must not consume dispatch budget when no worker slot is available",
);

const emptyPlanResult = await exerciseUnlimitedPowerLoop({
  plan: [],
  availableWorkerSlots: 1,
});
check(
  emptyPlanResult?.status === "stalled",
  "unlimited-power must terminate stalled when decomposition produces no runnable tasks",
);
check(
  typeof emptyPlanResult?.gap === "string" && /plan|task|work/i.test(emptyPlanResult.gap),
  "unlimited-power must report an explicit gap when decomposition produces no runnable tasks",
);
check(
  emptyPlanResult?.dispatches === 0,
  "unlimited-power must not consume dispatch budget for an empty plan",
);

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
