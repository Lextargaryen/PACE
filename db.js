const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'transit_pulse.db');
const db = new DatabaseSync(DB_PATH);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS bus_surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recorder_name TEXT NOT NULL,
    survey_date TEXT NOT NULL,
    route_no TEXT NOT NULL,
    vehicle_no TEXT NOT NULL,
    route_text TEXT NOT NULL,
    ownership_type TEXT NOT NULL CHECK(ownership_type IN ('Private', 'SLTB')),
    service_type TEXT NOT NULL CHECK(service_type IN ('Normal', 'AC')),
    seat_capacity_slot TEXT NOT NULL CHECK(seat_capacity_slot IN ('Below 20', '21-30', '31-40', '41-50', '51-60', 'Over 60')),
    location TEXT NOT NULL,
    arrival_time TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    positive_count INTEGER NOT NULL DEFAULT 0,
    negative_count INTEGER NOT NULL DEFAULT 0,
    net_sum INTEGER NOT NULL DEFAULT 0,
    submitted_at_timestamp TEXT DEFAULT (DATETIME('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_survey_date ON bus_surveys(survey_date);
  CREATE INDEX IF NOT EXISTS idx_recorder_name ON bus_surveys(recorder_name);
  CREATE INDEX IF NOT EXISTS idx_route_no ON bus_surveys(route_no);
`);

/**
 * Save a single survey entry
 */
function insertSurvey(data) {
  const stmt = db.prepare(`
    INSERT INTO bus_surveys (
      recorder_name,
      survey_date,
      route_no,
      vehicle_no,
      route_text,
      ownership_type,
      service_type,
      seat_capacity_slot,
      location,
      arrival_time,
      departure_time,
      positive_count,
      negative_count,
      net_sum,
      submitted_at_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const submittedAt = data.submitted_at_timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);

  const result = stmt.run(
    String(data.recorder_name || '').trim(),
    String(data.survey_date || '').trim(),
    String(data.route_no || '').trim(),
    String(data.vehicle_no || '').trim(),
    String(data.route_text || '').trim(),
    String(data.ownership_type || 'Private'),
    String(data.service_type || 'Normal'),
    String(data.seat_capacity_slot || 'Below 20'),
    String(data.location || '').trim(),
    String(data.arrival_time || '').trim(),
    String(data.departure_time || '').trim(),
    Number(data.positive_count) || 0,
    Number(data.negative_count) || 0,
    Number(data.net_sum) || 0,
    submittedAt
  );

  return { id: Number(result.lastInsertRowid), ...data, submitted_at_timestamp: submittedAt };
}

/**
 * Get all surveys ordered by latest first
 */
function getAllSurveys(limit = 100) {
  const stmt = db.prepare(`
    SELECT * FROM bus_surveys 
    ORDER BY id DESC 
    LIMIT ?
  `);
  return stmt.all(limit);
}

/**
 * Export all surveys as CSV
 */
function getSurveysForExport() {
  const stmt = db.prepare(`
    SELECT * FROM bus_surveys 
    ORDER BY id ASC
  `);
  return stmt.all();
}

/**
 * Get survey summary stats
 */
function getSurveyStats() {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) AS total_buses,
      TOTAL(positive_count) AS total_boarded,
      TOTAL(negative_count) AS total_alighted,
      TOTAL(net_sum) AS total_net_passengers
    FROM bus_surveys
  `);
  return stmt.get();
}

/**
 * Delete a survey record by ID
 */
function deleteSurvey(id) {
  const stmt = db.prepare('DELETE FROM bus_surveys WHERE id = ?');
  const result = stmt.run(Number(id));
  return result.changes > 0;
}

module.exports = {
  db,
  insertSurvey,
  getAllSurveys,
  getSurveysForExport,
  getSurveyStats,
  deleteSurvey
};
