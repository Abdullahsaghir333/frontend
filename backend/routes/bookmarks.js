const express = require('express');
const router = express.Router();
const Bookmark = require('../models/Bookmark');

// Create a new bookmark
router.post('/add', async (req, res) => {
  try {
    const { sessionId, content } = req.body;
    if (!sessionId || !content) {
      return res.status(400).json({ error: 'Session ID and Content are required' });
    }

    const bookmark = new Bookmark({ sessionId, content });
    await bookmark.save();

    res.status(201).json({ message: 'Bookmark created', bookmark });
  } catch (error) {
    res.status(500).json({ error: 'Server error adding bookmark' });
  }
});

// Get bookmarks for a session
router.get('/:sessionId', async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ sessionId: req.params.sessionId }).sort({ timestamp: 1 });
    res.status(200).json({ bookmarks });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching bookmarks' });
  }
});

module.exports = router;
