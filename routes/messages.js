// routes/messages.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');

router.post('/send/:recipientId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Message content is required' });

    const message = new Message({
      sender: req.userId,
      recipient: req.params.recipientId,
      content,
    });
    await message.save();
    res.status(201).json({ message: 'Message sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;