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

Use these schemas in the controller. Agents return raw JSON; the controller parses it, validates the exact shape, and requests one correction before treating the response as a gap.

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

function validateJsonObject(rawResponse, schema) {
  let response;
  try {
    response = typeof rawResponse === "string"
      ? JSON.parse(rawResponse)
      : rawResponse;
  } catch {
    return null;
  }
  if (response === null || typeof response !== "object" || Array.isArray(response)) {
    return null;
  }
  const expectedKeys = [...schema.required].sort();
  const actualKeys = Object.keys(response).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return null;
  }
  for (const key of schema.required) {
    const definition = schema.properties[key];
    const value = response[key];
    if (definition.type === "string" && typeof value !== "string") return null;
    if (
      definition.type === "array" &&
      (!Array.isArray(value) ||
        value.some((item) => typeof item !== definition.items.type) ||
        (definition.maxItems !== undefined && value.length > definition.maxItems))
    ) {
      return null;
    }
    if (definition.enum && !definition.enum.includes(value)) return null;
  }
  return response;
}
```

### Host Adapters

**Codex:**
- Use `spawn_agent` with `fork_turns: "none"` and all player context in the prompt.
- Ask for the exact keys `move`, `alliance`, `threat`, `price`, and `threatLevel`.
- Use `list_agents` to derive current capacity, choose an unused run component, and read completed payloads keyed by the canonical task names returned from `spawn_agent`.
- Use `wait_agent` only as a mailbox notification, `followup_task` for one correction, and `interrupt_agent` for workers still pending at the deadline. Leaf workers never spawn.
- Inherit the orchestrator model. Forward `userRequestedModel` only when the user explicitly named a model; never infer an override.

**Claude Code:**
- Call `Agent` with required `description` and `prompt` fields. `subagent_type` is optional. The current tool does not accept `schema`.
- Request raw JSON in the prompt, then validate it against `PLAYER_SCHEMA` or `ADVERSARY_SCHEMA` in the controller and request one correction if needed.
- Use `Promise.all` only for independent players.

### Single Adversary

Spawn one agent for focused opponent modeling:

```javascript
async function runClaudeAdversary() {
  let rawResponse = await Agent({
    description: "Adversary: [role]",
    prompt: `Model [OPPONENT] as ruthless rational actor.

OPPONENT: [role/name]
GOALS: [what they want — specific]
RESOURCES: [leverage, relationships, info, authority]
CONSTRAINTS: [what stops them from going nuclear]

TARGET is about to: [user's planned move]

Assume competent and self-interested. What's their counter-move?
Return only raw JSON with exactly these keys: counter, exploits, escalation, weakPoint.
No Markdown fences. No caveats. Most likely play, stated cold.`
  });
  let response = validateJsonObject(rawResponse, ADVERSARY_SCHEMA);
  if (!response) {
    rawResponse = await Agent({
      description: "Correct adversary JSON",
      prompt: `The prior response was invalid: ${rawResponse}
Return only raw JSON with exactly these keys: counter, exploits, escalation, weakPoint.`
    });
    response = validateJsonObject(rawResponse, ADVERSARY_SCHEMA);
  }
  if (!response) throw new Error("Claude adversary returned invalid JSON after correction.");
  return response;
}
```

### Multi-Party (Bounded Waves)

Dispatch only independent players. At most five player models run per invocation, and each wave is capped by current worker capacity:

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

function availableCodexWorkerSlots(agents) {
  const activeAgentCount = agents.filter((agent) =>
    ["pending", "running", "working"].includes(agent.agent_status)
  ).length;
  return Math.max(0, CODEX_TEAM_SLOT_LIMIT - activeAgentCount);
}

function hasExactKeys(value, expectedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

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
  const collectionGaps = players.slice(MAX_PLAYER_MODELS).map((player) => ({
    workerTask: null,
    player: player.name,
    gap: `Player ${player.name} was not dispatched because the ${MAX_PLAYER_MODELS}-player cap was reached.`
  }));
  const initialAgentSnapshot = await list_agents({});
  const runComponent = chooseUnusedRunComponent(initialAgentSnapshot.agents, "player");

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

Return only raw JSON with exactly these keys: ${PLAYER_OUTPUT_KEYS.join(", ")}.
No Markdown fences.`
    });
    return { workerTask, player };
  }

  async function collectCodexPlayerFinals(workerTasks) {
    const playerByWorkerTask = new Map(
      workerTasks.map(({ workerTask, player }) => [workerTask, player])
    );
    const pendingWorkerTasks = new Set(workerTasks.map(({ workerTask }) => workerTask));
    const resultsByWorkerTask = new Map();
    const correctionRequested = new Set();
    const rejectedFinalByWorkerTask = new Map();
    const collectionGaps = [];
    const collectionDeadline = Date.now() + COLLECTION_TIMEOUT_MS;

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
        const response = validateJsonObject(rawResponse, PLAYER_SCHEMA);
        if (!hasExactKeys(response, PLAYER_OUTPUT_KEYS)) {
          if (correctionRequested.has(workerTask)) {
            const player = playerByWorkerTask.get(workerTask);
            collectionGaps.push({
              workerTask,
              player: player.name,
              gap: `Player ${player.name} returned invalid JSON after one correction.`
            });
            pendingWorkerTasks.delete(workerTask);
            continue;
          }
          if (Date.now() >= collectionDeadline) continue;
          await followup_task({
            target: workerTask,
            message: `Return only raw JSON with exactly these keys: ${PLAYER_OUTPUT_KEYS.join(", ")}. No Markdown fences.`
          });
          correctionRequested.add(workerTask);
          rejectedFinalByWorkerTask.set(workerTask, rawResponse);
          // The next pass rechecks collectionDeadline before waiting for this correction.
          continue;
        }
        const player = playerByWorkerTask.get(workerTask);
        resultsByWorkerTask.set(workerTask, { workerTask, player, response });
        pendingWorkerTasks.delete(workerTask);
      }
    }

    for (const workerTask of pendingWorkerTasks) {
      await interrupt_agent({ target: workerTask });
      const player = playerByWorkerTask.get(workerTask);
      collectionGaps.push({
        workerTask,
        player: player.name,
        gap: `No valid final was delivered for player ${player.name} from canonical task ${workerTask} before the ${COLLECTION_TIMEOUT_DESCRIPTION} collection deadline.`
      });
    }
    return { resultsByWorkerTask, collectionGaps };
  }

  let nextPlayerDispatchIndex = 0;
  let waveIndex = 0;
  while (remainingPlayers.length > 0) {
    const currentAgentSnapshot = await list_agents({});
    const availableWorkerSlots = availableCodexWorkerSlots(currentAgentSnapshot.agents);
    if (availableWorkerSlots <= 0) {
      for (const player of remainingPlayers.splice(0)) {
        collectionGaps.push({
          workerTask: null,
          player: player.name,
          gap: `Player ${player.name} was not dispatched because no Codex worker slot was available.`
        });
      }
      break;
    }

    const waveWidth = Math.min(
      MAX_PLAYER_MODELS,
      availableWorkerSlots,
      remainingPlayers.length
    );
    const wave = remainingPlayers.splice(0, waveWidth);
    const workerTasks = await Promise.all(
      wave.map((player) => {
        const workerTaskName = `player_${runComponent}_w${waveIndex}_${nextPlayerDispatchIndex++}`;
        return dispatchCodexPlayer(workerTaskName, player, userRequestedModel);
      })
    );
    const { resultsByWorkerTask, collectionGaps: waveCollectionGaps } =
      await collectCodexPlayerFinals(workerTasks);
    for (const { workerTask } of workerTasks) {
      const keyedResult = resultsByWorkerTask.get(workerTask);
      if (keyedResult) results.push(keyedResult);
    }
    collectionGaps.push(...waveCollectionGaps);
    waveIndex += 1;
  }

  return synthesizeBoard({ players, results, collectionGaps });
}
```

For Claude Code, use the same capped `wave`. Each `Agent` call contains only `description` and `prompt`, requests raw JSON with the five exact keys, and returns to controller-side `PLAYER_SCHEMA` validation. `Promise.all` remains limited to the bounded, independent wave.

The invocation explicitly supplies `situation` and `explicitlyRequestedModel`; `userRequestedModel` is assigned from that explicit field and remains `undefined` when the user named no model. The conditional model field therefore never guesses an override. Before dispatch, `list_agents` supplies every existing canonical task name. The controller selects the first unused `rN` component and combines it with the wave number and a run-wide monotonic dispatch index, producing collision-free names containing only lowercase letters, digits, and underscores. The player's human name stays in `message`.

Codex's team limit is four slots including the controller. Each wave derives free capacity from non-completed `list_agents` entries. `wait_agent` accepts only `timeout_ms`; it signals a mailbox update, not a worker payload. The next `list_agents` snapshot exposes completed text as `agent_status.completed`, keyed by `agent_name`. Codex may also deliver a `FINAL_ANSWER` message directly into the controller conversation; treat its sender task name and payload identically. Each collector stops starting waits at its wall-clock deadline, interrupts every task still pending, and emits a player-keyed gap. Undispatched players and players beyond the cap also receive explicit gaps. Results retain `{ workerTask, player, response }`, so a missing response cannot shift attribution.

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
  let rawResponse = await Agent({
    description: `Wargame turn ${turn + 1}`,
    prompt: `Prior history: ${JSON.stringify(state.history)}

User's move: ${userMove}
Opponent: [role] with goals [X] and leverage [Y]

What's opponent's counter-move this turn?
Return only raw JSON with exactly these keys: counter, exploits, escalation, weakPoint.`
  });
  let response = validateJsonObject(rawResponse, ADVERSARY_SCHEMA);
  if (!response) {
    rawResponse = await Agent({
      description: `Correct wargame turn ${turn + 1} JSON`,
      prompt: `The prior response was invalid: ${rawResponse}
Return only raw JSON with exactly these keys: counter, exploits, escalation, weakPoint.`
    });
    response = validateJsonObject(rawResponse, ADVERSARY_SCHEMA);
  }
  if (!response) throw new Error(`Wargame turn ${turn + 1} returned invalid JSON.`);

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
