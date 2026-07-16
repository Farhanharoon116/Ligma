import { useState, useRef, useEffect } from 'react';
import { socket } from '../socket';
import { useSessionStore } from '../store/useSessionStore';
import { useVectorClock }  from '../hooks/useVectorClock';
import NodeToolbar from './NodeToolbar';

const TYPE_DEFAULTS = {
  sticky: { bgOpacity: 1,   border: 'none',                       fontFamily: "'Inter', sans-serif", borderRadius: 16 },
  text:   { bgOpacity: 0,   border: 'none',                       fontFamily: "'Inter', sans-serif", borderRadius:  8 },
  shape:  { bgOpacity: 1,    border: '2px solid #4262FF',          fontFamily: "'Inter', sans-serif", borderRadius: 12 }
};

/**
 * Renders a single canvas node (sticky / text / shape).
 * Handles:
 *  - drag to move (role-gated)
 *  - double-click inline edit
 *  - lock indicator
 *  - NodeToolbar on single click (role-gated)
 */
export default function CanvasNode({ node, transform }) {
  const [editing,     setEditing]     = useState(false);
  const [text,        setText]        = useState(node.text || '');
  const [showToolbar, setShowToolbar] = useState(false);

  const textareaRef = useRef(null);
  const isDragging  = useRef(false);

  const userId = useSessionStore((s) => s.userId);
  const role   = useSessionStore((s) => s.role);
  const { incrementClock, setClock } = useVectorClock();

  const canEdit         = role === 'lead' || role === 'contributor';
  const isLockedByOther = node.lockedBy && node.lockedBy !== userId;

  useEffect(() => { setText(node.text || ''); }, [node.text]);
  useEffect(() => { setClock(node.nodeId, node.vectorClock); }, [node.vectorClock]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  // ── Double-click → start inline edit ──────────────────────────────────────
  function handleDoubleClick(e) {
    e.stopPropagation();
    if (!canEdit || isLockedByOther) return;
    setEditing(true);
    setShowToolbar(false);
    socket.emit('canvas:node_lock', { nodeId: node.nodeId, lock: true });
  }

  // ── Commit text edit ───────────────────────────────────────────────────────
  function commitEdit() {
    setEditing(false);
    if (text !== node.text) {
      const clock = incrementClock(node.nodeId);
      socket.emit('canvas:node_update', {
        nodeId:      node.nodeId,
        changes:     { text },
        vectorClock: clock
      });
    }
    socket.emit('canvas:node_lock', { nodeId: node.nodeId, lock: false });
  }

  // ── Drag to move ───────────────────────────────────────────────────────────
  function handleMouseDown(e) {
    if (e.button !== 0 || editing) return;
    e.stopPropagation();
    setShowToolbar(true);

    if (!canEdit || isLockedByOther) return;

    const startX     = e.clientX;
    const startY     = e.clientY;
    const originX    = node.x;
    const originY    = node.y;
    isDragging.current = false;

    function onMouseMove(me) {
      const dx = (me.clientX - startX) / transform.scale;
      const dy = (me.clientY - startY) / transform.scale;
      if (!isDragging.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isDragging.current = true;
      }
      if (isDragging.current) {
        const clock = incrementClock(node.nodeId);
        socket.emit('canvas:node_update', {
          nodeId:      node.nodeId,
          changes:     { x: Math.round(originX + dx), y: Math.round(originY + dy) },
          vectorClock: clock
        });
      }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
      isDragging.current = false;
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  }

  // ── Visual style helpers ───────────────────────────────────────────────────
  const defaults   = TYPE_DEFAULTS[node.type] || TYPE_DEFAULTS.sticky;
  const bgColor    = node.color || '#fef08a';
  const isSelected = showToolbar && !editing;

  const wrapperStyle = {
    position:  'absolute',
    left:      node.x,
    top:       node.y,
    width:     node.width  || 200,
    minHeight: node.height || 150,
    cursor:    isLockedByOther ? 'not-allowed' : (canEdit ? 'grab' : 'default'),
    zIndex:    showToolbar || editing ? 10 : 1,
    userSelect: 'none'
  };

  const cardStyle = {
    width:           '100%',
    minHeight:       node.height || 150,
    backgroundColor: `rgba(${hexToRgb(bgColor)},${defaults.bgOpacity})`,
    border:          isSelected
      ? '2px solid #4262FF'
      : defaults.border,
    boxShadow:       isSelected
      ? '0 0 0 3px rgba(66,98,255,0.15), 0 4px 16px rgba(0,0,0,0.12)'
      : '0 2px 8px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.06)',
    borderRadius:    defaults.borderRadius,
    padding:         '14px 16px',
    position:        'relative',
    transition:      'box-shadow 0.15s, border 0.1s',
    fontFamily:      defaults.fontFamily
  };

  return (
    <div
      style={wrapperStyle}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseLeave={() => { if (!editing) setShowToolbar(false); }}
    >
      <div style={cardStyle}>

        {/* Floating toolbar */}
        {isSelected && canEdit && (
          <NodeToolbar node={node} onClose={() => setShowToolbar(false)} />
        )}

        {/* Lock badge — other user editing */}
        {isLockedByOther && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] rounded-md px-1.5 py-0.5 z-10 select-none leading-tight">
            🔒 editing
          </div>
        )}

        {/* Own-lock badge */}
        {node.lockedBy === userId && !editing && (
          <div className="absolute top-2 right-2 bg-[#4262FF]/80 text-white text-[10px] rounded-md px-1.5 py-0.5 z-10 select-none leading-tight">
            ✏️ you
          </div>
        )}

        {/* Content */}
        {editing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setText(node.text || '');
                setEditing(false);
                socket.emit('canvas:node_lock', { nodeId: node.nodeId, lock: false });
              }
            }}
            style={{
              width:      '100%',
              minHeight:  100,
              background: 'transparent',
              border:     'none',
              outline:    'none',
              resize:     'none',
              fontSize:   14,
              lineHeight: '1.6',
              color:      '#1a1a2e',
              fontFamily: defaults.fontFamily,
              cursor:     'text'
            }}
          />
        ) : (
          <p
            style={{
              margin:     0,
              fontSize:   14,
              lineHeight: '1.6',
              color:      node.text ? '#1a1a2e' : '#9ca3af',
              fontStyle:  node.text ? 'normal' : 'italic',
              whiteSpace: 'pre-wrap',
              wordBreak:  'break-word',
              minHeight:  24
            }}
          >
            {node.text || (canEdit ? 'Double-click to edit…' : '')}
          </p>
        )}
      </div>

      {/* Invisible overlay to close toolbar when clicking elsewhere */}
      {showToolbar && !editing && (
        <div
          className="fixed inset-0 -z-10"
          onMouseDown={(e) => { e.stopPropagation(); setShowToolbar(false); }}
        />
      )}
    </div>
  );
}

// ── Utility ────────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255,255,255';
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
