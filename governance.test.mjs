import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPosmCoverage, classifyStoreComment, evaluateMonitoringAlerts } from './governance.mjs';

const posmFields = ['Poster', 'Rack'];
const route = (code, status = 'Active') => ({ 'Client Code': code, 'Current Status': status, 'Approval Status': 'Approved' });
const visit = (code, date, status, values = {}) => ({ 'Client Code': code, 'Started At': date, 'حالة الزيارة': status, ...values });
const successful = 'زيارة ناجحة';

test('POSM active denominator excludes explicit exclusion only; weak and not-suitable remain', () => {
  const result = buildPosmCoverage({ routePlan: [route('1'), route('2'), route('3'), route('4', 'Excluded')], visits: [], posmFields });
  assert.equal(result.metrics.totalActive, 3);
  assert.deepEqual(result.records.map(row => row.code), ['1', '2', '3']);
});

test('POSM blank is unknown, zero is known, completeness requires every field', () => {
  const result = buildPosmCoverage({ routePlan: [route('1'), route('2'), route('3')], visits: [
    visit('1', '2026-10-01', successful, { Poster: 0, Rack: 0 }),
    visit('2', '2026-10-01', successful, { Poster: 2, Rack: null }),
    visit('3', '2026-10-01', successful, { Poster: null, Rack: null })
  ], posmFields, now: '2026-10-02' });
  assert.equal(result.records.find(row => row.code === '1').complete, true);
  assert.equal(result.records.find(row => row.code === '1').covered, false);
  assert.equal(result.records.find(row => row.code === '2').complete, false);
  assert.equal(result.records.find(row => row.code === '2').covered, true);
  assert.equal(result.metrics.missingDataCount, 2);
  assert.equal(result.metrics.completeDataCount, 1);
  assert.equal(result.metrics.completeDataCoverageRate, 0);
  assert.equal(result.metrics.completeDataRate, 1 / 3);
});

test('complete-data coverage rate uses complete records as its denominator', () => {
  const result = buildPosmCoverage({
    routePlan: [route('1'), route('2'), route('3')],
    visits: [
      visit('1', '2026-10-01', successful, { Poster: 2, Rack: 0 }),
      visit('2', '2026-10-01', successful, { Poster: 0, Rack: 0 }),
      visit('3', '2026-10-01', successful, { Poster: 4, Rack: null })
    ],
    posmFields, now: '2026-10-02'
  });
  assert.equal(result.metrics.completeDataCount, 2);
  assert.equal(result.metrics.completeDataCoverageRate, 0.5);
  assert.equal(result.metrics.totalActiveCoverageRate, 2 / 3);
});

test('successful denominator is unique active stores visited successfully in selected period', () => {
  const result = buildPosmCoverage({
    routePlan: [route('1'), route('2'), route('3')],
    visits: [visit('1', '2026-10-01', successful, { Poster: 1, Rack: 0 }), visit('1', '2026-10-02', successful, { Poster: 0, Rack: 0 }), visit('2', '2026-10-01', 'رفض', { Poster: 1, Rack: 1 })],
    posmFields, periodStart: '2026-10-01', periodEnd: '2026-10-02', now: '2026-10-03'
  });
  assert.equal(result.metrics.successfulDenominator, 1);
});

test('date-only period end includes visits throughout the final calendar day', () => {
  const result = buildPosmCoverage({
    routePlan: [route('1')],
    visits: [visit('1', '2026-10-02T23:59:59Z', successful, { Poster: 1, Rack: 0 })],
    posmFields, periodStart: '2026-10-01', periodEnd: '2026-10-02', now: '2026-10-03'
  });
  assert.equal(result.metrics.successfulDenominator, 1);
  assert.equal(result.records[0].covered, true);
});

