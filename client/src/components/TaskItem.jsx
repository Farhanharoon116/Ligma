import { socket }        from '../socket';
import { useTaskStore }   from '../store/useTaskStore';
import { useSessionStore } from '../store/useSessionStore';

/**
 * Individual task row in the TaskBoard sidebar.
 * Supports toggling the resolved state (broadcasted via socket).
 */
export default function TaskItem({ task }) {
  const role  = useSessionStore((s) => s.role);
  const users = useSessionStore((s) => s.users);

  const authorName =
    users.find((u) => u.userId === task.author)?.name ||
    task.authorName ||
    (task.author ? task.author.slice(0, 8) : 'unknown');

  function handleToggle() {
    socket.emit('task:update', { taskId: task._id, resolved: !task.resolved });
  }

  const time = task.timestamp
    ? new Date(task.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={`rounded-xl border p-3 transition-all ${
        task.resolved
          ? 'border-gray-100 bg-gray-50'
          : 'border-gray-200 bg-white hover:border-[#4262FF]/30 hover:shadow-sm'
      }`}
      style={{ boxShadow: task.resolved ? 'none' : '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors focus:outline-none ${
            task.resolved
              ? 'border-[#22c55e] bg-[#22c55e]'
              : 'border-gray-300 hover:border-[#4262FF] bg-white'
          }`}
          title={task.resolved ? 'Mark as unresolved' : 'Mark as resolved'}
        >
          {task.resolved && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
              <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Text + meta */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs leading-snug break-words ${
              task.resolved ? 'line-through text-gray-400' : 'text-gray-800'
            }`}
          >
            {task.text}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            <span className="font-medium text-gray-500">{authorName}</span>
            {time && <> · {time}</>}
          </p>
        </div>
      </div>
    </div>
  );
}
