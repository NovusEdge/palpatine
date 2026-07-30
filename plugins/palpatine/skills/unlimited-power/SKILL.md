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
const CODEX_TEAM_SLOT_LIMIT = 4;

function chooseUnusedRunComponent(agents, taskPrefix) {
  const existingLeafNames = agents.map((agent) => agent.agent_name.split("/").at(-1));
  for (let runIndex = 0; ; runIndex += 1) {
    const runComponent = `r${runIndex}`;
    const reservedPrefix = `${taskPrefix}_${runComponent}_`;
    if (!existingLeafNames.some((name) => name.startsWith(reservedPrefix))) {
      return runComponent;
    }
  }
}

function agentConsumesCodexSlot(agent) {
  const status = agent.agent_status;
  if (["pending", "running", "working"].includes(status)) return true;
  return status !== null &&
    typeof status === "object" &&
    !Object.prototype.hasOwnProperty.call(status, "completed");
}

function availableCodexWorkerSlots(agents) {
  const activeAgentCount = agents.filter(agentConsumesCodexSlot).length;
  return Math.max(0, CODEX_TEAM_SLOT_LIMIT - activeAgentCount);
}

async function runUnlimitedPower({
  objective,
  explicitlyRequestedModel,
}) {
  // PRIME RULE — refuse blind objectives.
  const done = defineAcceptanceCheck(objective);
  if (!done) return terminate("no-stop-condition", "No verifiable done-condition.");

  const userRequestedModel = explicitlyRequestedModel;
  let plan = decompose(objective);   // → dependency-LAYERED: a wave holds only independent tasks; dependents land in later waves
  let dispatched = 0, lastGap = null;
  let nextWorkerDispatchIndex = 0;
  const initialAgentSnapshot = await list_agents({});
  const runComponent = chooseUnusedRunComponent(initialAgentSnapshot.agents, "worker");

  for (let wave = 0; wave < BUDGET.maxWaves; wave++) {
    if (plan.length === 0) {
      const gap = lastGap === null
        ? "No runnable tasks were produced for the objective."
        : `No runnable tasks were produced for the remaining gap: ${lastGap}`;
      return terminate("stalled", gap);
    }

    const remainingDispatchBudget = BUDGET.maxDispatch - dispatched;
    if (remainingDispatchBudget === 0) break;

    const currentAgentSnapshot = await list_agents({});
    const availableWorkerSlots = availableCodexWorkerSlots(currentAgentSnapshot.agents);
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
        const workerTaskName = `worker_${runComponent}_w${wave}_${nextWorkerDispatchIndex++}`;
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
}
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
function normalizeWorkerResponse(rawResponse) {
  let response;
  try {
    response = typeof rawResponse === "string"
      ? JSON.parse(rawResponse)
      : rawResponse;
  } catch {
    return null;
  }
  const requiredKeys = ["result", "done", "gap", "evidence", "confidence"];
  if (
    response === null ||
    typeof response !== "object" ||
    Array.isArray(response) ||
    Object.keys(response).sort().join(",") !== [...requiredKeys].sort().join(",") ||
    typeof response.result !== "string" ||
    typeof response.done !== "boolean" ||
    typeof response.gap !== "string" ||
    typeof response.evidence !== "string" ||
    !["high", "medium", "low"].includes(response.confidence)
  ) {
    return null;
  }
  return response;
}

async function dispatchWorker(workerTaskName, task, acceptanceCheck, userRequestedModel) {
  const { task_name: workerTask } = await spawn_agent({
    task_name: workerTaskName,
    fork_turns: "none",
    ...(userRequestedModel ? { model: userRequestedModel } : {}),
    message: `Task: ${task.name}

${task.prompt}

Acceptance check: ${acceptanceCheck}
Leaf workers never spawn subagents.
Return only raw JSON with exactly these keys: result, done, gap, evidence, confidence.
No Markdown fences.`
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
  const correctionRequested = new Set();
  const rejectedFinalByWorkerTask = new Map();
  const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;
  const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;

  while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {
    const remainingMs = collectionDeadline - Date.now();
    if (remainingMs <= 0) break;
    // Codex accepts a timeout_ms of at least 10 seconds, so the final wait can overshoot by at most that amount.
    const waitMs = Math.max(10_000, Math.min(60_000, remainingMs));
    await wait_agent({ timeout_ms: waitMs });
    const { agents } = await list_agents({});

    for (const agent of agents) {
      const workerTask = agent.agent_name;
      if (!pendingWorkerTasks.has(workerTask)) continue;
      if (
        typeof agent.agent_status !== "object" ||
        typeof agent.agent_status.completed !== "string"
      ) {
        continue;
      }
      const rawResponse = agent.agent_status.completed;
      if (rejectedFinalByWorkerTask.get(workerTask) === rawResponse) continue;
      const response = normalizeWorkerResponse(rawResponse);
      if (!response) {
        if (correctionRequested.has(workerTask)) {
          resultsByWorkerTask.set(workerTask, {
            result: "Invalid final result.",
            done: false,
            gap: `Worker ${workerTask} returned invalid JSON after one correction.`,
            evidence: `The completed payload for canonical worker task ${workerTask} did not match WORKER_SCHEMA.`,
            confidence: "low"
          });
          pendingWorkerTasks.delete(workerTask);
          continue;
        }
        if (Date.now() >= collectionDeadline) continue;
        await followup_task({
          target: workerTask,
          message: "Return only raw JSON with exactly these keys: result, done, gap, evidence, confidence. No Markdown fences."
        });
        correctionRequested.add(workerTask);
        rejectedFinalByWorkerTask.set(workerTask, rawResponse);
        continue;
      }
      resultsByWorkerTask.set(workerTask, response);
      pendingWorkerTasks.delete(workerTask);
    }
  }
  for (const workerTask of pendingWorkerTasks) {
    await interrupt_agent({ target: workerTask });
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

Before dispatch, `list_agents` supplies every existing canonical task name. The controller selects the first unused `rN` component and combines it with the wave number and one run-wide monotonic dispatch index. Names remain unique across repeated invocations in the same Codex task and contain only lowercase letters, digits, and underscores; the human task name stays in `message`.

Codex's team limit is four slots including the controller. Current active entries use string statuses such as `"running"`; completed entries use an object with a string `completed` payload. Every wave counts active strings and any non-completed object status, while completed objects consume no slot. Pass `userRequestedModel` only when the user explicitly named a model. Otherwise omit it and inherit the orchestrator model. `wait_agent` signals a mailbox update, not a worker payload. The next `list_agents` snapshot exposes completed text as `agent_status.completed`, keyed by `agent_name`. Codex may also deliver a `FINAL_ANSWER` message directly into the controller conversation; treat its sender task name and payload identically. Each collector stops starting waits at its wall-clock deadline, interrupts every task still pending, and creates a low-confidence `WORKER_SCHEMA` result for every missing or invalid worker. Input order is preserved when results return to synthesis.

Codex workers inherit the orchestrator model unless the user explicitly requests an override. Their prompt includes the acceptance check and states that leaf workers never spawn.

**Claude `dispatchWorker`:**

```javascript
async function dispatchClaudeWorker(task, acceptanceCheck) {
  let rawResponse = await Agent({
    description: `Worker: ${task.name}`,
    prompt: `${task.prompt}

Acceptance check: ${acceptanceCheck}
Return only raw JSON with exactly these keys: result, done, gap, evidence, confidence.
No Markdown fences.`
  });
  let response = normalizeWorkerResponse(rawResponse);
  if (!response) {
    rawResponse = await Agent({
      description: `Correct worker ${task.name} JSON`,
      prompt: `The prior response was invalid: ${rawResponse}
Return only raw JSON with exactly these keys: result, done, gap, evidence, confidence.`
    });
    response = normalizeWorkerResponse(rawResponse);
  }
  if (!response) throw new Error(`Worker ${task.name} returned invalid JSON after correction.`);
  return response;
}
```

Claude Code 2.1.220 requires `description` and `prompt`, makes `subagent_type` optional, and does not accept `schema`. `normalizeWorkerResponse` parses the raw JSON and validates `WORKER_SCHEMA`; `collectWorkerResults` receives only controller-validated results.

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
