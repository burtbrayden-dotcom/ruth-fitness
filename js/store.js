/*
 * Saved progress, kept in this browser's localStorage under one key.
 * Everything is checked on load so a damaged or hand-edited save can never
 * stop the app from opening - bad parts are dropped, the rest is kept.
 * Loaded in the browser as window.Store.
 */
(function (root) {
  'use strict';

  const KEY = 'ruth-fitness.v1';
  const MAX_ENTRIES_PER_EXERCISE = 60;

  function emptyState(program) {
    return {
      version: 1,
      settings: {
        liftDays: program.schedule.defaultLiftDays.slice(),
        choices: {},
        safetyAcknowledged: false,
        stepGoal: null,
        stepGoalSince: null,
        stepOfferDeclined: null,
      },
      history: {},   // exerciseId -> [{date, weight, reps:[..], feel}]
      sessions: [],  // [{date, workout, done:[ids], skipped:[ids]}]
      steps: {},     // 'YYYY-MM-DD' -> {total, adds:[n]}
      active: null,  // workout in progress, so a refresh never loses it
    };
  }

  const isKey = function (k) { return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k); };
  const isNum = function (n) { return typeof n === 'number' && isFinite(n) && n >= 0; };

  /** Repair anything loaded from disk into a well-formed state. */
  function sanitize(raw, program) {
    const s = emptyState(program);
    if (!raw || typeof raw !== 'object') return s;

    const rs = raw.settings || {};
    if (Array.isArray(rs.liftDays)) {
      const days = rs.liftDays.filter(function (d) { return Number.isInteger(d) && d >= 0 && d <= 6; });
      if (days.length) s.settings.liftDays = Array.from(new Set(days)).sort();
    }
    if (rs.choices && typeof rs.choices === 'object') {
      Object.keys(program.choices).forEach(function (c) {
        if (program.choices[c].options.indexOf(rs.choices[c]) !== -1) s.settings.choices[c] = rs.choices[c];
      });
    }
    s.settings.safetyAcknowledged = rs.safetyAcknowledged === true;
    if (isNum(rs.stepGoal) && rs.stepGoal > 0) s.settings.stepGoal = Math.round(rs.stepGoal);
    if (isKey(rs.stepGoalSince)) s.settings.stepGoalSince = rs.stepGoalSince;
    if (isKey(rs.stepOfferDeclined)) s.settings.stepOfferDeclined = rs.stepOfferDeclined;

    if (raw.history && typeof raw.history === 'object') {
      Object.keys(raw.history).forEach(function (id) {
        if (!program.exercises[id] || !Array.isArray(raw.history[id])) return;
        const list = raw.history[id].filter(function (e) {
          return e && isKey(e.date) && isNum(e.weight) && Array.isArray(e.reps) &&
            e.reps.length && e.reps.every(isNum) && ['easy', 'right', 'hard'].indexOf(e.feel) !== -1;
        }).map(function (e) {
          return { date: e.date, weight: e.weight, reps: e.reps.slice(0, 6), feel: e.feel };
        });
        if (list.length) s.history[id] = list.slice(-MAX_ENTRIES_PER_EXERCISE);
      });
    }

    if (Array.isArray(raw.sessions)) {
      s.sessions = raw.sessions.filter(function (x) {
        return x && isKey(x.date) && program.workouts[x.workout];
      }).map(function (x) {
        return {
          date: x.date,
          workout: x.workout,
          done: Array.isArray(x.done) ? x.done.filter(function (id) { return program.exercises[id]; }) : [],
          skipped: Array.isArray(x.skipped) ? x.skipped.filter(function (id) { return program.exercises[id]; }) : [],
        };
      });
    }

    if (raw.steps && typeof raw.steps === 'object') {
      Object.keys(raw.steps).forEach(function (k) {
        const d = raw.steps[k];
        if (!isKey(k) || !d || !isNum(d.total)) return;
        s.steps[k] = {
          total: Math.round(d.total),
          adds: Array.isArray(d.adds) ? d.adds.filter(function (n) { return typeof n === 'number' && isFinite(n); }).slice(-50) : [],
        };
      });
    }

    const a = raw.active;
    if (a && program.workouts[a.workout] && isKey(a.date)) {
      const slots = program.workouts[a.workout].items.length;
      s.active = {
        workout: a.workout,
        date: a.date,
        index: Number.isInteger(a.index) && a.index >= -1 && a.index <= slots ? a.index : -1,
        results: sanitizeResults(a.results, slots, program),
      };
    }
    return s;
  }

  function sanitizeResults(raw, slots, program) {
    const out = {};
    if (!raw || typeof raw !== 'object') return out;
    const sets = program.prescription.sets;
    Object.keys(raw).forEach(function (k) {
      const i = Number(k);
      const r = raw[k];
      if (!Number.isInteger(i) || i < 0 || i >= slots || !r || !program.exercises[r.exerciseId]) return;
      const reps = Array.isArray(r.reps) ? r.reps.slice(0, sets) : [];
      while (reps.length < sets) reps.push(null);
      out[i] = {
        exerciseId: r.exerciseId,
        weight: isNum(r.weight) ? r.weight : null,
        reps: reps.map(function (n) { return isNum(n) ? n : null; }),
        feel: ['easy', 'right', 'hard'].indexOf(r.feel) !== -1 ? r.feel : null,
        status: r.status === 'done' || r.status === 'skipped' ? r.status : null,
        offer: r.offer === 'yes' || r.offer === 'no' ? r.offer : null,
        savedAs: program.exercises[r.savedAs] ? r.savedAs : null,
      };
    });
    return out;
  }

  /**
   * Load saved progress.
   * Returns { state, ok, problem } where problem is
   *   null | 'unavailable' (browser blocks storage) | 'damaged' (unreadable save, a copy was kept)
   */
  function load(storage, program) {
    let text;
    try {
      text = storage.getItem(KEY);
    } catch (e) {
      return { state: emptyState(program), ok: false, problem: 'unavailable' };
    }
    if (text == null) return { state: emptyState(program), ok: true, problem: null };
    try {
      return { state: sanitize(JSON.parse(text), program), ok: true, problem: null };
    } catch (e) {
      try { storage.setItem(KEY + '.damaged-copy', text); } catch (ignore) { /* nothing more we can do */ }
      return { state: emptyState(program), ok: true, problem: 'damaged' };
    }
  }

  /** Save. Returns true on success, false if the browser refused. */
  function save(storage, state) {
    try {
      storage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function addHistory(state, exerciseId, entry) {
    const list = state.history[exerciseId] || (state.history[exerciseId] = []);
    list.push(entry);
    if (list.length > MAX_ENTRIES_PER_EXERCISE) list.splice(0, list.length - MAX_ENTRIES_PER_EXERCISE);
  }

  /** Parse a backup file's text. Returns {ok, state} or {ok:false, error}. */
  function importText(text, program) {
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'That file is not a backup from this app.' };
    }
    if (!raw || raw.version !== 1 || typeof raw.settings !== 'object') {
      return { ok: false, error: 'That file is not a backup from this app.' };
    }
    return { ok: true, state: sanitize(raw, program) };
  }

  const api = {
    KEY: KEY,
    emptyState: emptyState,
    sanitize: sanitize,
    load: load,
    save: save,
    addHistory: addHistory,
    importText: importText,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Store = api;
})(typeof window !== 'undefined' ? window : this);
