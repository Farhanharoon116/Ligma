import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { connectDB } from './db.js';
import { initSocket } from './socket/index.js';
import sessionRoutes from './routes/session.js';
import canvasRoutes  from './routes/canvas.js';

const app        = express();
const httpServer = createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

app.use('/api/session', sessionRoutes);
app.use('/api/canvas',  canvasRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

const PORT = parseInt(process.env.PORT || '3001', 10);

connectDB().then(() => {
  initSocket(httpServer, process.env.CLIENT_URL);
  httpServer.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
  });
});
