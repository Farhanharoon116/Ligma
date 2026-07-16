import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  name:      { type: String, default: '' },
  users: [{
    userId: { type: String },
    name:   { type: String },
    role:   { type: String, enum: ['lead', 'contributor', 'viewer'], default: 'contributor' }
  }]
}, { timestamps: true });

export default mongoose.model('Session', sessionSchema);
