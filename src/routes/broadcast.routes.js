const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getLiveContent, getTeacherSubjects } = require('../controllers/broadcast.controller');

// Rate limit the public API - 60 req/min per IP
const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoints - no auth needed (students access these)
router.get('/live/:teacherId', publicRateLimit, getLiveContent);
router.get('/live/:teacherId/subjects', publicRateLimit, getTeacherSubjects);

module.exports = router;
