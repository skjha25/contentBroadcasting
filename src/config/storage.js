// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');
// const { v4: uuidv4 } = require('uuid');

// const MAX_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
// const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

// const isS3Configured = () => {
//   return !!(
//     process.env.AWS_ACCESS_KEY_ID &&
//     process.env.AWS_SECRET_ACCESS_KEY &&
//     process.env.AWS_REGION &&
//     process.env.AWS_S3_BUCKET
//   );
// };

// const fileFilter = (req, file, cb) => {
//   if (ALLOWED_TYPES.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'), false);
//   }
// };

// let upload;
// let storageType = 'local';

// if (isS3Configured()) {
//   try {
//     const { S3Client } = require('@aws-sdk/client-s3');
//     const multerS3 = require('multer-s3');

//     const s3Client = new S3Client({
//       region: process.env.AWS_REGION,
//       credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//       },
//     });

//     const s3Storage = multerS3({
//       s3: s3Client,
//       bucket: process.env.AWS_S3_BUCKET,
//       metadata: (req, file, cb) => {
//         cb(null, { fieldName: file.fieldname });
//       },
//       key: (req, file, cb) => {
//         const ext = path.extname(file.originalname);
//         const filename = `uploads/${uuidv4()}${ext}`;
//         cb(null, filename);
//       },
//     });

//     upload = multer({
//       storage: s3Storage,
//       limits: { fileSize: MAX_SIZE },
//       fileFilter,
//     });

//     storageType = 's3';
//     console.log('Storage: AWS S3');
//   } catch (err) {
//     console.warn('S3 config found but failed to initialize, falling back to local storage:', err.message);
//   }
// }

// if (storageType !== 's3') {
//   const uploadDir = path.join(__dirname, '../../uploads');
//   if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir, { recursive: true });
//   }

//   const localStorage = multer.diskStorage({
//     destination: (req, file, cb) => {
//       cb(null, uploadDir);
//     },
//     filename: (req, file, cb) => {
//       const ext = path.extname(file.originalname);
//       cb(null, `${uuidv4()}${ext}`);
//     },
//   });

//   upload = multer({
//     storage: localStorage,
//     limits: { fileSize: MAX_SIZE },
//     fileFilter,
//   });

//   storageType = 'local';
//   console.log('Storage: Local filesystem');
// }

// const getFileUrl = (file) => {
//   if (storageType === 's3') {
//     return file.location; 
//   }
//   return `/uploads/${file.filename}`;
// };

// module.exports = { upload, getFileUrl, storageType };
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const MAX_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

const isS3Configured = () => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION &&
    process.env.AWS_S3_BUCKET
  );
};

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and GIF are allowed.'), false);
  }
};

let upload;
let storageType = 'local';

// ─── Cloudinary (highest priority) ───────────────────────────────────────────
if (isCloudinaryConfigured()) {
  try {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const cloudinaryStorage = new CloudinaryStorage({
      cloudinary,
      params: (req, file) => {
        const ext = path.extname(file.originalname).replace('.', '');
        return {
          folder: 'content-broadcasting',
          format: ext || 'jpg',
          public_id: uuidv4(),
          resource_type: 'image',
        };
      },
    });

    upload = multer({
      storage: cloudinaryStorage,
      limits: { fileSize: MAX_SIZE },
      fileFilter,
    });

    storageType = 'cloudinary';
    console.log('Storage: Cloudinary');
  } catch (err) {
    console.warn('Cloudinary config found but failed to initialize, falling back:', err.message);
  }
}

// ─── AWS S3 (fallback) ────────────────────────────────────────────────────────
if (storageType !== 'cloudinary' && isS3Configured()) {
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    const multerS3 = require('multer-s3');

    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const s3Storage = multerS3({
      s3: s3Client,
      bucket: process.env.AWS_S3_BUCKET,
      metadata: (req, file, cb) => {
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `uploads/${uuidv4()}${ext}`;
        cb(null, filename);
      },
    });

    upload = multer({
      storage: s3Storage,
      limits: { fileSize: MAX_SIZE },
      fileFilter,
    });

    storageType = 's3';
    console.log('Storage: AWS S3');
  } catch (err) {
    console.warn('S3 config found but failed to initialize, falling back to local storage:', err.message);
  }
}

// ─── Local (final fallback) ───────────────────────────────────────────────────
if (storageType === 'local') {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const localStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });

  upload = multer({
    storage: localStorage,
    limits: { fileSize: MAX_SIZE },
    fileFilter,
  });

  console.log('Storage: Local filesystem');
}

// ─── Get public URL of uploaded file ─────────────────────────────────────────
const getFileUrl = (file) => {
  if (storageType === 'cloudinary') {
    return file.path; // Cloudinary returns full URL in file.path
  }
  if (storageType === 's3') {
    return file.location;
  }
  return `/uploads/${file.filename}`;
};

module.exports = { upload, getFileUrl, storageType };