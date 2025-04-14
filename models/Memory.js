const mongoose = require('mongoose');

const MemorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  media: { type: String, required: true }, // URL of the media (local or Cloudinary)
  isVideo: { type: Boolean, default: false }, // Indicates if the media is a video
  caption: { type: String }, // Caption for images
  summary: { type: String }, // Summary for videos
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user
  createdAt: { type: Date, default: Date.now }, // Timestamp
  location: { // Added for AR
    lat: { type: Number },
    lng: { type: Number }
  },
  "3dModelUrl": { type: String }, // Added for AR, note the quotes due to starting with a number
  visibility: { // Added for privacy
    type: String,
    enum: ['private', 'friends', 'public'],
    default: 'private'
  }
});

module.exports = mongoose.model('Memory', MemorySchema);