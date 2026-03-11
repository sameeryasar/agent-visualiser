import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as assert from 'assert';
import { createStateManager } from './state-manager';
import { ParsedEvent } from './jsonl-parser';

// ── Test 1: onSessionChanged resets state correctly ───────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/home/user/project');

  const state = sm.getState();
  assert.ok(state.session, 'session should be set');
  assert.strictEqual(state.session!.id, 'sess-1');
  assert.strictEqual(state.session!.project, '/home/user/project');
  assert.ok(typeof state.session!.startTime === 'string', 'startTime should be a string');

  assert.strictEqual(state.agents.length, 1, 'should have exactly one agent');
  const mainAgent = state.agents[0];
  assert.strictEqual(mainAgent.id, 'main');
  assert.strictEqual(mainAgent.type, 'main');
  assert.strictEqual(mainAgent.status, 'running');
  assert.strictEqual(mainAgent.parentId, null);
  assert.strictEqual(mainAgent.currentTool, null);
  assert.deepStrictEqual(mainAgent.tokens, { input: 0, output: 0, cacheRead: 0, cacheCreated: 0 });

  assert.deepStrictEqual(state.tasks, []);
  assert.deepStrictEqual(state.tokens, { input: 0, output: 0, cacheRead: 0, cacheCreated: 0 });

  console.log('PASS: onSessionChanged resets state correctly');
}

// ── Test 2: onSessionChanged resets existing state ────────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-A', '/path/a');

  // Add an agent manually by processing events
  sm.onEvents(null, [
    { kind: 'agent_launched', agentId: 'child-1', parentId: null, input: {} },
  ]);

  assert.strictEqual(sm.getState().agents.length, 2, 'should have 2 agents before reset');

  // Reset to a new session
  sm.onSessionChanged('sess-B', '/path/b');

  const state = sm.getState();
  assert.strictEqual(state.session!.id, 'sess-B');
  assert.strictEqual(state.agents.length, 1, 'should have only main agent after reset');
  assert.strictEqual(state.agents[0].id, 'main');
  assert.deepStrictEqual(state.tasks, []);

  console.log('PASS: onSessionChanged resets existing state correctly');
}

// ── Test 3: agent_launched adds child agent ───────────────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  const events: ParsedEvent[] = [
    {
      kind: 'agent_launched',
      agentId: 'child-uuid',
      parentId: 'main',
      input: { prompt: 'do something' },
    },
  ];
  sm.onEvents(null, events);

  const state = sm.getState();
  assert.strictEqual(state.agents.length, 2);
  const child = state.agents.find((a) => a.id === 'child-uuid');
  assert.ok(child, 'child agent should exist');
  assert.strictEqual(child!.type, 'agent');
  assert.strictEqual(child!.status, 'running');
  assert.strictEqual(child!.parentId, 'main');
  assert.strictEqual(child!.currentTool, null);
  assert.deepStrictEqual(child!.tokens, { input: 0, output: 0, cacheRead: 0, cacheCreated: 0 });

  console.log('PASS: agent_launched adds child agent');
}

// ── Test 4: agent_launched uses subagent_type for type ────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  sm.onEvents(null, [
    {
      kind: 'agent_launched',
      agentId: 'explore-agent',
      parentId: null,
      input: { subagent_type: 'Explore', prompt: 'explore codebase' },
    },
  ]);

  const child = sm.getState().agents.find((a) => a.id === 'explore-agent');
  assert.ok(child);
  assert.strictEqual(child!.type, 'Explore');

  console.log('PASS: agent_launched uses subagent_type for type');
}

