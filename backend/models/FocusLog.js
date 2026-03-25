const mongoose = require('mongoose');

const FocusLogSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['focused', 'distracted', 'away'], required: true },
  focusScore: { type: Number, default: 0 },  // 0-100
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('FocusLog', FocusLogSchema);
