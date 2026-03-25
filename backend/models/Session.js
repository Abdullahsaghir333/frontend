const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pythonSessionId: { type: String },           // UUID from Python backend
  title: { type: String, default: 'Untitled Session' },
  fileName: { type: String },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
  duration: { type: Number, default: 0 },      // seconds
  focusScore: { type: Number, default: 0 },    // 0-100
  topicsTotal: { type: Number, default: 0 },
  topicsCovered: { type: Number, default: 0 },
  materials: [{ type: String }],
  concepts: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);
