const express = require('express');
const auth = require('../middleware/auth');
const { createMemory, getMemories, getPublicMemories, deleteMemory, editMemory } = require('../controllers/memoryController');
const upload = require('../utils/upload');

const router = express.Router();

router.post('/', auth, upload.single('media'), createMemory);
router.put('/:id', auth, upload.single('media'), editMemory);
router.get('/', auth, getMemories);
router.get('/public', getPublicMemories);
router.delete('/:id', auth, deleteMemory); // New delete route


module.exports = router;