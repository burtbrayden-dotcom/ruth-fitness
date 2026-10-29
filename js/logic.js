/*
 * Pure logic for the app: dates, schedule, progression, walking.
 * No DOM access here, so every rule can be unit-tested in Node
 * (tests/logic.test.js). Loaded in the browser as window.Logic.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- dates
  // Always LOCAL calendar dates. toISOString() is UTC and would roll the
  // day over in the evening for anyone west of Greenwich.

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function parseKey(key) {
    const parts = String(key).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(d, n) {
    const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    out.setDate(out.getDate() + n);
    return out;
  }

  function daysBetween(aKey, bKey) {
    // Math.round absorbs the 23/25-hour days around daylight-saving changes.
    return Math.round((parseKey(bKey) - parseKey(aKey)) / 86400000);
  }

  function weekStart(d) {
    // Weeks run Monday to Sunday.
    const offset = (d.getDay() + 6) % 7;
    return addDays(d, -offset);
  }

  // ------------------------------------------------------------- schedule

  function lastSession(state) {
    const s = state.sessions;
    return s.length ? s[s.length - 1] : null;
  }

  // The next workout follows the last one she actually finished, not the
  // weekday, so a missed day never skips part of the rotation.
  function nextWorkoutKey(program, state) {
    const order = program.schedule.rotation;
    const last = lastSession(state);
    if (!last) return order[0];
    const i = order.indexOf(last.workout);
    return order[(i + 1) % order.length] || order[0];
  }

  function liftedOn(state, key) {
    return state.sessions.some(function (s) { return s.date === key; });
  }

  function nextLiftDate(liftDays, from) {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(from, i);
      if (liftDays.indexOf(d.getDay()) !== -1) return d;
    }
    return null;
  }

  /**
   * What should today be?
   *   'lift'       - a lifting day and no workout finished yet today
   *   'lift-done'  - a workout was finished today
   *   'walk'       - a walking day
   * canLiftInstead lets a walking day offer a make-up workout - only if
   * this week is short of its workouts, she did not lift yesterday, and
   * tomorrow is not a lifting day (strength days should never be back to
   * back). restSuggested flags a lifting day that comes right after a lift.
   */
  function todayPlan(program, state, now) {
    const key = dateKey(now);
    const liftDays = state.settings.liftDays;
    const isLiftDay = liftDays.indexOf(now.getDay()) !== -1;
    const workout = nextWorkoutKey(program, state);
    const liftedToday = liftedOn(state, key);
    const liftedYesterday = liftedOn(state, dateKey(addDays(now, -1)));
    const liftTomorrow = liftDays.indexOf(addDays(now, 1).getDay()) !== -1;
    const weekShort = weekSummary(program, state, now).workouts < liftDays.length;
    let type = 'walk';
    if (liftedToday) type = 'lift-done';
    else if (isLiftDay) type = 'lift';
    return {
      type: type,
      workout: workout,
      isLiftDay: isLiftDay,
      liftedYesterday: liftedYesterday,
      canLiftInstead: type === 'walk' && !liftedYesterday && !liftTomorrow && weekShort,
      restSuggested: type === 'lift' && liftedYesterday,
      nextLift: nextLiftDate(liftDays, now),
    };
  }

  function weekSummary(program, state, now) {
    const start = weekStart(now);
    const startKey = dateKey(start);
    const endKey = dateKey(addDays(start, 6));
    const inWeek = function (k) { return k >= startKey && k <= endKey; };
    const workouts = state.sessions.filter(function (s) { return inWeek(s.date); }).length;
    let walkDays = 0;
    let goalDays = 0;
    Object.keys(state.steps).forEach(function (k) {
      const day = state.steps[k];
      if (!inWeek(k) || !day || !(day.total > 0)) return;
      walkDays++;
      if (state.settings.stepGoal && day.total >= state.settings.stepGoal) goalDays++;
    });
    return {
      workouts: workouts,
      workoutsPlanned: state.settings.liftDays.length,
      walkDays: walkDays,
      goalDays: goalDays,
      startKey: startKey,
    };
  }

  // ---------------------------------------------------------- progression

  function heavier(exercise, weight, program) {
    if (exercise.equipment === 'dumbbell') {
      const ladder = program.dumbbellLadder;
      for (let i = 0; i < ladder.length; i++) if (ladder[i] > weight) return ladder[i];
      return weight + 5;
    }
    return weight + exercise.increment;
  }

  function lighter(exercise, weight, program) {
    if (exercise.equipment === 'dumbbell') {
      const ladder = program.dumbbellLadder;
      for (let i = ladder.length - 1; i >= 0; i--) if (ladder[i] < weight) return ladder[i];
      return null;
    }
    const w = weight - exercise.increment;
    return w > 0 ? w : null;
  }

  function hitTop(entry, program) {
    return entry.reps.length >= program.prescription.sets &&
      entry.reps.every(function (r) { return r >= program.prescription.repsMax; });
  }

  /**
   * Recommendation for the next time she does `exercise`.
   * `entries` = that exercise's history, oldest first. Each entry:
   *   { date, weight, reps: [n, n], feel: 'easy' | 'right' | 'hard' }
   *
   * The rule is double progression: keep the weight and add reps until
   * both sets reach the top of the range, then OFFER (never apply) the
   * next small weight. Returns:
   *   action  'start' | 'repeat' | 'offer-up' | 'offer-down'
   *   weight  weight to pre-fill (always the current weight - an offer
   *           only changes it if she taps Yes)
   *   offer   the proposed new weight for offer-up / offer-down, else null
   *   reason  short plain-language explanation
   */
  function recommend(exercise, entries, program) {
    const p = program.prescription;
    const valid = (entries || []).filter(function (e) {
      return e && typeof e.weight === 'number' && Array.isArray(e.reps) && e.reps.length;
    });
    const last = valid[valid.length - 1];
    if (!last) {
      return {
        action: 'start',
        weight: exercise.startWeight == null ? null : exercise.startWeight,
        offer: null,
        reason: exercise.startWeight == null
          ? 'First time. Start light - pick a weight you can lift 8 times smoothly.'
          : 'First time. This is the starting weight from your paper. If it feels too heavy, use less - that is fine.',
      };
    }

    const prev = valid[valid.length - 2] || null;
    const sameWeightAsPrev = prev && prev.weight === last.weight;
    const top = hitTop(last, program);

    // Too hard (a struggle, or her form slipped): offer lighter. Still an
    // offer - she may know it was just an off day.
    if (last.feel === 'hard') {
      const down = lighter(exercise, last.weight, program);
      if (down !== null) {
        return {
          action: 'offer-down',
          weight: last.weight,
          offer: down,
          reason: 'Last time felt too hard. A little lighter will let you move smoothly with good form and build up again.',
        };
      }
      return {
        action: 'repeat',
        weight: last.weight,
        offer: null,
        reason: 'Last time felt too hard, and this is already the lightest setting. Try the easier option below, or a smaller movement.',
      };
    }

    if (top) {
      const up = heavier(exercise, last.weight, program);
      // Easy at the top of the range: ready now. "About right" at the top:
      // ready once it has happened twice in a row at this weight.
      const confirmed = last.feel === 'easy' ||
        (sameWeightAsPrev && hitTop(prev, program) && prev.feel !== 'hard');
      if (confirmed) {
        return {
          action: 'offer-up',
          weight: last.weight,
          offer: up,
          reason: 'You did ' + p.repsMax + ' on every set and it felt manageable. You may be ready for a little more.' +
            (up > last.weight * 1.25 ? ' The next size up is a bigger jump, so it is fine to stay where you are.' : ''),
        };
      }
      return {
        action: 'repeat',
        weight: last.weight,
        offer: null,
        reason: 'You reached ' + p.repsMax + ' on every set. If it feels about right again today, you will be offered a little more next time.',
      };
    }

    if (prev && last.weight > prev.weight) {
      return {
        action: 'repeat',
        weight: last.weight,
        offer: null,
        reason: 'You moved up last time - well done. Fewer reps at a new weight is normal. Work back up toward ' + p.repsMax + '.',
      };
    }

    return {
      action: 'repeat',
      weight: last.weight,
      offer: null,
      reason: last.feel === 'easy'
        ? 'Felt easy last time. Today, try for ' + p.repsMax + ' on each set.'
        : 'Same weight as last time. If it feels OK, try for one more rep on a set - up to ' + p.repsMax + '.',
    };
  }

  /** ' each leg', ' each' (pair of dumbbells) or '' - shown after a weight. */
  function weightSuffix(exercise) {
    if (exercise.perSide) return ' each ' + (exercise.sideWord || 'side');
    if (exercise.pair) return ' each';
    return '';
  }

  function describeEntry(entry, exercise, program) {
    if (!entry) return null;
    const w = entry.weight === 0 ? 'no weight' : formatWeight(entry.weight) + weightSuffix(exercise);
    const feel = { easy: 'felt easy', right: 'felt about right', hard: 'felt too hard' }[entry.feel] || '';
    return w + ' - ' + entry.reps.map(function (r) { return repLabel(r, program); }).join(' and ') +
      ' reps' + (feel ? ', ' + feel : '');
  }

  function repLabel(r, program) {
    const p = program.prescription;
    return r < p.repsMin ? 'under ' + p.repsMin : (r > p.repsMax ? 'over ' + p.repsMax : String(r));
  }

  /** Rest time in plain words: 90 -> 'about 1\u00bd minutes'. */
  function restWords(seconds) {
    const halves = Math.round(seconds / 30);
    if (halves < 2) return 'about ' + seconds + ' seconds';
    const whole = Math.floor(halves / 2);
    const text = halves % 2 ? whole + '\u00bd' : String(whole);
    return 'about ' + text + ' minute' + (halves === 2 ? '' : 's');
  }

  function formatWeight(w) {
    if (w == null) return '';
    return (Math.round(w * 10) / 10) + ' lb';
  }

  /** Parse a typed weight. Returns {ok, value} or {ok:false, error}. */
  function parseWeight(text) {
    const t = String(text == null ? '' : text).trim().replace(/lbs?$/i, '').trim();
    if (t === '') return { ok: false, error: 'Please type a number, like 10.' };
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return { ok: false, error: 'Please use numbers only, like 10 or 12.5.' };
    const v = Number(t);
    if (v > 500) return { ok: false, error: 'That number looks too big. Please check it.' };
    return { ok: true, value: v };
  }

  // -------------------------------------------------------------- walking

  function roundUpTo(n, step) {
    return Math.ceil(n / step) * step;
  }

  /** Parse typed steps. Accepts "4,500" and "4500". */
  function parseSteps(text) {
    const t = String(text == null ? '' : text).trim().replace(/[,\s]/g, '');
    if (t === '') return { ok: false, error: 'Please type a number of steps, like 3000.' };
    if (!/^\d+$/.test(t)) return { ok: false, error: 'Please use numbers only, like 3000.' };
    const v = Number(t);
    if (v > 60000) return { ok: false, error: 'That number looks too big. Please check it.' };
    return { ok: true, value: v };
  }

  function minutesToSteps(minutes, program) {
    return Math.round(minutes * program.walking.stepsPerMinute);
  }

  function stepProgress(total, goal) {
    if (!goal || goal <= 0) return { pct: 0, remaining: 0, met: false };
    const pct = Math.min(100, Math.round((total / goal) * 100));
    return { pct: pct, remaining: Math.max(0, goal - total), met: total >= goal };
  }

  /**
   * Walking goal state.
   *  - mode 'baseline': no goal yet. After `baselineDays` logged days we
   *    suggest a starting goal = her average, rounded UP to the nearest
   *    500 (so it is reachable, not a stretch).
   *  - mode 'goal': a goal is set. At most once a week, if she reached it
   *    on enough days, OFFER +500 (never applied without a Yes).
   */
  function walkStatus(program, state, now) {
    const w = program.walking;
    const todayKey = dateKey(now);
    const today = (state.steps[todayKey] && state.steps[todayKey].total) || 0;
    const goal = state.settings.stepGoal;

    if (!goal) {
      // Only finished days count - today's walking is not done yet, and a
      // half-day would set the starting goal too low.
      const logged = Object.keys(state.steps)
        .filter(function (k) { return k < todayKey && state.steps[k] && state.steps[k].total > 0; })
        .sort();
      const recent = logged.slice(-7);
      let suggested = null;
      if (recent.length >= w.baselineDays) {
        const avg = recent.reduce(function (s, k) { return s + state.steps[k].total; }, 0) / recent.length;
        suggested = Math.min(w.longTermGoal, Math.max(w.minimumGoal, roundUpTo(avg, w.stepUp)));
      }
      return {
        mode: 'baseline',
        today: today,
        daysLogged: logged.length,
        daysNeeded: w.baselineDays,
        suggested: suggested,
      };
    }

    const progress = stepProgress(today, goal);
    let offer = null;
    if (goal < w.longTermGoal) {
      const since = state.settings.stepGoalSince || todayKey;
      const declined = state.settings.stepOfferDeclined;
      const settled = daysBetween(since, todayKey) >= 7;
      const quiet = !declined || daysBetween(declined, todayKey) >= 7;
      if (settled && quiet) {
        let metDays = 0;
        for (let i = 1; i <= 7; i++) {
          const k = dateKey(addDays(now, -i));
          if (state.steps[k] && state.steps[k].total >= goal) metDays++;
        }
        if (metDays >= w.daysToStepUp) offer = Math.min(w.longTermGoal, goal + w.stepUp);
      }
    }
    return {
      mode: 'goal',
      today: today,
      goal: goal,
      pct: progress.pct,
      remaining: progress.remaining,
      met: progress.met,
      offer: offer,
      toLongTerm: Math.max(0, w.longTermGoal - goal),
    };
  }

  // --------------------------------------------------------------- export

  const api = {
    dateKey: dateKey,
    parseKey: parseKey,
    addDays: addDays,
    daysBetween: daysBetween,
    weekStart: weekStart,
    nextWorkoutKey: nextWorkoutKey,
    todayPlan: todayPlan,
    nextLiftDate: nextLiftDate,
    weekSummary: weekSummary,
    heavier: heavier,
    lighter: lighter,
    recommend: recommend,
    describeEntry: describeEntry,
    weightSuffix: weightSuffix,
    repLabel: repLabel,
    restWords: restWords,
    formatWeight: formatWeight,
    parseWeight: parseWeight,
    parseSteps: parseSteps,
    minutesToSteps: minutesToSteps,
    stepProgress: stepProgress,
    walkStatus: walkStatus,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : this);
