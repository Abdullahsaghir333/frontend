const mongoose = require('mongoose');

const BookmarkSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  content: { type: String, required: true }, // the bookmarked point text (or snippet)
  slideIndex: { type: Number },              // optional (python slide index)
  pointIndex: { type: Number },              // optional (point index inside slide)
  slideTitle: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bookmark', BookmarkSchema);
