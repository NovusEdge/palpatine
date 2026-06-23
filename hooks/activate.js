#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const stateFile = path.join(os.homedir(), '.claude', 'palpatine-enabled');

if (fs.existsSync(stateFile)) {
  console.log(`STRATEGIC LENS ACTIVE

Flag power dynamics in interpersonal/strategic situations.
When relevant, append brief **Power dynamics:** with leverage points and applicable laws.
Toggle off: /palpatine off`);
}
