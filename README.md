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

Add to your Claude skills directory:

```bash
git clone https://github.com/yourusername/palpatine ~/.claude/skills/palpatine
```

Or download and copy the `palpatine/` folder to `~/.claude/skills/`.

## Files

- `SKILL.md` — Skill instructions
- `law_index.json` — Searchable index of all 48 laws
- `README.md` — This file

## Credits

Based on *The 48 Laws of Power* by Robert Greene.

*"Unlimited power!"*
