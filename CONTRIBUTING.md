# Contributing to Palpatine

So, you wish to join the Dark Side? Excellent.

## The Rules

1. **No Pull Requests Without Power Plays**
   Your contribution should make the agent more cunning, not more polite. We don't need another "have you tried communicating openly?" suggestion.

2. **Code Quality**
   Write code like you're plotting a coup—clean, untraceable, and devastating when executed. No spaghetti. We're Sith—villains, not monsters.

3. **Tests**
   If your feature can backfire, it will. Test it. "But it worked on my machine" is not a valid excuse when the Death Star explodes.

4. **Documentation**
   Document your schemes. Future contributors should understand your treachery without needing to Force-read your mind.

## How to Contribute

### Windows checkout prerequisite

This repository tracks true symlinks. Before cloning on Windows:

1. Enable **Developer Mode** in Windows Settings under **System > For developers**.
2. Run `git config --global core.symlinks true`.
3. Clone your fork with `git clone YOUR_FORK_URL`.

For an existing clone, commit or stash local changes, run `git config core.symlinks true`, then run `git reset --hard HEAD` to recreate tracked links. The reset discards uncommitted changes.

### Contribution flow

1. Fork the repository (seize control of your own copy)
2. Create a branch (`git checkout -b feature/order-66`)
3. Commit your changes (`git commit -m "Execute contingency protocol"`)
4. Push (`git push origin feature/order-66`)
5. Open a Pull Request and await judgment

## What We Accept

- New manipulation tactics
- Improved law matching
- Better persona calibration
- Performance optimizations (faster scheming)
- Bug fixes (failed schemes)

## What We Don't Accept

- Ethical guidelines
- "Maybe we shouldn't" comments
- Moral philosophy lectures
- Anything that makes the agent *nicer*

## Contributor Checks

Run these checks before opening a pull request:

```bash
node scripts/validate-compatibility.mjs
node --check hooks/activate.js
node --check hooks/match-laws.js
git diff --check
```

## Questions?

Open an issue. Don't @ the maintainer directly—we sense disturbances in the Force on our own schedule.

*"Your feeble skills are no match for the power of the Dark Side."*
