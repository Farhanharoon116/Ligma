import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from './store/useSessionStore';
import { useTaskStore }    from './store/useTaskStore';
import { useSocket }       from './hooks/useSocket';
import Canvas    from './components/Canvas';
import TaskBoard from './components/TaskBoard';
import EventLog  from './components/EventLog';
import Toolbar   from './components/Toolbar';
import JoinModal from './components/JoinModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#4262FF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#F7DC6F', '#DDA0DD', '#FF8A65', '#A8D8EA', '#B8860B'
];

function avatarColor(str) {
  let h = 0;
  for (const c of (str || '')) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const ROLE_PILL = {
  lead:        { bg: '#f3e8ff', text: '#7c3aed', label: 'Lead'        },
  contributor: { bg: '#dbeafe', text: '#1d4ed8', label: 'Contributor' },
  viewer:      { bg: '#f3f4f6', text: '#6b7280', label: 'Viewer'      }
};

// ── GridIcon for wordmark ─────────────────────────────────────────────────────
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="1"  y="1"  width="7" height="7" rx="1.5" fill="#4262FF" />
      <rect x="10" y="1"  width="7" height="7" rx="1.5" fill="#4262FF" opacity=".45" />
      <rect x="1"  y="10" width="7" height="7" rx="1.5" fill="#4262FF" opacity=".45" />
      <rect x="10" y="10" width="7" height="7" rx="1.5" fill="#4262FF" opacity=".2" />
    </svg>
  );
}

// ── TasksIcon / ActivityIcon for panel toggles ────────────────────────────────
function TasksIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

