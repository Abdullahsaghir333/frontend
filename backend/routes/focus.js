const express = require('express');
const router = express.Router();
const FocusLog = require('../models/FocusLog');
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

// @route   POST /api/focus
// @desc    Save a focus log entry
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { sessionId, status, focusScore } = req.body;
    
    const newFocusLog = new FocusLog({
      sessionId,
      userId: req.user._id,
      status,
      focusScore
    });

    const focusLog = await newFocusLog.save();
    res.json(focusLog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/focus/stats/:sessionId
// @desc    Get focus stats for a session
// @access  Private
router.get('/stats/:sessionId', authMiddleware, async (req, res) => {
  try {
    const logs = await FocusLog.find({ sessionId: req.params.sessionId });
    
    if (logs.length === 0) {
      return res.json({ avgScore: 0, focusedCount: 0, totalCount: 0 });
    }

    const totalScore = logs.reduce((acc, log) => acc + log.focusScore, 0);
    const focusedCount = logs.filter(log => log.status === 'focused').length;

    res.json({
      avgScore: Math.round(totalScore / logs.length),
      focusedCount,
      totalCount: logs.length
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/focus/user-stats
// @desc    Get aggregated focus stats for dashboard
// @access  Private
router.get('/user-stats', authMiddleware, async (req, res) => {
  try {
    const logs = await FocusLog.find({ userId: req.user._id });

    if (logs.length === 0) {
      return res.json({ avgFocus: 0, sessionsCount: 0 });
    }

    const totalScore = logs.reduce((acc, log) => acc + log.focusScore, 0);
    const avgFocus = Math.round(totalScore / logs.length);

    // Get count of unique sessions
    const sessionsCount = new Set(logs.map(log => log.sessionId.toString())).size;

    res.json({
      avgFocus,
      sessionsCount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
