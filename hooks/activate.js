#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const stateFile = path.join(os.homedir(), '.claude', 'palpatine-enabled');

if (fs.existsSync(stateFile)) {
  console.log(`PALPATINE MODE ACTIVE

Apply the 48 Laws of Power lens to interpersonal and strategic situations.
When relevant, append a brief **Power note:** with applicable law(s).
Toggle off with /palpatine off`);
}
