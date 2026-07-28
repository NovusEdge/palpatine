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
