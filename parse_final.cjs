const fs = require('fs');

const filePath = "C:\\\\Users\\\\meeli\\\\Operion OS GitHub\\\\OperionOS-backend\\\\test\\\\phase3c-runtime-trace.jsonl";
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\\r?\\n/).filter(line => line.trim() !== '');

const events = lines.map(JSON.parse);

console.log('total_events:', events.length);

const test_results = events.filter(e => e.event === 'test_result');
console.log('test_result_count:', test_results.length);

const fail_count = test_results.filter(e => e.status !== 'PASS').length;
console.log('fail_count:', fail_count);

const latest_by_testId = {};
test_results.forEach(e => {
  latest_by_testId[e.testId] = e.status;
});
console.log('latest status by testId:', latest_by_testId);

const cleanup_verifications = events.filter(e => e.event === 'cleanup_verification');
const latest_cleanup = cleanup_verifications[cleanup_verifications.length - 1];
console.log('cleanup_verification latest:', latest_cleanup ? latest_cleanup.result : 'none');

const auth_cleanup_verifications = events.filter(e => e.event === 'auth_cleanup_verification');
const latest_auth_cleanup = auth_cleanup_verifications[auth_cleanup_verifications.length - 1];
console.log('auth_cleanup_verification latest:', latest_auth_cleanup ? latest_auth_cleanup.result : 'none');