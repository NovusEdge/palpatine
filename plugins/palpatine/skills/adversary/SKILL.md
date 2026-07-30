---
name: adversary
description: Subagent orchestration for sophisticated opponent modeling and multi-party analysis.
---

# Adversary Simulation

Invoked via Claude Code `/palpatine:adversary` or Codex `$palpatine:adversary`, or auto-triggered for:
- Wargames with sophisticated opponents
- Multi-party scenarios (3+ players)
- Counter mode with complex stakeholder dynamics

## When to Use Subagents

**Use subagents when:**
- Multiple independent perspectives needed simultaneously
- Opponent sophistication warrants dedicated modeling
- User wants deep multi-party analysis

**Don't use subagents when:**
- Single obvious opponent
- Simple 2-party dynamics
- Quick read is sufficient

## Host Agent Patterns

### Schemas

Use JSON schemas for structured output — no parsing, automatic validation.

```javascript
// Single adversary response
const ADVERSARY_SCHEMA = {
  type: "object",
  properties: {
    counter: { 
      type: "string", 
      description: "Their response move, not reasoning" 
    },
    exploits: { 
      type: "array", 
      items: { type: "string" }, 
      maxItems: 3,
      description: "Target weaknesses they'd hit"
    },
    escalation: { 
      type: "string", 
      description: "How they escalate if resisted" 
    },
    weakPoint: { 
      type: "string", 
      description: "Where they're exposed" 
    }
  },
  required: ["counter", "exploits", "escalation", "weakPoint"]
}

// Multi-party player analysis
const PLAYER_SCHEMA = {
  type: "object",
  properties: {
    move: { type: "string" },
    alliance: { 
      type: "string", 
      description: "Who they side with and why it serves them" 
    },
    threat: { 
      type: "string", 
      description: "How they could hurt target" 
    },
    price: { 
      type: "string", 
      description: "Cost to neutralize or buy them off" 
    },
    threatLevel: { 
      type: "string", 
      enum: ["high", "medium", "low"] 
    }
  },
  required: ["move", "alliance", "threat", "price", "threatLevel"]
}
```

### Host Adapters

**Codex:**
- Use `spawn_agent` with `fork_turns: "none"` and all player context in the prompt.
- Ask for the exact keys `move`, `alliance`, `threat`, `price`, and `threatLevel`.
- Collect each wave from one controller-owned mailbox loop keyed by the canonical task names returned from `spawn_agent`; use `followup_task` when a response needs correction. Leaf workers never spawn.
- Inherit the orchestrator model. Forward `userRequestedModel` only when the user explicitly named a model; never infer an override.

**Claude Code:**
- Use `Agent` with `PLAYER_SCHEMA` or `ADVERSARY_SCHEMA`.
- Use `Promise.all` only for independent players.

### Single Adversary

Spawn one agent for focused opponent modeling:

```javascript
Agent({
  description: "Adversary: [role]",
  prompt: `Model [OPPONENT] as ruthless rational actor.

OPPONENT: [role/name]
GOALS: [what they want — specific]
RESOURCES: [leverage, relationships, info, authority]
CONSTRAINTS: [what stops them from going nuclear]

