# Dual Codex and Claude Code Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package Palpatine as one self-contained plugin that installs from both Codex and Claude Code marketplaces while preserving direct-checkout compatibility.

**Architecture:** The canonical payload moves to `plugins/palpatine/`. Codex and Claude use separate manifests and marketplace catalogs but share one skills/hooks tree. Relative root symlinks preserve current paths without placing a parent-pointing link inside the installed payload.

**Tech Stack:** Markdown skills, JSON manifests and catalogs, YAML Codex presentation metadata, Node.js standard library, Git symlinks, Codex CLI.

## Global Constraints

- Keep the plugin identifier `palpatine`.
- Keep Claude Code hooks functional through `hooks/hooks.json`.
- Omit `hooks`, `apps`, and `mcpServers` from the Codex manifest; Codex discovers the default hook file.
- Use version `2.1.0` and license identifier `LicenseRef-SPL-1.0` in both host manifests.
- Keep every installed-plugin path inside `plugins/palpatine/`.
- Keep root compatibility links relative and resolving inside the repository.
- Use Codex marketplace source path `./plugins/palpatine` with `AVAILABLE`, `ON_INSTALL`, and `Productivity`.
- Use Claude marketplace source path `./plugins/palpatine`.
- Keep the existing `~/.claude/palpatine-enabled` marker so prior always-on choices survive.
- Do not add an MCP server, app manifest, external runtime dependency, or duplicated skill tree.
- Codex worker width must respect live concurrency and inherit the parent model unless the user requests an override.

---

### Task 1: Add a failing dual-host packaging contract

**Files:**

- Create: `scripts/validate-compatibility.mjs`

**Interfaces:**

- Consumes: repository root from `process.cwd()`
- Produces: exit code `0` with `Compatibility validation passed.` or exit code `1` with one line per violated invariant

- [ ] **Step 1: Write the validator before moving files**

Create a dependency-free Node.js validator with these helpers and checks:

```javascript
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
    check(fs.realpathSync(link) === fs.realpathSync(target), `${relativeLink} resolves incorrectly`);
  } catch (error) {
    errors.push(`${relativeLink}: ${error.message}`);
  }
}
```

The main body must assert:

- `plugins/palpatine/.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` parse.
- Both manifests use name `palpatine`, version `2.1.0`, and license `LicenseRef-SPL-1.0`.
- Claude declares `hooks: "./hooks/hooks.json"`.
- Codex declares `skills: "./skills/"`, has all required `interface` fields, and omits `hooks`, `apps`, and `mcpServers`.
- Claude and Codex marketplace entries both target `./plugins/palpatine`.
- Codex policies equal `AVAILABLE` and `ON_INSTALL`, with category `Productivity`.
- The root `skills`, `hooks`, `.codex-plugin`, and three index files resolve to their canonical nested targets.
- Every directory immediately below `plugins/palpatine/skills` has `SKILL.md` and `agents/openai.yaml`.
- Law, war, and seduction data contain 48 laws, 33 strategies, 9 types, and 24 total steps.

Finish with:

```javascript
if (errors.length > 0) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Compatibility validation passed.");
```

- [ ] **Step 2: Run the validator and confirm the current layout fails**

Run:

```bash
node scripts/validate-compatibility.mjs
```

Expected: exit `1`; the first decisive failure reports missing `plugins/palpatine/.claude-plugin/plugin.json`.

- [ ] **Step 3: Check syntax**

Run:

```bash
node --check scripts/validate-compatibility.mjs
```

Expected: exit `0`.

- [ ] **Step 4: Commit the failing contract**

```bash
git add scripts/validate-compatibility.mjs
git commit -m "test: define dual-host plugin contract"
```

### Task 2: Create the canonical payload and both marketplaces

**Files:**

- Move: `.claude-plugin/plugin.json` → `plugins/palpatine/.claude-plugin/plugin.json`
- Move: `hooks/` → `plugins/palpatine/hooks/`
- Move: `skills/` → `plugins/palpatine/skills/`
- Move: `law_index.json` → `plugins/palpatine/skills/laws/references/law_index.json`
- Move: `war_index.json` → `plugins/palpatine/skills/war/references/war_index.json`
- Move: `seduction_index.json` → `plugins/palpatine/skills/seduce/references/seduction_index.json`
- Create: `plugins/palpatine/.codex-plugin/plugin.json`
- Create: `plugins/palpatine/agents/openai.yaml`
- Create: `.claude-plugin/marketplace.json`
- Create: `.agents/plugins/marketplace.json`
- Replace: `.github/plugin/marketplace.json` with a relative symlink
- Create: root compatibility symlinks for `.claude-plugin/plugin.json`, `.codex-plugin`, `hooks`, `skills`, and the three indexes
- Modify: `plugins/palpatine/hooks/match-laws.js`

