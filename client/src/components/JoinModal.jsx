import { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const ROLE_DESCRIPTIONS = {
  lead:        'Full control — create, edit, and delete notes',
  contributor: 'Create and edit notes, cannot delete',
  viewer:      'Read-only — observe the canvas in real time'
};

const ROLE_ICONS = { lead: '👑', contributor: '✏️', viewer: '👁' };

function GridLogoIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect x="2"  y="2"  width="14" height="14" rx="3" fill="#4262FF" />
      <rect x="20" y="2"  width="14" height="14" rx="3" fill="#4262FF" opacity=".45" />
      <rect x="2"  y="20" width="14" height="14" rx="3" fill="#4262FF" opacity=".45" />
      <rect x="20" y="20" width="14" height="14" rx="3" fill="#4262FF" opacity=".2" />
    </svg>
  );
}

export default function JoinModal({ onJoined }) {
  const [name,      setName]      = useState('');
  const [role,      setRole]      = useState('contributor');
  const [sessionId, setSessionId] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const setSession = useSessionStore((s) => s.setSession);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name'); return; }
    setLoading(true);
    setError('');

    try {
      let sid = sessionId.trim();

      if (!sid) {
        const res  = await fetch(`${SERVER_URL}/api/session`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: `${name.trim()}'s Session` })
        });
        if (!res.ok) throw new Error('Failed to create session');
        const data = await res.json();
        sid = data.sessionId;
      }

      const joinRes = await fetch(`${SERVER_URL}/api/session/${sid}/join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), role })
      });

      if (!joinRes.ok) {
        const err = await joinRes.json();
        setError(err.error || 'Failed to join session');
        setLoading(false);
        return;
      }

      const joined = await joinRes.json();
      setSession({ sessionId: sid, userId: joined.userId, role: joined.role, name: name.trim() });
      onJoined();
    } catch (err) {
      setError('Connection error — is the server running?');
    } finally {
      setLoading(false);
    }
  }

  const isJoining = !!sessionId.trim();

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: '#f8f7f4' }}>

      {/* Decorative background blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, #4262FF 0%, transparent 70%)', transform: 'translate(-30%, -30%)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)', transform: 'translate(30%, 30%)' }} />

      <div
        className="bg-white rounded-2xl w-full max-w-md relative z-10"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {/* Brand header */}
        <div className="px-8 pt-8 pb-6 text-center border-b border-gray-100">
          <div className="flex justify-center mb-3">
            <GridLogoIcon />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">LIGMA</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time collaborative canvas</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4262FF]/30 focus:border-[#4262FF] transition-colors"
              required
              autoFocus
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['lead', 'contributor', 'viewer'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border text-center transition-all ${
                    role === r
                      ? 'border-[#4262FF] bg-[#f0f3ff] text-[#4262FF]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">{ROLE_ICONS[r]}</span>
                  <span className="text-xs font-semibold capitalize">{r}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 leading-snug">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          {/* Session ID */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Session ID
              <span className="font-normal text-gray-400 normal-case tracking-normal ml-1">(leave blank to create new)</span>
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="Paste an existing session ID…"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4262FF]/30 focus:border-[#4262FF] transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-700 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4262FF] hover:bg-[#2d4edb] disabled:bg-[#4262FF]/40 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm mt-2"
          >
            {loading
              ? 'Connecting…'
              : isJoining
              ? '→ Join Session'
              : '✦ Create New Session'}
          </button>
        </form>

        <div className="px-8 pb-6 text-center">
          <p className="text-xs text-gray-300">
            Share the Session ID with teammates to collaborate in real time
          </p>
        </div>
      </div>
    </div>
  );
}