TARGET is about to: [user's planned move]

Assume competent and self-interested. What's their counter-move?
Return: counter move, exploits they'd hit, escalation path, their weak point.
No caveats. Most likely play, stated cold.`,
  schema: ADVERSARY_SCHEMA
})
```

### Multi-Party (Bounded Waves)

Dispatch only independent players. At most five player models run per invocation, and each wave is capped by current worker capacity:

```javascript
async function runMultiPartyAdversary({
  situation,
  explicitlyRequestedModel,
}) {
  const players = [
    { name: "CEO", goals: "...", leverage: "..." },
    { name: "HR Director", goals: "...", leverage: "..." },
    { name: "Skip-level", goals: "...", leverage: "..." }
  ];

  const userRequestedModel = explicitlyRequestedModel;
  const PLAYER_OUTPUT_KEYS = ["move", "alliance", "threat", "price", "threatLevel"];
  const MAX_PLAYER_MODELS = 5;
  const COLLECTION_TIMEOUT_MS = 120_000;
  const COLLECTION_TIMEOUT_DESCRIPTION = `${COLLECTION_TIMEOUT_MS / 1_000} seconds`;
  const remainingPlayers = players.slice(0, MAX_PLAYER_MODELS);
  const results = [];
  const collectionGaps = [];

  async function dispatchCodexPlayer(workerTaskName, player, userRequestedModel) {
    const { task_name: workerTask } = await spawn_agent({
      task_name: workerTaskName,
      fork_turns: "none",
      ...(userRequestedModel ? { model: userRequestedModel } : {}),
      message: `Model ${player.name} as a self-interested actor.

PLAYER: ${player.name}
GOALS: ${player.goals}
LEVERAGE: ${player.leverage}
SITUATION: ${situation}

Return JSON with exactly these keys: ${PLAYER_OUTPUT_KEYS.join(", ")}.`
    });
    return workerTask;
  }

  async function collectCodexPlayerFinals(workerTasks) {
    const pendingWorkerTasks = new Set(workerTasks);
    const resultsByWorkerTask = new Map();
    const correctionRequested = new Set();
    const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;

    while (pendingWorkerTasks.size > 0 && Date.now() < collectionDeadline) {
      const remainingMs = collectionDeadline - Date.now();
      if (remainingMs <= 0) break;
      // Codex accepts a timeout_ms of at least 10 seconds, so the final wait can overshoot by at most that amount.
      const waitMs = Math.max(10_000, Math.min(60_000, remainingMs));
      await wait_agent({ timeout_ms: waitMs });
      const deliveredFinals = readDeliveredFinals();

      for (const [workerTask, response] of deliveredFinals) {
        if (!pendingWorkerTasks.has(workerTask)) continue;
        if (!hasExactKeys(response, PLAYER_OUTPUT_KEYS)) {
          if (correctionRequested.has(workerTask)) {
            throw new Error(`Worker ${workerTask} returned invalid keys after correction.`);
          }
          if (Date.now() >= collectionDeadline) continue;
          await followup_task({
            target: workerTask,
            message: `Return JSON with exactly these keys: ${PLAYER_OUTPUT_KEYS.join(", ")}.`
          });
          correctionRequested.add(workerTask);
          // The next pass rechecks collectionDeadline before waiting for this correction.
          continue;
        }
        resultsByWorkerTask.set(workerTask, response);
        pendingWorkerTasks.delete(workerTask);
      }
    }

    const collectionGaps = [...pendingWorkerTasks].map((workerTask) =>
      `No final was delivered for canonical player task ${workerTask} before the ${COLLECTION_TIMEOUT_DESCRIPTION} collection deadline.`,
    );
    return { resultsByWorkerTask, collectionGaps };
  }

  let nextPlayerDispatchIndex = 0;
  let waveIndex = 0;
  while (remainingPlayers.length > 0) {
    const availableWorkerSlots = getAvailableWorkerSlots();
    if (availableWorkerSlots <= 0) break;

    const waveWidth = Math.min(
      MAX_PLAYER_MODELS,
      availableWorkerSlots,
      remainingPlayers.length
    );
    const wave = remainingPlayers.splice(0, waveWidth);
    const workerTasks = await Promise.all(
      wave.map((player) => {
        const workerTaskName = `player_w${waveIndex}_${nextPlayerDispatchIndex++}`;
        return dispatchCodexPlayer(workerTaskName, player, userRequestedModel);
      })
    );
    const { resultsByWorkerTask, collectionGaps: waveCollectionGaps } =
      await collectCodexPlayerFinals(workerTasks);
    results.push(...workerTasks.map((workerTask) => resultsByWorkerTask.get(workerTask)).filter(Boolean));
    collectionGaps.push(...waveCollectionGaps);
    waveIndex += 1;
  }

  return synthesizeBoard({ players, results, collectionGaps });
}
```

For Claude Code, use the same capped `wave` and `PLAYER_SCHEMA` with `Agent`; `Promise.all` remains limited to the bounded, independent wave.

The invocation explicitly supplies `situation` and `explicitlyRequestedModel`; `userRequestedModel` is assigned from that explicit field and remains `undefined` when the user named no model. The conditional model field therefore never guesses an override. The controller owns Codex task names: each combines the wave number with one run-wide monotonic dispatch index, so it is unique and contains only lowercase letters, digits, and underscores. The player's human name stays in `message`. `wait_agent` accepts only its optional `timeout_ms`; it signals a mailbox update, not a worker payload, and can return without a player final. Each collector stops starting waits at its wall-clock deadline; Codex's 10-second minimum timeout bounds a final overshoot. Before a correction request, the collector rechecks the deadline; expiry leaves that canonical task pending for the normal `collectionGaps` path and continues processing other delivered finals. `readDeliveredFinals()` yields newly delivered finals keyed by the canonical task name returned from `spawn_agent`. Unreturned canonical player tasks become `collectionGaps`, never invented `PLAYER_SCHEMA` fields, and the board synthesis receives those gaps. The controller never waits inside concurrent player dispatches or rereads stale responses after an unrelated update.

### Synthesis

After parallel agents return, synthesize in main context:

```markdown
## The Board

| Player | Move | Threat | Exploitable |
|--------|------|--------|-------------|
| CEO | [from results] | high | [weakPoint] |
| HR | [from results] | medium | [weakPoint] |
| Skip | [from results] | low | [weakPoint] |

**Alliances:**
- [CEO] ↔ [HR]: [shared interest]
- [Skip-level] isolated: [why]

**Optimal path:** [user's route through]
**Who to neutralize first:** [priority target]
**Who to recruit:** [potential ally + price]
**Collection gaps:** [canonical player tasks that did not return before the deadline]
```

### Sequential Wargaming

When each turn depends on prior response, run sequentially:

```javascript
let state = { situation: "...", history: [] };

for (let turn = 0; turn < 4; turn++) {
  const response = await Agent({
    description: `Wargame turn ${turn + 1}`,
    prompt: `Prior history: ${JSON.stringify(state.history)}
    
User's move: ${userMove}
Opponent: [role] with goals [X] and leverage [Y]

What's opponent's counter-move this turn?`,
    schema: ADVERSARY_SCHEMA
  });
  
  state.history.push({ user: userMove, opponent: response.counter });
  
  // Present turn, get user's next move or synthesize endgame
}
```

## Orchestration Rules

1. **Parallel when independent** — multi-party analysis, initial player modeling
2. **Sequential when dependent** — turn-by-turn wargaming where each move depends on prior
3. **Token discipline** — agents return structured data, synthesis happens in main context
4. **Cap player models** — at most five total player models per invocation, never exceeding available worker slots in one wave
5. **No recursive spawning** — agents don't spawn their own subagents

## Output Discipline

Agents return data. Main context does:
- Synthesis into board state
- Alliance mapping
- Optimal path recommendation
- Risk flagging
- Sign-off

Don't duplicate work — if agent returned it, use the data, don't re-analyze.

## Example Invocation

**User:** "Model how my team will react if I announce I'm leaving for a competitor"

**Execution:**

1. Identify players: manager, skip-level, 2 key peers, HR
2. Spawn up to 5 total player models with PLAYER_SCHEMA, batching by currently available worker slots
3. Collect structured responses
4. Synthesize board:

```
## The Board

| Player | Move | Threat | Price |
|--------|------|--------|-------|
| Manager | Counteroffer + guilt | medium | Will match offer |
| Skip-level | Fast-track promotion | high | Needs you for Q4 |
| Peer A | Jealousy, distance | low | Nothing — self-interest |
| Peer B | "Take me with you" | none | Intel on competitor |
| HR | Exit interview fishing | low | Standard process |

**Alliance:** Manager + Skip aligned to retain you
**Threat:** None high enough to block — clean exit available
**Leverage:** Skip's Q4 dependency = negotiating room if you want to stay

**Play:**
1. Announce to manager first, privately
2. Have counteroffer number ready
3. Don't mention competitor by name initially
4. Skip-level conversation within 24h before manager frames it

*"Everything is proceeding as I have foreseen."*
```
