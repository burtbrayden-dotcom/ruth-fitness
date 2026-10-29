// Run: node --test tests/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const PROGRAM = require('../js/program.js');
const L = require('../js/logic.js');
const Store = require('../js/store.js');

const ex = (id) => PROGRAM.exercises[id];
const entry = (weight, reps, feel, date = '2026-10-01') => ({ date, weight, reps, feel });
const fresh = () => Store.emptyState(PROGRAM);

// ------------------------------------------------------------- program data

test('every workout has three days of full-body work, all exercises defined', () => {
  assert.deepEqual(PROGRAM.schedule.rotation, ['day1', 'day2', 'day3']);
  for (const key of PROGRAM.schedule.rotation) {
    const w = PROGRAM.workouts[key];
    assert.ok(w.items.length >= 6 && w.items.length <= 8, key + ' stays manageable');
    for (const item of w.items) {
      const ids = typeof item === 'string' ? [item] : PROGRAM.choices[item.choice].options;
      for (const id of ids) assert.ok(PROGRAM.exercises[id], key + ' references ' + id);
    }
  }
});

test('every exercise carries the fields the screen needs', () => {
  for (const [id, e] of Object.entries(PROGRAM.exercises)) {
    for (const f of ['name', 'works', 'equipment', 'equipmentText', 'setup', 'easier']) {
      assert.ok(typeof e[f] === 'string' && e[f].length > 3, id + '.' + f);
    }
    assert.ok(Array.isArray(e.cues) && e.cues.length >= 1 && e.cues.length <= 2, id + ' has 1-2 cues');
    assert.ok(['machine', 'dumbbell', 'cable'].includes(e.equipment), id + ' equipment');
    if (e.equipment !== 'dumbbell') assert.ok(e.increment > 0, id + ' machine increment');
    if (e.video) {
      assert.match(e.video.id, /^[A-Za-z0-9_-]{11}$/, id + ' video id');
      assert.ok(e.video.title && e.video.channel, id + ' video source recorded');
    }
  }
});

test('starting weights match the paper', () => {
  const paper = {
    db_curl: 5, db_triceps_ext: 5, db_lateral_raise: 5, db_shoulder_press: 5,
    chest_press: 10, pec_fly: 20, lat_pulldown: 20,
    leg_press: 40, leg_extension: 30, leg_curl: 35, hip_adduction: 30, hip_abduction: 40, glute_kickback: 10,
  };
  for (const [id, w] of Object.entries(paper)) assert.equal(ex(id).startWeight, w, id);
  assert.equal(ex('face_pull').startWeight, null, 'face pull is new - no paper weight');
  assert.equal(ex('db_rdl').startWeight, null, 'RDL is new - no paper weight');
});

test('prescription is 2 sets of 6-8', () => {
  assert.deepEqual(
    [PROGRAM.prescription.sets, PROGRAM.prescription.repsMin, PROGRAM.prescription.repsMax],
    [2, 6, 8],
  );
});

// ---------------------------------------------------------------- dates

test('dateKey uses the local calendar date, not UTC', () => {
  assert.equal(L.dateKey(new Date(2026, 9, 28, 23, 30)), '2026-10-28');
  assert.equal(L.dateKey(new Date(2026, 0, 1, 0, 5)), '2026-01-01');
});

test('daysBetween survives a daylight-saving change', () => {
  assert.equal(L.daysBetween('2026-10-31', '2026-11-02'), 2); // US clocks change Nov 1
  assert.equal(L.daysBetween('2026-03-07', '2026-03-09'), 2);
});

// ------------------------------------------------------------- schedule

test('Mon/Wed/Fri are lifting days; the rest are walking days', () => {
  const s = fresh();
  const types = [];
  for (let d = 26; d <= 32; d++) types.push(L.todayPlan(PROGRAM, s, new Date(2026, 9, d)).type); // Mon Oct 26 ..
  assert.deepEqual(types, ['lift', 'walk', 'lift', 'walk', 'lift', 'walk', 'walk']);
});

