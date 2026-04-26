const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { upload } = require('../config/storage');
const {
  uploadContent,
  getMyContent,
  getAllContent,
  approveContent,
  rejectContent,
  getPendingContent,
} = require('../controllers/content.controller');

// Teacher routes
router.post(
  '/upload',
  authenticate,
  authorize('teacher'),
  upload.single('file'),
  uploadContent
);
router.get('/my', authenticate, authorize('teacher'), getMyContent);

// Principal routes
router.get('/all', authenticate, authorize('principal'), getAllContent);
router.get('/pending', authenticate, authorize('principal'), getPendingContent);
router.patch('/:id/approve', authenticate, authorize('principal'), approveContent);
router.patch('/:id/reject', authenticate, authorize('principal'), rejectContent);

module.exports = router;
