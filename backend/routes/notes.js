const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const Bookmark = require('../models/Bookmark');
const Session = require('../models/Session');
const authMiddleware = require('../middleware/authMiddleware');

// Get all notes for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Find all sessions for this user
    const userSessions = await Session.find({ userId: req.user._id }).select('_id');
    const sessionIds = userSessions.map(s => s._id);

    // Find notes belonging to those sessions
    const notes = await Note.find({ sessionId: { $in: sessionIds } })
      .populate('sessionId', 'title createdAt')
      .sort({ generatedAt: -1 });

    res.status(200).json(notes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error fetching user notes' });
  }
});

// Create notes compiled from bookmarks at the end of a session
router.post('/compile', authMiddleware, async (req, res) => {
  try {
    const { sessionId, title, summary, keyPoints, importantPoints, topicNotes, cheatsheet, content } = req.body;

    // Ensure session belongs to current user
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    // Get all bookmarks for session
    const bookmarks = await Bookmark.find({ sessionId }).sort({ timestamp: 1 });
    
    // Compile into content
    let compiledContent = bookmarks.map(b => b.content).join('\n\n');
    if (!compiledContent && typeof content === 'string' && content.trim()) {
      compiledContent = content.trim();
    }
    if (!compiledContent) compiledContent = "No notes generated for this session.";

    // Upsert one canonical note per session
    const payload = {
      sessionId,
      title: title || `${session.title || 'Session'} Notes`,
      summary: summary || '',
      keyPoints: Array.isArray(keyPoints) ? keyPoints : [],
      importantPoints: Array.isArray(importantPoints) ? importantPoints : [],
      topicNotes: Array.isArray(topicNotes) ? topicNotes : [],
      cheatsheet: Array.isArray(cheatsheet) ? cheatsheet : [],
      content: compiledContent,
      generatedAt: new Date(),
    };

    const note = await Note.findOneAndUpdate(
      { sessionId },
      { $set: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Notes compiled successfully', note });
  } catch (error) {
    res.status(500).json({ error: 'Error compiling notes' });
  }
});

// Get all notes for a specific session
router.get('/:sessionId', authMiddleware, async (req, res) => {
  try {
    const notes = await Note.find({ sessionId: req.params.sessionId }).sort({ generatedAt: -1 });
    res.status(200).json({ notes });
  } catch (error) {
    res.status(500).json({ error: 'Server error fetched notes' });
  }
});

// Generate Cheat Sheet
router.post('/cheatsheet', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;
    // In a real implementation we would call an LLM (OpenAI/Gemini) to summarize notes.
    // For now we will mock a cheatsheet response.
    const note = await Note.findOne({ sessionId });
    
    if (!note) return res.status(404).json({ error: 'No notes found to generate cheatsheet' });

    // Mock summary based on length
    const cheatSheet = {
      summary: "Here is your quick summary of the key concepts discussed...",
      flashcards: [
        { q: "Key concept 1", a: "Explanation derived from notes" },
        { q: "Details discussed", a: "Key takeaways from the session tools" }
      ]
    };

    res.status(200).json({ message: 'Cheat sheet generated', cheatSheet });
  } catch (error) {
    res.status(500).json({ error: 'Error generating cheat sheet' });
  }
});

module.exports = router;
