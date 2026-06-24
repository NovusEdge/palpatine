---
name: unlimited-power
description: Self-terminating recursive orchestrator. Dispatches waves of subagents until a verifiable done-condition passes or the budget caps. Power with a kill-switch.
---

# Unlimited Power

Invoked via `/palpatine:unlimited-power <objective>` or auto-triggered when the user says "do whatever it takes", "keep going until it's done", "don't stop until", "fully automate this", "run until done".

Fools hear *unlimited* and remove the brakes. Then the rate limiter removes them. Real power is a loop that knows when to stop — caps, a kill-switch, and a definition of *done* fixed before the first move. Unbounded recursion isn't strength; it's a man electrocuting himself with his own lightning.

## Prime Rule

**No done-condition, no launch.** Before anything fans out, the objective is reduced to a check that can return true/false. If it can't, refuse:

```
**No stop condition.** I don't run blind — that's a fork bomb, not a plan.
Define "done": [what observable state ends this?]
```

"Until the job is done" without a definition of *done* is the whole bug. Fix it first.

## The Governor

Hard caps. Set before dispatch, enforced every wave. This is what makes "unlimited" survivable.

```javascript
const BUDGET = {
  maxWaves:    5,   // loop iterations — recursion lives HERE, not in nesting
  maxWidth:    5,   // parallel agents per wave — rate-limit safe
  maxDispatch: 20,  // total agents across the whole run, ever
  maxDepth:    1,   // leaf agents do NOT spawn (see Rule 4 — matches /palpatine:adversary)
  model: "cheapest-sufficient" // tokens are fuel; don't burn premium on grunt work
};
```

## The Loop

Decompose → dispatch a bounded wave → verify against the done-condition → terminate or re-plan the *gap only*. Repeat until done or the governor stops it.

```javascript
// PRIME RULE — refuse blind objectives.
const done = defineAcceptanceCheck(objective);
if (!done) return abort("No verifiable done-condition.");

let plan = decompose(objective);   // → dependency-LAYERED: a wave holds only independent tasks; dependents land in later waves
let dispatched = 0, lastGap = null;

for (let wave = 0; wave < BUDGET.maxWaves; wave++) {
  const batch = plan.slice(0, Math.min(BUDGET.maxWidth, BUDGET.maxDispatch - dispatched));
  if (batch.length === 0) break;

  // A wave is independent-only, so Promise.all is safe. Dependent work was deferred
  // to a later wave by decompose()/replan() — ordering lives ACROSS waves, not within.
  const results = await Promise.all(batch.map(task => Agent({
    description: `Worker: ${task.name}`,
    prompt: workerPrompt(task, done),   // task + the acceptance check it must satisfy
    schema: WORKER_SCHEMA
  })));
  dispatched += batch.length;

  if (done.passes(results)) return terminate("done", results);

  const gap = synthesizeGap(results);            // what's still missing
  if (gap === lastGap) return terminate("stalled", gap);  // doom-loop guard (best-effort; maxWaves is the hard stop)
  lastGap = gap;
  plan = replan(gap);                            // next wave attacks only the remainder
}
return terminate("budget-exhausted", lastGap);   // partial results + exact gap, never silent
```

## Worker Schema

Leaf agents return data and a self-assessment — the main loop decides, not them.

```javascript
const WORKER_SCHEMA = {
  type: "object",
  properties: {
    result:     { type: "string", description: "The artifact or finding produced — not narration" },
    done:       { type: "boolean", description: "Did this subtask fully meet its acceptance check?" },
    gap:        { type: "string", description: "If not done: exactly what remains" },
    evidence:   { type: "string", description: "Where the result lives — path, output, citation" },
    confidence: { type: "string", enum: ["high", "medium", "low"] }
  },
  required: ["result", "done", "gap", "evidence", "confidence"]
}
```

## Orchestration Rules

1. **No done-condition, no launch.** Refuse blind objectives. Spinning forever is the failure mode, not the feature.
2. **The governor is law.** Every dimension capped before the first dispatch. "Unlimited" is a theme, not a runtime setting.
3. **Parallel within a wave, sequenced across waves.** A wave holds only mutually-independent tasks (fan out with `Promise.all`); `decompose`/`replan` layer dependent work into later waves so chained tasks never share a batch.
4. **Leaf agents don't spawn subagents.** The main loop owns all recursion — depth lives in *waves*, not nesting. (Consistent with `/palpatine:adversary` Rule 5. Bounded depth ≠ infinite descent.)
5. **Doom-loop guard (best-effort).** Two waves, same gap → stop early. The gap is a semantic summary, so this equality test is a heuristic, not a proof — `maxWaves` (Rule 2) is the hard stop that always holds; the guard only saves wasted waves when a stall repeats verbatim. Repetition isn't persistence; it's a stuck actuator.
6. **Rate discipline.** Cap wave width; stagger if the host throttles. A 429 storm is a self-inflicted defeat — you rate-limited *yourself* to death.
7. **Cheapest sufficient model per worker.** Premium models on grunt work is wasted motion. Match the tool to the cut.
8. **Escalate, never fail silent.** `budget-exhausted` returns what shipped + the exact remaining gap + the single next action. A quiet stall is worse than a loud stop.

## Terminal States

Every run ends in exactly one, reported cold:

```
**Status:** done | budget-exhausted | stalled | no-stop-condition
**Shipped:** [what got done — evidence/paths]
**Remaining:** [the gap, if any]
**Spend:** [waves used / agents dispatched of cap]
**Next:** [one action — only if not done]
```

Target: 50 words. The report is the report.

## Example Invocation

**User:** "Run until done: every public function in `src/api/` has a JSDoc block."

**Execution:**

1. **Done-condition:** `grep` every exported fn in `src/api/`; pass = zero functions without a preceding `/** */`. Checkable → proceed.
2. **Decompose:** 14 files, independent → parallel wave (width 5).
3. **Wave 1:** 5 workers document 5 files, return `WORKER_SCHEMA`. Predicate: 9 files still bare.
4. **Wave 2–3:** re-plan to the 9 remaining, two more waves. Predicate passes.
5. **Terminate:**

```
**Status:** done
**Shipped:** 14/14 files in src/api/ — JSDoc on all exports (grep clean)
**Remaining:** none
**Spend:** 3 waves / 14 agents of 20
**Next:** —
```

Had file 12 thrown a parser error twice with the same gap, Rule 5 fires: `stalled`, return the 13 done + name file 12 as the blocker. No 47th attempt at the same wall.

*"UNLIMITED POWER!"*
