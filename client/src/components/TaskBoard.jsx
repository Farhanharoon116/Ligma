import { useTaskStore }    from '../store/useTaskStore';
import { useSessionStore } from '../store/useSessionStore';
import TaskItem from './TaskItem';

/**
 * Sidebar panel listing AI-detected action items.
 * Action items are created automatically when Gemini classifies a sticky/text
 * node as ACTION_ITEM.
 */
export default function TaskBoard({ onClose, flex }) {
  const tasks     = useTaskStore((s) => s.tasks);
  const sessionId = useSessionStore((s) => s.sessionId);

  const active   = tasks.filter((t) => !t.resolved);
  const resolved = tasks.filter((t) =>  t.resolved);

  return (
    <div
      className="bg-white flex flex-col border-b border-gray-100"
      style={flex ? { flex: '1 1 0', minHeight: '140px', overflow: 'hidden' } : { flex: '1 1 auto', overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4262FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <h2 className="font-semibold text-gray-800 text-sm flex-1">Action Items</h2>
          {active.length > 0 && (
            <span className="bg-[#4262FF] text-white text-[10px] font-semibold rounded-full px-2 py-0.5 leading-tight">
              {active.length}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-sm ml-1"
              title="Close task board"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-1 leading-snug">
          Auto-detected by AI when you write action items on sticky notes
        </p>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {active.length === 0 && resolved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <div className="text-3xl mb-2.5">🤖</div>
            <p className="text-xs font-medium text-gray-500">No action items yet</p>
            <p className="text-[11px] mt-1 text-center leading-snug px-4 text-gray-400">
              Write something like "Send the report to the team" on a sticky note
            </p>
          </div>
        ) : (
          <>
            {active.map((task) => (
              <TaskItem key={task._id} task={task} />
            ))}

            {resolved.length > 0 && (
              <>
                <div className="pt-2 pb-1">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                    Resolved · {resolved.length}
                  </p>
                </div>
                {resolved.map((task) => (
                  <TaskItem key={task._id} task={task} />
                ))}
              </>
            )}
          </>
        )}
      </div>

    
    </div>
  );
}
