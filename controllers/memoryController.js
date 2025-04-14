const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Memory = require('../models/Memory');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Cloudinary configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const generateCaption = async (mediaPath, isVideo) => {
  const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY;

  if (isVideo) {
    // For videos, mediaPath is now a Cloudinary URL (thumbnail)
    console.log('Generating caption for video thumbnail:', mediaPath);
  } else {
    console.log('File path:', mediaPath);
  }

  let imageData;
  if (mediaPath.startsWith('http')) {
    // Fetch image from URL (e.g., Cloudinary thumbnail)
    const response = await axios.get(mediaPath, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(response.data).toString('base64');
    imageData = base64Image;
  } else {
    // Local file
    const imageBuffer = fs.readFileSync(mediaPath);
    imageData = imageBuffer.toString('base64');
  }

  console.log('Hugging Face Payload Preview:', imageData.substring(0, 50) + '...');

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base',
        { inputs: imageData },
        {
          headers: {
            Authorization: `Bearer ${HUGGING_FACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      console.log('Hugging Face Response:', response.data);
      return response.data[0].generated_text || 'Image description unavailable';
    } catch (error) {
      console.warn(`Hugging Face attempt ${attempt + 1}/${maxRetries}:`, error.response?.data || error.message);
      if (attempt === maxRetries - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // OpenAI fallback (optional)
  if (OPENAI_API_KEY) {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o', // Check OpenAI docs for latest vision model
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this image in one sentence.' },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
              ],
            },
          ],
          max_tokens: 50,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      return response.data.choices[0].message.content || 'OpenAI caption unavailable';
    } catch (error) {
      console.error('OpenAI fallback failed:', error.response?.data || error.message);
    }
  }

  return 'Unable to generate caption';
};

const generateSummary = async (thumbnailUrls) => {
  try {
    // Describe each thumbnail using an AI model
    const frameDescriptions = await Promise.all(
      thumbnailUrls.map(async (url, index) => {
        try {
          console.log(`Processing thumbnail ${index + 1}: ${url}`); // Debugging: Log the thumbnail URL

          // Fetch the thumbnail image and convert it to base64
          const response = await axios.get(url, { responseType: 'arraybuffer' });
          const base64Image = Buffer.from(response.data, 'binary').toString('base64');

          // Use Hugging Face's image captioning model to describe the thumbnail
          const captionResponse = await axios.post(
            'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base',
            { inputs: base64Image },
            {
              headers: {
                Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const description = captionResponse.data[0].generated_text;
          console.log(`Thumbnail ${index + 1} description:`, description); // Debugging: Log the description
          return description || 'No description available';
        } catch (err) {
          console.error(`Error describing thumbnail ${index + 1}:`, err.message); // Debugging: Log the error
          return 'No description available';
        }
      })
    );

    // Combine descriptions into a single string
    const combinedDescriptions = frameDescriptions.join('\n');
    console.log('Combined descriptions:', combinedDescriptions); // Debugging: Log the combined descriptions

    // If all descriptions are "No description available", return a default summary
    if (frameDescriptions.every((desc) => desc === 'No description available')) {
      return 'The video contains scenes of varying content.';
    }

    // Use Hugging Face's summarization model to generate a concise summary
    const summaryResponse = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      { inputs: combinedDescriptions },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const summary = summaryResponse.data[0].summary_text;
    console.log('Generated summary:', summary); // Debugging: Log the summary
    return summary || 'No summary available';
  } catch (err) {
    console.error('Error generating summary:', err);
    return 'No summary available';
  }
};


const createMemory = async (req, res) => {
  try {
    const { title, description } = req.body;
    const media = req.file.path;
    const isVideo = ['video/mp4', 'video/webm', 'video/ogg'].includes(req.file.mimetype);
    let caption = '';
    let summary = '';
    let mediaUrl = '';

    console.log('User ID:', req.userId);
    console.log('File details:', req.file);

    if (isVideo) {
      const cleanFilename = req.file.filename.replace(/\.(mp4|webm|ogg)$/i, '');
      const publicId = `memories/${cleanFilename}`;
      console.log('Uploading video with public_id:', publicId);
      const uploadResult = await cloudinary.uploader.upload(media, {
        resource_type: 'video',
        public_id: publicId,
      });
      mediaUrl = uploadResult.secure_url;
      console.log('Uploaded video URL:', mediaUrl);

      const thumbnailOffsets = [1, 5, 10];
      const thumbnailCaptions = await Promise.all(
        thumbnailOffsets.map(async (offset) => {
          const thumbnailUrl = cloudinary.url(uploadResult.public_id, {
            resource_type: 'video',
            format: 'jpg',
            transformation: [
              { width: 300, height: 300, crop: 'fill' },
              { fetch_format: 'jpg', quality: 'auto' },
              { start_offset: offset.toString() },
            ],
          });
          console.log(`Thumbnail URL (${offset}s): ${thumbnailUrl}`);
          return await generateCaption(thumbnailUrl, false);
        })
      );

      caption = thumbnailCaptions[0];
      summary = thumbnailCaptions.join(' ');
    } else {
      const uploadResult = await cloudinary.uploader.upload(media, {
        resource_type: 'image',
        public_id: `memories/${req.file.filename}`,
        transformation: [{ quality: 'auto:good' }, { effect: 'improve' }],
      });
      mediaUrl = uploadResult.secure_url;
      console.log('Uploaded image URL:', mediaUrl);
      caption = await generateCaption(media, isVideo);
    }

    const memory = new Memory({
      title,
      description,
      media: mediaUrl,
      isVideo,
      caption,
      summary: isVideo ? summary : undefined,
      user: req.userId,
    });

    await memory.save();
    console.log('Saved memory:', memory);
    res.status(201).json(memory);
  } catch (err) {
    console.error('Error in createMemory:', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteMemory = async (req, res) => {
  try {
    const { id } = req.params; // Memory ID from URL
    const userId = req.userId; // From auth middleware

    // Find memory and ensure it belongs to the user
    const memory = await Memory.findOne({ _id: id, user: userId });
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found or not authorized' });
    }

    // Delete from MongoDB
    await Memory.deleteOne({ _id: id });

    // Optionally delete from Cloudinary (if needed)
    const publicId = `memories/${memory.media.split('/').pop().split('.')[0]}`; // Extract public ID
    await cloudinary.uploader.destroy(publicId, {
      resource_type: memory.isVideo ? 'video' : 'image',
    });

    res.status(200).json({ message: 'Memory deleted successfully' });
  } catch (err) {
    console.error('Error in deleteMemory:', err);
    res.status(500).json({ error: err.message });
  }
};

const editMemory = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, visibility } = req.body; // Added visibility
    const userId = req.userId;
    const media = req.file?.path; // Optional new media file

    // Find memory and ensure it belongs to the user
    const memory = await Memory.findOne({ _id: id, user: userId });
    if (!memory) {
      return res.status(404).json({ error: 'Memory not found or not authorized' });
    }

    // Update fields
    memory.title = title || memory.title;
    memory.description = description || memory.description;

    // Update visibility if provided, with validation
    if (visibility) {
      const validVisibilities = ['private', 'friends', 'public'];
      if (!validVisibilities.includes(visibility)) {
        return res.status(400).json({ error: 'Invalid visibility value. Must be private, friends, or public.' });
      }
      memory.visibility = visibility;
    }

    // If new media is uploaded, replace the old one
    if (media) {
      // Delete old media from Cloudinary
      const oldPublicId = `memories/${memory.media.split('/').pop().split('.')[0]}`;
      await cloudinary.uploader.destroy(oldPublicId, {
        resource_type: memory.isVideo ? 'video' : 'image',
      });

      // Upload new media
      const isVideo = ['video/mp4', 'video/webm', 'video/ogg'].includes(req.file.mimetype);
      const uploadResult = await cloudinary.uploader.upload(media, {
        resource_type: isVideo ? 'video' : 'image',
        public_id: `memories/${req.file.filename}`,
        transformation: isVideo ? [] : [{ quality: 'auto:good' }, { effect: 'improve' }],
      });
      memory.media = uploadResult.secure_url;
      memory.isVideo = isVideo;
      memory.caption = await generateCaption(media, isVideo);
    }

    await memory.save();
    res.status(200).json(memory);
  } catch (err) {
    console.error('Error in editMemory:', err);
    res.status(500).json({ error: err.message });
  }
};


const getMemories = async (req, res) => {
  try {
    const userId = req.userId; // From auth middleware, undefined if not authenticated
    let query;

    if (userId) {
      const user = await User.findById(userId).select('friends').lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      const friendIds = user.friends || [];

      query = {
        $or: [
          { user: userId },
          { visibility: 'public' },
          { visibility: 'friends', user: { $in: friendIds } },
        ],
      };
    } else {
      query = { visibility: 'public' };
    }

    const memories = await Memory.find(query)
      .sort({ createdAt: -1 })
      .populate('user', 'username avatar') // Populate username and avatar
      .lean();

    console.log('Fetched memories:', memories);
    res.json(memories);
  } catch (error) {
    console.error('Error in getMemories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getPublicMemories = async (req, res) => {
  try {
    // Fetch only public memories, no user-specific logic
    const memories = await Memory.find({ visibility: 'public' }).lean();
    console.log('Fetched public memories:', memories);
    res.json(memories);
  } catch (error) {
    console.error('Error in getMemories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { createMemory, getMemories, getPublicMemories, deleteMemory, editMemory };