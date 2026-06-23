#!/usr/bin/env node
/**
 * Auto-law matching hook for /palpatine skill
 * Reads user input from stdin, matches against law_index.json, outputs applicable laws
 */

const fs = require('fs');
const path = require('path');

// Read input from stdin (hook passes conversation context)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const userMessage = extractUserMessage(data);
    if (!userMessage) process.exit(0);

    const laws = loadLaws();
    const matched = matchLaws(userMessage.toLowerCase(), laws);

    if (matched.length > 0) {
      outputMatches(matched);
    }
  } catch (e) {
    // Silent fail - don't break the skill if hook fails
    process.exit(0);
  }
});

function extractUserMessage(data) {
  // Hook receives conversation context - extract latest user message
  if (data.user_message) return data.user_message;
  if (data.messages && data.messages.length > 0) {
    const last = data.messages[data.messages.length - 1];
    if (last.role === 'user') return last.content;
  }
  return null;
}

function loadLaws() {
  const lawPath = path.join(__dirname, '..', 'law_index.json');
  const raw = fs.readFileSync(lawPath, 'utf8');
  return JSON.parse(raw).laws;
}

function matchLaws(text, laws) {
  const scored = laws.map(law => {
    let score = 0;

    // Keyword matches
    for (const kw of law.keywords || []) {
      if (text.includes(kw.toLowerCase())) score += 2;
    }

    // "When" condition matches
    for (const when of law.when || []) {
      if (text.includes(when.toLowerCase())) score += 3;
    }

    // Partial matches in essence
    const essenceWords = law.essence.toLowerCase().split(/\s+/);
    for (const word of essenceWords) {
      if (word.length > 4 && text.includes(word)) score += 1;
    }

    return { law, score };
  });

  // Return top 3 with score > 0, sorted by score
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.law);
}

function outputMatches(laws) {
  console.log('\n**Matched Laws** (auto-detected):');
  for (const law of laws) {
    console.log(`- **Law ${law.id}:** ${law.name} — ${law.essence}`);
    if (law.reversal) {
      console.log(`  - *Reversal:* ${law.reversal}`);
    }
  }
  console.log('');
}
