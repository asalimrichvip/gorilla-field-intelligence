const DEFAULT_CYCLE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const cleanCode = value => String(value ?? '').trim().replace(/^_/, '').replace(/^0+(?=\d)/, '');
const keyCode = value => cleanCode(value).toLowerCase();
const dateOf = value => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text.includes('T') || /\d{1,2}:\d{2}/.test(text) ? text : `${text.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};
const endDateOf = value => {
  const parsed = dateOf(value);
  if (!parsed) return null;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? new Date(parsed.getTime() + DAY_MS - 1)
    : parsed;
};
const stamp = row => dateOf(row?.['Started At'] ?? row?.startedAt ?? row?.Date ?? row?.date ?? row?.['Visit Date']);
const within = (date, start, end) => Boolean(date && (!start || date >= start) && (!end || date <= end));
const success = row => {
  const value = String(row?.['حالة الزيارة'] ?? row?.visitStatus ?? row?.status ?? '').trim().toLowerCase();
  return value === 'زيارة ناجحة' || value === 'successful visit' || value === 'successful' || row?.['Successful Visit'] === 1 || row?.['Successful Visit'] === true;
};
const numeric = value => value === '' || value == null || typeof value === 'boolean' || !Number.isFinite(Number(value)) ? null : Number(value);
const uniqueByCode = rows => {
  const map = new Map();
  for (const row of rows || []) {
    const code = keyCode(row?.['Client Code'] ?? row?.clientCode ?? row?.code ?? row?._id);
    if (code) map.set(code, row);
  }
  return map;
};
const latestByCode = rows => {
  const map = new Map();
  for (const row of rows || []) {
    const code = keyCode(row?.['Client Code'] ?? row?.clientCode ?? row?.code ?? row?._id);
    if (!code) continue;
    const date = stamp(row), old = map.get(code);
    if (!old || (date && (!old.date || date > old.date))) map.set(code, { row, date });
  }
  return map;
};
const routeStatus = row => String(row?.['Current Status'] ?? row?.currentStatus ?? row?.status ?? 'Active').trim().toLowerCase();
const isExcluded = status => status === 'excluded';
const isApproved = row => {
  const value = String(row?.['Approval Status'] ?? row?.approvalStatus ?? row?.['Plan Status'] ?? row?.planStatus ?? '').trim().toLowerCase();
  return !value || ['approved', 'active', 'published', 'current'].includes(value);
};

function resolveFields(posmFields, visits) {
  if (Array.isArray(posmFields)) return posmFields;
  if (posmFields && typeof posmFields === 'object') return Object.values(posmFields).filter(x => typeof x === 'string');
  return [];
}

function posmState(row, fields) {
  if (!fields.length) return { known: false, complete: false, total: null, values: {}, covered: false };
  const values = Object.fromEntries(fields.map(field => [field, numeric(row?.[field])]));
  const complete = fields.every(field => values[field] !== null);
  const known = fields.some(field => values[field] !== null);
  const positive = fields.some(field => values[field] > 0);
  return { known, complete, total: known ? fields.reduce((sum, field) => sum + (values[field] ?? 0), 0) : null, values, covered: positive };
}

/** Build POSM coverage against the approved active route population. */
export function buildPosmCoverage({ routePlan = [], visits = [], posmFields, periodStart, periodEnd, mode = 'latest', excludedCodes = [], cycleDays = DEFAULT_CYCLE_DAYS, now = new Date() } = {}) {
  if (!['latest', 'any'].includes(mode)) throw new TypeError("mode must be 'latest' or 'any'");
  const start = dateOf(periodStart), end = endDateOf(periodEnd), nowDate = dateOf(now) || new Date();
  const fields = resolveFields(posmFields, visits);
  const excluded = new Set((excludedCodes || []).map(keyCode).filter(Boolean));
  const approvedRoutes = (routePlan || []).filter(isApproved);
  const routes = latestByCode(approvedRoutes);
  const routeRecords = new Map([...routes].filter(([code, entry]) => !excluded.has(code) && !isExcluded(routeStatus(entry.row))));
  const history = latestByCode(visits);
  const periodVisits = (visits || []).filter(row => within(stamp(row), start, end));
  const successfulPeriod = periodVisits.filter(success);
  const successfulCodes = new Set(successfulPeriod.map(row => keyCode(row?.['Client Code'] ?? row?.clientCode ?? row?._id)).filter(Boolean));
  const periodByCode = new Map();
  for (const row of periodVisits) {
    const code = keyCode(row?.['Client Code'] ?? row?.clientCode ?? row?._id);
    if (!code) continue;
    if (!periodByCode.has(code)) periodByCode.set(code, []);
    periodByCode.get(code).push(row);
  }

  const staleAfterMs = Math.max(1, Number(cycleDays) || DEFAULT_CYCLE_DAYS) * 2 * DAY_MS;
  const records = [...routeRecords].map(([code, route]) => {
    const allLatest = history.get(code);
    const periodRows = (periodByCode.get(code) || []).slice().sort((a, b) => (stamp(a)?.getTime() ?? -Infinity) - (stamp(b)?.getTime() ?? -Infinity));
    let evidenceRow = null, evidenceScope = 'no_history';
    if (mode === 'any') {
      const positive = periodRows.find(row => posmState(row, fields).covered);
      if (positive) { evidenceRow = positive; evidenceScope = 'period_any'; }
      else if (!periodRows.length && allLatest) { evidenceRow = allLatest.row; evidenceScope = 'carried_history'; }
      else if (periodRows.length) { evidenceRow = periodRows.at(-1); evidenceScope = 'period'; }
    } else if (periodRows.length) {
      evidenceRow = periodRows.at(-1); evidenceScope = 'period_latest';
    } else if (allLatest) {
      evidenceRow = allLatest.row; evidenceScope = 'history_latest';
    }
    const state = posmState(evidenceRow, fields);
    const evidenceDate = stamp(evidenceRow) || allLatest?.date || null;
    const ageMs = evidenceDate ? Math.max(0, nowDate.getTime() - evidenceDate.getTime()) : null;
    const stale = ageMs !== null && ageMs >= staleAfterMs;
    const wasVisited = successfulCodes.has(code);
    return {
      code,
      client: route.row.Client ?? route.row.client ?? evidenceRow?.Client ?? evidenceRow?.ClientName ?? code,
      rtm: route.row.RTM ?? route.row.rtm ?? '',
      tdm: route.row.TDM ?? route.row.TDMName ?? route.row.tdm ?? '',
      routeStatus: routeStatus(route.row),
      successfulVisitInPeriod: wasVisited,
      visitCountInPeriod: periodRows.filter(success).length,
      evidenceScope,
      evidenceDate: evidenceDate ? evidenceDate.toISOString() : null,
      ageDays: ageMs === null ? null : Math.floor(ageMs / DAY_MS),
      stale,
      hasData: state.known,
      complete: state.complete,
      covered: state.known ? state.covered : null,
      totalUnits: state.total,
      values: state.values
    };
  }).sort((a, b) => a.code.localeCompare(b.code));

  const activeCount = records.length;
  const completeRecords = records.filter(record => record.complete);
  const knownRecords = records.filter(record => record.hasData);
  const coveredRecords = records.filter(record => record.covered === true);
  const successfulDenominatorRecords = records.filter(record => record.successfulVisitInPeriod);
  const successfulDenominatorCovered = successfulDenominatorRecords.filter(record => record.covered === true);
  const completeCoveredRecords = completeRecords.filter(record => record.covered === true);
  const completeDataRate = activeCount ? completeRecords.length / activeCount : null;
  const totalActiveCoverageRate = activeCount ? coveredRecords.length / activeCount : null;
  return {
    mode,
    periodStart: start?.toISOString() || null,
    periodEnd: end?.toISOString() || null,
    posmFields: [...fields],
    records,
    metrics: {
      totalActive: activeCount,
      successfulDenominator: successfulDenominatorRecords.length,
      successfulDenominatorCoverageRate: successfulDenominatorRecords.length ? successfulDenominatorCovered.length / successfulDenominatorRecords.length : null,
      totalActiveCovered: coveredRecords.length,
      totalActiveCoverageRate,
      completeDataCount: completeRecords.length,
      completeDataRate,
      completeDataCoverageRate: completeRecords.length ? completeCoveredRecords.length / completeRecords.length : null,
      knownDataCount: knownRecords.length,
      missingDataCount: activeCount - completeRecords.length,
      staleCount: records.filter(record => record.stale).length,
      totalPosmUnits: knownRecords.reduce((sum, record) => sum + (record.totalUnits ?? 0), 0),
      posmCoveredCount: coveredRecords.length
    }
  };
}

/** Classify free-text route comments without silently excluding weak stores. */
export function classifyStoreComment(value) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return 'none';
  if (/\bweak\b|ضعيف|ضعيفة|ضعف/.test(text)) return 'weak';
  if (/wrong\s*categor|incorrect\s*categor|wrong\s*industry|industry\s*mismatch|غير\s*الفئة|فئة\s*غير\s*مناسبة|تصنيف\s*(?:خاطئ|خطأ)|صناعة\s*(?:خطأ|غير\s*مناسبة)|مش\s*من\s*نفس\s*الفئة/.test(text)) return 'wrong_category';
  if (/not\s*suitable|unsuitable|غير\s*مناسب|غير\s*ملائم|لا\s*يناسب|لا\s*تصلح/.test(text)) return 'not_suitable';
  if (/\bunknown\b|غير\s*معروف|مجهول|غير\s*واضح/.test(text)) return 'unknown';
  return 'unknown';
}

function triBool(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const text = String(value ?? '').trim().toLowerCase();
  if (['yes', 'true', 'نعم', 'يوجد', '1'].includes(text)) return true;
  if (['no', 'false', 'لا', 'لا يوجد', '0'].includes(text)) return false;
  return null;
}

function evidence(rows, fields) {
  if (!fields?.length) return { state: 'review', reason: 'fields_not_configured', latest: null, positive: false };
  const known = rows.map(row => ({ row, value: triBool(row[fields[0]]) }));
  const positive = known.some(item => item.value === true);
  const negative = known.some(item => item.value === false);
  if (positive && negative) return { state: 'review', reason: 'conflicting_evidence', latest: rows.at(-1) || null, positive: true };
  if (positive) return { state: 'present', reason: '', latest: known.filter(item => item.value === true).at(-1)?.row || null, positive: true };
  if (negative) return { state: 'absent', reason: '', latest: known.filter(item => item.value === false).at(-1)?.row || null, positive: false };
  return { state: 'review', reason: 'incomplete_evidence', latest: rows.at(-1) || null, positive: false };
}

function gorillaEvidence(rows, fields) {
  if (!fields || !fields.survey || !Array.isArray(fields.skus) || fields.skus.length !== 6) return { state: 'review', reason: 'fields_not_configured', positive: false };
  let sawPositive = false, sawConfirmedPositive = false, sawNegative = false, sawConflict = false, latest = null;
  for (const row of rows) {
    const survey = triBool(row[fields.survey]);
    const skuValues = fields.skus.map(field => numeric(row[field]));
    const skuPositive = skuValues.some(value => value !== null && value > 0);
    const allZero = skuValues.every(value => value !== null && value === 0);
    if (survey === true || skuPositive) sawPositive = true;
    if (survey === true && skuPositive) sawConfirmedPositive = true;
    if (survey === false && allZero) { sawNegative = true; latest = row; }
    if ((survey === true && allZero) || (survey === false && skuPositive)) sawConflict = true;
  }
  if (sawConflict) return { state: 'review', reason: 'conflicting_or_mixed_evidence', positive: sawPositive, confirmedPositive: sawConfirmedPositive };
  if (sawPositive) return { state: 'present', reason: '', positive: true, confirmedPositive: sawConfirmedPositive };
  if (sawNegative) return { state: 'absent', reason: '', positive: false, confirmedPositive: false, latest };
  return { state: 'review', reason: 'incomplete_evidence', positive: false };
}

function alertTransitions(type, routeRows, cycleRows, historyRows, fields, routeEntryDate, cycleStart) {
  const inCycle = cycleRows.filter(success);
  const afterEntry = routeEntryDate ? historyRows.filter(row => {
    const date = stamp(row), entry = dateOf(routeEntryDate);
    return date && entry && date >= entry;
  }) : historyRows;
  const relevantCycleRows = routeEntryDate ? inCycle.filter(row => {
    const date = stamp(row), entry = dateOf(routeEntryDate);
    return date && entry && date >= entry;
  }) : inCycle;
  const relevantHistory = afterEntry.filter(success).sort((a, b) => (stamp(a)?.getTime() ?? 0) - (stamp(b)?.getTime() ?? 0));
  if (type === 'gorilla_lost') {
    const priorRows = relevantHistory.filter(row => !cycleStart || (stamp(row) && stamp(row) < dateOf(cycleStart)));
    const prior = gorillaEvidence(priorRows, fields.gorilla);
    const current = gorillaEvidence(relevantCycleRows, fields.gorilla);
    if (!prior.positive) return { state: 'review', reason: 'no_prior_gorilla_presence', positive: current.positive, latest: current.latest };
    if (current.positive) return { state: current.confirmedPositive && current.state === 'present' ? 'present' : 'review', reason: current.reason || (current.confirmedPositive ? 'positive_evidence_in_cycle' : 'positive_evidence_needs_both_sources'), positive: true, latest: current.latest };
    if (current.state === 'absent') return { state: 'absent', reason: '', positive: false, latest: current.latest };
    return { state: 'review', reason: current.reason || 'incomplete_cycle_evidence', positive: false, latest: current.latest };
  }
  if (type === 'posm_lost') {
    const fieldsList = fields.posm || [];
    if (!fieldsList.length) return { state: 'review', reason: 'fields_not_configured', positive: false };
    const positive = rows => rows.some(row => fieldsList.some(field => numeric(row[field]) > 0));
    const knownZero = rows => rows.some(row => fieldsList.every(field => numeric(row[field]) !== null && numeric(row[field]) === 0));
    const priorRows = relevantHistory.filter(row => !cycleStart || (stamp(row) && stamp(row) < dateOf(cycleStart)));
    if (!positive(priorRows)) return { state: 'review', reason: 'no_prior_posm_presence', positive: false };
    if (positive(relevantCycleRows)) return { state: 'present', positive: true };
    if (knownZero(relevantCycleRows)) return { state: 'absent', positive: false };
    return { state: 'review', reason: 'incomplete_evidence', positive: false };
  }
  if (type === 'fridge_lost') {
    const priorRows = relevantHistory.filter(row => !cycleStart || (stamp(row) && stamp(row) < dateOf(cycleStart)));
    const fridgeField = fields.fridge?.[0], priorPositive = Boolean(fridgeField && priorRows.some(row => triBool(row[fridgeField]) === true));
    const currentPositive = Boolean(fridgeField && relevantCycleRows.some(row => triBool(row[fridgeField]) === true));
    const currentNegative = relevantCycleRows.filter(row => fridgeField && triBool(row[fridgeField]) === false).at(-1);
    if (!priorPositive) return { state: 'review', reason: 'no_prior_fridge_presence' };
    if (currentPositive) return { state: 'present', positive: true };
    if (currentNegative) return { state: 'absent', positive: false, latest: currentNegative };
    return { state: 'review', reason: 'incomplete_cycle_evidence' };
  }
  return { state: 'review', reason: 'unsupported_alert_type', positive: false };
}

/** Evaluate alert state transitions; callers persist these returned states. */
export function evaluateMonitoringAlerts({ routePlan = [], visits = [], cycleStart, cycleEnd, routeEntryDates = {}, fields = {} } = {}) {
  const start = dateOf(cycleStart), end = endDateOf(cycleEnd);
  const routeMap = latestByCode(routePlan);
  const visitMap = new Map();
  for (const row of visits || []) {
    const code = keyCode(row?.['Client Code'] ?? row?.clientCode ?? row?._id);
    if (!code) continue;
    if (!visitMap.has(code)) visitMap.set(code, []);
    visitMap.get(code).push(row);
  }
  const codes = new Set([...routeMap.keys(), ...visitMap.keys()]);
  const alerts = [];
  for (const code of [...codes].sort()) {
    const route = routeMap.get(code)?.row;
    const history = (visitMap.get(code) || []).slice().sort((a, b) => (stamp(a)?.getTime() ?? 0) - (stamp(b)?.getTime() ?? 0));
    const routeEntryDate = routeEntryDates instanceof Map ? routeEntryDates.get(code) ?? routeEntryDates.get(cleanCode(code)) : routeEntryDates[code] ?? routeEntryDates[cleanCode(code)];
    const inScope = Boolean(route && !isExcluded(routeStatus(route)) && isApproved(route));
    if (!inScope) {
      if (history.length) alerts.push({ code, type: 'out_of_scope', state: 'closed', reason: 'route_removed', routeStatus: route ? routeStatus(route) : 'removed' });
      continue;
    }
    const cycleRows = history.filter(row => success(row) && within(stamp(row), start, end));
    const entryDate = dateOf(routeEntryDate);
    const eligibleCycleRows = entryDate ? cycleRows.filter(row => stamp(row) && stamp(row) >= entryDate) : cycleRows;
    for (const type of ['gorilla_lost', 'posm_lost', 'fridge_lost']) {
      const result = alertTransitions(type, history, eligibleCycleRows, history, fields, routeEntryDate, cycleStart);
      const cycleGorilla = type === 'gorilla_lost' ? gorillaEvidence(eligibleCycleRows, fields.gorilla) : null;
      const cyclePositive = type === 'gorilla_lost'
        ? cycleGorilla.positive
        : type === 'posm_lost'
          ? eligibleCycleRows.some(row => (fields.posm || []).some(field => numeric(row[field]) > 0))
          : evidence(eligibleCycleRows, fields.fridge).state === 'present';
      const state = cycleGorilla?.reason === 'conflicting_or_mixed_evidence' ? 'review' : cyclePositive ? (result.state === 'present' ? 'closed' : 'review') : result.state === 'absent' ? 'open' : 'review';
      alerts.push({ code, type, state, reason: cyclePositive ? 'positive_evidence_in_cycle' : result.reason || (state === 'open' ? 'confirmed_absence' : ''), evidenceDate: stamp(result.latest)?.toISOString() || null });
    }
    const damageField = fields.damagedProducts;
    if (damageField) {
      const yesRows = eligibleCycleRows.filter(row => triBool(row[damageField]) === true);
      const noRows = eligibleCycleRows.filter(row => triBool(row[damageField]) === false);
      if (yesRows.length) alerts.push({ code, type: 'damaged_products', state: 'open', severity: 'warning', reason: 'reported_yes', evidenceDate: stamp(yesRows.at(-1))?.toISOString() || null });
      else if (noRows.length) alerts.push({ code, type: 'damaged_products', state: 'review', severity: 'warning', reason: 'no_does_not_auto_close', evidenceDate: stamp(noRows.at(-1))?.toISOString() || null });
      else alerts.push({ code, type: 'damaged_products', state: 'review', severity: 'warning', reason: 'no_cycle_evidence' });
    }
  }
  return alerts;
}
