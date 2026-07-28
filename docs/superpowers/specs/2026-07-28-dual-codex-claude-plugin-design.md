# Dual Codex and Claude Code Plugin Design

## Goal

Make Palpatine installable and functional through both Codex and Claude Code plugin marketplaces without maintaining two copies of its skills, hooks, or data.

## Current State

The repository is a Claude Code plugin at its root:

- `.claude-plugin/plugin.json` defines plugin metadata and the Claude `SessionStart` hook.
- `skills/` contains eight shared skills.
- `hooks/` contains the Claude-only always-on hook and an unused law matcher.
- Three root JSON files contain the reference data.
- `.github/plugin/marketplace.json` uses a legacy marketplace shape and location.

Codex cannot ingest the Claude manifest because the bundled Codex validator rejects its top-level `displayName` and `hooks` fields and requires an `interface` block. Codex can still load `hooks/hooks.json` through default plugin discovery. Three reference skills also assume `${CLAUDE_PLUGIN_ROOT}`, while the two orchestration skills demonstrate only Claude's `Agent` model.

## Approaches Considered

### 1. Canonical nested payload with root compatibility links

Move the installable plugin to `plugins/palpatine/`. Point both marketplace catalogs at that directory. Keep legacy root entry points as relative symlinks into the canonical payload.

Advantages:

- Both marketplaces use their standard `./plugins/palpatine` source.
- The installed payload is self-contained and cannot recurse through a parent-pointing link.
- Skills and data remain single-source.
- Direct root-based Claude development continues to work.

Cost: the initial diff contains moves and symlinks.

### 2. Keep the payload at the repository root

Add both manifests at the root and create `plugins/palpatine` as a link back to the repository root.

Advantages: the smallest move set.

Rejected because an installer that follows the source link can encounter a recursive tree: the root contains the link that points back to the root.

### 3. Duplicate Claude and Codex payloads

Keep the Claude plugin at the root and copy it under `plugins/palpatine` for Codex.

Advantages: no links in the installed payload.

Rejected because skill, hook, and reference changes would drift across two trees.

## Selected Architecture

Use approach 1.

```text
.
├── .agents/plugins/marketplace.json       # Codex marketplace
├── .claude-plugin/
│   ├── marketplace.json                   # Claude marketplace
│   └── plugin.json -> ../plugins/palpatine/.claude-plugin/plugin.json
├── .codex-plugin -> plugins/palpatine/.codex-plugin
├── .github/plugin/marketplace.json -> ../../.claude-plugin/marketplace.json
├── hooks -> plugins/palpatine/hooks
├── skills -> plugins/palpatine/skills
├── law_index.json -> plugins/palpatine/skills/laws/references/law_index.json
├── seduction_index.json -> plugins/palpatine/skills/seduce/references/seduction_index.json
├── war_index.json -> plugins/palpatine/skills/war/references/war_index.json
└── plugins/palpatine/
    ├── .claude-plugin/plugin.json
    ├── .codex-plugin/plugin.json
    ├── agents/openai.yaml
    ├── hooks/
    └── skills/
```

The nested payload contains no path that resolves outside itself. Root links exist only for direct-checkout compatibility and legacy consumers.

## Host-Specific Manifests

The Claude manifest keeps `hooks: "./hooks/hooks.json"` and Claude metadata.

The Codex manifest:

- keeps the stable plugin name `palpatine`;
- declares `skills: "./skills/"`;
- omits unsupported `hooks`, `apps`, and `mcpServers`;
- supplies the required Codex `interface` metadata and starter prompts;
- uses the same semantic version and license metadata as the Claude manifest.

Both manifests move to version `2.1.0`. This compatibility release also makes the post-`v2.0.0` `unlimited-power` skill visible to version-keyed plugin caches.

## Marketplace Packaging

Claude uses `.claude-plugin/marketplace.json` with:

- marketplace name `palpatine`;
- owner `NovusEdge`;
- plugin source `./plugins/palpatine`.

Codex uses `.agents/plugins/marketplace.json` with:

- marketplace name and display name `palpatine` / `Palpatine`;
- plugin source `{ "source": "local", "path": "./plugins/palpatine" }`;
- installation policy `AVAILABLE`;
- authentication policy `ON_INSTALL`;
- category `Productivity`.

The legacy `.github/plugin/marketplace.json` becomes a link to the canonical Claude catalog.

## Shared Skill Compatibility

All eight skills remain shared.

- Each skill gets optional `agents/openai.yaml` presentation metadata for Codex.
- Invocation sections show Claude slash commands and Codex `$palpatine:<skill-name>` invocations. The main Codex skill is `$palpatine:palpatine`.
- `laws`, `war`, and `seduce` read data from a `references/` directory next to their own `SKILL.md`. They no longer depend exclusively on `${CLAUDE_PLUGIN_ROOT}` or the user's working directory.
- Root data filenames remain as links so existing Claude scripts and external references do not break.
- Persistent always-on mode keeps the legacy `~/.claude/palpatine-enabled` marker. Both hosts run the same default `SessionStart` hook, and Codex supplies Claude-compatible plugin hook environment variables.

## Orchestration Compatibility

`adversary` and `unlimited-power` retain their host-independent rules but add explicit host adapters:

- Claude Code uses `Agent` and structured schemas.
- Codex uses `spawn_agent`, `wait_agent`, and follow-up messaging. Worker prompts request a fixed response shape because Codex subagent dispatch does not accept the Claude schema argument.
- Parallel width never exceeds the host's available worker slots.
- Codex inherits the parent model unless the user explicitly asks for an override.
- Leaf agents never spawn descendants; the main task owns waves and termination.

## Lifecycle Hooks

The current `SessionStart` hook and `~/.claude/palpatine-enabled` state remain unchanged. Codex discovers `hooks/hooks.json` without a manifest entry and adds its plain-text output as developer context after the user trusts the hook definition. `match-laws.js` remains unregistered, but its data path moves with the canonical law reference.

## Documentation and Validation

README installation and invocation examples cover both hosts. CONTRIBUTING describes the actual Markdown, JSON, and Node.js checks.

A dependency-free repository validator checks:

- both manifests parse and agree on name/version/license;
- Claude retains hooks while Codex omits them;
- both marketplaces resolve `./plugins/palpatine`;
- compatibility links resolve inside the checkout;
- all skill frontmatter and Codex presentation files exist;
- all canonical reference data exists and has the expected record counts.

Final verification also runs the Codex plugin creator validator, the skill validator, Node syntax checks, JSON parsing, the law matcher smoke test, local Codex marketplace installation, and `codex plugin list`.

## Failure Handling

- A broken or escaping symlink fails validation.
- A manifest mismatch fails before installation.
- A missing local Codex marketplace is added from the repository root before plugin installation.
- If Codex already has the marketplace or plugin, the supported remove/add or cachebuster flow is used instead of editing Codex config by hand.
- Codex hook execution is verified separately from plugin installation because new or changed plugin hooks require explicit trust review.
- Claude CLI validation is reported as unavailable when the executable is not installed; repository validation still covers its manifest, catalog, hooks JSON, and script syntax.

## References

- Claude Code marketplace structure: https://code.claude.com/docs/en/plugin-marketplaces
- Claude Code plugin structure: https://code.claude.com/docs/en/plugins
- Codex plugin packaging and default hook discovery: https://developers.openai.com/plugins/build/plugins
- Codex lifecycle hooks and trust review: https://learn.chatgpt.com/docs/hooks
