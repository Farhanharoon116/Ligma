import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { getActiveNodes } from '../services/canvasState.js';
import Task from '../models/Task.js';

const router = express.Router();

const canvasLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down' }
});

// GET /api/canvas/:sessionId — derive and return current canvas state
router.get('/:sessionId', canvasLimiter, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const [nodes, tasks] = await Promise.all([
      getActiveNodes(sessionId),
      Task.find({ sessionId }).lean()
    ]);
    res.json({ nodes, tasks });
  } catch (err) {
    console.error('[route] GET /api/canvas/:sessionId:', err);
    res.status(500).json({ error: 'Failed to get canvas state' });
  }
});

export default router;
