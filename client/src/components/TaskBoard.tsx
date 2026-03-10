import { Task } from 'shared';

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  return <div>TaskBoard: {tasks.length} tasks</div>;
}
