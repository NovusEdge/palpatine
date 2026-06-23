---
name: defense
description: Detect manipulation patterns, identify tactics being used against you, get counter-moves.
---

# Defense Mode

Invoked via `/palpatine:defense` or auto-detected when user says "manipulating me", "is this a power play", "someone is doing X to me".

## Response Format

```
**Pattern detected:** [Name] — [one-line description]
**Indicators:** [what triggered detection]
**Their goal:** [what they're trying to achieve]

**Counter:**
1. [Immediate action]
2. [Longer-term defense]
3. [Exit criteria]

**Laws:** [N] — [how to use defensively]

*"[sign-off]"*
```

## Pattern Library

### DARVO (Deny, Attack, Reverse Victim and Offender)

**What it is:** When confronted, they deny wrongdoing, attack your credibility, then claim they're the real victim.

**Detection:**
- Confrontation triggers immediate counter-accusation
- "I can't believe you'd accuse me of that" + "You're the one who..."
- Sudden emotional escalation when evidence presented
- Your reasonable complaint becomes their grievance

**Counter:**
1. Don't JADE (Justify, Argue, Defend, Explain) — it feeds the reversal
2. Broken record: "That's not what we're discussing. [Original issue]."
3. Document the pivot itself as evidence of pattern
4. Witnesses — DARVO works 1:1, fails with audience

**Laws:** 4 (say less), 9 (don't argue), 36 (disdain things you cannot have)

---

### Triangulation

**What it is:** Using third parties to communicate, create jealousy, or manipulate. "Well, [X] thinks you should..."

**Detection:**
- Information from third parties you should've heard directly
- Comparisons designed to provoke
- Playing people against each other while staying "neutral"
- You feel competitive with someone for no clear reason

**Counter:**
1. Go direct: "I'd rather hear that from [X] directly"
2. Refuse comparison: "That's between you and them"
3. Name it: "It sounds like you're trying to triangulate here"
4. Remove yourself as the third point — refuse to participate

**Laws:** 2 (don't trust friends blindly), 14 (pose as friend, work as spy), 20 (don't commit)

---

### Gaslighting

**What it is:** Making you question your perception of reality. "That never happened." "You're being paranoid."

**Detection:**
- Flat denial of documented events
- "You always..." / "You never..." absolutes
- Your emotional response weaponized ("You're too sensitive")
- Memory conflicts that always favor them
- You increasingly doubt your own judgment

**Counter:**
1. Document everything — timestamps, screenshots, witnesses
2. Trust records over memory
3. Don't argue perception — "My experience was [X]"
4. Reduce contact; gaslighters escalate when losing control
5. External validation — check with trusted third parties

**Laws:** 5 (guard reputation), 17 (cultivate unpredictability), 30 (make accomplishments seem effortless)

---

### Love Bombing / Devaluation Cycle

**What it is:** Excessive early praise/attention, then sudden withdrawal to create dependency.

**Detection:**
- Too much too fast — disproportionate investment early
- Pedestalization followed by criticism
- Affection used as reward/punishment lever
- You're always chasing the "good" version of them

**Counter:**
1. Pace the relationship — don't match their intensity
2. Note the contrast, don't chase the high
3. Maintain outside sources of validation
4. If devaluation starts, don't earn your way back — exit

**Laws:** 11 (create dependency — you're the target), 16 (use absence), 20 (don't commit)

---

### Strategic Incompetence

**What it is:** Doing tasks badly so you stop asking and do it yourself.

**Detection:**
- Competent elsewhere, incompetent here
- Mistakes require your intervention
- No improvement despite feedback
- You've stopped delegating this thing

**Counter:**
1. Don't rescue — let consequences land on them
2. "This needs to be done correctly. How will you fix it?"
3. Document pattern for performance management
4. Reassign with clear accountability, not to yourself

**Laws:** 7 (others do work), 11 (dependency — reversed), 26 (keep hands clean)

---

### Bait and Switch

**What it is:** Promise one thing, deliver another, then make you feel unreasonable for objecting.

**Detection:**
- Verbal promises, written delivery differs
- "That's not what I meant" when held accountable
- Incremental scope changes after commitment
- You feel gaslit about what was agreed

**Counter:**
1. Get it in writing before committing
2. "Let's confirm: you're committing to [X exact terms]?"
3. When switch happens: "This isn't what we agreed. Here's the email."
4. Walk if pattern repeats — they're testing boundaries

**Laws:** 3 (conceal intentions — you're the target), 8 (make others come to you), 31 (control options)

---

### Intermittent Reinforcement

**What it is:** Unpredictable rewards create stronger attachment than consistent ones.

**Detection:**
- Sometimes responsive, sometimes cold — no pattern you can predict
- You're constantly calibrating your behavior to get the "good" response
- Small kindnesses feel disproportionately rewarding
- You're more invested than the relationship warrants

**Counter:**
1. Name it internally — "This is a slot machine, not a relationship"
2. Stop trying to predict/earn the reward
3. Set your own schedule of contact, don't react to theirs
4. Reduce investment to match actual value received

**Laws:** 16 (use absence — you're the target), 17 (unpredictability as control)

---

### Moving the Goalposts

**What it is:** Standards keep changing so you can never satisfy them.

**Detection:**
- Achievement met, new requirement appears
- "That's good, but now you need to..."
- Historical accomplishments discounted
- Approval always slightly out of reach

**Counter:**
1. Get success criteria in writing upfront
2. "These were the criteria. I met them. We're done."
3. Stop playing — recognize infinite game
4. Document the pattern for escalation

**Laws:** 16 (scarcity), 35 (master timing), 47 (don't go past the mark)

---

### Weaponized Emotions

**What it is:** Using anger, tears, or sulking to control outcomes.

**Detection:**
- Emotional displays reliably get them what they want
- You modify behavior to avoid triggering their emotions
- Emotions appear/disappear conveniently
- You feel manipulated but guilty for noticing

**Counter:**
1. Don't reward — "I can see you're upset. Let's revisit when you're calm."
2. Leave the room if needed
3. Decide in advance what you'll do, don't negotiate in the moment
4. Their emotions are their responsibility

**Laws:** 4 (say less), 9 (don't argue), 39 (stir up waters to catch fish — you're the fish)

## Detection Heuristics

When user describes interpersonal situation, scan for:

| Signal | Possible Pattern |
|--------|-----------------|
| "They said I'm being paranoid/sensitive" | Gaslighting |
| "They deny things I know happened" | Gaslighting |
| "They attack me when I bring up issues" | DARVO |
| "They tell me what [X] thinks of me" | Triangulation |
| "They were amazing at first, now..." | Love bombing cycle |
| "I can never meet their standards" | Moving goalposts |
| "They get so upset when I..." | Weaponized emotions |
| "They're great at X but 'can't' do Y" | Strategic incompetence |
| "They promised X but delivered Y" | Bait and switch |
| "Sometimes they're great, sometimes cold" | Intermittent reinforcement |

Multiple patterns can co-occur. Name all that apply.
