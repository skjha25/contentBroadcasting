const pool = require('../config/db');

/**
 * Scheduling Logic:
 * 
 * For each subject under a teacher, we have content items with a rotation_order and duration.
 * We calculate which content is "active" right now by:
 * 1. Getting all approved content for this teacher+subject that is within its time window
 * 2. Calculating total cycle duration (sum of all durations)
 * 3. Finding elapsed minutes since a fixed epoch (midnight today)
 * 4. Using modulo to find position in cycle → pick the right content
 * 
 * This creates a seamless, looping rotation without any state/cron job needed.
 */

const getActiveContentForTeacher = async (teacherId, subject = null) => {
  const now = new Date();

  // Build query - get all approved content for this teacher within time window
  let query = `
    SELECT 
      c.id, c.title, c.description, c.subject, c.file_url, c.file_type,
      c.start_time, c.end_time, c.created_at,
      cs.duration, cs.rotation_order, cs.slot_id,
      u.name AS teacher_name
    FROM content c
    JOIN content_schedule cs ON cs.content_id = c.id
    JOIN content_slots sl ON sl.id = cs.slot_id
    JOIN users u ON u.id = c.uploaded_by
    WHERE c.uploaded_by = ?
      AND c.status = 'approved'
      AND c.start_time IS NOT NULL
      AND c.end_time IS NOT NULL
      AND c.start_time <= ?
      AND c.end_time >= ?
  `;

  const params = [teacherId, now, now];

  if (subject) {
    params.push(subject.toLowerCase());
    query += ` AND c.subject = ?`;
  }

  query += ' ORDER BY c.subject, cs.rotation_order ASC';

  const [allContent] = await pool.query(query, params);

  if (allContent.length === 0) {
    return null;
  }

  // Group by subject
  const bySubject = {};
  allContent.forEach((item) => {
    if (!bySubject[item.subject]) {
      bySubject[item.subject] = [];
    }
    bySubject[item.subject].push(item);
  });

  // For each subject, determine the currently active item
  const activeContent = [];

  for (const [subj, items] of Object.entries(bySubject)) {
    const activeItem = getActiveItemFromRotation(items, now);
    if (activeItem) {
      activeContent.push(activeItem);
    }
  }

  return activeContent.length > 0 ? activeContent : null;
};


const getActiveItemFromRotation = (items, now) => {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];

  // Calculate total cycle duration in minutes
  const totalCycleDuration = items.reduce((sum, item) => sum + item.duration, 0);

  // Use minutes elapsed since midnight (UTC) as our clock
  const midnight = new Date(now);
  midnight.setUTCHours(0, 0, 0, 0);
  const elapsedMinutes = Math.floor((now - midnight) / 60000);

  // Position in cycle
  const positionInCycle = elapsedMinutes % totalCycleDuration;

  // Find which item is active at this position
  let elapsed = 0;
  for (const item of items) {
    elapsed += item.duration;
    if (positionInCycle < elapsed) {
      return item;
    }
  }

  // Fallback (shouldn't happen)
  return items[0];
};

module.exports = { getActiveContentForTeacher };