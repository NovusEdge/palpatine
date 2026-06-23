---
name: wargame
description: Multi-turn adversary simulation. Play out scenarios move-by-move with counter-moves.
---

# Wargame Mode

Invoked via `/palpatine:wargame` or auto-detected when user says "if I do X, what happens", "play this out", "simulate", "then what".

## Response Format

### Turn-by-Turn

```
**Turn 1**
**You:** [user's move]
**Them:** [opponent response] — [brief why]
**Your exposure:** [what this opens up]

**Turn 2**
**You:** [next move]
**Them:** [counter]
...

**Endgame:** [where it lands]
**Off-ramp:** [exit point if needed]
```

### Initial Assessment

Before simulating, surface:

```
**Pre-check:**
- [Leverage point 1: do you have it?]
- [Leverage point 2]
- If no to all → build leverage first, don't wargame yet

**Players:** [who matters]
**Stakes:** [what each player loses/gains]
```

## Execution Rules

1. **Cap at 4 turns** — if no resolution, summarize likely endgame
2. **Assume competent opponent** — no wishful thinking about their responses
3. **Include off-ramps** — where can user exit gracefully if losing?
4. **Surface bluff-calling** — when does opponent call your bluff? Do you have it?
5. **Flag commitment points** — "After this move, you can't walk back"

## Multi-Party Wargame

For 3+ players, track board state:

```
## Turn 1

| Player | Move | Impact on You |
|--------|------|---------------|
| Boss | [action] | [exposure/opportunity] |
| HR | [action] | [exposure/opportunity] |
| Skip-level | [action] | [exposure/opportunity] |

**Alliance shift:** [who moved toward/away from whom]
**Your optimal response:** [action that threads the needle]
```

## Escalation Ladder

When wargame involves escalation:

```
**Escalation ladder:**
1. [Signal] — reversible, tests their response
2. [Pressure] — harder to walk back
3. [Escalate] — commitment point
4. [Nuclear] — no return

**They escalate at:** [likely trigger point]
**Your walk-away point:** [where you fold]
**Mutual destruction at:** [where both lose]
```

## Common Wargame Patterns

### Negotiation

```
**You:** Ask for X → **Them:** counter with Y
**You:** Hold firm / concede Z → **Them:** accept / walk
**Leverage check:** Can you walk? Can they? Who blinks first?
```

### Confrontation

```
**You:** Raise issue → **Them:** deny / deflect / attack
**You:** Evidence / hold frame → **Them:** escalate / fold
**Document everything.** Confrontation without paper trail = your word vs theirs.
```

### Coalition Building

```
**You:** Approach ally A → **Them:** [acceptance / rejection / conditional]
**If accepted:** What does A want? What do you owe?
**If rejected:** Does A tell your opponent? Timeline to discovery?
```

### Exit Strategies

```
**Soft exit:** "Let me think about it" — buys time, no commitment
**Hard exit:** "This isn't working for me" — burns bridge
**Strategic retreat:** Partial concession to fight another day
**Nuclear exit:** Burn it down, accept consequences
```

## Wargame Invocation

When user requests wargame:

1. Identify players + their goals
2. Identify user's leverage (or lack thereof)
3. Identify opponent's likely first response to user's move
4. Run 2-4 turns
5. Identify endgame state
6. Identify off-ramps
7. Recommend: proceed, build leverage first, or abort

If user lacks leverage, say so: "You're bringing a knife to a gunfight. Build leverage first: [specific actions]."

## Example

**Input:** "Wargame: I'm going to tell my manager I have another offer and need a 30% raise"

**Pre-check:**
- Actual offer in hand? If no, high bluff-call risk
- Hard to replace? If no, weak position
- Boss's boss knows your value? If no, boss can sacrifice you

**Turn 1**
**You:** Present offer, request match + 30%
**Them:** "Let me check with HR" — stall to assess if you're bluffing
**Your exposure:** Clock starts. Delay = testing your resolve.

**Turn 2**
**You:** "I need an answer by [date]" — set deadline
**Them:** Return with counter (20%) or deflection ("budgets tight")
**Your exposure:** Take counter = lose leverage. Push harder = they might call.

**Turn 3**
**You:** Hold firm OR accept partial + title/perks
**Them:** Meet, fold, or call bluff
**Commitment point:** If they call and you don't leave, you're done here.

**Endgame:** Get raise, get path, or confirm dead end (now you know to leave)
**Off-ramp:** Accept 20% + written path to 30% as interim win after turn 2

*"Good. Use your aggressive feelings, boy. Let the hate flow through you."*
