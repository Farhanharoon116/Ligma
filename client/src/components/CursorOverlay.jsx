import { useCanvasStore }  from '../store/useCanvasStore';
import { useSessionStore } from '../store/useSessionStore';

const CURSOR_COLORS = [
  '#4262FF', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#8b5cf6', '#ec4899'
];

function colorForUser(userId) {
  let hash = 0;
  for (const c of userId) hash = (Math.imul(31, hash) + c.charCodeAt(0)) | 0;
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

/**
 * Renders remote users' cursor positions as SVG arrows + name labels.
 *
 * This component must be rendered INSIDE the canvas transform wrapper so that
 * cursor positions (which are stored in canvas/world coordinates) can be used
 * directly as CSS `left`/`top` values — no manual coordinate conversion needed.
 *
 * The `scale` prop is used to counter-scale the cursor visuals so they remain
 * a constant size on screen regardless of the current zoom level.
 */
export default function CursorOverlay({ scale }) {
  const cursors = useCanvasStore((s) => s.cursors);
  const myId    = useSessionStore((s) => s.userId);
  const users   = useSessionStore((s) => s.users);

  const counterScale = 1 / (scale ?? 1);

  return (
    <>
      {Object.entries(cursors).map(([uid, pos]) => {
        if (uid === myId) return null;

        const color = colorForUser(uid);
        const user  = users.find((u) => u.userId === uid);
        const label = user?.name || uid.slice(0, 6);

        return (
          <div
            key={uid}
            className="absolute pointer-events-none"
            style={{
              left:            pos.x,
              top:             pos.y,
              transform:       `translate(-2px, -2px) scale(${counterScale})`,
              transformOrigin: '0 0',
              zIndex:          30,
            }}
          >
            {/* Arrow SVG */}
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
              <path
                d="M1 1 L1 17 L5 12 L9 20 L12 18.5 L8 10.5 L14 10.5 Z"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute top-5 left-2 text-white rounded-full px-2 py-0.5 whitespace-nowrap shadow-sm"
              style={{ backgroundColor: color, fontSize: '11px', lineHeight: '16px', fontFamily: "'Inter', sans-serif" }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </>
  );
}