test('rotation follows the last finished workout, so a missed day skips nothing', () => {
  const s = fresh();
  assert.equal(L.nextWorkoutKey(PROGRAM, s), 'day1');
  s.sessions.push({ date: '2026-10-26', workout: 'day1', done: [], skipped: [] });
  assert.equal(L.nextWorkoutKey(PROGRAM, s), 'day2');
  s.sessions.push({ date: '2026-10-30', workout: 'day2', done: [], skipped: [] }); // missed Wednesday
  assert.equal(L.nextWorkoutKey(PROGRAM, s), 'day3');
  s.sessions.push({ date: '2026-11-02', workout: 'day3', done: [], skipped: [] });
  assert.equal(L.nextWorkoutKey(PROGRAM, s), 'day1');
});

test('after finishing today the plan says done; lifting instead is offered only if she did not lift yesterday', () => {
  const s = fresh();
  s.sessions.push({ date: '2026-10-26', workout: 'day1', done: [], skipped: [] });
  assert.equal(L.todayPlan(PROGRAM, s, new Date(2026, 9, 26)).type, 'lift-done');
  const tue = L.todayPlan(PROGRAM, s, new Date(2026, 9, 27));
  assert.equal(tue.type, 'walk');
  assert.equal(tue.canLiftInstead, false, 'lifted Monday, so no lift Tuesday');
  const sat = L.todayPlan(PROGRAM, s, new Date(2026, 9, 31));
  assert.equal(sat.canLiftInstead, true);
});

test('make-up workout is never offered the day before a lifting day, or after a full week', () => {
  const s = fresh();
  s.sessions.push({ date: '2026-10-26', workout: 'day1', done: [], skipped: [] }); // Mon; missed nothing else yet
  assert.equal(L.todayPlan(PROGRAM, s, new Date(2026, 9, 27)).canLiftInstead, false, 'Tue: lifted Mon and Wed is a lift day');
  s.sessions.push({ date: '2026-10-28', workout: 'day2', done: [], skipped: [] });
  assert.equal(L.todayPlan(PROGRAM, s, new Date(2026, 9, 31)).canLiftInstead, true, 'Sat: 2 of 3 done, Sunday is free');
  s.sessions.push({ date: '2026-10-30', workout: 'day3', done: [], skipped: [] });
  assert.equal(L.todayPlan(PROGRAM, s, new Date(2026, 10, 1)).canLiftInstead, false, 'Sun after 3 of 3: nothing missed');
  assert.equal(L.todayPlan(PROGRAM, s, new Date(2026, 9, 31)).canLiftInstead, false, 'Sat after Fri lift');
});

test('a lifting day right after a lift suggests resting', () => {
  const s = fresh();
  s.settings.liftDays = [1, 2, 4]; // she chose back-to-back days
  s.sessions.push({ date: '2026-10-26', workout: 'day1', done: [], skipped: [] });
  const tue = L.todayPlan(PROGRAM, s, new Date(2026, 9, 27));
  assert.equal(tue.type, 'lift');
  assert.equal(tue.restSuggested, true);
  assert.equal(L.todayPlan(PROGRAM, s, new Date(2026, 9, 29)).restSuggested, false);
});

test('rest time reads in plain words', () => {
  assert.equal(L.restWords(90), 'about 1\u00bd minutes');
  assert.equal(L.restWords(120), 'about 2 minutes');
  assert.equal(L.restWords(60), 'about 1 minute');
  assert.equal(L.restWords(45), 'about 1 minute');
  assert.equal(L.restWords(20), 'about 20 seconds');
});

test('rep labels follow the prescription, so the rep range can be edited', () => {
  const custom = Object.assign({}, PROGRAM, { prescription: { sets: 2, repsMin: 8, repsMax: 12, restSeconds: 90 } });
  assert.equal(L.repLabel(7, custom), 'under 8');
  assert.equal(L.repLabel(13, custom), 'over 12');
  const r = L.recommend(ex('leg_press'), [entry(40, [12, 12], 'easy')], custom);
  assert.equal(r.action, 'offer-up');
  assert.equal(L.recommend(ex('leg_press'), [entry(40, [8, 8], 'easy')], custom).action, 'repeat');
});

