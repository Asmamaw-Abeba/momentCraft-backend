const mongoose = require('mongoose');

const TimelineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  memories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Memory' }], // Array of memory IDs
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user
  // visibility: { 
  //   type: String, 
  //   enum: ['private', 'friends', 'public'], 
  //   default: 'private' 
  // },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Timeline', TimelineSchema);