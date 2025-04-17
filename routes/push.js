const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: String,
  endpoint: String,
  keys: {
    p256dh: String,
    auth: String,
  },
});
const Subscription = mongoose.model('Subscription', subscriptionSchema);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

router.post('/subscribe', async (req, res) => {
  const { userId, subscription } = req.body;
  try {
    await Subscription.findOneAndUpdate(
      { userId },
      { userId, ...subscription },
      { upsert: true }
    );
    res.status(201).json({ message: 'Subscription saved' });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

router.post('/notify/:userId', async (req, res) => {
  const { userId } = req.params;
  let { title, body } = req.body;
  // Validate payload
  if (!title || !body) {
    title = title || 'MomentCraft Update';
    body = body || 'New content is available!';
  }
  try {
    const subscription = await Subscription.findOne({ userId });
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    const payload = JSON.stringify({ title, body });
    await webpush.sendNotification(subscription, payload);
    res.status(200).json({ message: 'Notification sent' });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;