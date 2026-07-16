import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { socket } from '../socket';
import { useCanvasStore }  from '../store/useCanvasStore';
import { useSessionStore } from '../store/useSessionStore';
import { useVectorClock }  from '../hooks/useVectorClock';
import CanvasNode    from './CanvasNode';
import CursorOverlay from './CursorOverlay';

const NODE_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];

/**
 * Main canvas component.
 *
 * Features:
 *  - Pan  : middle-mouse drag OR space + left-drag OR pan tool active
 *  - Zoom : scroll wheel (zoom toward cursor)
 *  - Create: double-click empty space → new node of selectedTool type
 *  - Nodes rendered as absolutely-positioned divs in a transform wrapper
 *  - Remote cursor overlay
 *
 * Exposes zoomIn / zoomOut / fitView via forwardRef for the left Toolbar.
 */
const Canvas = forwardRef(function Canvas({ selectedTool }, ref) {
  const [transform,   setTransform]   = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning,   setIsPanning]   = useState(false);
  const [spaceHeld,   setSpaceHeld]   = useState(false);

  const canvasRef    = useRef(null);
  const panStart     = useRef(null);
  const lastCursorTs = useRef(0);

  const nodes    = useCanvasStore((s) => s.getActiveNodes());
  const role     = useSessionStore((s) => s.role);
  const userId   = useSessionStore((s) => s.userId);
  const { incrementClock } = useVectorClock();

  const canCreate  = role === 'lead' || role === 'contributor';
  const isPanTool  = selectedTool === 'pan' || spaceHeld;
  const nodeType   = ['sticky', 'text', 'shape'].includes(selectedTool) ? selectedTool : null;

  // ── Expose zoom controls to parent via ref ─────────────────────────────────
  useImperativeHandle(ref, () => ({
    zoomIn:  () => setTransform((p) => ({ ...p, scale: Math.min(p.scale * 1.2, 4) })),
    zoomOut: () => setTransform((p) => ({ ...p, scale: Math.max(p.scale * 0.8, 0.15) })),
    fitView: () => setTransform({ x: 0, y: 0, scale: 1 })
  }));

  // ── Coordinate helpers ─────────────────────────────────────────────────────
  const screenToCanvas = useCallback((sx, sy) => ({
    x: (sx - transform.x) / transform.scale,
    y: (sy - transform.y) / transform.scale
  }), [transform]);

  // ── Mouse events ───────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && isPanTool)) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
    }
  }, [isPanTool]);

  const handleMouseMove = useCallback((e) => {
    if (isPanning && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      panStart.current = { x: e.clientX, y: e.clientY };
    }

    // Throttle cursor broadcasts to ~20 fps
    const now = Date.now();
    if (now - lastCursorTs.current > 50 && canvasRef.current) {
      lastCursorTs.current = now;
      const rect      = canvasRef.current.getBoundingClientRect();
      const canvasPos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
      socket.emit('cursor:move', canvasPos);
    }
  }, [isPanning, screenToCanvas]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  // ── Scroll to zoom ─────────────────────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect   = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setTransform((prev) => {
      const newScale = Math.min(Math.max(prev.scale * factor, 0.15), 4);
      const ratio    = newScale / prev.scale;
      return {
        scale: newScale,
        x:     mx - (mx - prev.x) * ratio,
        y:     my - (my - prev.y) * ratio
      };
    });
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Space key for pan mode ─────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.code === 'Space' && !e.target.matches('input,textarea')) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    }
    function onKeyUp(e) {
      if (e.code === 'Space') {
        setSpaceHeld(false);
        setIsPanning(false);
        panStart.current = null;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []);

  // ── Double-click → create node ─────────────────────────────────────────────
  const handleDoubleClick = useCallback((e) => {
    if (!canCreate || !nodeType || isPanTool) return;
    if (!canvasRef.current) return;

    const rect     = canvasRef.current.getBoundingClientRect();
    const pos      = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
    const nodeId   = uuidv4();
    const clock    = incrementClock(nodeId);
    const colorIdx = Math.floor(Math.random() * NODE_COLORS.length);

    const isShape = nodeType === 'shape';
    socket.emit('canvas:node_create', {
      nodeId,
      type:        nodeType,
      text:        isShape ? 'Shape' : '',
      x:           Math.round(pos.x - (isShape ? 80 : 100)),
      y:           Math.round(pos.y - (isShape ? 50 : 75)),
      width:       isShape ? 160 : 200,
      height:      isShape ? 100 : 150,
      color:       nodeType === 'sticky' ? NODE_COLORS[colorIdx] : (isShape ? '#f0f3ff' : '#e2e8f0'),
      vectorClock: clock,
      acl:         { lead: true, contributor: true, viewer: false }
    });
  }, [canCreate, nodeType, isPanTool, screenToCanvas, incrementClock]);

  const canvasCursor = isPanning ? 'grabbing' : isPanTool ? 'grab' : 'default';

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ background: '#f8f7f4' }}>

      {/* Scale readout */}
      <div
        className="absolute left-4 bottom-4 z-40 text-xs text-gray-400 bg-white rounded-lg px-2.5 py-1 border border-gray-200"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        {Math.round(transform.scale * 100)}%
      </div>


      {!canCreate && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 text-xs text-gray-400 bg-white rounded-full px-3 py-1 border border-gray-200 pointer-events-none"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          👁 Viewer mode — read only
        </div>
      )}

      {/* ── Infinite canvas ─────────────────────────────────────────────────── */}
      <div
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          cursor: canvasCursor,
          backgroundImage:
            'radial-gradient(circle, #d1cfc8 1px, transparent 1px)',
          backgroundSize: `${Math.max(16, 24 * transform.scale)}px ${Math.max(16, 24 * transform.scale)}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Transform wrapper — all nodes and remote cursors live here */}
        <div
          style={{
            position:        'absolute',
            top:             0,
            left:            0,
            width:           0,
            height:          0,
            transformOrigin: '0 0',
            transform:       `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`
          }}
        >
          {nodes.map((node) => (
            <CanvasNode
              key={node.nodeId}
              node={node}
              transform={transform}
            />
          ))}

          <CursorOverlay scale={transform.scale} />
        </div>
      </div>
    </div>
  );
});

export default Canvas;
