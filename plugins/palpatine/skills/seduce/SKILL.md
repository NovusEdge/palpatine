---
name: seduce
description: Quick reference for the Art of Seduction. Seducer types, 24-step process, anti-seducer traits.
---

# Seduction Reference

Invoke with Claude Code `/palpatine:seduce` or `/palpatine:seduce <query>`, or Codex `$palpatine:seduce` or `$palpatine:seduce <query>`.

## Usage

| Claude Code | Codex | Action |
|-------------|-------|--------|
| `/palpatine:seduce` | `$palpatine:seduce` | Overview of types + phases |
| `/palpatine:seduce siren` | `$palpatine:seduce siren` | Show seducer type |
| `/palpatine:seduce 15` | `$palpatine:seduce 15` | Show step 15 (Isolate) |
| `/palpatine:seduce hot cold` | `$palpatine:seduce hot cold` | Search by keyword |

## Quick Lookup

Resolve `references/seduction_index.json` relative to this skill's `SKILL.md`; the user's working directory is never the resource base. In Claude Code, the explicit shell path is `${CLAUDE_PLUGIN_ROOT}/skills/seduce/references/seduction_index.json`. Use `rg`; use `grep` as a fallback.

```bash
# Claude Code, by seducer type
rg -i -A5 "siren|rake|charmer" "${CLAUDE_PLUGIN_ROOT}/skills/seduce/references/seduction_index.json"

# Codex or another host, after resolving from this SKILL.md
rg -A5 '"id": 15,' "<resolved skill directory>/references/seduction_index.json"

# Fallback when rg is unavailable
grep -E -i -B2 -A5 "withdraw|chase|mystery" "<resolved skill directory>/references/seduction_index.json"
```

## The 9 Seducer Types

| Type | Core Move | Target's Gap |
|------|-----------|--------------|
| **Siren** | Sensory overload, adventure | Bored, routine-trapped |
| **Rake** | Relentless pursuit | Doubts desirability |
| **Ideal Lover** | Mirror their fantasy | Unfulfilled ideals |
| **Dandy** | Ambiguity, mystery | Wants unconventional |
| **Natural** | Childlike authenticity | Guarded, suspicious |
| **Coquette** | Hot/cold, withdrawal | Too confident |
| **Charmer** | Total attention | Needs validation |
| **Charismatic** | Absolute conviction | Lost, needs direction |
| **Star** | Theatrical distance | Wants to worship |

## The 24 Steps (4 Phases)

### I: Separation (1-8)
1. Choose the Right Victim
2. Create False Security
3. Send Mixed Signals
4. Appear as Object of Desire
5. Create Need — Stir Discontent
6. Master Insinuation
7. Enter Their Spirit
8. Create Temptation

### II: Lead Astray (9-15)
9. Keep in Suspense
10. Demonic Power of Words
11. Pay Attention to Detail
12. Poeticize Your Presence
13. Strategic Weakness
14. Confuse Desire and Reality
15. Isolate the Victim

### III: Precipice (16-20)
16. Prove Yourself
17. Effect Regression
18. Stir the Transgressive
19. Spiritual Lures
20. Mix Pleasure with Pain

### IV: Moving In (21-24)
21. Give Space to Fall
22. Physical Lures
23. Bold Move
24. Beware Aftereffects

## Anti-Seducer Traits (What Kills It)

- Talking too much about yourself
- Constant reassurance-seeking
- Impatience/rushing
- Self-absorption
- Lack of generosity
- Humorlessness

## Key Patterns

**Mystery > clarity** — unclear intentions create obsession
**Hot/cold** — alternate approach/withdrawal to destabilize
**Target the gap** — find what's missing in their life, fill it
**Make them chase** — withdraw when they pursue, they value what retreats
**Strategic vulnerability** — perfection is suspicious, weakness creates intimacy