**Interfaces:**

- Consumes: the current root plugin and the plugin-creator scaffold script
- Produces: a self-contained `plugins/palpatine` source addressable by both catalogs

- [ ] **Step 1: Move the shared payload**

Use `git mv` so history remains readable:

```bash
mkdir -p plugins/palpatine/.claude-plugin
git mv .claude-plugin/plugin.json plugins/palpatine/.claude-plugin/plugin.json
git mv hooks plugins/palpatine/hooks
git mv skills plugins/palpatine/skills
mkdir -p plugins/palpatine/skills/laws/references
mkdir -p plugins/palpatine/skills/war/references
mkdir -p plugins/palpatine/skills/seduce/references
git mv law_index.json plugins/palpatine/skills/laws/references/law_index.json
git mv war_index.json plugins/palpatine/skills/war/references/war_index.json
git mv seduction_index.json plugins/palpatine/skills/seduce/references/seduction_index.json
```

- [ ] **Step 2: Scaffold the Codex manifest and repo marketplace**

Run from the plugin-creator skill root:

```bash
python3 scripts/create_basic_plugin.py palpatine \
  --path /Users/kkugot/Documents/palpatine/plugins \
  --with-skills \
  --with-hooks \
  --with-marketplace \
  --marketplace-path /Users/kkugot/Documents/palpatine/.agents/plugins/marketplace.json \
  --marketplace-name palpatine
```

Expected: it adds only the missing Codex manifest and marketplace; existing moved skill and hook files remain intact.

- [ ] **Step 3: Replace scaffold metadata with release metadata**

Set `plugins/palpatine/.codex-plugin/plugin.json` to:

```json
{
  "name": "palpatine",
  "version": "2.1.0",
  "description": "Strategic analysis, adversary simulation, and power-dynamics playbooks for difficult decisions.",
  "author": {
    "name": "NovusEdge",
    "url": "https://github.com/NovusEdge"
  },
  "homepage": "https://github.com/NovusEdge/palpatine#readme",
  "repository": "https://github.com/NovusEdge/palpatine",
  "license": "LicenseRef-SPL-1.0",
  "keywords": [
    "strategy",
    "power-dynamics",
    "adversary-simulation",
    "decision-making",
    "negotiation"
  ],
  "skills": "./skills/",
  "interface": {
    "displayName": "Palpatine",
    "shortDescription": "Strategic analysis and adversary simulation",
    "longDescription": "Diagnose power dynamics, pressure-test decisions, model opponents, and turn difficult interpersonal or organizational situations into concrete moves.",
    "developerName": "NovusEdge",
    "category": "Productivity",
    "capabilities": [
      "Interactive",
      "Read",
      "Write"
    ],
    "websiteURL": "https://github.com/NovusEdge/palpatine",
    "defaultPrompt": [
      "Diagnose the power dynamics in this situation and tell me what to do.",
      "Wargame this decision and show the likely counter-moves.",
      "Identify the manipulation pattern and give me a defense."
    ],
    "brandColor": "#991B1B"
  }
}
```

Update the nested Claude manifest to version `2.1.0`, license `LicenseRef-SPL-1.0`, and matching generic description while retaining its top-level `displayName` and `hooks`.

- [ ] **Step 4: Add canonical marketplace metadata**

Set `.claude-plugin/marketplace.json` to:

```json
{
  "name": "palpatine",
  "owner": {
    "name": "NovusEdge"
  },
  "description": "Strategic analysis and adversary simulation plugins from NovusEdge.",
  "plugins": [
    {
      "name": "palpatine",
      "source": "./plugins/palpatine",
      "description": "Diagnose power dynamics, model opponents, and turn difficult situations into concrete moves.",
      "category": "Productivity",
      "tags": [
        "strategy",
        "negotiation",
        "power-dynamics"
      ]
    }
  ]
}
```

Keep the scaffolded Codex marketplace name `palpatine`, display name `Palpatine`, and exact policy/source entry required by the global constraints.

