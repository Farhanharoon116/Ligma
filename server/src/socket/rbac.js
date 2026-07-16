import Session from '../models/Session.js';

/** Permissions allowed per role */
const ROLE_PERMISSIONS = {
  lead:        new Set(['create', 'update', 'delete', 'lock']),
  contributor: new Set(['create', 'update', 'lock']),
  viewer:      new Set()
};

/**
 * Look up the role of a user in a session.
 * Returns null if the session or user doesn't exist.
 */
export async function getUserRole(sessionId, userId) {
  const session = await Session.findOne({ sessionId }).lean();
  if (!session) return null;
  const user = session.users.find((u) => u.userId === userId);
  return user ? user.role : null;
}

/**
 * Pure permission check (no I/O).
 */
export function canPerform(role, action) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(action) ?? false;
}

/**
 * Async guard for socket handlers.
 * Emits error:unauthorized and returns false if the user lacks permission.
 *
 * @param {import('socket.io').Socket} socket
 * @param {string} sessionId
 * @param {string} action
 * @returns {Promise<boolean>}
 */
export async function checkPermission(socket, sessionId, action) {
  const userId = socket.data.userId;
  const role = await getUserRole(sessionId, userId);
  if (!canPerform(role, action)) {
    socket.emit('error:unauthorized', {
      message: `Role '${role ?? 'unknown'}' is not allowed to perform '${action}'`
    });
    return false;
  }
  return true;
}
