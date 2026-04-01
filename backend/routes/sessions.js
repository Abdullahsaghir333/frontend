const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

const SESSION_LIMIT = 5;

// @route   GET /api/sessions/check-limit
// @desc    Pre-flight check: can this user create a new session?
// @access  Private
router.get('/check-limit', authMiddleware, async (req, res) => {
  try {
    const count = await Session.countDocuments({ userId: req.user._id });
    res.json({ count, limit: SESSION_LIMIT, canCreate: count < SESSION_LIMIT });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/sessions
// @desc    Create a new session record (called after Python session creation)
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    // ── Enforce 5-session limit ──
    const count = await Session.countDocuments({ userId: req.user._id });
    if (count >= SESSION_LIMIT) {
      return res.status(403).json({
        message: `Session limit reached (${SESSION_LIMIT}). Please delete an existing session before creating a new one.`,
        count,
        limit: SESSION_LIMIT,
      });
    }

    const { pythonSessionId, title, fileName, topicsTotal, materials, concepts, difficulty } = req.body;
    
    const newSession = new Session({
      userId: req.user._id,
      pythonSessionId,
      title: title || 'Untitled Session',
      fileName,
      topicsTotal: topicsTotal || 0,
      materials,
      concepts,
      difficulty: difficulty || 'medium',
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
// @desc    Update a session (status, duration, focusScore, chat history, slides data, etc.)
// @access  Private
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      status,
      duration,
      focusScore,
      topicsCovered,
      summary,
      focusMonitorUsed,
      focusLogsCount,
      completedAt,
      // ── New persistence fields ──
      notesText,
      slidesData,
      chatHistory,
      lastSlideIndex,
      difficulty,
    } = req.body;
    
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
    if (summary !== undefined) session.summary = summary;
    if (focusMonitorUsed !== undefined) session.focusMonitorUsed = !!focusMonitorUsed;
    if (focusLogsCount !== undefined) session.focusLogsCount = Number(focusLogsCount) || 0;
    if (completedAt !== undefined) session.completedAt = completedAt ? new Date(completedAt) : null;

    // ── New persistence fields ──
    if (notesText !== undefined) session.notesText = notesText;
    if (slidesData !== undefined) session.slidesData = slidesData;
    if (chatHistory !== undefined) session.chatHistory = chatHistory;
    if (lastSlideIndex !== undefined) session.lastSlideIndex = lastSlideIndex;
    if (difficulty !== undefined) session.difficulty = difficulty;

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
