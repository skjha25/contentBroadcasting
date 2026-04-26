require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const seed = async () => {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    await pool.query(`
      INSERT IGNORE INTO users (name, email, password_hash, role)
      VALUES ('Mr. Principal', 'principal@school.com', ?, 'principal')
    `, [passwordHash]);

    await pool.query(`
      INSERT IGNORE INTO users (name, email, password_hash, role)
      VALUES ('Mrs. Sharma', 'teacher1@school.com', ?, 'teacher')
    `, [passwordHash]);

    await pool.query(`
      INSERT IGNORE INTO users (name, email, password_hash, role)
      VALUES ('Mr. Verma', 'teacher2@school.com', ?, 'teacher')
    `, [passwordHash]);

    console.log('Seed data inserted');
    console.log('\nDemo Credentials:');
    console.log('Principal → principal@school.com / password123');
    console.log('Teacher 1 → teacher1@school.com / password123');
    console.log('Teacher 2 → teacher2@school.com / password123');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    process.exit(0);
  }
};

seed();