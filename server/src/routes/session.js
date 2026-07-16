import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import Session from '../models/Session.js';

const router = express.Router();

// Limit all session endpoints to 30 requests per minute per IP
const sessionLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down' }
});

// POST /api/session — create a new collaborative session
router.post('/', sessionLimiter, async (req, res) => {
  try {
    const sessionId = uuidv4();
    const { name } = req.body;
    const session  = await Session.create({
      sessionId,
      name: name || 'Untitled Session',
      users: []
    });
    res.status(201).json({ sessionId: session.sessionId, name: session.name });
  } catch (err) {
    console.error('[route] POST /api/session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// POST /api/session/:id/join — join an existing session
router.post('/:id/join', sessionLimiter, async (req, res) => {
  try {
    const sessionId = req.params.id;
    const { name, role } = req.body;

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const validRole = ['lead', 'contributor', 'viewer'].includes(role) ? role : 'contributor';
    const userId    = uuidv4();

    session.users.push({ userId, name, role: validRole });
    await session.save();

    res.json({ userId, sessionId, role: validRole, name });
  } catch (err) {
    console.error('[route] POST /api/session/:id/join:', err);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

// GET /api/session/:id — get session metadata
router.get('/:id', sessionLimiter, async (req, res) => {
  try {
    const session = await Session.findOne({ sessionId: req.params.id }).lean();
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err) {
    console.error('[route] GET /api/session/:id:', err);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

export default router;
