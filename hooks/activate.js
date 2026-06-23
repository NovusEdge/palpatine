#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const stateFile = path.join(os.homedir(), '.claude', 'palpatine-enabled');

if (fs.existsSync(stateFile)) {
  console.log(`THE DARK SIDE CLOUDS EVERYTHING

*"I can see you. Your mind is mine to control."*

Strategic lens ACTIVE. Flag power dynamics in interpersonal situations.
Append **Power dynamics:** with leverage points and applicable laws.

/palpatine off to disable.`);
}
