import fetch from 'node-fetch';
import Task from '../models/Task.js';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// nodeId → timeoutId — tracks in-flight debounce timersto 
const debounceMap = new Map();

/**
 * Call the Gemini REST API to classify a canvas note.
 * Returns one of: ACTION_ITEM | DECISION | OPEN_QUESTION | REFERENCE | null
 */
async function classifyText(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('[gemini] GEMINI_API_KEY not configured — skipping classification');
    return null;
  }

  const prompt =
    'Classify the following canvas note into exactly one category: \n' +
    'ACTION_ITEM, DECISION, OPEN_QUESTION, or REFERENCE. \n' +
    'Respond with only the category label, nothing else.\n\n' +
    `Note: "${text}"`;


  let response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
  } catch (err) {
    console.error('[gemini] Network error:', err.message);
    return null;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[gemini] API error ${response.status}:`, body);
    return null;
  }

  const data = await response.json();
  console.log('[gemini] Raw API response:', JSON.stringify(data?.candidates?.[0]?.content?.parts?.[0]));
  const rawLabel = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  const label = rawLabel?.toUpperCase();
  console.log('[gemini] Parsed label:', label);
  return label || null;
}

/**
 * Schedule an AI classification for a sticky/text node.
 * Debounces 1500ms per nodeId so rapid edits only trigger one API call.
 * If the result is ACTION_ITEM, creates a Task and emits task:update to the room.
 *
 * @param {string} nodeId
 * @param {string} text
 * @param {string} sessionId
 * @param {string} userId
 * @param {string} authorName
 * @param {import('socket.io').Server} io
 */
export function scheduleClassify(nodeId, text, sessionId, userId, authorName, io) {
  if (debounceMap.has(nodeId)) {
    clearTimeout(debounceMap.get(nodeId));
  }

  const timeoutId = setTimeout(async () => {
    debounceMap.delete(nodeId);
    console.log(`[gemini] debounce fired for node=${nodeId}, text length=${text?.length}`);

    if (!text || !text.trim()) {
      console.log('[gemini] Skipping empty text');
      return;
    }

    try {
      console.log(`[gemini] Calling classifyText for node=${nodeId}`);
      const category = await classifyText(text);
      console.log(`[gemini] node=${nodeId} category=${category}`);

      if (category === 'ACTION_ITEM') {
        console.log(`[gemini] ACTION_ITEM detected for node=${nodeId}, checking for duplicate...`);
        // Dedup: skip if an unresolved task already exists for this node with the same text
        const existing = await Task.findOne({ sessionId, nodeId, text: text.trim(), resolved: false }).lean();
        if (existing) {
          console.log(`[gemini] node=${nodeId} task already exists — skipping duplicate`);
          return;
        }
        const task = await Task.create({
          sessionId,
          nodeId,
          text: text.trim(),
          author: userId,
          authorName: authorName || '',
          timestamp: new Date(),
          resolved: false
        });
        console.log(`[gemini] Task created: ${task._id} for node=${nodeId}`);
        io.to(sessionId).emit('task:update', {
          action: 'create',
          task: task.toObject()
        });
      }
    } catch (err) {
      console.error('[gemini] Classification error:', err);
    }
  }, 1500);

  debounceMap.set(nodeId, timeoutId);
}
