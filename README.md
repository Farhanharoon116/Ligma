# 🖼️ LIGMA — Collaborative Canvas + AI Task Board

LIGMA is a **real-time collaborative whiteboard** with an integrated AI-powered action-item tracker. Multiple users share a live canvas where they can create sticky notes, text boxes, and shapes; all changes are synchronized instantly via WebSockets. When you write something that looks like a task, Gemini 2.5 Flash automatically creates an action item in the sidebar.

---

## Features

| Feature | Details |
|---------|---------|
| **Real-time canvas** | Drag, pan, zoom; sticky notes, text boxes, shapes |
| **Multi-user cursors** | See where your teammates are pointing |
| **Event sourcing** | Every mutation is an immutable event; state is always derived by replay |
| **Vector-clock conflict resolution** | LWW merge — no CRDT library, hand-rolled |
| **Node-level RBAC** | Lead / Contributor / Viewer with server-side enforcement |
| **AI intent extraction** | Gemini 2.5 Flash classifies notes → auto-creates action items |
| **Reconnect replay** | Clients send `lastEventId`; server replays only the missed delta |

---

## Architecture

### 1 — Event Sourcing

Every canvas mutation (create, update, delete, lock) is stored as an **immutable document** in the `events` MongoDB collection:

```
{ _id, sessionId, type, payload, userId, timestamp }
```

The current canvas state is **never stored directly** — it is always derived by replaying the ordered event log:

```
events (ordered by timestamp)
  ↓ replay
nodeMap (in-memory / Node cache collection)
```

This gives us:
- A complete audit trail of every change
- Reliable reconnect / catch-up via a single query (`timestamp > lastEvent.timestamp`)
- The ability to time-travel to any past state

### 2 — Vector Clock Conflict Resolution (LWW)

Each canvas node carries a vector clock: `{ [userId]: counter }`.

When two clients concurrently edit the same node the server applies **Last-Write-Wins (LWW)** using the following algorithm (implemented in `server/src/services/vectorClock.js`):

```
merge(clockA, clockB, fieldsA, fieldsB):
  sumA = Σ clockA[i]
  sumB = Σ clockB[i]

  if sumA > sumB  → pick fieldsA for every field
  if sumB > sumA  → pick fieldsB for every field
  if sumA == sumB → tie-break: lexicographically greatest userId wins

  advance merged clock: mergedClock[u] = max(clockA[u], clockB[u])
```

`increment(clock, userId)` is called on every write, advancing only the writing user's counter.

### 3 — WebSocket Protocol

Socket.IO rooms map 1-to-1 with sessions. The server **never** broadcasts full state — only deltas.

| Event | Direction | Description |
|-------|-----------|-------------|
| `session:user_join` | client → server | Join room; send `lastEventId` for reconnect |
| `session:init` | server → client | Full snapshot (new joins only) |
| `session:replay` | server → client | Missed events since `lastEventId` |
| `canvas:node_create` | bidirectional | New node payload |
| `canvas:node_update` | bidirectional | Changed fields + merged vector clock |
| `canvas:node_delete` | bidirectional | nodeId only |
| `canvas:node_lock` | bidirectional | Lock/unlock a node for exclusive editing |
| `cursor:move` | bidirectional | Canvas-space `{x, y}` — not persisted |
| `task:update` | server → client | AI-created or resolved action item |
| `error:unauthorized` | server → client | RBAC denial |

### 4 — Node-level RBAC

Three roles with different permissions:

| Role | Create | Update | Delete | Lock |
|------|--------|--------|--------|------|
| **Lead** | ✅ | ✅ | ✅ | ✅ |
| **Contributor** | ✅ | ✅ | ❌ | ✅ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ |

Roles are stored in the `Session` document. The server validates the user's role in every Socket.IO handler **before** writing to the database, and emits `error:unauthorized` on failure. The client additionally hides / disables controls based on role.

### 5 — AI Intent Extraction

