const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); // Add this line

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the "uploads" folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI2)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log(err));

// Routes
app.get('/', (req, res) => {
  res.send('MomentCraft Backend');
});

// Memory Routes
const memoryRoutes = require('./routes/memoryRoutes');
app.use('/api/memories', memoryRoutes);

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const timelineRoutes = require('./routes/timelineRoutes');
app.use('/api/timelines', timelineRoutes);

const messagesRoutes = require('./routes/messages');
app.use('/api/messages', messagesRoutes);

const pushRoutes = require('./routes/push');
app.use('/api/push', pushRoutes);
// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));