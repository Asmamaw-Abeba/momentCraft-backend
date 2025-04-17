const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Memory = require('../models/Memory');
const Timeline = require('../models/Timeline');
const router = express.Router();
const auth = require('../middleware/auth');
// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create a new user
    const user = new User({ username, email, password });
    await user.save();

    // // Send push notification
    // await axios.post(`https://momentcraft-backend.onrender.com/api/push/notify/${user.e}`, {
    //   title: 'New user Added!',
    //   body: `Check out your new user: ${user.username}`,
    // });

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login a user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a friend
router.post('/:id/friends', auth, async (req, res) => {
  try {
    const { id: friendId } = req.params; // Friend to add
    const userId = req.userId; // Authenticated user

    if (userId === friendId) {
      return res.status(400).json({ message: 'Cannot add yourself as a friend' });
    }

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ message: 'Friend not found' });
    }

    if (!user.friends.includes(friendId)) {
      user.friends.push(friendId);
      await user.save();
    }

    res.status(200).json({ message: 'Friend added', friends: user.friends });
  } catch (error) {
    console.error('Error adding friend:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove a friend
router.delete('/:id/friends', auth, async (req, res) => {
  try {
    const { id: friendId } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId);
    user.friends = user.friends.filter(f => f.toString() !== friendId);
    await user.save();

    res.status(200).json({ message: 'Friend removed', friends: user.friends });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (excluding self, friends, and pending requests)
router.get('/all', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const excludeIds = [
      userId,
      ...(user.friends || []),
      ...(user.friendRequests || []),
      ...(user.sentRequests || []),
    ];

    const users = await User.find({ _id: { $nin: excludeIds } })
      .select('username email _id')
      .lean();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Existing endpoints (unchanged except for path adjustments)
router.post('/:id/request', auth, async (req, res) => {
  try {
    const { id: targetId } = req.params;
    const userId = req.userId;

    if (userId === targetId) return res.status(400).json({ message: 'Cannot send request to yourself' });

    const user = await User.findById(userId);
    const target = await User.findById(targetId);

    if (!target) return res.status(404).json({ message: 'User not found' });
    if (user.friends.includes(targetId) || target.friends.includes(userId)) {
      return res.status(400).json({ message: 'Already friends' });
    }
    if (user.sentRequests.includes(targetId)) {
      return res.status(400).json({ message: 'Request already sent' });
    }
    if (target.friendRequests.includes(userId)) {
      return res.status(400).json({ message: 'Request already pending' });
    }

    user.sentRequests.push(targetId);
    target.friendRequests.push(userId);

    await user.save();
    await target.save();

    res.status(200).json({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept a friend request
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const { id: requesterId } = req.params; // User who sent the request
    const userId = req.userId; // Authenticated user

    const user = await User.findById(userId);
    const requester = await User.findById(requesterId);

    if (!requester) return res.status(404).json({ message: 'User not found' });
    if (!user.friendRequests.includes(requesterId)) {
      return res.status(400).json({ message: 'No pending request from this user' });
    }

    // Remove from requests
    user.friendRequests = user.friendRequests.filter((id) => id.toString() !== requesterId);
    requester.sentRequests = requester.sentRequests.filter((id) => id.toString() !== userId);

    // Add to friends
    user.friends.push(requesterId);
    requester.friends.push(userId);

    await user.save();
    await requester.save();

    res.status(200).json({ message: 'Friend request accepted' });
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Decline a friend request
router.post('/:id/decline', auth, async (req, res) => {
  try {
    const { id: requesterId } = req.params;
    const userId = req.userId;

    const user = await User.findById(userId);
    const requester = await User.findById(requesterId);

    if (!requester) return res.status(404).json({ message: 'User not found' });
    if (!user.friendRequests.includes(requesterId)) {
      return res.status(400).json({ message: 'No pending request from this user' });
    }

    user.friendRequests = user.friendRequests.filter((id) => id.toString() !== requesterId);
    requester.sentRequests = requester.sentRequests.filter((id) => id.toString() !== userId);

    await user.save();
    await requester.save();

    res.status(200).json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Error declining friend request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friends and requests
router.get('/me/friends', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('friends', 'username email')
      .populate('friendRequests', 'username email')
      .populate('sentRequests', 'username email')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      friends: user.friends || [],
      pendingRequests: user.friendRequests || [],
      sentRequests: user.sentRequests || [],
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// server/routes/auth.js
router.get('/profile/:friendId', auth, async (req, res) => {
  try {
    const friend = await User.findById(req.params.friendId)
      .select('username email friends') // Add avatar if implemented
      .lean();
    if (!friend) return res.status(404).json({ message: 'Friend not found' });

    // Add memories count (optional)
    const memoriesCount = await Memory.countDocuments({ userId: req.params.friendId });
    friend.memoriesCount = memoriesCount;

    res.json(friend);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});




// Search user by username
router.get('/search', auth, async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const user = await User.findOne({ username }).select('username email _id').lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error searching user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ... (other imports and routes remain unchanged)

// Share timeline with friends
router.post('/share-timeline', auth, async (req, res) => {
  try {
    const { timelineId, friendIds } = req.body; // Array of friend IDs to share with
    const userId = req.userId;

    if (!timelineId || !friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
      return res.status(400).json({ message: 'Timeline ID and friend IDs are required' });
    }

    const user = await User.findById(userId).populate('friends');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Verify timeline exists
    const timeline = await Timeline.findById(timelineId);
    if (!timeline) return res.status(404).json({ message: 'Timeline not found' });

    // Ensure all friendIds are valid and in user's friend list
    const validFriendIds = user.friends.map((f) => f._id.toString());
    const invalidIds = friendIds.filter((id) => !validFriendIds.includes(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({ message: 'Some friend IDs are invalid or not your friends' });
    }
    // Update each friend's sharedTimelines
    await User.updateMany(
      { _id: { $in: friendIds } },
      { $addToSet: { sharedTimelines: timelineId } } // $addToSet prevents duplicates
    );

    res.status(200).json({ message: 'Timeline shared with friends successfully' });
  } catch (error) {
    console.error('Error sharing timeline:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get shared timelines (for friends to view)
router.get('/me/shared-timelines', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate({
        path: 'sharedTimelines',
        select: 'name description memories updatedAt createdAt',
        populate: { path: 'memories', select: 'title media caption' },
      })
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user.sharedTimelines || []);
  } catch (error) {
    console.error('Error fetching shared timelines:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me/shared-timelines/:friendId', auth, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    const user = await User.findById(friendId)
      .populate({
        path: 'sharedTimelines',
        select: 'name description memories updatedAt createdAt',
        populate: { path: 'memories', select: 'title media caption' },
      })
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user.sharedTimelines || []);
  } catch (error) {
    console.error('Error fetching shared timelines:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// router.get('/me', auth, async (req, res) => {
//   try {
//     const user = await User.findById(req.userId).select('-password').lean();
//     if (!user) return res.status(404).json({ message: 'User not found' });
//     res.json(user);
//   } catch (error) {
//     console.error('Error fetching user:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

module.exports = router;