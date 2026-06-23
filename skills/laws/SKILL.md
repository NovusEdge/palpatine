---
name: laws
description: Quick reference for the 48 Laws of Power. Browse, search, or get specific laws.
---

# Laws Reference

Invoked via `/palpatine:laws` or `/palpatine:laws <query>`.

## Usage

| Command | Action |
|---------|--------|
| `/palpatine:laws` | List all 48 laws (names only) |
| `/palpatine:laws 7` | Show Law 7 in detail |
| `/palpatine:laws boss` | Search laws by keyword |
| `/palpatine:laws negotiation` | Search by situation |

## Quick Lookup

Run grep on law_index.json:
```bash
# By number
grep -A5 '"id": 7,' "${CLAUDE_PLUGIN_ROOT}/law_index.json"

# By keyword
grep -i -B2 -A5 "boss\|manager\|superior" "${CLAUDE_PLUGIN_ROOT}/law_index.json"

# By situation
grep -i -B2 -A5 "negotiation" "${CLAUDE_PLUGIN_ROOT}/law_index.json"
```

## Output Format

**Single law:**
```
**Law [N]: [Name]**
*"[Essence]"*

**When:** [situations]
**Reversal:** [when to do opposite]
**Keywords:** [for matching]
```

**List:**
```
1. Never Outshine the Master
2. Never Put Too Much Trust in Friends...
...
48. Assume Formlessness
```

**Search results:**
```
**Matching laws for "[query]":**
- Law [N]: [Name] — [essence snippet]
- Law [M]: [Name] — [essence snippet]
```

## Thematic Groups

For quick mental access:

**Power building:** 5, 6, 11, 25, 27, 34
**Relationships:** 1, 2, 10, 12, 14, 18, 46
**Conflict:** 8, 9, 15, 19, 22, 39, 42, 44
**Self-control:** 4, 17, 28, 35, 47, 48
**Deception:** 3, 7, 21, 26, 30, 31
**Image:** 16, 24, 30, 32, 37, 38
**Strategic patience:** 8, 22, 29, 35, 45

## All Laws (Quick Reference)

1. Never Outshine the Master
2. Never Put Too Much Trust in Friends, Learn How to Use Enemies
3. Conceal Your Intentions
4. Always Say Less Than Necessary
5. So Much Depends on Reputation - Guard It with Your Life
6. Court Attention at All Cost
7. Get Others to Do the Work, but Always Take the Credit
8. Make Other People Come to You - Use Bait if Necessary
9. Win Through Your Actions, Never Through Argument
10. Infection: Avoid the Unhappy and Unlucky
11. Learn to Keep People Dependent on You
12. Use Selective Honesty and Generosity to Disarm Your Victim
13. When Asking for Help, Appeal to Self-Interest, Never Mercy
14. Pose as a Friend, Work as a Spy
15. Crush Your Enemy Totally
16. Use Absence to Increase Respect and Honor
17. Keep Others in Suspended Terror: Cultivate an Air of Unpredictability
18. Do Not Build Fortresses to Protect Yourself - Isolation is Dangerous
19. Know Who You're Dealing With - Do Not Offend the Wrong Person
20. Do Not Commit to Anyone
21. Play a Sucker to Catch a Sucker - Seem Dumber Than Your Mark
22. Use the Surrender Tactic: Transform Weakness into Power
23. Concentrate Your Forces
24. Play the Perfect Courtier
25. Re-Create Yourself
26. Keep Your Hands Clean
27. Play on People's Need to Believe to Create a Cultlike Following
28. Enter Action with Boldness
29. Plan All the Way to the End
30. Make Your Accomplishments Seem Effortless
31. Control the Options: Get Others to Play with the Cards You Deal
32. Play to People's Fantasies
33. Discover Each Man's Thumbscrew
34. Be Royal in Your Own Fashion: Act Like a King to Be Treated Like One
35. Master the Art of Timing
36. Disdain Things You Cannot Have: Ignoring Them is the Best Revenge
37. Create Compelling Spectacles
38. Think as You Like but Behave Like Others
39. Stir Up Waters to Catch Fish
40. Despise the Free Lunch
41. Avoid Stepping into a Great Man's Shoes
42. Strike the Shepherd and the Sheep Will Scatter
43. Work on the Hearts and Minds of Others
44. Disarm and Infuriate with the Mirror Effect
45. Preach the Need for Change, but Never Reform Too Much at Once
46. Never Appear Too Perfect
47. Do Not Go Past the Mark You Aimed For; In Victory, Learn When to Stop
48. Assume Formlessness
