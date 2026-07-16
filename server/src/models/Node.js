import mongoose from 'mongoose';

// Derived state cache — rebuilt by replaying Event documents.
const nodeSchema = new mongoose.Schema({
  nodeId:     { type: String, required: true },
  sessionId:  { type: String, required: true },
  type:       { type: String, enum: ['sticky', 'text', 'shape'], default: 'sticky' },
  text:       { type: String, default: '' },
  x:          { type: Number, default: 0 },
  y:          { type: Number, default: 0 },
  width:      { type: Number, default: 200 },
  height:     { type: Number, default: 150 },
  color:      { type: String, default: '#fef08a' },
  lockedBy:   { type: String, default: null },
  vectorClock: { type: mongoose.Schema.Types.Mixed, default: {} },
  acl: {
    lead:        { type: Boolean, default: true },
    contributor: { type: Boolean, default: true },
    viewer:      { type: Boolean, default: false }
  },
  deleted: { type: Boolean, default: false }
}, { timestamps: true });

nodeSchema.index({ sessionId: 1, nodeId: 1 }, { unique: true });

export default mongoose.model('Node', nodeSchema);
