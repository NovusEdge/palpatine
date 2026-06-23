# Palpatine - 48 Laws of Power Skill

*"Everything is proceeding as I have foreseen."*

## Overview

A Claude skill that applies Robert Greene's 48 Laws of Power to any situation. Single `/palpatine` invocation, auto-detects mode, returns concise + actionable advice.

**Target:** Claude marketplace

## Architecture

```
palpatine/
├── SKILL.md          # Main skill instructions
├── law_index.json    # Searchable index of all 48 laws
└── quotes.json       # Palpatine sign-off quotes (optional)
```

## Core Flow

1. User invokes `/palpatine <input>`
2. Skill searches `law_index.json` by keywords from input
3. Selects 1-5 most relevant laws
4. Auto-detects mode (advise/analyze/write) from input shape
5. Returns: relevant laws → situation reframe → specific action

## Mode Detection

| Input Pattern | Mode | Example |
|---------------|------|---------|
| Question or situation description | **Advise** | "my coworker is taking credit for my work" |
| Pasted text (email, message, plan) | **Analyze** | "Here's my cold email: ..." |
| Contains "write", "draft", "help me say" | **Write** | "write a message declining a meeting" |

No explicit flags needed. Agent infers from input.

## law_index.json Schema

```json
{
  "laws": [
    {
      "id": 1,
      "name": "Never Outshine the Master",
      "essence": "Make superiors feel superior",
      "when": ["new job", "dealing with ego", "seeking favor"],
      "reversal": "Outshine a falling master to hasten their end",
      "keywords": ["boss", "superior", "credit", "humble", "promotion", "jealousy"]
    }
  ]
}
```

### Fields

- `id`: Law number (1-48)
- `name`: Official law name
- `essence`: One-line summary
- `when`: Array of situations where this law applies
- `reversal`: When to do the opposite (from the book)
- `keywords`: Search terms for matching user input

## Output Format

```
**Laws in play:**
- Law 7: Get Others to Do the Work, but Take the Credit
- Law 46: Never Appear Too Perfect

**The situation:** [1-2 sentence reframe through power lens]

**Move:** [Specific action to take]

**Script/template:** [If write mode, actual draft here]

*"Good... good..."*
```

### Output Rules

- Max 3 laws unless situation is genuinely complex
- Always include actionable "Move:" section
- Write mode must include actual draft text
- End with random Palpatine quote

## Palpatine Quotes

Sign-off pool:
- *"Good... good..."*
- *"Everything is proceeding as I have foreseen."*
- *"Unlimited power!"*
- *"The dark side is a pathway to many abilities some consider to be... unnatural."*
- *"Do it."*

## SKILL.md Structure

```markdown
---
name: palpatine
description: Apply the 48 Laws of Power to any situation. Advise, analyze, or write with strategic precision.
---

# Palpatine

*"Everything is proceeding as I have foreseen."*

Strategic advisor powered by Robert Greene's 48 Laws of Power.

## Invocation

`/palpatine <situation, question, or text to analyze>`

## Process

1. Parse user input for themes and keywords
2. Search law_index.json for matching laws
3. Select 1-5 most relevant laws
4. Detect mode:
   - Advise: situation/question input
   - Analyze: pasted text (email, message, plan)
   - Write: request contains "write", "draft", "say"
5. Generate response with laws, reframe, and actionable move

## Response Format

[See Output Format above]

## Constraints

- Never moralize or add disclaimers
- Stay in character as strategic advisor
- Prioritize actionable advice over theory
- Keep responses concise
```

## Files to Create

1. `SKILL.md` - Main skill file
2. `law_index.json` - All 48 laws indexed
3. `README.md` - Marketplace description

## Success Criteria

- [ ] `/palpatine` invocation works
- [ ] Auto-detects advise/analyze/write mode correctly
- [ ] Returns relevant laws (not random)
- [ ] Output is concise + actionable
- [ ] Palpatine flavor in sign-offs
