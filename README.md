# Palpatine

[![License: SPL](https://img.shields.io/badge/License-Sith%20Public%20License-red.svg)](LICENSE)

High-functioning predator for Codex and Claude Code. No moralizing. No disclaimers. Pattern recognition without sentiment.

## What it does

Palpatine takes any situation and returns:
- **The actual problem** — what you're not seeing
- **Actions** — who does what by when

50 words. Patterns inform the thinking, not the output.

Four internal libraries inform the diagnosis: Power for positioning, War for conflict, Seduction for desire, and Human Nature for emotional drivers and recurring behavior. Advice keeps source names and citations internal and distinguishes observed conduct from inferred motives.

Browse the 18 Human Nature patterns with `/palpatine:nature` in Claude Code or `$palpatine:nature` in Codex. Add a number or keyword, such as `7`, `envy`, or `promotion`, to find matching entries. Reference lookups show pattern names and summaries; ordinary advice stays in the diagnosis-and-actions format.

**Modes (auto-detected):**
| Mode | Trigger | Output |
|------|---------|--------|
| **Advise** | Situation or question | Diagnosis + actions |
| **Analyze** | Pasted text | What's wrong + fix |
| **Write** | "draft", "help me say" | The artifact |
| **Counter** | "against me" | Their playbook + pre-empt |
| **Escalate** | "burn it down" | Ladder with costs |

## Example

```
# Claude Code
/palpatine:palpatine my boss keeps taking credit for my work in meetings

# Codex
$palpatine:palpatine my boss keeps taking credit for my work in meetings
```

**Output:**

```markdown
**Problem:** You're a production asset, not visible. Boss has no incentive to change.

**Do this:**
1. CC stakeholders on status updates — document your work, frame as "keeping people informed"
2. Volunteer for cross-functional projects where boss isn't the only audience
3. Create a deliverable only you can run — make your absence costly
4. If they escalate: paper trail for HR or exit
```

## Installation

### Hook prerequisite

Both hosts start the packaged JavaScript hook with Node.js on every `SessionStart`, even when the always-on marker is off. Node.js must be installed and available as `node` on `PATH` before installing the plugin. Validate the runtime in a shell or PowerShell:

```text
node --version
```

### Codex (shell)

```bash
codex plugin marketplace add NovusEdge/palpatine
codex plugin add palpatine@palpatine
```

Start a new Codex task after installation so the plugin is loaded.

### Claude Code (in-app)

Run these slash commands inside Claude Code:

```text
/plugin marketplace add NovusEdge/palpatine
/plugin install palpatine@palpatine
/reload-plugins
```

Invoke skills with `/palpatine:<skill>` in Claude Code or `$palpatine:<skill>` in Codex.

## Always-On Mode

Both hosts support always-on mode at the next session start. In Claude Code, use `/palpatine:palpatine on` or `/palpatine:palpatine off`. In Codex, use `$palpatine:palpatine on` or `$palpatine:palpatine off`. Codex prompts for hook trust review before hooks can run.

When enabled, flags power dynamics in relevant conversations without you having to invoke explicitly.

## Credits

Pattern libraries derived from Robert Greene:
- *The 48 Laws of Power* (1998)
- *The Art of Seduction* (2001)
- *The 33 Strategies of War* (2006)
- *The Laws of Human Nature* (2018)

The Human Nature index contains paraphrased patterns from a local MinerU EPUB extraction. Its source metadata records the input SHA-256, extractor version, and chapter paths. The plugin ships the compact index; it does not require MinerU or the full book at runtime.

Licensed under the [Sith Public License](LICENSE). Use at your own risk. We're not your mom.
