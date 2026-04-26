const pool = require('../config/db');
const { getActiveContentForTeacher } = require('../services/scheduling.service');

const getLiveContent = async (req, res) => {
  const { teacherId } = req.params;
  const { subject } = req.query;

  try {
    const [teacherRows] = await pool.query(
      "SELECT id, name FROM users WHERE id = ? AND role = 'teacher'",
      [teacherId]
    );

    if (teacherRows.length === 0) {
      return res.json({ success: true, message: 'No content available', data: null });
    }

    const teacher = teacherRows[0];
    const activeContent = await getActiveContentForTeacher(parseInt(teacherId), subject || null);

    if (!activeContent || activeContent.length === 0) {
      return res.json({ success: true, message: 'No content available', data: null });
    }

    return res.json({
      success: true,
      message: 'Live content fetched successfully.',
      data: {
        teacher: { id: teacher.id, name: teacher.name },
        content: activeContent,
        fetched_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Live content error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch live content.' });
  }
};

const getTeacherSubjects = async (req, res) => {
  const { teacherId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT subject FROM content 
       WHERE uploaded_by = ? AND status = 'approved'
       ORDER BY subject`,
      [teacherId]
    );
    return res.json({ success: true, data: rows.map(r => r.subject) });
  } catch (err) {
    console.error('Get subjects error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch subjects.' });
  }
};

module.exports = { getLiveContent, getTeacherSubjects };
