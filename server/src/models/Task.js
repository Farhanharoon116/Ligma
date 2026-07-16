import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  sessionId:  { type: String, required: true, index: true },
  nodeId:     { type: String, required: true },
  text:       { type: String, required: true },
  author:     { type: String, required: true },
  authorName: { type: String, default: '' },
  timestamp:  { type: Date, default: Date.now },
  resolved:   { type: Boolean, default: false }
});

export default mongoose.model('Task', taskSchema);
