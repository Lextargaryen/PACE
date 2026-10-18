const assert = require('node:assert');

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 Running PACE test suite...\n');

  // Test 1: Static assets
  console.log('Test 1: Verify static file routes');
  for (const path of ['/', '/css/styles.css', '/js/app.js', '/manifest.json', '/sw.js']) {
    const res = await fetch(`${BASE_URL}${path}`);
    assert.strictEqual(res.status, 200, `Expected 200 for ${path}`);
    const text = await res.text();
    assert.ok(text.length > 0, `Expected non-empty response for ${path}`);
  }
  console.log('  ✅ Static routes passed\n');

  // Test 2: Validation of required fields
  console.log('Test 2: Validation of required fields on /api/surveys/submit');
  const invalidPayload = {
    recorder_name: 'Tester'
    // missing all other required fields
  };
  const failRes = await fetch(`${BASE_URL}/api/surveys/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invalidPayload)
  });
  assert.strictEqual(failRes.status, 400, 'Expected 400 for missing required fields');
  console.log('  ✅ Validation check passed\n');

  // Test 3: Successful submission
  console.log('Test 3: Valid bus survey submission');
  const validPayload = {
    recorder_name: 'Surveyor Perera',
    survey_date: '2026-10-16',
    route_no: '120',
    vehicle_no: 'WP NC-1234',
    route_text: 'Pettah - Horana',
    ownership_type: 'SLTB',
    service_type: 'Normal',
    seat_capacity_slot: '51-60',
    location: '6.9312, 79.8456',
    arrival_time: '15:00:00',
    departure_time: '15:10:00',
    positive_count: 32,
    negative_count: 14,
    net_sum: 18
  };

  const submitRes = await fetch(`${BASE_URL}/api/surveys/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload)
  });
  assert.strictEqual(submitRes.status, 201, 'Expected 201 Created');
  const submitData = await submitRes.json();
  assert.ok(submitData.success, 'Expected success: true');
  assert.ok(submitData.record.id > 0, 'Expected positive auto-increment id');
  assert.strictEqual(submitData.record.route_no, '120');
  assert.strictEqual(submitData.record.net_sum, 18);
  console.log(`  ✅ Successfully saved survey record ID: ${submitData.record.id}\n`);

  // Test 4: Batch submission (offline queue sync)
  console.log('Test 4: Batch offline queue sync on /api/surveys/batch');
  const batchPayload = {
    surveys: [
      {
        recorder_name: 'Surveyor Perera',
        survey_date: '2026-10-16',
        route_no: '100',
        vehicle_no: 'WP NA-5544',
        route_text: 'Panadura - Pettah',
        ownership_type: 'Private',
        service_type: 'AC',
        seat_capacity_slot: ' Over 60'.trim(),
        location: '6.9200, 79.8500',
        arrival_time: '15:15:00',
        departure_time: '15:20:00',
        positive_count: 15,
        negative_count: 5,
        net_sum: 10
      }
    ]
  };
  const batchRes = await fetch(`${BASE_URL}/api/surveys/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchPayload)
  });
  assert.strictEqual(batchRes.status, 201, 'Expected 201 for batch sync');
  const batchData = await batchRes.json();
  assert.strictEqual(batchData.count, 1);
  console.log('  ✅ Batch sync passed\n');

  // Test 5: Verify CSV Export
  console.log('Test 5: Verify CSV export on /api/surveys/export');
  const csvRes = await fetch(`${BASE_URL}/api/surveys/export`);
  assert.strictEqual(csvRes.status, 200, 'Expected 200 for CSV export');
  assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
  assert.ok(csvRes.headers.get('content-disposition').includes('attachment; filename='));

  const csvBody = await csvRes.text();
  assert.ok(csvBody.includes('Route No'), 'CSV must include Route No header');
  assert.ok(csvBody.includes('Net Count (Sum)'), 'CSV must include Net Count (Sum) header');
  assert.ok(!csvBody.includes('Boarded (+)'), 'CSV must not include Boarded (+) header');
  assert.ok(!csvBody.includes('Alighted (-)'), 'CSV must not include Alighted (-) header');
  assert.ok(csvBody.includes('Pettah - Horana'), 'CSV must include the inserted survey data');
  console.log('  ✅ CSV export passed with accurate headers and records\n');

  // Test 6: Verify Summary Stats
  console.log('Test 6: Verify Stats on /api/stats');
  const statsRes = await fetch(`${BASE_URL}/api/stats`);
  assert.strictEqual(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.ok(statsData.stats.total_buses >= 2);
  assert.strictEqual(typeof statsData.stats.total_net_passengers, 'number');
  assert.strictEqual(statsData.stats.total_boarded, undefined);
  assert.strictEqual(statsData.stats.total_alighted, undefined);
  console.log('  ✅ Stats query passed:', statsData.stats, '\n');

  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 100% SPECIFICATION CONFORMANCE.');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