// ── Test 5: token_usage accumulates into agent and global ─────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  sm.onEvents(null, [
    { kind: 'token_usage', agentId: null, input: 100, output: 50, cacheRead: 10, cacheCreated: 5 },
  ]);
  sm.onEvents(null, [
    { kind: 'token_usage', agentId: null, input: 200, output: 100, cacheRead: 20, cacheCreated: 10 },
  ]);

  const state = sm.getState();
  const main = state.agents.find((a) => a.id === 'main')!;
  assert.deepStrictEqual(main.tokens, { input: 300, output: 150, cacheRead: 30, cacheCreated: 15 });
  assert.deepStrictEqual(state.tokens, { input: 300, output: 150, cacheRead: 30, cacheCreated: 15 });

  console.log('PASS: token_usage accumulates into agent and global totals');
}

// ── Test 6: token_usage for named agent accumulates correctly ─────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  sm.onEvents(null, [
    { kind: 'agent_launched', agentId: 'child-1', parentId: null, input: {} },
  ]);
  sm.onEvents('child-1', [
    { kind: 'token_usage', agentId: 'child-1', input: 50, output: 25, cacheRead: 5, cacheCreated: 2 },
  ]);
  sm.onEvents(null, [
    { kind: 'token_usage', agentId: null, input: 100, output: 50, cacheRead: 0, cacheCreated: 0 },
  ]);

  const state = sm.getState();
  const child = state.agents.find((a) => a.id === 'child-1')!;
  assert.deepStrictEqual(child.tokens, { input: 50, output: 25, cacheRead: 5, cacheCreated: 2 });
  // Global should include both
  assert.deepStrictEqual(state.tokens, { input: 150, output: 75, cacheRead: 5, cacheCreated: 2 });

  console.log('PASS: token_usage for named agent accumulates correctly');
}

// ── Test 7: agent_completed sets status and clears currentTool ────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  sm.onEvents(null, [{ kind: 'tool_use', agentId: null, toolName: 'Bash', toolInput: null }]);
  const mainBefore = sm.getState().agents.find((a) => a.id === 'main')!;
  assert.strictEqual(mainBefore.currentTool, 'Bash', 'currentTool should be set');

  sm.onEvents(null, [{ kind: 'agent_completed', agentId: null }]);

  const main = sm.getState().agents.find((a) => a.id === 'main')!;
  assert.strictEqual(main.status, 'completed');
  assert.strictEqual(main.currentTool, null, 'currentTool should be cleared on completion');

  console.log('PASS: agent_completed sets status and clears currentTool');
}

// ── Test 8: tool_use updates currentTool ─────────────────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  sm.onEvents(null, [{ kind: 'tool_use', agentId: null, toolName: 'Read', toolInput: null }]);
  const main = sm.getState().agents.find((a) => a.id === 'main')!;
  assert.strictEqual(main.currentTool, 'Read');

  // Update to a different tool
  sm.onEvents(null, [{ kind: 'tool_use', agentId: null, toolName: 'Write', toolInput: null }]);
  assert.strictEqual(sm.getState().agents.find((a) => a.id === 'main')!.currentTool, 'Write');

  console.log('PASS: tool_use updates currentTool');
}

