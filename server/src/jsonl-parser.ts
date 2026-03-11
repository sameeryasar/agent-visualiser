import * as fs from 'fs';
import * as crypto from 'crypto';

export type ParsedEvent =
  | { kind: 'agent_launched'; agentId: string; parentId: string | null; input: unknown }
  | { kind: 'token_usage'; agentId: string | null; input: number; output: number; cacheRead: number; cacheCreated: number }
  | { kind: 'agent_completed'; agentId: string | null }
  | { kind: 'tool_use'; agentId: string | null; toolName: string; toolInput: unknown };

export interface FileReader {
  readNewLines(filePath: string): ParsedEvent[];
  reset(filePath: string): void;
}

function extractEvents(line: Record<string, unknown>): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  const lineAgentId = typeof line.agentId === 'string' ? line.agentId : null;

  if (line.type !== 'assistant') {
    return events;
  }

  const message = line.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== 'object') {
    return events;
  }

  // Extract tool uses from content array
  const content = message.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      if (
        item &&
        typeof item === 'object' &&
        (item as Record<string, unknown>).type === 'tool_use'
      ) {
        const toolItem = item as Record<string, unknown>;
        const toolName = typeof toolItem.name === 'string' ? toolItem.name : '';

        if (toolName === 'Agent') {
          // agent_launched event — child gets the tool_use id as its identifier
          const toolUseId = typeof toolItem.id === 'string' ? toolItem.id : crypto.randomUUID();
          const input = (toolItem.input as Record<string, unknown>) ?? null;
          const parentId = lineAgentId; // the current line's agentId is the parent

          events.push({
            kind: 'agent_launched',
            agentId: toolUseId,
            parentId,
            input,
          });
        } else if (toolName) {
          // generic tool_use event
          events.push({
            kind: 'tool_use',
            agentId: lineAgentId,
            toolName,
            toolInput: toolItem.input ?? null,
          });
        }
      }
    }
  }

  // Extract token usage
  const usage = message.usage;
  if (usage && typeof usage === 'object') {
    const u = usage as Record<string, unknown>;
    if (
      typeof u.input_tokens === 'number' ||
      typeof u.output_tokens === 'number'
    ) {
      events.push({
        kind: 'token_usage',
        agentId: lineAgentId,
        input: typeof u.input_tokens === 'number' ? u.input_tokens : 0,
        output: typeof u.output_tokens === 'number' ? u.output_tokens : 0,
        cacheRead: typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : 0,
        cacheCreated: typeof u.cache_creation_input_tokens === 'number' ? u.cache_creation_input_tokens : 0,
      });
    }
  }

  // Extract agent_completed — only for terminal stop reasons, not 'tool_use' pauses
  const stopReason = message.stop_reason;
  if (stopReason !== null && stopReason !== undefined && stopReason !== 'tool_use') {
    events.push({
      kind: 'agent_completed',
      agentId: lineAgentId,
    });
  }

  return events;
}

export function createFileReader(): FileReader {
  const offsets = new Map<string, number>();

  return {
    readNewLines(filePath: string): ParsedEvent[] {
      const offset = offsets.get(filePath) ?? 0;

      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        return [];
      }

      const fileSize = stat.size;
      if (fileSize <= offset) {
        return [];
      }

      const fd = fs.openSync(filePath, 'r');
      let buffer: Buffer;
      try {
        const bytesToRead = fileSize - offset;
        buffer = Buffer.allocUnsafe(bytesToRead);
        fs.readSync(fd, buffer, 0, bytesToRead, offset);
      } finally {
        fs.closeSync(fd);
      }

      offsets.set(filePath, fileSize);

      const text = buffer.toString('utf8');
      const lines = text.split('\n').filter((l) => l.trim().length > 0);

      const events: ParsedEvent[] = [];
      for (const rawLine of lines) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawLine);
        } catch {
          continue;
        }

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const lineEvents = extractEvents(parsed as Record<string, unknown>);
          events.push(...lineEvents);
        }
      }

      return events;
    },

    reset(filePath: string): void {
      offsets.set(filePath, 0);
    },
  };
}
