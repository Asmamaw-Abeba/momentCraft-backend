const Timeline = require('../models/Timeline');
const Memory = require('../models/Memory');

// Create a new timeline
const createTimeline = async (req, res) => {
  console.log('Request Body:', req.body); // Log the request body
  console.log('User ID:', req.userId); // Log the user ID

  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required.' });
    }

    const timeline = new Timeline({
      name,
      description,
      user: req.userId,
    });

    await timeline.save();
    console.log('Timeline Created:', timeline); // Log the created timeline

    res.status(201).json(timeline);
  } catch (err) {
    console.error('Error:', err.message); // Log the error
    res.status(500).json({ error: err.message });
  }
};

// Add a memory to a timeline
const addMemoryToTimeline = async (req, res) => {
  try {
    const { timelineId, memoryId } = req.params;
    const timeline = await Timeline.findById(timelineId);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    const memory = await Memory.findById(memoryId);
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    // Add memory to timeline if it doesn't already exist
    if (!timeline.memories.includes(memoryId)) {
      timeline.memories.push(memoryId);
      await timeline.save();
    }

    res.status(200).json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove a memory from a timeline
const removeTimeline = async (req, res) => {
  try {
    const { timelineId } = req.params;

    // Find and delete the timeline
    const timeline = await Timeline.findByIdAndDelete(timelineId);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    // Optionally, you could delete associated memories here if needed
    // await Memory.deleteMany({ _id: { $in: timeline.memories } });

    res.status(200).json({ message: 'Timeline deleted successfully' });
  } catch (error) {
    console.error('Error deleting timeline:', error);
    res.status(500).json({ error: 'Failed to delete timeline' });
  }
};

// Remove a memory from a timeline
const removeMemoryFromTimeline = async (req, res) => {
  try {
    const { timelineId, memoryId } = req.params;
    const timeline = await Timeline.findById(timelineId);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    // Remove memory from timeline
    timeline.memories = timeline.memories.filter((id) => id.toString() !== memoryId);
    await timeline.save();

    res.status(200).json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Public endpoint to fetch a timeline by ID
const getPublicTimeline = async (req, res) => {
  try {
    const { timelineId } = req.params;
    const timeline = await Timeline.findById(timelineId)
    .populate('memories', 'media title') // Populate memory details
    .populate('user', 'username avatar') // Populate user info
    // .lean(); // Populate the memories field
    .select('-__v'); // Exclude version field
    if (!timeline) {
      return res.status(404).json({ message: 'Timeline not found' });
    }
    res.status(200).json(timeline);
  } catch (error) {
    console.error('Error fetching public timeline:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getTimelineById = async (req, res) => {
  try {
    const { timelineId } = req.params;
    const timeline = await Timeline.findById(timelineId).populate('memories');
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }
    res.status(200).json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all timelines for a user with user info
const getTimelines = async (req, res) => {
  try {
    const timelines = await Timeline.find({ user: req.userId })
      .populate('memories', 'media title') // Populate memory details
      .populate('user', 'username avatar') // Populate user info
      .lean();
    res.status(200).json(timelines);
  } catch (err) {
    console.error('Error in getTimelines:', err);
    res.status(500).json({ error: err.message });
  }
};

// // Copy a timeline
// const copyTimeline = async (req, res) => {
//   const { timelineId, name, description } = req.body;
//   try {
//     const originalTimeline = await Timeline.findById(timelineId).populate('memories');
//     if (!originalTimeline) {
//       return res.status(404).json({ message: 'Timeline not found' });
//     }
//     if (originalTimeline.user.toString() !== req.userId) {
//       return res.status(403).json({ message: 'Unauthorized to copy this timeline' });
//     }

//     const newTimeline = new Timeline({
//       name: name || `${originalTimeline.name} (Copy)`,
//       description: description || originalTimeline.description,
//       user: req.userId,
//       memories: originalTimeline.memories.map((m) => m._id), // Copy memory references
//     });

//     await newTimeline.save();
//     res.status(201).json(newTimeline);
//   } catch (err) {
//     console.error('Error in copyTimeline:', err);
//     res.status(500).json({ error: err.message });
//   }
// };

const reorderMemoriesInTimeline = async (req, res) => {
  try {
    const { timelineId } = req.params;
    const { memoryIds } = req.body;

    const timeline = await Timeline.findById(timelineId);
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found' });
    }

    timeline.memories = memoryIds;
    await timeline.save();

    res.status(200).json(timeline);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createTimeline,
  addMemoryToTimeline,
  removeMemoryFromTimeline,
  getPublicTimeline,
  getTimelineById,
  getTimelines,
  reorderMemoriesInTimeline,
  removeTimeline,
};