test('a big dumbbell jump says it is fine to stay', () => {
  const r = L.recommend(ex('db_lateral_raise'), [entry(5, [8, 8], 'easy')], PROGRAM);
  assert.equal(r.offer, 8);
  assert.match(r.reason, /bigger jump/);
  assert.doesNotMatch(L.recommend(ex('leg_press'), [entry(40, [8, 8], 'easy')], PROGRAM).reason, /bigger jump/);
});

test('lifting days can be changed in settings', () => {
  const s = fresh();
  s.settings.liftDays = [2, 4, 6];
  assert.equal(L.todayPlan(PROGRAM, s, new Date(2026, 9, 27)).type, 'lift'); // Tue
  assert.equal(L.todayPlan(PROGRAM, s, new Date(2026, 9, 26)).type, 'walk'); // Mon
});

test('weekSummary counts this Monday-Sunday week only', () => {
  const s = fresh();
  s.settings.stepGoal = 3000;
  s.sessions.push({ date: '2026-10-25', workout: 'day1', done: [], skipped: [] }); // previous Sunday
  s.sessions.push({ date: '2026-10-26', workout: 'day2', done: [], skipped: [] });
  s.steps['2026-10-27'] = { total: 3500, adds: [] };
  s.steps['2026-10-28'] = { total: 1200, adds: [] };
  const w = L.weekSummary(PROGRAM, s, new Date(2026, 9, 28));
  assert.deepEqual([w.workouts, w.walkDays, w.goalDays], [1, 2, 1]);
});

// ---------------------------------------------------------- progression

test('first time uses the paper starting weight', () => {
  const r = L.recommend(ex('leg_press'), [], PROGRAM);
  assert.equal(r.action, 'start');
  assert.equal(r.weight, 40);
});

test('first time with no paper weight asks her to start light', () => {
  const r = L.recommend(ex('face_pull'), [], PROGRAM);
  assert.equal(r.action, 'start');
  assert.equal(r.weight, null);
});

test('8 and 8, felt easy -> offers the next small weight but does not apply it', () => {
  const r = L.recommend(ex('leg_press'), [entry(40, [8, 8], 'easy')], PROGRAM);
  assert.equal(r.action, 'offer-up');
  assert.equal(r.offer, 45);
  assert.equal(r.weight, 40, 'pre-filled weight stays the same until she says yes');
});

test('8 and 8, about right once -> repeat; twice in a row -> offer', () => {
  const once = L.recommend(ex('chest_press'), [entry(10, [8, 8], 'right')], PROGRAM);
  assert.equal(once.action, 'repeat');
  assert.equal(once.weight, 10);
  const twice = L.recommend(ex('chest_press'), [entry(10, [8, 8], 'right'), entry(10, [8, 8], 'right')], PROGRAM);
  assert.equal(twice.action, 'offer-up');
  assert.equal(twice.offer, 15);
});

test('reps inside the range -> same weight, keep building reps', () => {
  const r = L.recommend(ex('leg_curl'), [entry(35, [7, 6], 'right')], PROGRAM);
  assert.equal(r.action, 'repeat');
  assert.equal(r.weight, 35);
  assert.equal(r.offer, null);
});

test('easy but not yet at 8 -> no increase yet, aim for 8', () => {
  const r = L.recommend(ex('leg_curl'), [entry(35, [6, 6], 'easy')], PROGRAM);
  assert.equal(r.action, 'repeat');
  assert.match(r.reason, /8/);
});

test('felt too hard (a struggle or form slipped) -> offers lighter even if reps were fine', () => {
  const r = L.recommend(ex('leg_press'), [entry(45, [6, 6], 'hard')], PROGRAM);
  assert.equal(r.action, 'offer-down');
  assert.equal(r.offer, 40);
  assert.equal(r.weight, 45, 'still only an offer');
});

