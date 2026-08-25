const fs = require('fs');
const path = require('path');

const filePath = "C:\\\\Users\\\\meeli\\\\Operion OS GitHub\\\\OperionOS-backend\\\\test\\\\phase3c-runtime-trace.jsonl";
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

const events = [];
for (let i = 0; i < lines.length; i++) {
  try {
    events.push(JSON.parse(lines[i]));
  } catch (err) {
    console.error('Error parsing line ' + (i+1) + ': ' + err.message);
  }
}

console.log('Total events:', events.length);

const test_result_events = events.filter(e => e.event === 'test_result');
console.log('test_result count:', test_result_events.length);

// Let's inspect unique keys or complete structure of a test_result
if (test_result_events.length > 0) {
  console.log('test_result key sample:', Object.keys(test_result_events[0]));
  console.log('test_result sample data:', JSON.stringify(test_result_events[0], null, 2));
}

const cleanup_verif_events = events.filter(e => e.event === 'cleanup_verification');
console.log('cleanup_verification count:', cleanup_verif_events.length);
if (cleanup_verif_events.length > 0) {
  console.log('cleanup_verification sample:', JSON.stringify(cleanup_verif_events[cleanup_verif_events.length - 1], null, 2));
}

const auth_cleanup_verif_events = events.filter(e => e.event === 'auth_cleanup_verification');
console.log('auth_cleanup_verification count:', auth_cleanup_verif_events.length);
if (auth_cleanup_verif_events.length > 0) {
  console.log('auth_cleanup_verification sample:', JSON.stringify(auth_cleanup_verif_events[auth_cleanup_verif_events.length - 1], null, 2));
}
