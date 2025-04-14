const express = require('express');
const auth = require('../middleware/auth');
const {
  createTimeline,
  addMemoryToTimeline,
  removeMemoryFromTimeline,
  getTimelines,
  reorderMemoriesInTimeline,
  removeTimeline,
  getTimelineById,
  getPublicTimeline,
} = require('../controllers/timelineController');

const router = express.Router();

router.post('/', auth, createTimeline);
router.put('/:timelineId/memories/:memoryId', auth, addMemoryToTimeline);
router.delete('/:timelineId', auth, removeTimeline);
router.delete('/:timelineId/memories/:memoryId', auth, removeMemoryFromTimeline);
router.get('/', auth, getTimelines);
router.get('/public/:timelineId', getPublicTimeline);
router.get('/:timelineId', auth, getTimelineById);
router.put('/:timelineId/reorder', auth, reorderMemoriesInTimeline);

module.exports = router