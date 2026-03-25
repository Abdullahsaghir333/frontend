const mongoose = require('mongoose');

const RoleReversalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  audioUrl: { type: String },
  feedback: {
    correct: [{ type: String }],
    mistakes: [{ type: String }],
    suggestions: [{ type: String }]
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RoleReversal', RoleReversalSchema);
