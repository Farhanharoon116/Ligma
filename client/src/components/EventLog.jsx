import { useEffect } from 'react';
import { socket } from '../socket';
import { useSessionStore }   from '../store/useSessionStore';
import { useEventLogStore }  from '../store/useEventLogStore';

/**
 * Right-panel event log. Listens to socket events directly so every
 * canvas mutation is reliably captured in real-time.
 */
export default function EventLog({ onClose }) {
  const { events, addEvent } = useEventLogStore();
  const users   = useSessionStore((s) => s.users);
  const myId    = useSessionStore((s) => s.userId);
  const myName  = useSessionStore((s) => s.name);

  // Helper — resolve user name from in-room presence list
  function resolveAuthor(userId) {
    if (userId === myId) return myName;
    const u = users.find((u) => u.userId === userId);
    return u?.name ?? 'Someone';
  }

  // ── Socket-level event listeners ─────────────────────────────────────────
  useEffect(() => {
    function onNodeCreate(data) {
      const author = resolveAuthor(data.userId);
      addEvent({
        type:    'node_create',
        author,
        message: `${author} created a ${data.type ?? 'sticky'} note`
      });
    }

    function onNodeUpdate(data) {
      // Only log text edits, not pure position moves
      if (data.changes && data.changes.text !== undefined) {
        const author  = resolveAuthor(data.userId);
        const preview = data.changes.text?.slice(0, 40) || '';
        addEvent({
          type:    'node_edit',
          author,
          message: preview
            ? `${author} edited: "${preview}${data.changes.text.length > 40 ? '…' : ''}"`
            : `${author} cleared a note`
        });
      }
    }

    function onNodeDelete(data) {
      const author = resolveAuthor(data.userId);
      addEvent({
        type:    'node_delete',
        author,
        message: `${author} deleted a note`
      });
    }

    function onUserJoin({ userId: uid, name: uname }) {
      if (uid === myId) return; // Don't log own join
      addEvent({ type: 'user_join', author: uname, message: `${uname} joined` });
    }

    function onUserLeave({ userId: uid }) {
      const u = users.find((u) => u.userId === uid);
      const name = u?.name ?? 'A user';
      addEvent({ type: 'user_leave', author: name, message: `${name} left` });
    }

    socket.on('canvas:node_create', onNodeCreate);
    socket.on('canvas:node_update', onNodeUpdate);
    socket.on('canvas:node_delete', onNodeDelete);
    socket.on('session:user_join',  onUserJoin);
    socket.on('session:user_leave', onUserLeave);

    return () => {
      socket.off('canvas:node_create', onNodeCreate);
      socket.off('canvas:node_update', onNodeUpdate);
      socket.off('canvas:node_delete', onNodeDelete);
      socket.off('session:user_join',  onUserJoin);
      socket.off('session:user_leave', onUserLeave);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, myName]);

  // ── Relative timestamp ───────────────────────────────────────────────────
  function relativeTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5)  return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  // ── Avatar color ─────────────────────────────────────────────────────────
  const PALETTE = ['#4262FF','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#F7DC6F','#DDA0DD','#FF8A65'];
  function avatarColor(str) {
    let h = 0;
    for (const c of (str || '')) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
    return PALETTE[Math.abs(h) % PALETTE.length];
  }

  const TYPE_COLORS = {
    node_create: '#4262FF',
    node_edit:   '#F59E0B',
    node_delete: '#EF4444',
    user_join:   '#10B981',
    user_leave:  '#9CA3AF',
  };

  return (
    <div
      className="flex flex-col bg-white border-l border-gray-200 overflow-hidden"
      style={{
        width:     '280px',
        flex:      '1 1 0',
        minHeight: '120px',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.04)'
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-800 flex-1">Activity</span>
        {events.length > 0 && (
          <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">
            {events.length} events
          </span>
        )}
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-sm"
          title="Close activity log"
        >
          ✕
        </button>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-xs font-medium">No activity yet</p>
            <p className="text-xs mt-0.5 text-center text-gray-300">
              Events appear here as the canvas changes
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* Author avatar */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: avatarColor(event.author) }}
                >
                  {event.author?.[0]?.toUpperCase() ?? '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-snug break-words">
                    {event.message}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{relativeTime(event.ts)}</p>
                </div>

                {/* Type dot */}
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: TYPE_COLORS[event.type] ?? '#9CA3AF' }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
