---
name: war
description: Quick reference for the 33 Strategies of War. Browse, search, or get specific strategies.
---

# War Reference

Invoked via `/palpatine:war` or `/palpatine:war <query>`.

## Usage

| Command | Action |
|---------|--------|
| `/palpatine:war` | List all 33 strategies |
| `/palpatine:war 4` | Show Strategy 4 (Death-Ground) |
| `/palpatine:war blitz` | Search by keyword |
| `/palpatine:war outnumbered` | Search by situation |

## Quick Lookup

```bash
# By number
grep -A5 '"id": 4,' "${CLAUDE_PLUGIN_ROOT}/war_index.json"

# By keyword
grep -i -B2 -A5 "speed\|fast\|blitz" "${CLAUDE_PLUGIN_ROOT}/war_index.json"
```

## Output Format

**Single strategy:**
```
**Strategy [N]: [Name]**
*"[Essence]"*

**When:** [situations]
**Keywords:** [for matching]
```

## Thematic Groups

**Self-Directed:** 1-4 (clarity, adaptation, presence, urgency)
**Team:** 5-7 (command, agility, morale)
**Defensive:** 8-11 (economy, counterattack, deterrence, grand strategy)
**Offensive:** 12-23 (intel, speed, leverage, infiltration, maneuver)
**Unconventional:** 24-33 (deception, void, alliances, psychological)

## All Strategies

1. Declare War on Your Enemies (Polarity)
2. Do Not Fight the Last War (Guerrilla-Mind)
3. Presence of Mind (Counterbalance)
4. Create Urgency (Death-Ground)
5. Avoid Groupthink (Command-and-Control)
6. Segment Your Forces (Controlled-Chaos)
7. Transform War into Crusade (Morale)
8. Pick Battles Carefully (Perfect-Economy)
9. Turn the Tables (Counterattack)
10. Make Defense a Pleasure (Deterrence)
11. Lose Battles but Win the War (Grand Strategy)
12. Know Your Enemy (Intelligence)
13. Overwhelm with Speed (Blitzkrieg)
14. Control the Dynamic (Forcing)
15. Hit Them Where It Hurts (Center-of-Gravity)
16. Defeat Them in Detail (Divide-and-Conquer)
17. Defeat from Within (Trojan Horse)
18. Expose the Soft Flank (Turning)
19. Envelop the Enemy (Annihilation)
20. Maneuver into Weakness (Ripening)
21. Negotiate While Advancing (Diplomatic-War)
22. Know How to End Things (Exit)
23. Weave Fact and Fiction (Misperception)
24. Line of Least Expectation (Ordinary-Extraordinary)
25. Occupy Moral High Ground (Righteous)
26. Deny Them Targets (Void)
27. Seem to Work for Others (Alliance)
28. Give Them Rope (One-Upmanship)
29. Take Small Bites (Fait Accompli)
30. Penetrate Their Minds (Communication)
31. Destroy from Within (Inner-Front)
32. Dominate While Submitting (Passive-Aggression)
33. Sow Uncertainty (Terror)