On every `canvas:node_update` for `sticky` or `text` nodes, the server debounces 1500ms, then calls:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent
```

Prompt:
```
Classify the following canvas note into exactly one category:
ACTION_ITEM, DECISION, OPEN_QUESTION, or REFERENCE.
Respond with only the category label, nothing else.

Note: "<node text>"
```

If the result is `ACTION_ITEM`, a `Task` document is created and broadcast to all clients in the room via `task:update`.

---

## Project Structure

```
Ligma/
├── server/                    Express + Socket.IO + MongoDB
│   ├── src/
│   │   ├── index.js           Entry point
│   │   ├── db.js              Mongoose connection
│   │   ├── models/
│   │   │   ├── Event.js       Immutable event log
│   │   │   ├── Node.js        Derived-state cache
│   │   │   ├── Task.js        AI-detected action items
│   │   │   └── Session.js     Session + users + roles
│   │   ├── socket/
│   │   │   ├── index.js       Socket.IO server setup
│   │   │   ├── handlers.js    All event handlers
│   │   │   └── rbac.js        Role-check helpers
│   │   ├── services/
│   │   │   ├── canvasState.js Event replay → derive state
│   │   │   ├── vectorClock.js increment / merge / mergeClocks
│   │   │   └── gemini.js      Debounced Gemini classification
│   │   └── routes/
│   │       ├── session.js     REST session CRUD
│   │       └── canvas.js      REST canvas snapshot
│   └── .env.example
│
└── client/                    React + Vite + TailwindCSS
    ├── src/
    │   ├── App.jsx
    │   ├── socket.js          Socket.IO singleton
    │   ├── store/
    │   │   ├── useSessionStore.js  Zustand (persisted)
    │   │   ├── useCanvasStore.js   Zustand nodes + cursors
    │   │   └── useTaskStore.js     Zustand tasks
    │   ├── components/
    │   │   ├── Canvas.jsx
    │   │   ├── CanvasNode.jsx
    │   │   ├── NodeToolbar.jsx
    │   │   ├── CursorOverlay.jsx
    │   │   ├── TaskBoard.jsx
    │   │   ├── TaskItem.jsx
    │   │   └── JoinModal.jsx
    │   └── hooks/
    │       ├── useSocket.js
    │       └── useVectorClock.js
    └── .env.example
```

---

## Setup

### Prerequisites

- Node.js ≥ 18
- MongoDB (local or Atlas)
- Gemini API key (optional — classification is skipped when absent)

### Development

```bash
# 1. Clone the repo
git clone https://github.com/Farhanharoon116/Ligma.git
cd Ligma

# 2. Install server dependencies
cd server
cp .env.example .env        # fill in MONGODB_URI and GEMINI_API_KEY
npm install
npm run dev                 # starts on :3001 with nodemon

# 3. Install client dependencies (separate terminal)
cd ../client
cp .env.example .env
npm install
npm run dev                 # starts on :5173 with Vite HMR
```

Open `http://localhost:5173`, enter a name and role, and share the displayed Session ID with collaborators.

### Production (Render)

**Backend (Web Service)**

| Setting | Value |
|---------|-------|
| Root dir | `server` |
| Build command | `npm install` |
| Start command | `npm start` |
| Environment vars | `MONGODB_URI`, `GEMINI_API_KEY`, `CLIENT_URL`, `PORT` |

**Frontend (Static Site)**

| Setting | Value |
|---------|-------|
| Root dir | `client` |
| Build command | `npm install && npm run build` |
| Publish dir | `dist` |
| Environment vars | `VITE_SERVER_URL=<backend URL>` |

---

## Environment Variables

### `/server/.env`

```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/ligma
GEMINI_API_KEY=your_gemini_api_key_here
CLIENT_URL=http://localhost:5173
```

### `/client/.env`

```
VITE_SERVER_URL=http://localhost:3001
```

---

## License

MIT