// ── Test 9: onTaskFile inserts new task ───────────────────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  const tmpFile = path.join(os.tmpdir(), `task-test-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({
    id: 'task-uuid-1',
    subject: 'Fix the bug',
    status: 'pending',
    activeForm: null,
  }), 'utf8');

  try {
    sm.onTaskFile(tmpFile);
    const tasks = sm.getState().tasks;
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].id, 'task-uuid-1');
    assert.strictEqual(tasks[0].subject, 'Fix the bug');
    assert.strictEqual(tasks[0].status, 'pending');
    assert.strictEqual(tasks[0].activeForm, null);

    console.log('PASS: onTaskFile inserts new task');
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// ── Test 10: onTaskFile upserts (replaces) existing task ──────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  const tmpFile = path.join(os.tmpdir(), `task-test-${Date.now()}.json`);

  // First insert
  fs.writeFileSync(tmpFile, JSON.stringify({
    id: 'task-uuid-2',
    subject: 'Original subject',
    status: 'pending',
    activeForm: null,
  }), 'utf8');
  sm.onTaskFile(tmpFile);

  // Update same task
  fs.writeFileSync(tmpFile, JSON.stringify({
    id: 'task-uuid-2',
    subject: 'Updated subject',
    status: 'in_progress',
    activeForm: 'some form text',
  }), 'utf8');
  sm.onTaskFile(tmpFile);

  try {
    const tasks = sm.getState().tasks;
    assert.strictEqual(tasks.length, 1, 'should still have one task after upsert');
    assert.strictEqual(tasks[0].subject, 'Updated subject');
    assert.strictEqual(tasks[0].status, 'in_progress');
    assert.strictEqual(tasks[0].activeForm, 'some form text');

    console.log('PASS: onTaskFile upserts existing task correctly');
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// ── Test 11: onTaskFile adds multiple distinct tasks ─────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  const tmp1 = path.join(os.tmpdir(), `task-a-${Date.now()}.json`);
  const tmp2 = path.join(os.tmpdir(), `task-b-${Date.now()}.json`);

  fs.writeFileSync(tmp1, JSON.stringify({ id: 'task-a', subject: 'Task A', status: 'pending', activeForm: null }), 'utf8');
  fs.writeFileSync(tmp2, JSON.stringify({ id: 'task-b', subject: 'Task B', status: 'completed', activeForm: null }), 'utf8');

  try {
    sm.onTaskFile(tmp1);
    sm.onTaskFile(tmp2);

    const tasks = sm.getState().tasks;
    assert.strictEqual(tasks.length, 2);
    assert.ok(tasks.some((t) => t.id === 'task-a'));
    assert.ok(tasks.some((t) => t.id === 'task-b'));

    console.log('PASS: onTaskFile adds multiple distinct tasks');
  } finally {
    fs.unlinkSync(tmp1);
    fs.unlinkSync(tmp2);
  }
}

// ── Test 12: change event fires after mutations ────────────────────────────────
{
  const sm = createStateManager();
  let changeCount = 0;
  const listener = () => { changeCount++; };
  sm.on('change', listener);

  sm.onSessionChanged('sess-1', '/proj');
  assert.strictEqual(changeCount, 1, 'change fired after onSessionChanged');

  sm.onEvents(null, [{ kind: 'tool_use', agentId: null, toolName: 'Bash', toolInput: null }]);
  assert.strictEqual(changeCount, 2, 'change fired after onEvents with tool_use');

  sm.onEvents(null, [{ kind: 'agent_completed', agentId: null }]);
  assert.strictEqual(changeCount, 3, 'change fired after agent_completed');

  const tmpFile = path.join(os.tmpdir(), `task-evt-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({ id: 'task-z', subject: 'Z', status: 'pending', activeForm: null }), 'utf8');
  try {
    sm.onTaskFile(tmpFile);
    assert.strictEqual(changeCount, 4, 'change fired after onTaskFile');
  } finally {
    fs.unlinkSync(tmpFile);
  }

  sm.off('change', listener);
  sm.onSessionChanged('sess-2', '/proj2');
  assert.strictEqual(changeCount, 4, 'change not fired after off()');

  console.log('PASS: change event fires after mutations and off() works');
}

// ── Test 13: empty events array does not emit change ─────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  let changeCount = 0;
  sm.on('change', () => { changeCount++; });

  const countBefore = changeCount;
  sm.onEvents(null, []);
  assert.strictEqual(changeCount, countBefore, 'no change event for empty events array');

  console.log('PASS: empty events array does not emit change');
}

// ── Test 14: getState returns consistent snapshot ─────────────────────────────
{
  const sm = createStateManager();
  sm.onSessionChanged('sess-1', '/proj');

  const state1 = sm.getState();
  sm.onEvents(null, [{ kind: 'token_usage', agentId: null, input: 10, output: 5, cacheRead: 0, cacheCreated: 0 }]);
  const state2 = sm.getState();

  // After mutation, getState returns the updated state
  assert.strictEqual(state2.tokens.input, 10);

  console.log('PASS: getState returns updated state after mutations');
}

console.log('\nAll state-manager tests passed.');