Create `plugins/palpatine/agents/openai.yaml`:

```yaml
interface:
  display_name: "Palpatine"
  short_description: "Strategic analysis and adversary simulation"
  default_prompt: "Use $palpatine:palpatine to diagnose the power dynamics in this situation and give me concrete moves."
```

- [ ] **Step 5: Create compatibility links**

Create these exact relative links:

```text
.claude-plugin/plugin.json -> ../plugins/palpatine/.claude-plugin/plugin.json
.codex-plugin -> plugins/palpatine/.codex-plugin
.github/plugin/marketplace.json -> ../../.claude-plugin/marketplace.json
hooks -> plugins/palpatine/hooks
skills -> plugins/palpatine/skills
law_index.json -> plugins/palpatine/skills/laws/references/law_index.json
war_index.json -> plugins/palpatine/skills/war/references/war_index.json
seduction_index.json -> plugins/palpatine/skills/seduce/references/seduction_index.json
```

- [ ] **Step 6: Point the law matcher at canonical data**

Change its `loadLaws()` path to:

```javascript
const lawPath = path.join(
  __dirname,
  "..",
  "skills",
  "laws",
  "references",
  "law_index.json",
);
```

- [ ] **Step 7: Run the contract**

Run:

```bash
node scripts/validate-compatibility.mjs
```

Expected: exit `1` only for missing per-skill `agents/openai.yaml` files.

- [ ] **Step 8: Commit packaging**

```bash
git add -A
git commit -m "feat: package palpatine for Codex"
```

### Task 3: Make skills self-contained and Codex-discoverable

**Files:**

- Modify: `plugins/palpatine/skills/palpatine/SKILL.md`
- Modify: `plugins/palpatine/skills/laws/SKILL.md`
- Modify: `plugins/palpatine/skills/war/SKILL.md`
- Modify: `plugins/palpatine/skills/seduce/SKILL.md`
- Create: `plugins/palpatine/skills/*/agents/openai.yaml` for all eight skills

**Interfaces:**

- Consumes: canonical per-skill `references/` files
- Produces: host-neutral resource lookup plus Codex install-surface metadata

- [ ] **Step 1: Replace host-exclusive resource paths**

In the three reference skills:

- state both host invocations;
- instruct the host to resolve `references/<index>.json` relative to that skill's `SKILL.md`;
- keep `${CLAUDE_PLUGIN_ROOT}/skills/<skill>/references/<index>.json` as the explicit Claude shell path;
- use `rg` examples with `grep` as fallback;
- state that the user's working directory is never the resource base.

In the core skill, add a resource map:

```text
48 Laws: ../laws/references/law_index.json
33 Strategies: ../war/references/war_index.json
Art of Seduction: ../seduce/references/seduction_index.json
```

Update invocation examples to pair Claude and Codex names, including `/palpatine:palpatine` and `$palpatine:palpatine`.

- [ ] **Step 2: Clarify cross-host always-on behavior**

Keep the same marker commands and add:

```text
The change applies on the next session start. Both Claude Code and Codex discover
hooks/hooks.json; Codex asks the user to trust a new or changed command hook before it runs.
```

- [ ] **Step 3: Add Codex presentation files**

Create one `agents/openai.yaml` under each skill with these exact contents:

`adversary/agents/openai.yaml`

```yaml
interface:
  display_name: "Adversary Simulation"
  short_description: "Model sophisticated opponents and multi-party dynamics"
  default_prompt: "Use $palpatine:adversary to model the opposing players and synthesize their likely moves."
```

`defense/agents/openai.yaml`

```yaml
interface:
  display_name: "Defense Mode"
  short_description: "Detect manipulation and choose concrete counter-moves"
  default_prompt: "Use $palpatine:defense to identify the manipulation pattern and give me a defense."
```

`laws/agents/openai.yaml`

```yaml
interface:
  display_name: "48 Laws Reference"
  short_description: "Browse and search the 48 Laws of Power"
  default_prompt: "Use $palpatine:laws to find the laws relevant to this situation."
```

`palpatine/agents/openai.yaml`

```yaml
interface:
  display_name: "Palpatine"
  short_description: "Diagnose power dynamics and prescribe concrete moves"
  default_prompt: "Use $palpatine:palpatine to diagnose this situation and tell me what to do."
```

`seduce/agents/openai.yaml`

