/*
 * App shell: loads saved progress, draws the header/navigation, routes
 * between screens (#today, #workout, #walk, #progress, #help) and draws
 * the Today screen. Other screens live in workout.js and screens.js.
 */
(function () {
  'use strict';

  const h = UI.h;
  const P = window.PROGRAM;
  const storage = (function () { try { return window.localStorage; } catch (e) { return null; } })();

  const loaded = storage
    ? Store.load(storage, P)
    : { state: Store.emptyState(P), problem: 'unavailable' };

  const App = {
    program: P,
    state: loaded.state,
    problem: loaded.problem,     // 'unavailable' | 'damaged' | null
    saveFailed: false,
    now: function () { return new Date(); },
    persist: function () {
      const ok = storage ? Store.save(storage, App.state) : false;
      App.saveFailed = !ok;
      updateBanner();
      return ok;
    },
    go: function (route) {
      if (location.hash === '#' + route) render({ focus: true });
      else location.hash = '#' + route;
    },
    render: function (opts) { render(opts); },
    // Which exercise fills a slot - a plain id, or her saved choice.
    slotExercise: function (item) {
      if (typeof item === 'string') return item;
      const c = P.choices[item.choice];
      return App.state.settings.choices[item.choice] || c.default;
    },
  };
  window.App = App;

  const ROUTES = [
    { id: 'today', label: 'Today' },
    { id: 'walk', label: 'Walking' },
    { id: 'progress', label: 'Progress' },
    { id: 'help', label: 'Help' },
  ];

  function route() {
    const r = (location.hash || '#today').slice(1);
    return ['today', 'workout', 'walk', 'progress', 'help'].indexOf(r) === -1 ? 'today' : r;
  }

  // --------------------------------------------------------------- banner

  function updateBanner() {
    const el = document.getElementById('banner');
    if (!el) return;
    let text = '';
    if (App.problem === 'unavailable' || App.saveFailed) {
      text = 'This browser is not letting the app save your progress (it may be in private browsing mode). You can still use it, but nothing will be remembered.';
    } else if (App.problem === 'damaged') {
      text = 'Your saved progress could not be read, so the app started fresh. If you have a backup file, you can load it under Help.';
    }
    el.textContent = text;
    el.hidden = !text;
  }

  // ----------------------------------------------------------------- shell

  function renderNav(current) {
    const nav = UI.clear(document.getElementById('nav'));
    ROUTES.forEach(function (r) {
      const active = current === r.id || (current === 'workout' && r.id === 'today');
      nav.appendChild(h('a', {
        href: '#' + r.id,
        class: 'nav-link' + (active ? ' active' : ''),
        'aria-current': active ? 'page' : null,
      }, r.label));
    });
  }

  let lastRoute = null;

  /**
   * Draw the current screen. Focus moves to the heading (and the page
   * scrolls to the top) only when the screen really changes - a new route,
   * or {focus: true} for the next workout step. An in-place update such as
   * adding a walk keeps her scroll position.
   */
  function render(opts) {
    WorkoutScreen.stopTimer();
    // Not while she is on the workout screen: a workout that runs past
    // midnight must not be closed under her. It is closed from any other
    // screen, or when the app is next opened.
    if (route() !== 'workout' || lastRoute === null) closeStaleWorkout();
    const r = route();
    const moved = lastRoute !== null && (r !== lastRoute || (opts && opts.focus === true));
    const keepY = window.scrollY;
    const main = document.getElementById('main');
    const f = document.activeElement;
    const keepFocus = f && f !== document.body && main.contains(f)
      ? { id: f.id, tag: f.tagName, text: f.textContent } : null;
    UI.clear(main);
    renderNav(r);
    updateBanner();

    if (!App.state.settings.safetyAcknowledged) renderWelcome(main);
    else if (r === 'workout') WorkoutScreen.render(main);
    else if (r === 'walk') Screens.walk(main);
    else if (r === 'progress') Screens.progress(main);
    else if (r === 'help') Screens.help(main);
    else renderToday(main);

    // New screen: focus its heading so screen readers announce it.
    if (moved) {
      const h1 = main.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    } else if (lastRoute !== null) {
      window.scrollTo(0, keepY);
      // Put keyboard focus back on the control she just used.
      if (keepFocus) {
        const same = keepFocus.id ? document.getElementById(keepFocus.id)
          : Array.prototype.find.call(main.querySelectorAll(keepFocus.tag), function (el) {
            return el.textContent === keepFocus.text;
          });
        if (same) same.focus({ preventScroll: true });
      }
    }
    lastRoute = r;
  }

  // A workout left open from an earlier day is saved as done (if she did
  // any of it) so the rotation moves on and nothing she lifted is lost.
  function closeStaleWorkout() {
    const a = App.state.active;
    // Strictly earlier: a clock or time-zone change that moves "today"
    // backwards must not close a workout she is in the middle of.
    if (!a || a.date >= Logic.dateKey(App.now())) return;
    const done = [];
    const skipped = [];
    Object.keys(a.results).forEach(function (slot) {
      const res = a.results[slot];
      if (res && res.status === 'done') done.push(res.exerciseId);
      if (res && res.status === 'skipped') skipped.push(res.exerciseId);
    });
    if (done.length) App.state.sessions.push({ date: a.date, workout: a.workout, done: done, skipped: skipped });
    App.state.active = null;
    App.persist();
  }

  // --------------------------------------------------------------- welcome

  function renderWelcome(main) {
    const s = P.safety;
    main.appendChild(h('h1', { text: 'Welcome, ' + P.person.name }));
    main.appendChild(h('p', { class: 'lead', text: 'This is your exercise guide: three short strength workouts a week, and walking on the other days. It remembers your weights for you and tells you what to do next.' }));
    main.appendChild(UI.card('Before you start - please read', 'caution',
      h('p', { text: s.intro }),
      h('ul', { class: 'list' }, s.points.map(function (t) { return h('li', { text: t }); }))));
    main.appendChild(h('div', { class: 'actions' },
      UI.button('I have read this - let’s begin', function () {
        App.state.settings.safetyAcknowledged = true;
        App.persist();
        App.go('today');
      }, { kind: 'primary' })));
    main.appendChild(h('p', { class: 'muted', text: 'You can read this again any time under Help.' }));
  }

  // ----------------------------------------------------------------- today

  function greeting(d) {
    const hr = d.getHours();
    return hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  }

  function workoutNames(key) {
    return P.workouts[key].items.map(function (item) { return P.exercises[App.slotExercise(item)].name; });
  }

  function startWorkout(key) {
    const today = Logic.dateKey(App.now());
    const a = App.state.active;
    if (!a || a.workout !== key) {
      App.state.active = { workout: key, date: today, index: -1, results: {} };
      App.persist();
    }
    App.go('workout');
  }

  function renderToday(main) {
    const now = App.now();
    const st = App.state;
    const plan = Logic.todayPlan(P, st, now);
    const w = P.workouts[plan.workout];
    const active = st.active; // anything older was already closed by closeStaleWorkout()

    main.appendChild(h('h1', { text: greeting(now) + ', ' + P.person.name }));
    main.appendChild(h('p', { class: 'lead', text: 'Today is ' + UI.longDate(now) + '.' }));

    if (plan.type === 'lift' || active) {
      const key = active ? active.workout : plan.workout;
      main.appendChild(UI.card(active ? 'You are partway through ' + P.workouts[key].title : 'Today is a strength day', 'hero',
        h('p', { class: 'big', text: P.workouts[key].title + ' - ' + P.workouts[key].items.length + ' exercises, about 40 minutes.' }),
        plan.restSuggested && !active
          ? h('p', { text: 'You did a strength workout yesterday. It is best to rest a day in between - it is fine to walk today and do this workout on your next strength day.' })
          : null,
        h('div', { class: 'actions' },
          UI.button(active ? 'Continue ' + P.workouts[key].title : 'Start ' + P.workouts[key].title,
            function () { startWorkout(key); }, { kind: 'primary' })),
        h('details', {},
          h('summary', { text: 'See today’s exercises' }),
          h('ol', { class: 'list' }, workoutNames(key).map(function (n) { return h('li', { text: n }); })))));
    } else if (plan.type === 'lift-done') {
      main.appendChild(UI.card('Workout done - well done!', 'good hero',
        h('p', { class: 'big', text: 'You finished your strength workout today. Rest and recover.' }),
        h('p', { text: 'Walking is optional on strength days. If you do walk, you can add your steps.' }),
        h('div', { class: 'actions' }, UI.button('Add steps', function () { App.go('walk'); }))));
    } else {
      const ws = Logic.walkStatus(P, st, now);
      const line = ws.mode === 'goal'
        ? UI.num(ws.today) + ' of ' + UI.num(ws.goal) + ' steps so far today.'
        : 'For your first few days, just walk as you normally do and add your steps.';
      main.appendChild(UI.card('Today is a walking day', 'hero',
        h('p', { class: 'big', text: line }),
        h('div', { class: 'actions' },
          UI.button('Start walking', function () { App.go('walk'); }, { kind: 'primary' }))));
      if (plan.canLiftInstead) {
        main.appendChild(UI.card(null, 'note',
          h('p', { text: 'Missed a strength day this week? You can do ' + w.title + ' today instead.' }),
          h('div', { class: 'actions' },
            UI.button('Do ' + w.title + ' today', function () { startWorkout(plan.workout); }))));
      }
    }

    if (plan.nextLift && plan.type !== 'lift' && !active) {
      main.appendChild(h('p', { class: 'next', text: 'Next strength day: ' + UI.longDate(plan.nextLift) + ' - ' + w.title + '.' }));
    }

    main.appendChild(weekCard(now));
  }

  /** This week, one line per day, in words (no colour-only status). */
  function weekCard(now) {
    const st = App.state;
    const summary = Logic.weekSummary(P, st, now);
    const start = Logic.parseKey(summary.startKey);
    const todayKey = Logic.dateKey(now);
    const rows = [];
    for (let i = 0; i < 7; i++) {
      const d = Logic.addDays(start, i);
      const k = Logic.dateKey(d);
      const parts = [];
      const sess = st.sessions.filter(function (s) { return s.date === k; });
      if (sess.length) parts.push('✓ ' + P.workouts[sess[0].workout].title + ' done');
      const steps = st.steps[k] && st.steps[k].total;
      if (steps) {
        const met = st.settings.stepGoal && steps >= st.settings.stepGoal;
        parts.push((met ? '✓ ' : '') + UI.num(steps) + ' steps' + (met ? ' (goal reached)' : ''));
      }
      if (!parts.length) {
        const planned = st.settings.liftDays.indexOf(d.getDay()) !== -1 ? 'Strength day' : 'Walking day';
        parts.push(k > todayKey ? planned : k === todayKey ? planned + ' (today)' : 'Nothing added');
      }
      rows.push(h('li', { class: k === todayKey ? 'today' : '' },
        h('span', { class: 'day', text: UI.DAYS[d.getDay()] }),
        h('span', { text: parts.join(' · ') })));
    }
    return UI.card('This week', '',
      h('p', { text: 'Strength workouts: ' + summary.workouts + ' of ' + summary.workoutsPlanned +
        '. Days with walking added: ' + summary.walkDays + '.' }),
      h('ul', { class: 'week' }, rows));
  }

  App.weekCard = weekCard;

  // ---------------------------------------------------------------- start

  window.addEventListener('hashchange', render);
  // Re-check the day when she comes back to the app (it may be tomorrow).
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && route() !== 'workout') render();
  });
  render();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline use is a bonus, not required */ });
  }
})();
