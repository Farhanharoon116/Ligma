import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  type:      { type: String, required: true },
  payload:   { type: mongoose.Schema.Types.Mixed, required: true },
  userId:    { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true }
});

eventSchema.index({ sessionId: 1, timestamp: 1 });

export default mongoose.model('Event', eventSchema);
