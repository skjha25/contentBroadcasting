const pool = require('../config/db');
const { getFileUrl } = require('../config/storage');

const uploadContent = async (req, res) => {
  const { title, subject, description, start_time, end_time, rotation_duration } = req.body;

  if (!title || !subject) {
    return res.status(400).json({ success: false, message: 'Title and subject are required.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'File is required.' });
  }
  if ((start_time && !end_time) || (!start_time && end_time)) {
    return res.status(400).json({ success: false, message: 'Both start_time and end_time must be provided together.' });
  }
  if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
    return res.status(400).json({ success: false, message: 'start_time must be before end_time.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const fileUrl = getFileUrl(req.file);
    const fileSize = req.file.size;
    const fileType = req.file.mimetype;

    const [contentResult] = await conn.query(
      `INSERT INTO content 
        (title, description, subject, file_url, file_type, file_size, uploaded_by, status, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [title, description || null, subject.toLowerCase(), fileUrl, fileType, fileSize,
        req.user.id, start_time || null, end_time || null]
    );
    const contentId = contentResult.insertId;

    await conn.query(
      `INSERT INTO content_slots (subject, teacher_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE subject = VALUES(subject)`,
      [subject.toLowerCase(), req.user.id]
    );

    const [slotRows] = await conn.query(
      'SELECT id FROM content_slots WHERE subject = ? AND teacher_id = ?',
      [subject.toLowerCase(), req.user.id]
    );
    const slotId = slotRows[0].id;

    const [orderRows] = await conn.query(
      'SELECT COALESCE(MAX(rotation_order), 0) + 1 AS next_order FROM content_schedule WHERE slot_id = ?',
      [slotId]
    );
    const nextOrder = orderRows[0].next_order;

    await conn.query(
      'INSERT INTO content_schedule (content_id, slot_id, rotation_order, duration) VALUES (?, ?, ?, ?)',
      [contentId, slotId, nextOrder, parseInt(rotation_duration) || 5]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'Content uploaded successfully. Awaiting principal approval.',
      data: { id: contentId, title, subject: subject.toLowerCase(), status: 'pending' },
    });
  } catch (err) {
    await conn.rollback();
    console.error('Upload error:', err.message);
    return res.status(500).json({ success: false, message: 'Upload failed.' });
  } finally {
    conn.release();
  }
};

const getMyContent = async (req, res) => {
  const { status, subject } = req.query;

  let query = `
    SELECT c.*, cs.duration, cs.rotation_order, u.name AS approved_by_name
    FROM content c
    LEFT JOIN content_schedule cs ON cs.content_id = c.id
    LEFT JOIN users u ON u.id = c.approved_by
    WHERE c.uploaded_by = ?
  `;
  const params = [req.user.id];

  if (status) { params.push(status); query += ' AND c.status = ?'; }
  if (subject) { params.push(subject.toLowerCase()); query += ' AND c.subject = ?'; }
  query += ' ORDER BY c.created_at DESC';

  try {
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get my content error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch content.' });
  }
};

const getAllContent = async (req, res) => {
  const { status, subject, teacher_id } = req.query;

  let query = `
    SELECT c.*, u.name AS teacher_name, u.email AS teacher_email,
           cs.duration, cs.rotation_order, approver.name AS approved_by_name
    FROM content c
    JOIN users u ON u.id = c.uploaded_by
    LEFT JOIN users approver ON approver.id = c.approved_by
    LEFT JOIN content_schedule cs ON cs.content_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (status) { params.push(status); query += ' AND c.status = ?'; }
  if (subject) { params.push(subject.toLowerCase()); query += ' AND c.subject = ?'; }
  if (teacher_id) { params.push(teacher_id); query += ' AND c.uploaded_by = ?'; }
  query += ' ORDER BY c.created_at DESC';

  try {
    const [rows] = await pool.query(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get all content error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch content.' });
  }
};

const approveContent = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query(
      `UPDATE content 
       SET status = 'approved', approved_by = ?, approved_at = NOW(), rejection_reason = NULL
       WHERE id = ? AND status = 'pending'`,
      [req.user.id, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Content not found or already processed.' });
    }
    const [rows] = await pool.query('SELECT * FROM content WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Content approved.', data: rows[0] });
  } catch (err) {
    console.error('Approve error:', err.message);
    return res.status(500).json({ success: false, message: 'Approval failed.' });
  }
};

const rejectContent = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim() === '') {
    return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
  }

  try {
    const [result] = await pool.query(
      `UPDATE content 
       SET status = 'rejected', rejection_reason = ?, approved_by = ?, approved_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [reason.trim(), req.user.id, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Content not found or already processed.' });
    }
    const [rows] = await pool.query('SELECT * FROM content WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Content rejected.', data: rows[0] });
  } catch (err) {
    console.error('Reject error:', err.message);
    return res.status(500).json({ success: false, message: 'Rejection failed.' });
  }
};

const getPendingContent = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, u.name AS teacher_name, u.email AS teacher_email,
             cs.duration, cs.rotation_order
      FROM content c
      JOIN users u ON u.id = c.uploaded_by
      LEFT JOIN content_schedule cs ON cs.content_id = c.id
      WHERE c.status = 'pending'
      ORDER BY c.created_at ASC
    `);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get pending error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch pending content.' });
  }
};

module.exports = {
  uploadContent, getMyContent, getAllContent,
  approveContent, rejectContent, getPendingContent,
};
