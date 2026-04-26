require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const contentRoutes = require('./routes/content.routes');
const broadcastRoutes = require('./routes/broadcast.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Core middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (only used for local storage)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Content Broadcasting System is running', timestamp: new Date() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/content', contentRoutes);
app.use('/content', broadcastRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n Content Broadcasting System running on port ${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /auth/register`);
  console.log(`  POST /auth/login`);
  console.log(`  GET  /auth/me`);
  console.log(`  POST /content/upload       [Teacher]`);
  console.log(`  GET  /content/my           [Teacher]`);
  console.log(`  GET  /content/all          [Principal]`);
  console.log(`  GET  /content/pending      [Principal]`);
  console.log(`  PATCH /content/:id/approve [Principal]`);
  console.log(`  PATCH /content/:id/reject  [Principal]`);
  console.log(`  GET  /content/live/:teacherId  [Public]`);
  console.log(`  GET  /content/live/:teacherId/subjects [Public]\n`);
});

module.exports = app;