test('mode any uses any period positive and carries history only when there is no period visit', () => {
  const history = visit('1', '2026-09-01', successful, { Poster: 3, Rack: 0 });
  const result = buildPosmCoverage({ routePlan: [route('1'), route('2')], visits: [
    history,
    visit('1', '2026-10-01', successful, { Poster: 0, Rack: 0 }),
    visit('2', '2026-09-20', successful, { Poster: 2, Rack: 0 })
  ], posmFields, periodStart: '2026-10-01', periodEnd: '2026-10-10', mode: 'any', now: '2026-10-11' });
  assert.equal(result.records.find(row => row.code === '1').covered, false);
  assert.equal(result.records.find(row => row.code === '2').covered, true);
  assert.equal(result.records.find(row => row.code === '2').evidenceScope, 'carried_history');
});

test('mode latest takes latest record regardless of status, then all-history latest if no period visit', () => {
  const result = buildPosmCoverage({ routePlan: [route('1'), route('2')], visits: [
    visit('1', '2026-10-01', successful, { Poster: 4, Rack: 0 }),
    visit('1', '2026-10-02', 'رفض', { Poster: 0, Rack: 0 }),
    visit('2', '2026-09-01', successful, { Poster: 1, Rack: 0 })
  ], posmFields, periodStart: '2026-10-01', periodEnd: '2026-10-10', mode: 'latest', now: '2026-10-11' });
  assert.equal(result.records.find(row => row.code === '1').covered, false);
  assert.equal(result.records.find(row => row.code === '2').covered, true);
});

test('stale means at least two full cycles since the latest available record', () => {
  const result = buildPosmCoverage({ routePlan: [route('1'), route('2')], visits: [
    visit('1', '2026-09-02', successful, { Poster: 1, Rack: 0 }),
    visit('2', '2026-09-03', successful, { Poster: 1, Rack: 0 })
  ], posmFields, cycleDays: 14, now: '2026-09-30' });
  assert.equal(result.records.find(row => row.code === '1').stale, true);
  assert.equal(result.records.find(row => row.code === '2').stale, false);
});

test('comment classifier keeps weak eligible and flags review/exclusion categories', () => {
  assert.equal(classifyStoreComment('Weak outlet'), 'weak');
  assert.equal(classifyStoreComment('Wrong category'), 'wrong_category');
  assert.equal(classifyStoreComment('Wrong industry'), 'wrong_category');
  assert.equal(classifyStoreComment('Not suitable'), 'not_suitable');
  assert.equal(classifyStoreComment('لا تصلح'), 'not_suitable');
  assert.equal(classifyStoreComment('Unknown'), 'unknown');
  assert.equal(classifyStoreComment('Needs field review'), 'unknown');
  assert.equal(classifyStoreComment('المحل ضعيف'), 'weak');
  assert.equal(classifyStoreComment('تصنيف خطأ'), 'wrong_category');
  assert.equal(classifyStoreComment('غير مناسب'), 'not_suitable');
  assert.equal(classifyStoreComment(''), 'none');
});

const alertFields = { gorilla: { survey: 'Survey', skus: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] }, posm: ['Poster', 'Rack'], fridge: ['Fridge'], damagedProducts: 'Damaged' };
const gorillaAbsent = values => ({ Survey: false, S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0, ...values });

test('gorilla loss opens only with false survey and six explicit SKU zeros; incomplete/conflict is review', () => {
  const routePlan = [route('1'), route('2'), route('3')];
  const visits = [
    visit('1', '2026-09-20', successful, { Survey: true, S1: 1, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 }),
    visit('1', '2026-10-01', successful, gorillaAbsent({})),
    visit('2', '2026-10-01', successful, gorillaAbsent({ S3: null })),
    visit('3', '2026-10-01', successful, gorillaAbsent({ S3: 2 }))
  ];
  const rows = evaluateMonitoringAlerts({ routePlan, visits, cycleStart: '2026-10-01', cycleEnd: '2026-10-14', fields: alertFields });
  assert.equal(rows.find(row => row.code === '1' && row.type === 'gorilla_lost').state, 'open');
  assert.equal(rows.find(row => row.code === '2' && row.type === 'gorilla_lost').state, 'review');
  assert.equal(rows.find(row => row.code === '3' && row.type === 'gorilla_lost').state, 'review');
});