test('too hard and under 6 reps -> offers a lighter weight', () => {
  const r = L.recommend(ex('leg_press'), [entry(45, [5, 4], 'hard')], PROGRAM);
  assert.equal(r.action, 'offer-down');
  assert.equal(r.offer, 40);
  assert.equal(r.weight, 45, 'lighter is offered, not forced');
});

test('too hard twice at the same weight -> offers lighter', () => {
  const r = L.recommend(ex('leg_press'), [entry(45, [6, 6], 'hard'), entry(45, [6, 6], 'hard')], PROGRAM);
  assert.equal(r.action, 'offer-down');
});

test('dumbbells move to the next real dumbbell size', () => {
  assert.equal(L.heavier(ex('db_curl'), 5, PROGRAM), 8);
  assert.equal(L.heavier(ex('db_curl'), 3, PROGRAM), 5);
  assert.equal(L.lighter(ex('db_curl'), 5, PROGRAM), 3);
  assert.equal(L.lighter(ex('db_curl'), 1, PROGRAM), null, 'nothing lighter than the lightest');
  const r = L.recommend(ex('db_curl'), [entry(5, [8, 8], 'easy')], PROGRAM);
  assert.equal(r.offer, 8);
});

test('no lighter offer below the lightest machine setting', () => {
  const r = L.recommend(ex('chest_press'), [entry(5, [4, 3], 'hard')], PROGRAM);
  assert.equal(r.action, 'repeat');
});

test('after moving up, fewer reps is explained as normal', () => {
  const r = L.recommend(ex('leg_press'), [entry(40, [8, 8], 'easy'), entry(45, [6, 6], 'right')], PROGRAM);
  assert.equal(r.action, 'repeat');
  assert.match(r.reason, /moved up/);
});

test('garbage history entries are ignored, never crash', () => {
  const r = L.recommend(ex('leg_press'), [null, { weight: 'x' }, entry(40, [7, 7], 'right')], PROGRAM);
  assert.equal(r.weight, 40);
});

test('describeEntry reads like a sentence', () => {
  assert.equal(L.describeEntry(entry(10, [8, 7], 'right'), ex('chest_press'), PROGRAM), '10 lb - 8 and 7 reps, felt about right');
  assert.equal(L.describeEntry(entry(10, [8, 8], 'easy'), ex('glute_kickback'), PROGRAM), '10 lb each leg - 8 and 8 reps, felt easy');
  assert.equal(L.describeEntry(entry(5, [5, 9], 'hard'), ex('db_curl'), PROGRAM), '5 lb each - under 6 and over 8 reps, felt too hard');
  assert.equal(L.describeEntry(entry(5, [8, 8], 'easy'), ex('db_triceps_ext'), PROGRAM), '5 lb each arm - 8 and 8 reps, felt easy');
});

test('parseWeight accepts plain numbers and rejects nonsense with a clear message', () => {
  assert.deepEqual(L.parseWeight('12.5'), { ok: true, value: 12.5 });
  assert.deepEqual(L.parseWeight(' 40 lb '), { ok: true, value: 40 });
  assert.equal(L.parseWeight('').ok, false);
  assert.equal(L.parseWeight('abc').ok, false);
  assert.equal(L.parseWeight('-5').ok, false);
  assert.equal(L.parseWeight('9999').ok, false);
});

// -------------------------------------------------------------- walking

test('parseSteps handles commas and rejects nonsense', () => {
  assert.deepEqual(L.parseSteps('4,500'), { ok: true, value: 4500 });
  assert.equal(L.parseSteps('lots').ok, false);
  assert.equal(L.parseSteps('100000').ok, false);
  assert.equal(L.parseSteps('').ok, false);
});

test('a 10-minute walk counts as about 1,000 steps', () => {
  assert.equal(L.minutesToSteps(10, PROGRAM), 1000);
});

