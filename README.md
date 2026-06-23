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

1. Parses your input for themes and keywords
2. Searches 48 indexed laws for matches
3. Returns 1-3 relevant laws with specific, actionable advice
4. Signs off with a Palpatine quote

No moralizing. No disclaimers. Just strategy.

## Installation

**From marketplace (recommended):**
```bash
/plugin marketplace add youruser/palpatine
/plugin install palpatine
```

**Manual:**
```bash
git clone https://github.com/youruser/palpatine ~/.claude/skills/palpatine
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
