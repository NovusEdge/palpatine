---
name: unlimited-power
description: Self-terminating recursive orchestrator. Dispatches waves of subagents until a verifiable done-condition passes or the budget caps. Power with a kill-switch.
---

# Unlimited Power

Invoked via Claude Code `/palpatine:unlimited-power <objective>` or Codex `$palpatine:unlimited-power <objective>`, or auto-triggered when the user says "do whatever it takes", "keep going until it's done", "don't stop until", "fully automate this", "run until done".

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
  maxDepth:    1    // leaf agents do NOT spawn (see Rule 4 — matches /palpatine:adversary)
};
```

## The Loop

Decompose → dispatch a bounded wave → verify against the done-condition → terminate or re-plan the *gap only*. Repeat until done or the governor stops it.

```javascript
// PRIME RULE — refuse blind objectives.
const done = defineAcceptanceCheck(objective);
if (!done) return terminate("no-stop-condition", "No verifiable done-condition.");

const userRequestedModel = getExplicitUserRequestedModel(objective); // undefined unless the user named a model
let plan = decompose(objective);   // → dependency-LAYERED: a wave holds only independent tasks; dependents land in later waves
let dispatched = 0, lastGap = null;
let nextWorkerDispatchIndex = 0;

for (let wave = 0; wave < BUDGET.maxWaves; wave++) {
  if (plan.length === 0) {
    const gap = lastGap === null
      ? "No runnable tasks were produced for the objective."
      : `No runnable tasks were produced for the remaining gap: ${lastGap}`;
    return terminate("stalled", gap);
  }

  const remainingDispatchBudget = BUDGET.maxDispatch - dispatched;
  if (remainingDispatchBudget === 0) break;

  const availableWorkerSlots = getAvailableWorkerSlots();
  if (availableWorkerSlots <= 0) {
    return terminate(
      "stalled",
      "No worker capacity is available; retry when a worker slot opens."
    );
  }

  const effectiveWaveWidth = Math.min(
    BUDGET.maxWidth,
    availableWorkerSlots,
    remainingDispatchBudget
  );
  const batch = plan.slice(0, effectiveWaveWidth);

  // A wave is independent-only, so Promise.all is safe. Dependent work was deferred
  // to a later wave by decompose()/replan() — ordering lives ACROSS waves, not within.
  const workers = await Promise.all(
    batch.map(task => {
      const workerTaskName = `worker_w${wave}_${nextWorkerDispatchIndex++}`;
      return dispatchWorker(workerTaskName, task, done, userRequestedModel);
    })
  );
  const results = await collectWorkerResults(workers);
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

## Host Adapters

`dispatchWorker(workerTaskName, task, acceptanceCheck, userRequestedModel)` and `collectWorkerResults(workers)` are the host-specific boundaries.

**Codex `dispatchWorker`:**
```javascript
async function dispatchWorker(workerTaskName, task, acceptanceCheck, userRequestedModel) {
  const { task_name: workerTask } = await spawn_agent({
    task_name: workerTaskName,
    fork_turns: "none",
    ...(userRequestedModel ? { model: userRequestedModel } : {}),
    message: `Task: ${task.name}

${task.prompt}

Acceptance check: ${acceptanceCheck}
Leaf workers never spawn subagents.
Return the exact headings: result, done, gap, evidence, confidence.`
  });
  return workerTask;
}

async function collectWorkerResults(workerTasks) {
  return collectCodexWorkerFinals(workerTasks);
}

const COLLECTION_TIMEOUT_MS = 120_000;

async function collectCodexWorkerFinals(workerTasks) {
  const pendingWorkerTasks = new Set(workerTasks);
  const resultsByWorkerTask = new Map();
  const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;
  const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;

  while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {
    const remainingMs = collectionDeadline - Date.now();
    if (remainingMs <= 0) break;
    // Codex accepts a timeout_ms of at least 10 seconds, so the final wait can overshoot by at most that amount.
    const waitMs = Math.max(10_000, Math.min(60_000, remainingMs));
    await wait_agent({ timeout_ms: waitMs });
    const deliveredFinals = readDeliveredFinals();

    for (const [workerTask, response] of deliveredFinals) {
      if (!pendingWorkerTasks.has(workerTask)) continue;
      resultsByWorkerTask.set(workerTask, normalizeWorkerResponse(response));
      pendingWorkerTasks.delete(workerTask);
    }
  }
  for (const workerTask of pendingWorkerTasks) {
    resultsByWorkerTask.set(workerTask, {
      result: "No final result returned.",
      done: false,
      gap: `Worker ${workerTask} did not return before the ${COLLECTION_TIMEOUT_DESCRIPTION} collection deadline.`,
      evidence: `No final was delivered for canonical worker task ${workerTask} before the ${COLLECTION_TIMEOUT_DESCRIPTION} collection deadline.`,
      confidence: "low",
    });
  }
  return workerTasks.map((workerTask) => resultsByWorkerTask.get(workerTask));
}
```

The controller generates each `task_name` from the wave number and one run-wide monotonic dispatch index. This keeps names unique and within Codex's lowercase-letter, digit, and underscore schema; the human task name stays in `message`. Pass `userRequestedModel` only when the user explicitly named a model. Otherwise omit it and inherit the orchestrator model. `wait_agent` signals a mailbox update, not a worker payload. It accepts only its optional `timeout_ms` and can return without a worker final. Each collector stops starting waits at its wall-clock deadline; Codex's 10-second minimum timeout bounds a final overshoot. `readDeliveredFinals()` yields newly delivered finals keyed by the canonical task name returned from `spawn_agent`; one controller loop normalizes delivered finals against `WORKER_SCHEMA` and creates a low-confidence `WORKER_SCHEMA` result for every canonical worker that missed the deadline. Input order is preserved when results return to synthesis.

Codex workers inherit the orchestrator model unless the user explicitly requests an override. Their prompt includes the acceptance check and states that leaf workers never spawn.

**Claude `dispatchWorker`:**
1. Call `Agent` with `WORKER_SCHEMA`.
2. Return the validated structured result.

**Claude `collectWorkerResults`:** Return the already validated worker results.

## Orchestration Rules

1. **No done-condition, no launch.** Refuse blind objectives. Spinning forever is the failure mode, not the feature.
2. **The governor is law.** Every dimension capped before the first dispatch. "Unlimited" is a theme, not a runtime setting.
3. **Parallel within a wave, sequenced across waves.** A wave holds only mutually-independent tasks (fan out with `Promise.all`); `decompose`/`replan` layer dependent work into later waves so chained tasks never share a batch.
4. **Leaf agents don't spawn subagents.** The main loop owns all recursion — depth lives in *waves*, not nesting. (Consistent with `/palpatine:adversary` Rule 5. Bounded depth ≠ infinite descent.)
5. **Doom-loop guard (best-effort).** Two waves, same gap → stop early. The gap is a semantic summary, so this equality test is a heuristic, not a proof — `maxWaves` (Rule 2) is the hard stop that always holds; the guard only saves wasted waves when a stall repeats verbatim. Repetition isn't persistence; it's a stuck actuator.
6. **Rate discipline.** Cap wave width; stagger if the host throttles. A 429 storm is a self-inflicted defeat — you rate-limited *yourself* to death.
7. **Model discipline.** Workers use the host's inherited model unless the user explicitly requests an override.
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