test('step progress is capped at 100% and reports what is left', () => {
  assert.deepEqual(L.stepProgress(2500, 5000), { pct: 50, remaining: 2500, met: false });
  assert.deepEqual(L.stepProgress(7000, 5000), { pct: 100, remaining: 0, met: true });
  assert.deepEqual(L.stepProgress(0, 0), { pct: 0, remaining: 0, met: false });
});

test('no goal yet: suggests a starting goal from her first 3 finished days, rounded up to 500', () => {
  const s = fresh();
  const now = new Date(2026, 9, 29);
  s.steps['2026-10-26'] = { total: 2100, adds: [] };
  s.steps['2026-10-27'] = { total: 3300, adds: [] };
  let w = L.walkStatus(PROGRAM, s, now);
  assert.equal(w.mode, 'baseline');
  assert.equal(w.suggested, null, 'needs 3 days first');
  s.steps['2026-10-29'] = { total: 400, adds: [] }; // today, still walking
  w = L.walkStatus(PROGRAM, s, now);
  assert.equal(w.suggested, null, "today's half-day does not count yet");
  s.steps['2026-10-28'] = { total: 2700, adds: [] };
  w = L.walkStatus(PROGRAM, s, now);
  assert.equal(w.suggested, 3000); // avg 2700 -> 3000, today's 400 left out
});

test('starting goal never goes below 1,000 or above 10,000', () => {
  const s = fresh();
  const now = new Date(2026, 9, 29);
  ['2026-10-26', '2026-10-27', '2026-10-28'].forEach((k) => (s.steps[k] = { total: 200, adds: [] }));
  assert.equal(L.walkStatus(PROGRAM, s, now).suggested, 1000);
  ['2026-10-26', '2026-10-27', '2026-10-28'].forEach((k) => (s.steps[k] = { total: 14000, adds: [] }));
  assert.equal(L.walkStatus(PROGRAM, s, now).suggested, 10000);
});

test('goal step-up is offered only after a settled week with the goal met 3+ days', () => {
  const s = fresh();
  s.settings.stepGoal = 3000;
  s.settings.stepGoalSince = '2026-10-20';
  const now = new Date(2026, 9, 28);
  s.steps['2026-10-22'] = { total: 3100, adds: [] };
  s.steps['2026-10-24'] = { total: 3000, adds: [] };
  assert.equal(L.walkStatus(PROGRAM, s, now).offer, null, 'only 2 days met');
  s.steps['2026-10-26'] = { total: 4000, adds: [] };
  assert.equal(L.walkStatus(PROGRAM, s, now).offer, 3500);

  s.settings.stepGoalSince = '2026-10-25';
  assert.equal(L.walkStatus(PROGRAM, s, now).offer, null, 'goal changed less than a week ago');

  s.settings.stepGoalSince = '2026-10-20';
  s.settings.stepOfferDeclined = '2026-10-27';
  assert.equal(L.walkStatus(PROGRAM, s, now).offer, null, 'she said not yet yesterday');
});

test('goal step-up never passes 10,000', () => {
  const s = fresh();
  s.settings.stepGoal = 9800;
  s.settings.stepGoalSince = '2026-10-01';
  const now = new Date(2026, 9, 28);
  ['2026-10-25', '2026-10-26', '2026-10-27'].forEach((k) => (s.steps[k] = { total: 11000, adds: [] }));
  assert.equal(L.walkStatus(PROGRAM, s, now).offer, 10000);
  s.settings.stepGoal = 10000;
  assert.equal(L.walkStatus(PROGRAM, s, now).offer, null);
});

// ---------------------------------------------------------------- storage

function memoryStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    _map: m,
  };
}