```yaml
interface:
  display_name: "Seduction Reference"
  short_description: "Browse seduction archetypes, phases, and patterns"
  default_prompt: "Use $palpatine:seduce to find the seduction patterns relevant to this situation."
```

`unlimited-power/agents/openai.yaml`

```yaml
interface:
  display_name: "Unlimited Power"
  short_description: "Run bounded subagent waves against a verifiable objective"
  default_prompt: "Use $palpatine:unlimited-power to finish this objective within explicit stop conditions and budget caps."
```

`war/agents/openai.yaml`

```yaml
interface:
  display_name: "33 Strategies of War"
  short_description: "Browse and search the 33 Strategies of War"
  default_prompt: "Use $palpatine:war to find the strategies relevant to this conflict."
```

`wargame/agents/openai.yaml`

```yaml
interface:
  display_name: "Wargame"
  short_description: "Simulate moves, counter-moves, exposure, and endgames"
  default_prompt: "Use $palpatine:wargame to simulate this decision turn by turn."
```

- [ ] **Step 4: Validate**

Run:

```bash
node scripts/validate-compatibility.mjs
rg -n '\$\{CLAUDE_PLUGIN_ROOT\}/(law|war|seduction)_index\.json' plugins/palpatine/skills
```

Expected: validator passes; `rg` returns no obsolete root-data references.

- [ ] **Step 5: Commit skill packaging**

```bash
git add plugins/palpatine/skills
git commit -m "feat: make skills portable across hosts"
```

### Task 4: Add native Codex subagent adapters

**Files:**

- Modify: `plugins/palpatine/skills/adversary/SKILL.md`
- Modify: `plugins/palpatine/skills/unlimited-power/SKILL.md`

**Interfaces:**

- Consumes: Claude `Agent` capability or Codex collaboration tools
- Produces: the same board synthesis and bounded-wave terminal report on either host

- [ ] **Step 1: Add an adversary host adapter**

Rename `Claude Code Agent Patterns` to `Host Agent Patterns`. Add:

```text
Codex:
- Spawn one independent worker per player with `spawn_agent`.
- Use `fork_turns: "none"` and provide all player context in the prompt.
- Ask for the exact keys move, alliance, threat, price, and threatLevel.
- Dispatch independent players in parallel, wait for mailbox completion, then synthesize.
- Use follow-up messaging for corrections; leaf workers never spawn.

Claude Code:
- Use `Agent` with PLAYER_SCHEMA or ADVERSARY_SCHEMA.
- Use Promise.all only for independent players.
```

Replace the fixed `5-7` simultaneous-agent cap with at most five total player models, never exceeding available worker slots in one wave.

- [ ] **Step 2: Make unlimited-power pseudocode host-neutral**

Replace direct `Agent(...)` calls with an abstract `dispatchWorker(task, acceptanceCheck)` and add adapters:

```text
Codex dispatchWorker:
1. spawn_agent with a self-contained task, fork_turns "none", and no model override;
2. require result, done, gap, evidence, and confidence headings;
3. wait for completion and normalize the final response.

Claude dispatchWorker:
1. call Agent with WORKER_SCHEMA;
2. return the validated structured result.
```

Set effective wave width to `min(5, availableWorkerSlots, remainingDispatchBudget)`. Keep five waves, 20 total dispatches, depth one, the best-effort stall guard, and all four terminal states.

- [ ] **Step 3: Validate host terminology**

Run:

```bash
node scripts/validate-compatibility.mjs
rg -n 'Claude Code Agent Patterns|max 5-7 agents|model: "cheapest-sufficient"' plugins/palpatine/skills
```

Expected: validator passes; `rg` returns no obsolete host-exclusive heading, concurrency claim, or forced model selection.

- [ ] **Step 4: Commit orchestration adapters**

```bash
git add plugins/palpatine/skills/adversary/SKILL.md plugins/palpatine/skills/unlimited-power/SKILL.md
git commit -m "feat: add Codex subagent adapters"
```

### Task 5: Document and continuously check both install paths

**Files:**

- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Create: `.github/workflows/validate.yml`

**Interfaces:**

- Consumes: the two marketplace catalogs and repository validator
- Produces: exact user install commands and a dependency-free CI check

- [ ] **Step 1: Rewrite installation and invocation documentation**

README must include:

```bash
# Codex
codex plugin marketplace add NovusEdge/palpatine
codex plugin add palpatine@palpatine

# Claude Code
/plugin marketplace add NovusEdge/palpatine
/plugin install palpatine@palpatine
```

