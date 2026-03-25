const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

// @route   POST /api/sessions
// @desc    Create a new session record (called after Python session creation)
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { pythonSessionId, title, fileName, topicsTotal, materials, concepts } = req.body;
    
    const newSession = new Session({
      userId: req.user._id,
      pythonSessionId,
      title: title || 'Untitled Session',
      fileName,
      topicsTotal: topicsTotal || 0,
      materials,
      concepts
    });

    const session = await newSession.save();
    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/sessions
// @desc    Get all sessions for a user
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/sessions/:id
// @desc    Get session by ID
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    
    // Check ownership
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PATCH /api/sessions/:id
// @desc    Update a session (status, duration, focusScore, etc.)
// @access  Private
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { status, duration, focusScore, topicsCovered } = req.body;
    
    let session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Check ownership
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Update fields if provided
    if (status) session.status = status;
    if (duration !== undefined) session.duration = duration;
    if (focusScore !== undefined) session.focusScore = focusScore;
    if (topicsCovered !== undefined) session.topicsCovered = topicsCovered;

    await session.save();
    res.json(session);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/sessions/:id
// @desc    Delete a session
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    // Check ownership
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await session.deleteOne();
    res.json({ message: 'Session removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