test('save then load round-trips progress', () => {
  const store = memoryStorage();
  const s = fresh();
  Store.addHistory(s, 'leg_press', entry(40, [8, 8], 'easy'));
  s.sessions.push({ date: '2026-10-26', workout: 'day1', done: ['leg_press'], skipped: [] });
  s.steps['2026-10-27'] = { total: 3000, adds: [1000, 2000] };
  assert.equal(Store.save(store, s), true);
  const back = Store.load(store, PROGRAM);
  assert.equal(back.problem, null);
  assert.deepEqual(back.state.history.leg_press, s.history.leg_press);
  assert.deepEqual(back.state.sessions, s.sessions);
  assert.deepEqual(back.state.steps, s.steps);
});

test('a damaged save does not stop the app; a copy is kept', () => {
  const store = memoryStorage({ [Store.KEY]: '{not json' });
  const r = Store.load(store, PROGRAM);
  assert.equal(r.problem, 'damaged');
  assert.deepEqual(r.state.sessions, []);
  assert.equal(store._map.get(Store.KEY + '.damaged-copy'), '{not json');
});

test('blocked storage (private browsing) is reported, not thrown', () => {
  const store = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const r = Store.load(store, PROGRAM);
  assert.equal(r.problem, 'unavailable');
  assert.equal(Store.save(store, r.state), false);
});

test('sanitize drops bad parts and keeps the good ones', () => {
  const raw = {
    settings: { liftDays: [1, 3, 9, 'x'], choices: { glute: 'db_rdl', bogus: 1 }, stepGoal: -5 },
    history: {
      leg_press: [entry(40, [8, 8], 'easy'), { date: 'yesterday', weight: 40, reps: [8], feel: 'easy' }],
      not_an_exercise: [entry(1, [1], 'easy')],
    },
    sessions: [{ date: '2026-10-26', workout: 'day1' }, { date: '2026-10-27', workout: 'day9' }],
    steps: { '2026-10-27': { total: 500 }, bad: { total: 1 }, '2026-10-28': { total: 'many' } },
    active: { workout: 'day2', date: '2026-10-28', index: 3, results: {} },
  };
  const s = Store.sanitize(raw, PROGRAM);
  assert.deepEqual(s.settings.liftDays, [1, 3]);
  assert.deepEqual(s.settings.choices, { glute: 'db_rdl' });
  assert.equal(s.settings.stepGoal, null);
  assert.equal(s.history.leg_press.length, 1);
  assert.equal(s.history.not_an_exercise, undefined);
  assert.equal(s.sessions.length, 1);
  assert.deepEqual(Object.keys(s.steps), ['2026-10-27']);
  assert.equal(s.active.index, 3);
});

test('a damaged in-progress workout is repaired, not trusted', () => {
  const raw = {
    settings: {},
    active: {
      workout: 'day1', date: '2026-10-30', index: 99,
      results: {
        0: { exerciseId: 'leg_press', weight: 40, reps: [8, 'x', 7], feel: 'meh', status: 'done', offer: 'maybe', savedAs: 'leg_press' },
        1: { exerciseId: 'not_real', weight: 1, reps: [] },
        42: { exerciseId: 'leg_curl', weight: 35, reps: [8, 8] },
        2: 'garbage',
      },
    },
  };
  const a = Store.sanitize(raw, PROGRAM).active;
  assert.equal(a.index, -1, 'out-of-range position falls back to the start');
  assert.deepEqual(Object.keys(a.results), ['0']);
  assert.deepEqual(a.results[0], {
    exerciseId: 'leg_press', weight: 40, reps: [8, null], feel: null, status: 'done', offer: null, savedAs: 'leg_press',
  });
});

test('importText rejects files that are not backups', () => {
  assert.equal(Store.importText('hello', PROGRAM).ok, false);
  assert.equal(Store.importText('{"a":1}', PROGRAM).ok, false);
  const good = JSON.stringify(fresh());
  assert.equal(Store.importText(good, PROGRAM).ok, true);
});

test('history is capped so storage cannot grow forever', () => {
  const s = fresh();
  for (let i = 0; i < 80; i++) Store.addHistory(s, 'leg_press', entry(40, [8, 8], 'right'));
  assert.equal(s.history.leg_press.length, 60);
});
