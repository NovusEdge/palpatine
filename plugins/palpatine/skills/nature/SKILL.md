---
name: nature
description: Use when looking up Human Nature patterns by number or situation, or interpreting defensiveness, envy, self-image, conformity, and recurring behavior in power dynamics.
---

# Human Nature Reference

Invoke with Claude Code `/palpatine:nature [query]` or Codex `$palpatine:nature [query]`.

## Usage

| Claude Code | Codex | Action |
|-------------|-------|--------|
| `/palpatine:nature` | `$palpatine:nature` | List all 18 pattern names |
| `/palpatine:nature 7` | `$palpatine:nature 7` | Show Defensiveness |
| `/palpatine:nature envy` | `$palpatine:nature envy` | Search by keyword |
| `/palpatine:nature promotion` | `$palpatine:nature promotion` | Find patterns for a situation |

## Lookup

Resolve `references/human_nature_index.json` relative to this skill's `SKILL.md`; the user's working directory is never the resource base. In Claude Code, the explicit path is `${CLAUDE_PLUGIN_ROOT}/skills/nature/references/human_nature_index.json`.

Read complete matching records. This Node.js lookup accepts an empty query, a chapter number, or a literal search term. Pass the query as an argument, never as JavaScript source.

```bash
node -e '
const { laws } = require(process.argv[1]);
const query = (process.argv[2] || "").trim().toLowerCase();
const matches = !query ? laws : /^\d+$/.test(query)
  ? laws.filter(law => law.id === Number(query))
  : laws.filter(law => JSON.stringify([
      law.name, law.essence, law.when, law.keywords
    ]).toLowerCase().includes(query));
console.log(JSON.stringify(matches, null, 2));
' "<resolved skill directory>/references/human_nature_index.json" "envy"
```

For a situation, choose short terms from the observed behavior and search them separately. Select the strongest one to three matches. An empty lookup means no indexed match; do not invent an entry.

## Apply the patterns

Use the essence to interpret the emotional driver, then choose a concrete move. Blend with Power for positioning, War for conflict, or Seduction for desire when relevant.

Separate observed facts from inferred motives. Match repeated behavior and context; compare incentives, constraints, and ordinary disagreement before inferring a hidden motive. Nonverbal cues, gender, and age alone do not establish intent or character. Treat the chapter names as behavior patterns, not clinical diagnoses.

## Output

For an explicit reference lookup, show the pattern's name, essence, and matching situations. Include a reversal only if the record has one. List requests show names only. Names and IDs are allowed in reference lookups; keep author names, book titles, and source metadata internal.

For advice, keep Palpatine's existing format and 50-word target:

```text
Problem: [Observed dynamic and the interpretation it supports]

Do this:
1. [Concrete move]
2. [What to watch or do next]
```

Patterns inform the diagnosis and moves. Keep law numbers, author names, book titles, and citations out of advice. Expand only when asked; no separate explanation mode.
