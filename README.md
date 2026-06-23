# Palpatine

*"Everything is proceeding as I have foreseen."*

Strategic advisor skill powered by Robert Greene's **48 Laws of Power**.

## What it does

Invoke `/palpatine` with any situation, question, or text to get strategic advice based on the 48 Laws of Power.

**Three modes, auto-detected:**
- **Advise** — describe a situation, get relevant laws and actionable moves
- **Analyze** — paste an email or message, get a power-dynamics critique
- **Write** — request help drafting, get strategic copy

## Examples

```
/palpatine my coworker keeps undermining me in meetings
```

```
/palpatine review this cold email: "Hi, I'd love to pick your brain..."
```

```
/palpatine write a message declining a meeting without burning bridges
```

## How it works

1. Maps players, interests, and leverage points
2. Matches 1-3 applicable laws from the 48
3. Returns structured analysis + numbered action plan with timing
4. Flags risks and reversal scenarios

No moralizing. No disclaimers. Just strategy.

## Installation

**From marketplace (recommended):**
```bash
/plugin marketplace add novusedge/palpatine
/plugin install palpatine
```

**Manual:**
```bash
git clone https://github.com/NovusEdge/palpatine ~/.claude/skills/palpatine
```

## Always-On Mode

Toggle persistent mode that applies power dynamics to all relevant interactions:

- `/palpatine on` — Enable (persists across sessions)
- `/palpatine off` — Disable

## Files

```
palpatine/
├── .claude-plugin/
│   └── plugin.json      # Plugin manifest
├── hooks/
│   ├── hooks.json       # SessionStart hook config  
│   └── activate.js      # Checks state on session start
├── SKILL.md             # Skill instructions
├── law_index.json       # Searchable index of all 48 laws
└── README.md
```

## Credits

Based on *The 48 Laws of Power* by Robert Greene.

*"Unlimited power!"*
