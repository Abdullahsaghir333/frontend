const express = require('express');
const router = express.Router();
const Bookmark = require('../models/Bookmark');
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

// Create a new bookmark
router.post('/add', authMiddleware, async (req, res) => {
  try {
    const { sessionId, content, slideIndex, pointIndex, slideTitle } = req.body;
    if (!sessionId || !content) {
      return res.status(400).json({ error: 'Session ID and Content are required' });
    }

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    const bookmark = new Bookmark({ sessionId, content, slideIndex, pointIndex, slideTitle });
    await bookmark.save();

    res.status(201).json({ message: 'Bookmark created', bookmark });
  } catch (error) {
    res.status(500).json({ error: 'Server error adding bookmark' });
  }
});

// Get bookmarks for a session
router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    const bookmarks = await Bookmark.find({ sessionId: req.params.sessionId }).sort({ timestamp: 1 });
    res.status(200).json({ bookmarks });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching bookmarks' });
  }
});

module.exports = router;
