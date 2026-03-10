import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as assert from 'assert';
import { createFileReader, ParsedEvent } from './jsonl-parser';

function makeTempFile(content: string): string {
  const tmpPath = path.join(os.tmpdir(), `jsonl-test-${Date.now()}.jsonl`);
  fs.writeFileSync(tmpPath, content, 'utf8');
  return tmpPath;
}

function cleanup(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
}

// ── Test 1: reads no events from an empty file ────────────────────────────────
{
  const tmpFile = makeTempFile('');
  try {
    const reader = createFileReader();
    const events = reader.readNewLines(tmpFile);
    assert.deepStrictEqual(events, [], 'empty file should return no events');
    console.log('PASS: empty file returns []');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 2: second call with no new data returns [] ───────────────────────────
{
  const line = JSON.stringify({ type: 'assistant', agentId: 'a1', message: { stop_reason: 'end_turn' } });
  const tmpFile = makeTempFile(line + '\n');
  try {
    const reader = createFileReader();
    reader.readNewLines(tmpFile); // consume
    const events2 = reader.readNewLines(tmpFile);
    assert.deepStrictEqual(events2, [], 'second call with no new bytes should return []');
    console.log('PASS: second call returns [] when no new data');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 3: agent_completed extracted from stop_reason ───────────────────────
{
  const line = JSON.stringify({
    type: 'assistant',
    agentId: 'agent-42',
    message: { stop_reason: 'end_turn' },
  });
  const tmpFile = makeTempFile(line + '\n');
  try {
    const reader = createFileReader();
    const events = reader.readNewLines(tmpFile);
    const completed = events.filter((e) => e.kind === 'agent_completed');
    assert.strictEqual(completed.length, 1, 'should have one agent_completed event');
    assert.strictEqual((completed[0] as { kind: string; agentId: string | null }).agentId, 'agent-42');
    console.log('PASS: agent_completed extracted correctly');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 4: token_usage extracted ────────────────────────────────────────────
{
  const line = JSON.stringify({
    type: 'assistant',
    agentId: 'agent-tok',
    message: {
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 5,
      },
    },
  });
  const tmpFile = makeTempFile(line + '\n');
  try {
    const reader = createFileReader();
    const events = reader.readNewLines(tmpFile);
    const usage = events.find((e) => e.kind === 'token_usage');
    assert.ok(usage, 'should have a token_usage event');
    assert.strictEqual((usage as Extract<ParsedEvent, { kind: 'token_usage' }>).input, 100);
    assert.strictEqual((usage as Extract<ParsedEvent, { kind: 'token_usage' }>).output, 50);
    assert.strictEqual((usage as Extract<ParsedEvent, { kind: 'token_usage' }>).cacheRead, 10);
    assert.strictEqual((usage as Extract<ParsedEvent, { kind: 'token_usage' }>).cacheCreated, 5);
    console.log('PASS: token_usage extracted correctly');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 5: agent_launched extracted when Agent tool used ─────────────────────
{
  const line = JSON.stringify({
    type: 'assistant',
    agentId: 'parent-agent',
    message: {
      content: [
        {
          type: 'tool_use',
          name: 'Agent',
          input: { prompt: 'do something', model: 'claude-3' },
        },
      ],
    },
  });
  const tmpFile = makeTempFile(line + '\n');
  try {
    const reader = createFileReader();
    const events = reader.readNewLines(tmpFile);
    const launched = events.find((e) => e.kind === 'agent_launched');
    assert.ok(launched, 'should have an agent_launched event');
    const ev = launched as Extract<ParsedEvent, { kind: 'agent_launched' }>;
    assert.strictEqual(ev.parentId, 'parent-agent');
    assert.ok(ev.agentId, 'agentId should be set');
    console.log('PASS: agent_launched extracted correctly');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 6: generic tool_use extracted ───────────────────────────────────────
{
  const line = JSON.stringify({
    type: 'assistant',
    agentId: 'agent-tools',
    message: {
      content: [
        { type: 'tool_use', name: 'Bash' },
        { type: 'tool_use', name: 'Read' },
      ],
    },
  });
  const tmpFile = makeTempFile(line + '\n');
  try {
    const reader = createFileReader();
    const events = reader.readNewLines(tmpFile);
    const toolUses = events.filter((e) => e.kind === 'tool_use');
    assert.strictEqual(toolUses.length, 2, 'should have two tool_use events');
    const names = toolUses.map((e) => (e as Extract<ParsedEvent, { kind: 'tool_use' }>).toolName);
    assert.ok(names.includes('Bash'), 'should include Bash');
    assert.ok(names.includes('Read'), 'should include Read');
    console.log('PASS: tool_use events extracted correctly');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 7: incremental reads (tail-style) ───────────────────────────────────
{
  const tmpFile = makeTempFile('');
  try {
    const reader = createFileReader();

    // First read — nothing
    const events1 = reader.readNewLines(tmpFile);
    assert.deepStrictEqual(events1, [], 'no events before any lines written');

    // Append a line
    fs.appendFileSync(tmpFile, JSON.stringify({
      type: 'assistant',
      agentId: 'a1',
      message: { stop_reason: 'end_turn' },
    }) + '\n');

    const events2 = reader.readNewLines(tmpFile);
    assert.ok(events2.some((e) => e.kind === 'agent_completed'), 'should see agent_completed after append');

    // Append another line
    fs.appendFileSync(tmpFile, JSON.stringify({
      type: 'assistant',
      agentId: 'a2',
      message: { usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } },
    }) + '\n');

    const events3 = reader.readNewLines(tmpFile);
    assert.ok(events3.some((e) => e.kind === 'token_usage'), 'should see token_usage after second append');
    assert.ok(!events3.some((e) => e.kind === 'agent_completed'), 'should not re-emit completed from first append');

    console.log('PASS: incremental tail-style reads work correctly');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 8: bad JSON lines are skipped ───────────────────────────────────────
{
  const goodLine = JSON.stringify({ type: 'assistant', agentId: 'a1', message: { stop_reason: 'end_turn' } });
  const content = 'NOT_JSON\n' + goodLine + '\n{bad json}\n';
  const tmpFile = makeTempFile(content);
  try {
    const reader = createFileReader();
    const events = reader.readNewLines(tmpFile);
    const completed = events.filter((e) => e.kind === 'agent_completed');
    assert.strictEqual(completed.length, 1, 'should have exactly one completed event, bad lines skipped');
    console.log('PASS: bad JSON lines are skipped gracefully');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 9: reset() resets offset ────────────────────────────────────────────
{
  const line = JSON.stringify({ type: 'assistant', agentId: 'a1', message: { stop_reason: 'end_turn' } });
  const tmpFile = makeTempFile(line + '\n');
  try {
    const reader = createFileReader();
    const events1 = reader.readNewLines(tmpFile);
    assert.strictEqual(events1.filter((e) => e.kind === 'agent_completed').length, 1, 'first read has 1 event');

    const events2 = reader.readNewLines(tmpFile);
    assert.strictEqual(events2.length, 0, 'second read has 0 events');

    reader.reset(tmpFile);
    const events3 = reader.readNewLines(tmpFile);
    assert.strictEqual(events3.filter((e) => e.kind === 'agent_completed').length, 1, 'after reset, events reappear');
    console.log('PASS: reset() correctly resets offset');
  } finally {
    cleanup(tmpFile);
  }
}

// ── Test 10: non-existent file returns [] ────────────────────────────────────
{
  const reader = createFileReader();
  const events = reader.readNewLines('/tmp/does-not-exist-xyz-12345.jsonl');
  assert.deepStrictEqual(events, [], 'non-existent file should return []');
  console.log('PASS: non-existent file returns []');
}

console.log('\nAll tests passed.');
