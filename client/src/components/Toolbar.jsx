import { useState } from 'react';
import { useSessionStore } from '../store/useSessionStore';

// ── SVG Icons ────────────────────────────────────────────────────────────────

function SelectIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l14 9-7 1-4 7z" />
    </svg>
  );
}

function StickyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8l6-6V4a2 2 0 0 0-2-2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function ShapeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function FitViewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

// ── ToolButton ───────────────────────────────────────────────────────────────

function ToolButton({ icon, label, active, onClick, disabled = false }) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          active
            ? 'bg-[#f0f3ff] text-[#4262FF]'
            : disabled
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
        }`}
      >
        {icon}
      </button>

      {showTip && !disabled && (
        <div className="absolute left-[46px] top-1/2 -translate-y-1/2 z-50 bg-gray-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap pointer-events-none shadow-lg">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </div>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

export default function Toolbar({ selectedTool, setSelectedTool, canvasRef }) {
  const role = useSessionStore((s) => s.role);
  const canCreate = role === 'lead' || role === 'contributor';

  function zoomIn()  { canvasRef.current?.zoomIn();  }
  function zoomOut() { canvasRef.current?.zoomOut(); }
  function fitView() { canvasRef.current?.fitView(); }

  return (
    <div
      className="fixed left-0 top-[52px] bottom-0 w-[52px] bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1 z-40"
      style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.06)' }}
    >
      <ToolButton
        icon={<SelectIcon />}
        label="Select"
        active={selectedTool === 'select'}
        onClick={() => setSelectedTool('select')}
      />

      <ToolButton
        icon={<StickyIcon />}
        label="Sticky Note"
        active={selectedTool === 'sticky'}
        onClick={() => setSelectedTool('sticky')}
        disabled={!canCreate}
      />

      <ToolButton
        icon={<TextIcon />}
        label="Text"
        active={selectedTool === 'text'}
        onClick={() => setSelectedTool('text')}
        disabled={!canCreate}
      />

      <ToolButton
        icon={<ShapeIcon />}
        label="Shape"
        active={selectedTool === 'shape'}
        onClick={() => setSelectedTool('shape')}
        disabled={!canCreate}
      />

      <div className="w-8 h-px bg-gray-100 my-1" />

      <ToolButton
        icon={<HandIcon />}
        label="Pan (Space)"
        active={selectedTool === 'pan'}
        onClick={() => setSelectedTool(selectedTool === 'pan' ? 'select' : 'pan')}
      />

      <div className="w-8 h-px bg-gray-100 my-1" />

      <ToolButton
        icon={<ZoomInIcon />}
        label="Zoom In"
        active={false}
        onClick={zoomIn}
      />

      <ToolButton
        icon={<ZoomOutIcon />}
        label="Zoom Out"
        active={false}
        onClick={zoomOut}
      />

      <ToolButton
        icon={<FitViewIcon />}
        label="Fit View"
        active={false}
        onClick={fitView}
      />
    </div>
  );
}
