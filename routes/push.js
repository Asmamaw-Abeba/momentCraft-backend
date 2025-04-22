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
  createdAt: { type: Date, default: Date.now },
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:support@momentcraft.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

router.post('/subscribe', async (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }
  try {
    await Subscription.findOneAndUpdate(
      { userId, endpoint: subscription.endpoint },
      { userId, ...subscription },
      { upsert: true, new: true }
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
    const subscriptions = await Subscription.find({ userId });
    if (!subscriptions.length) {
      return res.status(404).json({ error: 'No subscriptions found for user' });
    }
    const payload = JSON.stringify({ title, body });
    const results = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, payload);
          return { status: 'success', endpoint: subscription.endpoint };
        } catch (error) {
          console.warn(`Failed to send notification to ${subscription.endpoint}:`, error);
          return { status: 'failed', endpoint: subscription.endpoint, error };
        }
      })
    );
    res.status(200).json({ message: 'Notifications processed', results });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: 'Failed to process notifications' });
  }
});

module.exports = router;