test('positive Gorilla evidence in same cycle suppresses prior absence', () => {
  const visits = [
    visit('1', '2026-09-20', successful, { Survey: true, S1: 1, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 }),
    visit('1', '2026-10-01', successful, gorillaAbsent({})),
    visit('1', '2026-10-02', successful, { Survey: true, S1: 1, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 })
  ];
  const rows = evaluateMonitoringAlerts({ routePlan: [route('1')], visits, cycleStart: '2026-10-01', cycleEnd: '2026-10-14', fields: alertFields });
  assert.equal(rows.find(row => row.type === 'gorilla_lost').state, 'closed');
});

test('POSM and fridge loss use successful visit evidence; damaged No does not auto-close', () => {
  const visits = [
    visit('1', '2026-09-20', successful, { Poster: 2, Rack: 0, Fridge: true }),
    visit('1', '2026-10-02', successful, gorillaAbsent({ Poster: 0, Rack: 0, Fridge: false, Damaged: false }))
  ];
  const rows = evaluateMonitoringAlerts({ routePlan: [route('1')], visits, cycleStart: '2026-10-01', cycleEnd: '2026-10-14', fields: alertFields });
  assert.equal(rows.find(row => row.type === 'posm_lost').state, 'open');
  assert.equal(rows.find(row => row.type === 'fridge_lost').state, 'open');
  assert.equal(rows.find(row => row.type === 'damaged_products').state, 'review');
});

test('no prior Gorilla, POSM or fridge presence means no Lost alert', () => {
  const visits = [visit('1', '2026-10-02', successful, gorillaAbsent({ Poster: 0, Rack: 0, Fridge: false }))];
  const rows = evaluateMonitoringAlerts({ routePlan: [route('1')], visits, cycleStart: '2026-10-01', cycleEnd: '2026-10-14', fields: alertFields });
  for (const type of ['gorilla_lost', 'posm_lost', 'fridge_lost']) assert.equal(rows.find(row => row.type === type).state, 'review');
});

test('Gorilla return is confirmed only when both survey and SKU evidence are positive', () => {
  const visits = [
    visit('1', '2026-09-20', successful, { Survey: true, S1: 1, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 }),
    visit('1', '2026-10-01', successful, gorillaAbsent({})),
    visit('1', '2026-10-02', successful, { Survey: true, S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 })
  ];
  const rows = evaluateMonitoringAlerts({ routePlan: [route('1')], visits, cycleStart: '2026-10-01', cycleEnd: '2026-10-14', fields: alertFields });
  assert.equal(rows.find(row => row.type === 'gorilla_lost').state, 'review');
});

test('damaged Yes creates warning, route removal closes out-of-scope, and removed stores are ignored', () => {
  const visits = [visit('1', '2026-10-02', successful, gorillaAbsent({ Damaged: true }))];
  const active = evaluateMonitoringAlerts({ routePlan: [route('1')], visits, cycleStart: '2026-10-01', cycleEnd: '2026-10-14', fields: alertFields });
  assert.equal(active.find(row => row.type === 'damaged_products').state, 'open');
  assert.equal(active.find(row => row.type === 'damaged_products').severity, 'warning');
  const removed = evaluateMonitoringAlerts({ routePlan: [], visits, cycleStart: '2026-10-01', cycleEnd: '2026-10-14', fields: alertFields });
  assert.deepEqual(removed.map(row => row.type), ['out_of_scope']);
  assert.equal(removed[0].state, 'closed');
});

test('re-entry requires evidence at or after routeEntryDate', () => {
  const visits = [visit('1', '2026-10-01', successful, gorillaAbsent({}))];
  const rows = evaluateMonitoringAlerts({ routePlan: [route('1')], visits, cycleStart: '2026-10-01', cycleEnd: '2026-10-14', routeEntryDates: { '1': '2026-10-05' }, fields: alertFields });
  assert.equal(rows.find(row => row.type === 'gorilla_lost').state, 'review');
});
