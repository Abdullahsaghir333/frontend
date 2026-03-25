const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  title: { type: String, default: 'Untitled Notes' },
  summary: { type: String, default: '' },
  keyPoints: [{ type: String }],
  topicNotes: [{
    topic: { type: String },
    content: { type: String },
  }],
  cheatsheet: [{
    term: { type: String },
    def: { type: String },
  }],
  content: { type: String },   // legacy compiled notes
  generatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Note', NoteSchema);
