export interface Agent {
  id: string;            // 'main' or agent UUID
  type: string;          // 'main', 'Explore', 'Plan', etc.
  status: 'running' | 'completed';
  parentId: string | null;
  currentTool: string | null;
  currentToolInput: string | null;
  description: string | null;
  tokens: TokenCounts;
}

export interface Task {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string | null;
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreated: number;
}

export interface SessionState {
  session: { id: string; project: string; startTime: string };
  agents: Agent[];
  tasks: Task[];
  tokens: TokenCounts;
}

export interface State {
  sessions: Record<string, SessionState>;
}
