const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
);

function normalizeSurvey(data) {
  return {
    recorder_name: String(data.recorder_name || '').trim(),
    survey_date: String(data.survey_date || '').trim(),
    route_no: String(data.route_no || '').trim(),
    vehicle_no: String(data.vehicle_no || '').trim(),
    route_text: String(data.route_text || '').trim(),
    ownership_type: String(data.ownership_type || 'Private'),
    service_type: String(data.service_type || 'Normal'),
    seat_capacity_slot: String(data.seat_capacity_slot || 'Below 20'),
    location: String(data.location || '').trim(),
    arrival_time: String(data.arrival_time || '').trim(),
    departure_time: String(data.departure_time || '').trim(),
    net_sum: Number(data.net_sum) || 0,
    submitted_at_timestamp: data.submitted_at_timestamp || new Date().toISOString()
  };
}

async function insertSurvey(data) {
  const { data: record, error } = await supabase
    .from('bus_surveys')
    .insert(normalizeSurvey(data))
    .select()
    .single();
  if (error) throw error;
  return record;
}

async function getAllSurveys(limit = 100) {
  const { data, error } = await supabase
    .from('bus_surveys')
    .select('*')
    .order('id', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 1000));
  if (error) throw error;
  return data;
}

async function getSurveysForExport() {
  const { data, error } = await supabase
    .from('bus_surveys')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

async function getSurveyStats() {
  const records = await getSurveysForExport();
  return records.reduce((stats, record) => ({
    total_buses: stats.total_buses + 1,
    total_net_passengers: stats.total_net_passengers + (record.net_sum || 0)
  }), { total_buses: 0, total_net_passengers: 0 });
}

async function deleteSurvey(id) {
  const { data, error } = await supabase
    .from('bus_surveys')
    .delete()
    .eq('id', Number(id))
    .select('id');
  if (error) throw error;
  return data.length > 0;
}

module.exports = {
  insertSurvey,
  getAllSurveys,
  getSurveysForExport,
  getSurveyStats,
  deleteSurvey
};
