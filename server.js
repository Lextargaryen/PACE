const express = require('express');
const cors = require('cors');
const path = require('node:path');
const {
  insertSurvey,
  getAllSurveys,
  getSurveysForExport,
  getSurveyStats,
  deleteSurvey
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/geocode/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`, {
      headers: { 'User-Agent': 'PACE Bus Survey/1.0 (field survey application)' }
    });
    if (!response.ok) return res.status(502).json({ error: 'Reverse geocoding unavailable' });
    const result = await response.json();
    const address = result.address || {};
    // Prefer the closest named feature/road and nearby locality. City-level fields can be many kilometres away.
    const nearbyPart = address.road || address.pedestrian || address.bus_stop || address.station || address.neighbourhood || address.suburb;
    const locality = address.city_district || address.town || address.municipality || address.village || address.city;
    const majorIdentifier = [nearbyPart, locality].filter(Boolean).join(', ') || result.name || address.county || result.display_name;
    return res.json({ location: majorIdentifier || 'GPS location', display_name: result.display_name || '', latitude: lat, longitude: lon });
  } catch (err) {
    console.error('Reverse geocoding failed:', err.message);
    return res.status(502).json({ error: 'Reverse geocoding unavailable' });
  }
});

// Helper to escape CSV fields
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  const stringVal = String(val);
  if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n') || stringVal.includes('\r')) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return stringVal;
}

/**
 * POST /api/surveys/submit
 * Receives a completed bus card payload and writes it to the database
 */
app.post('/api/surveys/submit', async (req, res) => {
  try {
    const payload = req.body;

    // Validate required fields
    const required = [
      'recorder_name',
      'survey_date',
      'route_no',
      'vehicle_no',
      'route_text',
      'ownership_type',
      'service_type',
      'seat_capacity_slot',
      'location',
      'arrival_time',
      'departure_time'
    ];

    for (const field of required) {
      if (!payload[field] || String(payload[field]).trim() === '') {
        return res.status(400).json({
          error: `Missing required field: ${field}`
        });
      }
    }

    const savedRecord = await insertSurvey(payload);
    return res.status(201).json({
      success: true,
      message: 'Bus survey record submitted successfully',
      record: savedRecord
    });
  } catch (err) {
    console.error('Error submitting survey:', err);
    return res.status(500).json({
      error: 'Failed to save survey record',
      details: err.message
    });
  }
});

/**
 * POST /api/surveys/batch
 * Syncs multiple queued surveys from offline mode
 */
app.post('/api/surveys/batch', async (req, res) => {
  try {
    const { surveys } = req.body;
    if (!Array.isArray(surveys) || surveys.length === 0) {
      return res.status(400).json({ error: 'Array of surveys is required' });
    }

    const inserted = [];
    for (const item of surveys) {
      const saved = await insertSurvey(item);
      inserted.push(saved);
    }

    return res.status(201).json({
      success: true,
      count: inserted.length,
      records: inserted
    });
  } catch (err) {
    console.error('Error batch submitting surveys:', err);
    return res.status(500).json({
      error: 'Failed to batch save surveys',
      details: err.message
    });
  }
});

/**
 * GET /api/surveys/export
 * Downloads all recorded survey entries as a CSV file for analysis
 */
app.get('/api/surveys/export', async (req, res) => {
  try {
    const records = await getSurveysForExport();

    const headers = [
      'ID',
      'Recorder Name',
      'Survey Date',
      'Route No',
      'Vehicle No',
      'Route (Plain Text)',
      'Operator Type',
      'Bus Condition',
      'Seat Capacity',
      'Location',
      'Arrival Time',
      'Departure Time',
      'Net Count (Sum)',
      'Submitted At Timestamp'
    ];

    let csvContent = '\uFEFF' + headers.join(',') + '\n';

    for (const r of records) {
      const row = [
        escapeCsvValue(r.id),
        escapeCsvValue(r.recorder_name),
        escapeCsvValue(r.survey_date),
        escapeCsvValue(r.route_no),
        escapeCsvValue(r.vehicle_no),
        escapeCsvValue(r.route_text),
        escapeCsvValue(r.ownership_type),
        escapeCsvValue(r.service_type),
        escapeCsvValue(r.seat_capacity_slot),
        escapeCsvValue(r.location),
        escapeCsvValue(r.arrival_time),
        escapeCsvValue(r.departure_time),
        escapeCsvValue(r.net_sum),
        escapeCsvValue(r.submitted_at_timestamp)
      ];
      csvContent += row.join(',') + '\n';
    }

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pace_surveys_${dateStr}.csv"`
    );
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).json({ error: 'Failed to export CSV', details: err.message });
  }
});

/**
 * GET /api/surveys
 * List recorded surveys
 */
app.get('/api/surveys', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const records = await getAllSurveys(limit);
    return res.json({ success: true, count: records.length, surveys: records });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch surveys', details: err.message });
  }
});

/**
 * GET /api/stats
 * Aggregate metrics
 */
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getSurveyStats();
    return res.json({ success: true, stats });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

/**
 * DELETE /api/surveys/:id
 */
app.delete('/api/surveys/:id', async (req, res) => {
  try {
    const success = await deleteSurvey(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Record not found' });
    }
    return res.json({ success: true, message: 'Record deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete record', details: err.message });
  }
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`PACE Bus Survey server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
