import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { parseMainSessionPath, parseSubagentPath } from './session-watcher';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// ── parseMainSessionPath ──────────────────────────────────────────────────────

// Test 1: valid main session path
{
  const filePath = path.join(PROJECTS_DIR, '-Users-foo-Projects-myapp', 'abc123.jsonl');
  const result = parseMainSessionPath(filePath);
  assert.ok(result !== null, 'should parse valid main session path');
  assert.strictEqual(result!.sessionId, 'abc123');
  assert.strictEqual(result!.projectDir, '-Users-foo-Projects-myapp');
  assert.strictEqual(result!.filePath, filePath);
  console.log('PASS: valid main session path parsed correctly');
}

// Test 2: too-deep path (subagent) is NOT a main session
{
  const filePath = path.join(PROJECTS_DIR, '-Users-foo-Projects-myapp', 'abc123', 'subagents', 'sub.jsonl');
  const result = parseMainSessionPath(filePath);
  assert.strictEqual(result, null, 'subagent path should not match main session');
  console.log('PASS: subagent path correctly rejected by parseMainSessionPath');
}

// Test 3: non-jsonl file is rejected
{
  const filePath = path.join(PROJECTS_DIR, '-Users-foo-Projects-myapp', 'abc123.txt');
  const result = parseMainSessionPath(filePath);
  assert.strictEqual(result, null, 'non-.jsonl file should return null');
  console.log('PASS: non-.jsonl file rejected by parseMainSessionPath');
}

// Test 4: file directly in PROJECTS_DIR is rejected (depth 1, not 2)
{
  const filePath = path.join(PROJECTS_DIR, 'orphan.jsonl');
  const result = parseMainSessionPath(filePath);
  assert.strictEqual(result, null, 'depth-1 file should return null');
  console.log('PASS: depth-1 file rejected by parseMainSessionPath');
}

// Test 5: file 3 levels deep (not subagents) is rejected
{
  const filePath = path.join(PROJECTS_DIR, 'proj', 'session', 'something.jsonl');
  const result = parseMainSessionPath(filePath);
  assert.strictEqual(result, null, 'depth-3 non-subagent file should return null');
  console.log('PASS: depth-3 non-subagent file rejected by parseMainSessionPath');
}

// ── parseSubagentPath ─────────────────────────────────────────────────────────

// Test 6: valid subagent path
{
  const filePath = path.join(PROJECTS_DIR, '-Users-foo-Projects-myapp', 'abc123', 'subagents', 'sub-001.jsonl');
  const result = parseSubagentPath(filePath);
  assert.ok(result !== null, 'should parse valid subagent path');
  assert.strictEqual(result!.sessionId, 'abc123');
  console.log('PASS: valid subagent path parsed correctly');
}

// Test 7: main session file is NOT a subagent
{
  const filePath = path.join(PROJECTS_DIR, '-Users-foo-Projects-myapp', 'abc123.jsonl');
  const result = parseSubagentPath(filePath);
  assert.strictEqual(result, null, 'main session path should not match subagent pattern');
  console.log('PASS: main session path correctly rejected by parseSubagentPath');
}

// Test 8: path with wrong intermediate dir name is rejected
{
  const filePath = path.join(PROJECTS_DIR, 'proj', 'session', 'agents', 'file.jsonl');
  const result = parseSubagentPath(filePath);
  assert.strictEqual(result, null, 'wrong intermediate dir should return null');
  console.log('PASS: wrong intermediate dir rejected by parseSubagentPath');
}

// Test 9: non-jsonl subagent path is rejected
{
  const filePath = path.join(PROJECTS_DIR, 'proj', 'session', 'subagents', 'file.txt');
  const result = parseSubagentPath(filePath);
  assert.strictEqual(result, null, 'non-.jsonl subagent file should return null');
  console.log('PASS: non-.jsonl subagent file rejected by parseSubagentPath');
}

console.log('\nAll session-watcher tests passed.');
