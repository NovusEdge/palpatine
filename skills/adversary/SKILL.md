---
name: adversary
description: Subagent orchestration for sophisticated opponent modeling and multi-party analysis.
---

# Adversary Simulation

Invoked via `/palpatine:adversary` or auto-triggered for:
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

## Claude Code Agent Patterns

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

### Multi-Party (Parallel)

Spawn all players simultaneously — they're independent analyses:

```javascript
const players = [
  { name: "CEO", goals: "...", leverage: "..." },
  { name: "HR Director", goals: "...", leverage: "..." },
  { name: "Skip-level", goals: "...", leverage: "..." }
];

// All agents run in parallel
const results = await Promise.all(players.map(p => 
  Agent({
    description: `Player: ${p.name}`,
    prompt: `Model ${p.name} as self-interested actor.

PLAYER: ${p.name}
GOALS: ${p.goals}
LEVERAGE: ${p.leverage}
SITUATION: [current state]

What's their move? Who do they ally with? How might they hurt target? What buys them off?
Assume competence and selfishness.`,
    schema: PLAYER_SCHEMA
  })
));
```

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
4. **Cap agent count** — max 5-7 agents per invocation, more = diminishing returns
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
2. Spawn 5 agents in parallel with PLAYER_SCHEMA
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