Add a host invocation mapping that pairs Claude `/palpatine:<skill>` with Codex `$palpatine:<skill>`. State that both hosts support always-on mode at the next session start and that Codex requires hook trust review.

Remove the broken manual clone instruction.

- [ ] **Step 2: Correct contributor tooling**

Replace Python/Black claims with:

```bash
node scripts/validate-compatibility.mjs
node --check hooks/activate.js
node --check hooks/match-laws.js
git diff --check
```

- [ ] **Step 3: Add CI**

Create `.github/workflows/validate.yml`:

```yaml
name: Validate plugins

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  compatibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/validate-compatibility.mjs
      - run: node --check hooks/activate.js
      - run: node --check hooks/match-laws.js
```

- [ ] **Step 4: Run repository checks**

Run:

```bash
node scripts/validate-compatibility.mjs
node --check hooks/activate.js
node --check hooks/match-laws.js
printf '%s\n' '{"prompt":"My boss takes credit and controls access"}' | node hooks/match-laws.js
git diff --check
```

Expected: all commands pass; law matcher prints at least one `Matched Laws` entry.

- [ ] **Step 5: Commit docs and CI**

```bash
git add README.md CONTRIBUTING.md .github/workflows/validate.yml
git commit -m "docs: add dual-host install guidance"
```

### Task 6: Run official validation and install in Codex

**Files:**

- Modify only when a validator exposes a concrete defect

**Interfaces:**

- Consumes: plugin-creator and skill-creator validators, local Codex marketplace CLI
- Produces: an installed and enabled `palpatine@palpatine` plugin

- [ ] **Step 1: Run official Codex validation**

Run the plugin-creator validator against the canonical payload with a Python runtime that includes PyYAML:

```bash
python3 /Users/kkugot/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /Users/kkugot/Documents/palpatine/plugins/palpatine
```

Expected: `Plugin validation passed`.

- [ ] **Step 2: Validate every skill**

Run `quick_validate.py` once for each directory under `plugins/palpatine/skills`.

Expected: all eight return `Skill is valid!`.

- [ ] **Step 3: Parse every tracked JSON and YAML file**

Run:

```bash
git ls-files -z '*.json' | xargs -0 -n1 jq empty
```

Parse YAML through the same PyYAML-enabled runtime. Expected: no parse errors.

- [ ] **Step 4: Add the local repo marketplace**

First inspect:

```bash
codex plugin marketplace list
```

If `palpatine` is absent, run:

```bash
codex plugin marketplace add /Users/kkugot/Documents/palpatine
```

Expected: marketplace `palpatine` points at the current repository root.

- [ ] **Step 5: Install the plugin**

Run:

```bash
codex plugin add palpatine@palpatine --json
codex plugin list
```

Expected: `palpatine@palpatine` is `installed, enabled`, version `2.1.0`, and its cached manifest contains all eight skills plus the default hook file.

- [ ] **Step 6: Re-run all checks from a clean Git state**

Run:

```bash
node scripts/validate-compatibility.mjs
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: validation passes and no uncommitted repository changes remain.

### Task 7: Review, push, and create the pull request

**Files:**

- Modify only for findings from the review

**Interfaces:**

- Consumes: complete feature branch and green validation evidence
- Produces: a pushed branch and GitHub pull request targeting `main`

- [ ] **Step 1: Review the complete diff**

Run:

```bash
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
git log --oneline origin/main..HEAD
```

Use the requesting-code-review and verification-before-completion skills. Fix every confirmed blocking or medium-severity compatibility issue and rerun Task 6 checks.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feature/codex-plugin-compatibility
```

- [ ] **Step 3: Create the PR**

Title:

```text
feat: add Codex plugin compatibility
```

Body:

```markdown
## Summary

- package Palpatine once for Codex and Claude Code marketplaces
- add Codex-native manifests, metadata, resource lookup, and subagent adapters
- preserve Claude hooks and legacy root paths through compatibility symlinks
- add validation, CI, and dual-host installation docs

## Validation

- Codex plugin-creator validator
- all eight skill validators
- repository compatibility validator
- Node hook syntax and law-matcher smoke test
- local `palpatine@palpatine` Codex installation
```

Create it with authenticated GitHub CLI when available; otherwise use the signed-in GitHub web session after the branch push.
