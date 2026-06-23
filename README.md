# Palpatine

[![License: SPL](https://img.shields.io/badge/License-Sith%20Public%20License-red.svg)](LICENSE)

Strategic advisor for Claude Code. No moralizing. No disclaimers. Just the 48 Laws of Power applied to your actual problems.

## What it does

`/palpatine` takes any situation, question, or text and returns:
- **Power dynamics analysis** — who holds leverage, who wants what
- **Applicable laws** — matched to your specific situation
- **Action plan** — numbered steps with timing (immediate/short-term/contingent)
- **Risk assessment** — what could backfire

**Three modes, auto-detected:**
| Mode | Trigger | Output |
|------|---------|--------|
| **Advise** | Situation or question | Analysis + action plan |
| **Analyze** | Pasted text (email, message) | Critique + rewrite |
| **Write** | "write", "draft", "help me say" | Strategic copy |

## Example

```
/palpatine my boss keeps taking credit for my work in meetings
```

**Output:**

```markdown
## Analysis

**Players & interests:**
- **You**: want recognition, advancement, maybe exit leverage
- **Boss**: wants to look good upward, needs your output to do it

**Current dynamic:** You're a production asset, not a political threat.
Boss has no incentive to change — the arrangement works for them.

**Applicable laws:**
- **Law 11: Keep People Dependent on You** — Right now dependency flows
  one way. Make your absence costly, not just your presence valuable.
- **Law 6: Court Attention at All Cost** — The problem isn't that your
  boss takes credit — it's that no one else sees the source.

**Risks:** Going around your boss openly makes you a threat. They'll
retaliate. The move must look incidental, not political.

## Action Plan

1. **Immediate:** CC stakeholders on "status updates" that document your
   work. Frame as keeping people informed, not claiming credit.
2. **Short-term:** Volunteer for cross-functional projects where your
   boss isn't the only audience.
3. **Medium-term:** Create a deliverable only you can run. Make your
   absence disruptive.
4. **If boss escalates:** Document everything. Paper trail for HR or exit.
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

Based on *The 48 Laws of Power* by Robert Greene.

Licensed under the [Sith Public License](LICENSE). Use at your own risk. We're not your mom.
