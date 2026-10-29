/*
 * Walking, Progress, and Help & Settings screens. Loaded as window.Screens.
 */
(function () {
  'use strict';

  const h = UI.h;

  // ---------------------------------------------------------------- walking

  function todaySteps(key) {
    const st = App.state;
    return st.steps[key] || (st.steps[key] = { total: 0, adds: [] });
  }

  function setGoal(n) {
    const s = App.state.settings;
    s.stepGoal = n;
    s.stepGoalSince = Logic.dateKey(App.now());
    s.stepOfferDeclined = null;
    App.persist();
    App.render();
  }

  function walk(main) {
    const P = App.program;
    const W = P.walking;
    const now = App.now();
    const key = Logic.dateKey(now);
    const ws = Logic.walkStatus(P, App.state, now);
    const plan = Logic.todayPlan(P, App.state, now);

    main.appendChild(h('h1', { text: 'Walking' }));
    main.appendChild(h('p', { class: 'lead', text: UI.longDate(now) + (plan.type === 'walk'
      ? ' - a walking day.' : ' - a strength day, so walking today is optional.') }));

    if (ws.mode === 'baseline') {
      if (ws.suggested) {
        main.appendChild(UI.card('Your starting goal', 'offer hero',
          h('p', { class: 'big', text: 'Based on the days you have logged, a comfortable starting goal is ' + UI.num(ws.suggested) + ' steps a day.' }),
          h('p', { text: 'This is close to what you already do - it should feel easy. It will grow slowly from here.' }),
          h('div', { class: 'actions' },
            UI.button('Use ' + UI.num(ws.suggested) + ' steps', function () { setGoal(ws.suggested); }, { kind: 'primary' }))));
      } else {
        main.appendChild(UI.card('Finding your starting point', 'hero',
          h('p', { class: 'big', text: 'For your first few days, walk as you normally would and add your steps below.' }),
          h('p', { text: 'After ' + ws.daysNeeded + ' days of walking, the app will suggest a comfortable starting goal. Finished days so far: ' + ws.daysLogged + ' of ' + ws.daysNeeded + ' (today counts once the day is over).' }),
          h('p', {}, h('strong', { text: 'Steps today: ' }), UI.num(ws.today))));
      }
    } else {
      main.appendChild(progressCard(ws));
      if (ws.offer) {
        main.appendChild(UI.card('Ready for a little more?', 'offer',
          h('p', { text: 'You reached your goal on several days this past week. Would you like to raise it to ' + UI.num(ws.offer) + ' steps? That is about 5 more minutes of walking a day.' }),
          h('div', { class: 'actions' },
            UI.button('Yes, raise my goal to ' + UI.num(ws.offer), function () { setGoal(ws.offer); }, { kind: 'primary' }),
            UI.button('Not yet', function () {
              App.state.settings.stepOfferDeclined = key;
              App.persist();
              App.render();
            }))));
      }
    }

    // -- add steps
    const msg = UI.liveMessage('steps-msg');
    const day = App.state.steps[key];
    main.appendChild(UI.card('Add a walk', '',
      h('p', { text: 'Tap after each walk. Short walks add up - about 1,000 steps for every 10 minutes.' }),
      h('div', { class: 'quick-walks' }, W.quickWalks.map(function (m) {
        const steps = Logic.minutesToSteps(m, P);
        return UI.button('+ ' + m + ' minutes', function () {
          const d = todaySteps(key);
          d.total += steps;
          d.adds.push(steps);
          App.persist();
          App.render();
          UI.setMessage(document.getElementById('steps-msg'), 'Added a ' + m + '-minute walk (about ' + UI.num(steps) + ' steps).');
        }, { attrs: { 'aria-label': 'Add a ' + m + '-minute walk, about ' + UI.num(steps) + ' steps' } });
      })),
      day && day.adds.length ? h('div', { class: 'actions' }, UI.button('Undo the last walk I added', function () {
        const d = todaySteps(key);
        const last = d.adds.pop();
        if (last != null) d.total = Math.max(0, d.total - last);
        App.persist();
        App.render();
        UI.setMessage(document.getElementById('steps-msg'), 'Removed the last walk.');
      })) : null,
      msg));

    const input = h('input', { id: 'steps-input', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-describedby': 'steps-error', placeholder: 'e.g. 3500' });
    const err = h('p', { id: 'steps-error', class: 'field-error', 'aria-live': 'polite' });
    main.appendChild(UI.card('Or type your step count', '',
      h('p', { text: 'If your phone or step counter shows today’s steps, type the total here. It replaces today’s number.' }),
      h('label', { for: 'steps-input', text: 'Today’s total steps' }),
      h('div', { class: 'inline-form' }, input,
        UI.button('Save', function () {
          const v = Logic.parseSteps(input.value);
          if (!v.ok) { err.textContent = v.error; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
          App.state.steps[key] = { total: v.value, adds: [] };
          App.persist();
          App.render();
          UI.setMessage(document.getElementById('steps-msg'), 'Saved ' + UI.num(v.value) + ' steps for today.');
        }, { kind: 'primary' })),
      err));

    main.appendChild(goalEditor());
    main.appendChild(UI.card('How your goal grows', '',
      h('p', { text: 'The long-term aim is ' + UI.num(W.longTermGoal) + ' steps on walking days - but there is no deadline. Your goal only goes up by ' + UI.num(W.stepUp) + ' steps (about 5 minutes) at a time, at most once a week, and only when you have been reaching it. You always decide whether to raise it.' }),
      ws.mode === 'goal' && ws.toLongTerm > 0
        ? h('p', { text: 'You are ' + UI.num(ws.toLongTerm) + ' steps away from ' + UI.num(W.longTermGoal) + '.' })
        : null));
    main.appendChild(UI.card('Walking tips', '', h('ul', { class: 'list' }, W.tips.map(function (t) { return h('li', { text: t }); }))));
  }

  function progressCard(ws) {
    return UI.card(ws.met ? '✓ Goal reached today - well done!' : 'Today’s steps', ws.met ? 'good hero' : 'hero',
      h('p', { class: 'huge', text: UI.num(ws.today) + ' steps' }),
      h('p', { class: 'big', text: 'Goal: ' + UI.num(ws.goal) + ' steps' + (ws.met ? '.' : ' · ' + UI.num(ws.remaining) + ' to go.') }),
      h('div', {
        class: 'bar', role: 'progressbar', 'aria-label': 'Steps toward today’s goal',
        'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(ws.pct),
        'aria-valuetext': ws.pct + ' percent of your goal',
      }, h('div', { class: 'bar-fill', style: 'width:' + ws.pct + '%' })),
      h('p', { text: ws.pct + '% of your goal.' }));
  }

  function goalEditor() {
    const s = App.state.settings;
    const P = App.program;
    const input = h('input', { id: 'goal-input', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-describedby': 'goal-error', value: s.stepGoal ? String(s.stepGoal) : '' });
    const err = h('p', { id: 'goal-error', class: 'field-error', 'aria-live': 'polite' });
    return h('details', { class: 'card' },
      h('summary', { text: s.stepGoal ? 'Change my goal' : 'Set my own goal now' }),
      h('p', { text: 'Feeling tired, sore, or unwell? It is fine to lower your goal for a while.' }),
      s.stepGoal && s.stepGoal - P.walking.stepUp >= P.walking.minimumGoal
        ? h('div', { class: 'actions' }, UI.button('Lower my goal to ' + UI.num(s.stepGoal - P.walking.stepUp), function () { setGoal(s.stepGoal - P.walking.stepUp); }))
        : null,
      h('label', { for: 'goal-input', text: 'Daily step goal' }),
      h('div', { class: 'inline-form' }, input, UI.button('Save goal', function () {
        const v = Logic.parseSteps(input.value);
        if (!v.ok || v.value < 500) {
          err.textContent = v.ok ? 'Please choose at least 500 steps.' : v.error;
          input.setAttribute('aria-invalid', 'true');
          input.focus();
          return;
        }
        setGoal(v.value);
      }, { kind: 'primary' })),
      err);
  }

  // --------------------------------------------------------------- progress

  function progress(main) {
    const P = App.program;
    const st = App.state;
    const now = App.now();
    main.appendChild(h('h1', { text: 'Your progress' }));

    const fourWeeksAgo = Logic.dateKey(Logic.addDays(now, -28));
    const recent = st.sessions.filter(function (s) { return s.date >= fourWeeksAgo; }).length;
    const walkDays = Object.keys(st.steps).filter(function (k) { return st.steps[k].total > 0; }).length;
    main.appendChild(UI.card('Showing up', 'good',
      h('p', { class: 'big', text: st.sessions.length
        ? 'You have finished ' + st.sessions.length + ' strength workout' + (st.sessions.length === 1 ? '' : 's') + ' - ' + recent + ' in the last 4 weeks.'
        : 'Your finished workouts will appear here.' }),
      h('p', { text: walkDays ? 'You have added walking on ' + walkDays + ' day' + (walkDays === 1 ? '' : 's') + '.' : 'Your walking days will appear here.' }),
      h('p', { text: 'Every workout counts. Doing it regularly matters much more than doing it perfectly.' })));

    main.appendChild(App.weekCard(now));

    const ids = Object.keys(P.exercises).filter(function (id) { return (st.history[id] || []).length; });
    const weights = UI.card('Your weights', '');
    if (!ids.length) weights.appendChild(h('p', { text: 'After your first workout, this shows each exercise and how your weights change over time.' }));
    ids.forEach(function (id) {
      const ex = P.exercises[id];
      const list = st.history[id];
      const first = list[0];
      const last = list[list.length - 1];
      const diff = last.weight - first.weight;
      const change = diff > 0 ? 'Up ' + Logic.formatWeight(diff) + ' since you started.' : diff < 0 ? 'Adjusted to suit you.' : 'Holding steady.';
      const msg = h('p', { class: 'message', role: 'status' });
      const row = h('div', { class: 'ex-row' },
        h('h3', { text: ex.name }),
        h('p', { text: 'Started at ' + Logic.formatWeight(first.weight) + ' → now ' + Logic.formatWeight(last.weight) + Logic.weightSuffix(ex) + '. ' + change }),
        h('p', { class: 'muted', text: 'Last time (' + UI.shortDate(Logic.parseKey(last.date)) + '): ' + Logic.describeEntry(last, ex, P) + '. Done ' + list.length + ' time' + (list.length === 1 ? '' : 's') + '.' }),
        msg);
      row.appendChild(confirmButton('Remove the last entry (if it was a mistake)', 'Yes, remove it', function () {
        list.pop();
        if (!list.length) delete st.history[id];
        App.persist();
        App.render();
      }));
      weights.appendChild(row);
    });
    main.appendChild(weights);

    const sessions = st.sessions.slice(-10).reverse();
    if (sessions.length) {
      main.appendChild(UI.card('Recent workouts', '', h('ul', { class: 'list' }, sessions.map(function (s) {
        return h('li', { text: UI.shortDate(Logic.parseKey(s.date)) + ' - ' + P.workouts[s.workout].title + ': ' + s.done.length + ' exercise' + (s.done.length === 1 ? '' : 's') + ' done' + (s.skipped.length ? ', ' + s.skipped.length + ' skipped' : '') + '.' });
      }))));
    }
  }

  /** A button that asks "are you sure?" in place - no pop-ups. */
  function confirmButton(label, confirmLabel, onConfirm) {
    const wrap = h('div', { class: 'actions' });
    function idle() {
      UI.clear(wrap).appendChild(UI.button(label, ask));
    }
    function ask() {
      UI.clear(wrap);
      wrap.appendChild(h('p', { class: 'confirm-q', text: 'Are you sure? This cannot be undone.' }));
      const yes = UI.button(confirmLabel, onConfirm, { kind: 'danger' });
      wrap.appendChild(yes);
      wrap.appendChild(UI.button('No, keep it', idle));
      yes.focus();
    }
    idle();
    return wrap;
  }

  // ------------------------------------------------------------------- help

  function help(main) {
    const P = App.program;
    const st = App.state;
    const p = P.prescription;
    main.appendChild(h('h1', { text: 'Help & Settings' }));

    main.appendChild(UI.card('Staying safe', 'caution',
      h('p', { text: P.safety.intro }),
      h('ul', { class: 'list' }, P.safety.points.map(function (t) { return h('li', { text: t }); }))));

    main.appendChild(UI.card('How the program works', '',
      h('ul', { class: 'list' },
        h('li', { text: 'Three strength workouts a week (Workout 1, 2 and 3, in turn), on days with a rest day in between. Walking on the other days.' }),
        h('li', { text: 'Each exercise: ' + p.sets + ' sets of ' + p.repsMin + ' to ' + p.repsMax + ' slow, controlled reps. Rest about 1½ minutes between sets.' }),
        h('li', { text: P.effort.summary }),
        h('li', { text: 'Stay at the same weight until you can do ' + p.repsMax + ' reps on both sets and it feels manageable. Then the app will ask if you would like to try a little more. You always decide.' }),
        h('li', { text: 'If you miss a day, just do the next workout on your next day. Nothing is lost.' }))));

    // -- lifting days
    const dayMsg = h('p', { class: 'message', role: 'status' });
    const order = [1, 2, 3, 4, 5, 6, 0];
    main.appendChild(h('fieldset', { class: 'card days' },
      h('legend', { text: 'My strength days' }),
      h('p', { class: 'muted', text: 'Choose 3 days with a rest day between them, like Monday, Wednesday and Friday.' }),
      order.map(function (d) {
        return h('label', { class: 'check' },
          h('input', {
            type: 'checkbox', value: String(d), checked: st.settings.liftDays.indexOf(d) !== -1,
            onchange: function (e) {
              const set = st.settings.liftDays.filter(function (x) { return x !== d; });
              if (e.target.checked) set.push(d);
              if (!set.length) {
                e.target.checked = true;
                UI.setMessage(dayMsg, 'Please keep at least one strength day.', true);
                return;
              }
              st.settings.liftDays = set.sort();
              App.persist();
              const names = order.filter(function (x) { return set.indexOf(x) !== -1; }).map(function (x) { return UI.DAYS[x]; }).join(', ');
              const backToBack = set.some(function (x) { return set.indexOf((x + 1) % 7) !== -1; });
              let note = '';
              if (backToBack) note = ' Two of these days are next to each other - it is best to rest a day between strength days.';
              else if (set.length !== P.schedule.defaultLiftDays.length) note = ' The program is planned for ' + P.schedule.defaultLiftDays.length + ' strength days a week.';
              UI.setMessage(dayMsg, 'Saved. Strength days: ' + names + '.' + note, !!note);
            },
          }),
          h('span', { text: UI.DAYS[d] }));
      }),
      dayMsg));

    // -- exercise choice
    Object.keys(P.choices).forEach(function (cid) {
      const c = P.choices[cid];
      const current = st.settings.choices[cid] || c.default;
      main.appendChild(h('fieldset', { class: 'card' },
        h('legend', { text: c.label }),
        c.options.map(function (id) {
          return h('label', { class: 'radio' },
            h('input', { type: 'radio', name: 'help-' + cid, value: id, checked: id === current,
              onchange: function () { st.settings.choices[cid] = id; App.persist(); } }),
            h('span', { text: P.exercises[id].choiceLabel || P.exercises[id].name }));
        })));
    });

    // -- saved information
    const fileMsg = h('p', { class: 'message', role: 'status', id: 'file-msg' });
    const loadConfirm = h('div');
    const fileInput = h('input', {
      type: 'file', accept: '.json,application/json', id: 'backup-file', class: 'visually-hidden',
      onchange: function () {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        fileInput.value = ''; // so choosing the same file again still works
        f.text().then(function (text) {
          const r = Store.importText(text, P);
          if (!r.ok) { UI.setMessage(fileMsg, r.error, true); return; }
          const n = r.state.sessions.length;
          const lastS = r.state.sessions[n - 1];
          UI.clear(loadConfirm).appendChild(h('div', { class: 'actions' },
            h('p', { class: 'confirm-q', text: 'This backup has ' + n + ' workout' + (n === 1 ? '' : 's') +
              (lastS ? ' (the last on ' + UI.shortDate(Logic.parseKey(lastS.date)) + ')' : '') +
              '. Loading it replaces everything saved on this device now. Load it?' }),
            UI.button('Yes, load the backup', function () {
              App.state = r.state;
              App.persist();
              App.render();
              UI.setMessage(document.getElementById('file-msg'), 'Backup loaded.');
            }, { kind: 'danger' }),
            UI.button('No, keep what I have', function () { UI.clear(loadConfirm); })));
          loadConfirm.querySelector('button').focus();
        }).catch(function () { UI.setMessage(fileMsg, 'That file could not be opened.', true); });
      },
    });
    main.appendChild(UI.card('Your saved information', '',
      h('p', { text: 'Your weights and steps are saved only in this browser, on this device. They do not appear on your other devices, and they would be lost if this browser’s data were cleared. Nothing is sent anywhere.' }),
      h('p', { text: 'To be safe, save a backup file now and then. You can load it on another device.' }),
      h('div', { class: 'actions' },
        UI.button('Save a backup file', function () {
          const blob = new Blob([JSON.stringify(App.state, null, 1)], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: 'exercise-backup-' + Logic.dateKey(App.now()) + '.json' });
          document.body.appendChild(a);
          a.click();
          a.remove();
          UI.setMessage(fileMsg, 'Backup file saved to your downloads.');
        }),
        fileInput,
        h('label', { for: 'backup-file', class: 'btn secondary' }, 'Load a backup file')),
      loadConfirm,
      fileMsg,
      h('p', { text: 'To fix a wrong weight, change it on the exercise screen next time, or remove the last entry on the Progress page.' }),
      confirmButton('Erase everything and start over', 'Yes, erase everything', function () {
        App.state = Store.emptyState(P);
        App.state.settings.safetyAcknowledged = true;
        App.persist();
        App.go('today');
      })));

    main.appendChild(UI.card('About the videos', '',
      h('p', { text: 'Each exercise links to a demonstration video on YouTube from a physical therapist, health organisation, equipment maker or qualified trainer. Videos need an internet connection. If a video will not play, use the "Open it on YouTube" link under it, or ask a staff member at the gym.' })));
  }

  window.Screens = { walk: walk, progress: progress, help: help };
})();
