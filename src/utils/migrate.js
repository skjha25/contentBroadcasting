require('dotenv').config();
const pool = require('../config/db');

const createTables = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('principal', 'teacher') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS content (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        subject VARCHAR(100) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size INT NOT NULL,
        uploaded_by INT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        rejection_reason TEXT,
        approved_by INT,
        approved_at TIMESTAMP NULL,
        start_time TIMESTAMP NULL,
        end_time TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS content_slots (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject VARCHAR(100) NOT NULL,
        teacher_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_subject_teacher (subject, teacher_id),
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS content_schedule (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content_id INT NOT NULL,
        slot_id INT NOT NULL,
        rotation_order INT NOT NULL DEFAULT 0,
        duration INT NOT NULL DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
        FOREIGN KEY (slot_id) REFERENCES content_slots(id) ON DELETE CASCADE
      )
    `);

    await conn.commit();
    console.log('All tables created successfully');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    conn.release();
  }
};

createTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));