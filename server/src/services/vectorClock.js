/**
 * Vector Clock utilities for Last-Write-Wins (LWW) conflict resolution.
 * Each canvas node carries a vector clock: { [userId]: counter }.
 * No external CRDT library — implemented manually.
 */

/**
 * Increment the counter for userId in the given clock.
 * Returns a new clock object (immutable — never mutates input).
 *
 * @param {Object} clock  - existing vector clock
 * @param {string} userId - the user performing the write
 * @returns {Object} new vector clock
 */
export function increment(clock, userId) {
  return { ...clock, [userId]: ((clock && clock[userId]) || 0) + 1 };
}

/**
 * Compute the total sum of all counter values in a clock.
 */
function clockSum(clock) {
  if (!clock) return 0;
  return Object.values(clock).reduce((acc, v) => acc + (v || 0), 0);
}

/**
 * Merge two competing field sets using LWW semantics.
 *
 * For each field present in either set:
 *   - Pick the value from whichever clock has the higher total sum.
 *   - Tie-break: the lexicographically greatest userId wins (deterministic).
 *
 * @param {Object} clockA  - vector clock from update A (the incoming write)
 * @param {Object} clockB  - vector clock from update B (the existing state)
 * @param {Object} fieldsA - candidate field values from A
 * @param {Object} fieldsB - candidate field values from B
 * @returns {Object} merged field values
 */
export function merge(clockA, clockB, fieldsA, fieldsB) {
  const sumA = clockSum(clockA);
  const sumB = clockSum(clockB);

  let winner;
  if (sumA > sumB) {
    winner = 'A';
  } else if (sumB > sumA) {
    winner = 'B';
  } else {
    // Deterministic tie-break: highest userId alphabetically
    const maxA = Object.keys(clockA || {}).sort().pop() || '';
    const maxB = Object.keys(clockB || {}).sort().pop() || '';
    winner = maxA >= maxB ? 'A' : 'B';
  }

  const allFields = new Set([
    ...Object.keys(fieldsA || {}),
    ...Object.keys(fieldsB || {})
  ]);

  const result = {};
  for (const field of allFields) {
    const aVal = fieldsA && fieldsA[field] !== undefined ? fieldsA[field] : undefined;
    const bVal = fieldsB && fieldsB[field] !== undefined ? fieldsB[field] : undefined;
    if (winner === 'A') {
      result[field] = aVal !== undefined ? aVal : bVal;
    } else {
      result[field] = bVal !== undefined ? bVal : aVal;
    }
  }
  return result;
}

/**
 * Merge two vector clocks by taking the per-userId maximum.
 * Used to advance the clock after resolving a conflict.
 *
 * @param {Object} clockA
 * @param {Object} clockB
 * @returns {Object} merged clock
 */
export function mergeClocks(clockA, clockB) {
  const merged = { ...(clockA || {}) };
  for (const [userId, counter] of Object.entries(clockB || {})) {
    merged[userId] = Math.max(merged[userId] || 0, counter || 0);
  }
  return merged;
}
