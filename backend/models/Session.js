const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pythonSessionId: { type: String },           // UUID from Python backend
  title: { type: String, default: 'Untitled Session' },
  fileName: { type: String },
  status: { type: String, enum: ['in_progress', 'paused', 'completed'], default: 'in_progress' },
  duration: { type: Number, default: 0 },      // seconds
  focusScore: { type: Number, default: 0 },    // 0-100
  topicsTotal: { type: Number, default: 0 },
  topicsCovered: { type: Number, default: 0 },
  materials: [{ type: String }],
  concepts: [{ type: String }],
  summary: { type: String, default: '' },
  focusMonitorUsed: { type: Boolean, default: false },
  focusLogsCount: { type: Number, default: 0 },
  completedAt: { type: Date },

  // ── Task 9: Full session persistence ──
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  notesText: { type: String, default: '' },                    // extracted PDF text
  slidesData: { type: mongoose.Schema.Types.Mixed, default: [] }, // full slides JSON (no audio_data)
  chatHistory: [{
    from: { type: String },   // 'teacher' | 'student'
    text: { type: String },
    time: { type: String },
  }],
  lastSlideIndex: { type: Number, default: 0 },                // where user paused
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);
