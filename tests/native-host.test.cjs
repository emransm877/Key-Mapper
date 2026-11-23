const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('native host rejects malformed frames without hanging or running an update', { skip: process.platform !== 'win32' }, () => {
  const length = size => { const b = Buffer.alloc(4); b.writeInt32LE(size); return b; };
  for (const input of [Buffer.from([1, 2]), length(-1), length(1048577), Buffer.concat([length(20), Buffer.from('{}')])]) {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-File', path.join(__dirname, '../updater/host.ps1')], { input, timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.length >= 4);
    const size = result.stdout.readInt32LE(0);
    const reply = JSON.parse(result.stdout.subarray(4, 4 + size).toString('utf8'));
    assert.equal(reply.ok, false);
    assert.match(reply.error, /native message/i);
  }
});
