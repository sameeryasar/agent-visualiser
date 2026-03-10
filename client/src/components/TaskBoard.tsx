import { Task } from 'shared';

function TaskCard({ task }: { task: Task }) {
  return (
    <div
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 6,
        padding: 8,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          color: '#e6edf3',
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={task.subject}
      >
        {task.subject}
      </div>
      {task.status === 'in_progress' && task.activeForm && (
        <div
          style={{
            color: '#8b949e',
            fontSize: 11,
            marginTop: 4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          } as React.CSSProperties}
        >
          {task.activeForm}
        </div>
      )}
    </div>
  );
}

function Column({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          color: '#8b949e',
          fontWeight: 'bold',
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: '1px solid #30363d',
        }}
      >
        {title}
        <span style={{ marginLeft: 6, fontWeight: 'normal' }}>({tasks.length})</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tasks.length === 0 ? (
          <div style={{ color: '#8b949e', fontStyle: 'italic', fontSize: 12 }}>—</div>
        ) : (
          tasks.map(task => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const pending = tasks.filter(t => t.status === 'pending');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const completed = tasks.filter(t => t.status === 'completed');

  return (
    <div style={{ display: 'flex', gap: '12px', height: '100%' }}>
      <Column title="Pending" tasks={pending} />
      <Column title="In Progress" tasks={inProgress} />
      <Column title="Completed" tasks={completed} />
    </div>
  );
}
