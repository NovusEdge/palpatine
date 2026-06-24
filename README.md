# Palpatine

[![License: SPL](https://img.shields.io/badge/License-Sith%20Public%20License-red.svg)](LICENSE)

High-functioning predator for Claude Code. No moralizing. No disclaimers. Pattern recognition without sentiment.

## What it does

`/palpatine` takes any situation and returns:
- **The actual problem** — what you're not seeing
- **Actions** — who does what by when

50 words. Patterns inform the thinking, not the output.

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
/palpatine my boss keeps taking credit for my work in meetings
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

```bash
# Marketplace
/plugin marketplace add novusedge/palpatine
/plugin install palpatine

# Manual
git clone https://github.com/NovusEdge/palpatine ~/.claude/skills/palpatine
```

## Always-On Mode

```bash
/palpatine on   # Strategic lens on all interactions
/palpatine off  # Back to normal
```

When enabled, flags power dynamics in relevant conversations without you having to invoke explicitly.

## Credits

Pattern libraries derived from Robert Greene:
- *The 48 Laws of Power* (1998)
- *The Art of Seduction* (2001)
- *The 33 Strategies of War* (2006)

Licensed under the [Sith Public License](LICENSE). Use at your own risk. We're not your mom.