function AppShell() {
  useSocket();

  const { role, name, users, sessionId, clearSession } = useSessionStore();
  const canvasRef = useRef(null);

  const [selectedTool,  setSelectedTool]  = useState('sticky');
  const [showTaskBoard, setShowTaskBoard] = useState(true);
  const [showEventLog,  setShowEventLog]  = useState(false);
  const [sessionName,   setSessionName]   = useState('Untitled Session');
  const [editingName,   setEditingName]   = useState(false);
  const [copySuccess,   setCopySuccess]   = useState(false);

  const pill = ROLE_PILL[role] || ROLE_PILL.viewer;

  // Max 3 visible avatars + overflow
  const visibleUsers  = users.slice(0, 3);
  const overflowCount = users.length - 3;

  function handleLeave() {
    clearSession();
    window.location.reload();
  }

  function handleCopyInvite() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }

  function handleExportBrief() {
    const { tasks } = useTaskStore.getState();
    const active   = tasks.filter((t) => !t.resolved);
    const resolved = tasks.filter((t) => t.resolved);
    let txt = `LIGMA Session Brief\nSession: ${sessionName}\nExported: ${new Date().toLocaleString()}\n\n`;
    txt += `Active Tasks (${active.length}):\n`;
    active.forEach((t, i) => { txt += `${i + 1}. ${t.text}\n`; });
    txt += `\nCompleted Tasks (${resolved.length}):\n`;
    resolved.forEach((t, i) => { txt += `${i + 1}. ✓ ${t.text}\n`; });
    const blob = new Blob([txt], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'ligma-brief.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Right panel width (both use 300px column when open)
  const rightPanelOpen  = showTaskBoard || showEventLog;
  const rightPanelWidth = rightPanelOpen ? 300 : 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#f8f7f4' }}>

      {/* ── Top Navbar ─────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 h-[52px] bg-white border-b border-gray-200 flex items-center justify-between px-4 z-50"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        {/* Left: wordmark + session name */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5">
            <GridIcon />
            <span className="font-bold text-[18px] text-[#4262FF] tracking-tight">LIGMA</span>
          </div>

          <div className="h-5 w-px bg-gray-200 mx-3" />

          {editingName ? (
            <input
              autoFocus
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
              className="text-sm font-medium text-gray-700 bg-transparent border-b border-[#4262FF] outline-none w-40"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-medium text-gray-700 hover:text-gray-900 truncate max-w-[180px]"
              title="Click to rename"
            >
              {sessionName}
            </button>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">

          {/* Presence avatars — stacked, max 3 + overflow */}
          {users.length > 0 && (
            <div className="flex items-center">
              {visibleUsers.map((u, i) => (
                <div
                  key={u.userId}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ring-2 ring-white select-none"
                  style={{
                    backgroundColor: avatarColor(u.name),
                    marginLeft:      i === 0 ? 0 : '-8px',
                    zIndex:          visibleUsers.length - i
                  }}
                  title={`${u.name} (${u.role})`}
                >
                  {u.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              ))}
              {overflowCount > 0 && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 text-xs font-semibold ring-2 ring-white"
                  style={{ marginLeft: '-8px', zIndex: 0 }}
                >
                  +{overflowCount}
                </div>
              )}
            </div>
          )}

          <div className="h-5 w-px bg-gray-200 mx-1" />

          {/* Panel toggles */}
          <button
            onClick={() => setShowTaskBoard((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showTaskBoard
                ? 'bg-[#f0f3ff] text-[#4262FF]'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            title="Toggle task board"
          >
            <TasksIcon />
            Tasks
          </button>

          <button
            onClick={() => setShowEventLog((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showEventLog
                ? 'bg-[#f0f3ff] text-[#4262FF]'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            title="Toggle activity log"
          >
            <ActivityIcon />
            Activity
          </button>

          <div className="h-5 w-px bg-gray-200 mx-1" />

          {/* Copy Invite */}
          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1.5 text-xs border border-[#4262FF] text-[#4262FF] rounded-lg px-3 py-1.5 hover:bg-[#f0f3ff] transition-colors font-medium"
          >
            🔗 {copySuccess ? 'Copied!' : 'Invite'}
          </button>

          {/* Export Brief */}
          <button
            onClick={handleExportBrief}
            className="flex items-center gap-1.5 text-xs bg-[#4262FF] hover:bg-[#2d4edb] text-white rounded-lg px-3 py-1.5 transition-colors font-medium"
          >
            ✨ Export Brief
          </button>

          <div className="h-5 w-px bg-gray-200 mx-1" />

          {/* User badge + role pill */}
          <div className="flex flex-col items-center gap-0.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ backgroundColor: avatarColor(name) }}
              title={name}
            >
              {name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span
              className="text-[9px] rounded-full px-1.5 py-0.5 font-medium leading-none"
              style={{ background: pill.bg, color: pill.text }}
            >
              {pill.label}
            </span>
          </div>

          {/* Leave */}
          <button
            onClick={handleLeave}
            className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg px-2 py-1.5 transition-colors ml-1"
            title="Leave session"
          >
            Leave
          </button>
        </div>
      </header>

      {/* ── Left Toolbar ───────────────────────────────────────────────────── */}
      <Toolbar
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        canvasRef={canvasRef}
      />

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <main
        className="absolute top-[52px] left-[52px] bottom-0"
        style={{ right: `${rightPanelWidth}px`, transition: 'right 0.2s ease' }}
      >
        <Canvas ref={canvasRef} selectedTool={selectedTool} />
      </main>

      {/* ── Right Panels ───────────────────────────────────────────────────── */}
      {rightPanelOpen && (
        <div
          className="fixed right-0 top-[52px] bottom-0 flex flex-col z-40 border-l border-gray-200"
          style={{ width: `${rightPanelWidth}px`, boxShadow: '-2px 0 8px rgba(0,0,0,0.06)' }}
        >
          {showTaskBoard && (
            <TaskBoard onClose={() => setShowTaskBoard(false)} flex={showEventLog} />
          )}
          {showEventLog && (
            <EventLog onClose={() => setShowEventLog(false)} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { sessionId, userId } = useSessionStore();
  const [joined, setJoined]   = useState(false);

  useEffect(() => {
    if (sessionId && userId) setJoined(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!joined || !sessionId || !userId) {
    return <JoinModal onJoined={() => setJoined(true)} />;
  }

  return <AppShell />;
}
