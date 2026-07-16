import { useSessionStore } from '../store/useSessionStore';
import { socket } from '../socket';

const COLORS = [
  '#fef08a', // yellow
  '#bbf7d0', // green
  '#bfdbfe', // blue
  '#fecaca', // red/pink
  '#e9d5ff', // purple
  '#fed7aa'  // orange
];

/**
 * Floating toolbar that appears above a selected canvas node.
 * Controls are hidden/disabled based on the current user's role.
 */
export default function NodeToolbar({ node, onClose }) {
  const role   = useSessionStore((s) => s.role);
  const userId = useSessionStore((s) => s.userId);

  const canEdit   = role === 'lead' || role === 'contributor';
  const canDelete = role === 'lead';
  const isLocked  = node.lockedBy === userId;

  if (!canEdit) return null;

  function changeColor(color) {
    socket.emit('canvas:node_update', {
      nodeId:      node.nodeId,
      changes:     { color },
      vectorClock: node.vectorClock || {}
    });
  }

  function handleDelete() {
    socket.emit('canvas:node_delete', { nodeId: node.nodeId });
    onClose();
  }

  function handleLock() {
    socket.emit('canvas:node_lock', { nodeId: node.nodeId, lock: !isLocked });
  }

  return (
    <div
      className="absolute -top-12 left-0 flex items-center gap-1.5 bg-white rounded-xl border border-gray-200 px-2.5 py-2 z-30"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Color swatches */}
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => changeColor(color)}
          className="w-5 h-5 rounded-full transition-transform hover:scale-125 focus:outline-none flex-shrink-0"
          style={{
            backgroundColor: color,
            boxShadow:       node.color === color
              ? '0 0 0 2px white, 0 0 0 3.5px #4262FF'
              : '0 0 0 1.5px rgba(0,0,0,0.1)'
          }}
          title={`Set color`}
        />
      ))}

      <div className="w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0" />

      {/* Lock / unlock */}
      <button
        onClick={handleLock}
        title={isLocked ? 'Unlock node' : 'Lock node for editing'}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 text-sm"
      >
        {isLocked ? '🔓' : '🔒'}
      </button>

      {/* Delete (lead only) */}
      {canDelete && (
        <button
          onClick={handleDelete}
          title="Delete node"
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors text-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
