/*
 * The workout: overview + warm-up, then one exercise at a time, then a
 * summary. Progress is saved after every tap, so a refresh or a closed
 * tab never loses her place. Loaded as window.WorkoutScreen.
 */
(function () {
  'use strict';

  const h = UI.h;
  const stopTimer = Controls.stopTimer;

  function render(main) {
    stopTimer();
    const P = App.program;
    const a = App.state.active;
    if (!a) {
      main.appendChild(h('h1', { text: 'No workout open' }));
      main.appendChild(h('p', { class: 'lead', text: 'Start today’s workout from the Today page.' }));
      main.appendChild(h('div', { class: 'actions' }, UI.button('Go to Today', function () { App.go('today'); }, { kind: 'primary' })));
      return;
    }
    const w = P.workouts[a.workout];
    if (a.index < 0) renderOverview(main, a, w);
    else if (a.index >= w.items.length) renderFinish(main, a, w);
    else renderExercise(main, a, w, a.index);
  }

  function goTo(a, index) {
    a.index = index;
    App.persist();
    App.render({ focus: true });
  }

  // --------------------------------------------------------------- outline

  function statusText(a, i) {
    const res = a.results[i];
    if (i === a.index) return 'Now';
    if (res && res.status === 'done') return 'Done';
    if (res && res.status === 'skipped') return 'Skipped';
    return 'Coming up';
  }

  function outline(a, w) {
    const P = App.program;
    const done = Object.keys(a.results).filter(function (k) { return a.results[k].status; }).length;
    return h('details', { class: 'outline' },
      h('summary', { text: 'All exercises in this workout (' + done + ' of ' + w.items.length + ' finished)' }),
      h('ol', { class: 'outline-list' }, w.items.map(function (item, i) {
        const res = a.results[i];
        const id = res ? res.exerciseId : App.slotExercise(item);
        const status = statusText(a, i);
        return h('li', { class: 'status-' + status.toLowerCase().replace(' ', '-') },
          h('button', { type: 'button', class: 'link-btn', onclick: function () { goTo(a, i); } },
            P.exercises[id].name),
          h('span', { class: 'tag', text: status }));
      })));
  }

  // -------------------------------------------------------------- overview

  function renderOverview(main, a, w) {
    const P = App.program;
    const p = P.prescription;
    main.appendChild(h('h1', { text: w.title }));
    main.appendChild(h('p', { class: 'lead', text: w.items.length + ' exercises, about 40 minutes. Take your time.' }));
    main.appendChild(UI.card('How it works', '',
      h('ol', { class: 'list' },
        h('li', { text: 'Warm up first (below).' }),
        h('li', { text: 'The app shows one exercise at a time, with a video and the weight to use.' }),
        h('li', { text: 'Do ' + p.sets + ' sets of ' + p.repsMin + ' to ' + p.repsMax + ' slow, controlled repetitions ("reps"). Rest ' + Logic.restWords(p.restSeconds) + ' between sets - longer if you need it.' }),
        h('li', { text: 'Tap how many reps you did and how it felt, then tap Done. The app remembers it for next time.' })),
      h('p', { text: P.effort.summary })));
    main.appendChild(UI.card('Warm-up (' + P.warmup.minutes + ' minutes)', '',
      h('ol', { class: 'list' }, P.warmup.steps.map(function (t) { return h('li', { text: t }); }))));
    main.appendChild(UI.card(null, 'caution',
      h('p', {}, h('strong', { text: 'Stop right away ' }), 'if you feel pain, dizziness, chest discomfort, or anything unusual.'),
      h('p', { text: 'If chest pain, pressure or tightness, or severe shortness of breath does not go away within a few minutes of resting, call 911.' })));
    main.appendChild(h('div', { class: 'actions' },
      UI.button('I have warmed up - start the first exercise', function () { goTo(a, 0); }, { kind: 'primary' }),
      UI.button('Back to Today', function () { App.go('today'); })));
    main.appendChild(outline(a, w));
  }

  // -------------------------------------------------------------- exercise

  function todayRec(exId, a) {
    const P = App.program;
    const hist = (App.state.history[exId] || []).filter(function (e) { return e.date !== a.date; });
    return { rec: Logic.recommend(P.exercises[exId], hist, P), last: hist[hist.length - 1] || null };
  }

  function ensureResult(a, i, item) {
    const P = App.program;
    let res = a.results[i];
    // A slot keeps its exercise once started. Switching it happens only in
    // choicePicker (with a confirmation), so changing the choice under Help
    // mid-workout can never wipe a finished exercise.
    if (!res) {
      const want = App.slotExercise(item);
      const r = todayRec(want, a).rec;
      res = {
        exerciseId: want,
        weight: r.weight,
        reps: new Array(P.prescription.sets).fill(null),
        feel: null,
        status: null,
        offer: null,
        savedAs: null,
      };
      a.results[i] = res;
    }
    return res;
  }

  /** If she edits an exercise she already finished, keep history in step. */
  function resaveIfDone(res, a) {
    if (res.status !== 'done' || res.weight == null || !res.feel ||
        res.reps.some(function (r) { return r == null; })) return;
    if (res.savedAs) removeTodayEntry(res.savedAs, a.date);
    removeTodayEntry(res.exerciseId, a.date);
    Store.addHistory(App.state, res.exerciseId, { date: a.date, weight: res.weight, reps: res.reps.slice(), feel: res.feel });
    res.savedAs = res.exerciseId;
  }

  function removeTodayEntry(exId, date) {
    const list = App.state.history[exId];
    if (!list) return;
    App.state.history[exId] = list.filter(function (e) { return e.date !== date; });
    if (!App.state.history[exId].length) delete App.state.history[exId];
  }

  function renderExercise(main, a, w, i) {
    const P = App.program;
    const p = P.prescription;
    const item = w.items[i];
    const res = ensureResult(a, i, item);
    const ex = P.exercises[res.exerciseId];
    const info = todayRec(res.exerciseId, a);
    const rec = info.rec;
    const suffix = Logic.weightSuffix(ex);
    const isLast = i === w.items.length - 1;

    main.appendChild(h('p', { class: 'step', text: w.title + ' \u00b7 Exercise ' + (i + 1) + ' of ' + w.items.length }));
    main.appendChild(h('h1', { text: ex.name }));
    const paper = paperLine(ex);
    if (paper) main.appendChild(h('p', { class: 'muted', text: paper }));
    main.appendChild(h('p', { class: 'lead', text: ex.works }));

    if (typeof item !== 'string') main.appendChild(choicePicker(item, a, i, res));

    main.appendChild(videoBlock(ex));

    // -- what to do today
    const weightBox = weightControl(ex, res, suffix, a);
    const today = UI.card('Today', 'today-card',
      h('p', { class: 'big', text: p.sets + ' sets of ' + p.repsMin + ' to ' + p.repsMax + ' reps' + (ex.perSide ? ' with each ' + (ex.sideWord || 'side') : '') + '.' }),
      h('p', { text: 'Rest ' + Logic.restWords(p.restSeconds) + ' between sets.' }),
      info.last ? h('p', {}, h('strong', { text: 'Last time: ' }), Logic.describeEntry(info.last, ex, P) + '.') : null,
      h('p', { text: rec.reason }),
      offerBox(rec, res, suffix, weightBox),
      weightBox.el);
    main.appendChild(today);

    main.appendChild(UI.card('Getting set up', '', h('p', { text: ex.equipmentText + '.' }), h('p', { text: ex.setup })));
    main.appendChild(UI.card('How to do it', '',
      h('ul', { class: 'list' }, ex.cues.map(function (c) { return h('li', { text: c }); })),
      h('details', {}, h('summary', { text: 'Easier option' }), h('p', { text: ex.easier }))));
    if (ex.caution) main.appendChild(UI.card('Take care', 'caution', h('p', { text: ex.caution })));

    // -- record the sets
    const record = UI.card('After each set', 'record');
    for (let s = 0; s < p.sets; s++) {
      record.appendChild(repsPicker(res, s, ex, a));
      if (s < p.sets - 1) record.appendChild(Controls.restTimer(p.restSeconds));
    }
    record.appendChild(feelPicker(res, a));
    main.appendChild(record);

    main.appendChild(h('p', { class: 'stop-line', text: 'Stop if you feel pain, dizziness, or anything unusual. It is fine to skip an exercise.' }));

    const msg = UI.liveMessage('exercise-msg');
    main.appendChild(msg);
    main.appendChild(h('div', { class: 'actions' },
      UI.button(isLast ? 'Done - finish workout' : 'Done - next exercise', function () {
        const wv = Logic.parseWeight(weightBox.input.value);
        const missing = [];
        let first = null;
        if (!wv.ok) { missing.push('type the weight you used (0 if you used no weight)'); first = weightBox.input; }
        const pickers = main.querySelectorAll('fieldset.reps');
        res.reps.forEach(function (r, s) {
          if (r != null) return;
          missing.push('tap how many reps in set ' + (s + 1));
          first = first || pickers[s].querySelector('button');
        });
        if (!res.feel) { missing.push('tap how it felt'); first = first || main.querySelector('fieldset.feel button'); }
        if (missing.length) {
          const list = missing.length > 1
            ? missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1] : missing[0];
          UI.setMessage(msg, 'Almost there - please ' + list + '. Or tap "Skip this one today".', true);
          first.scrollIntoView({ block: 'center' });
          first.focus({ preventScroll: true });
          return;
        }
        res.weight = wv.value;
        if (res.savedAs && res.savedAs !== res.exerciseId) removeTodayEntry(res.savedAs, a.date);
        removeTodayEntry(res.exerciseId, a.date);
        Store.addHistory(App.state, res.exerciseId, { date: a.date, weight: res.weight, reps: res.reps.slice(), feel: res.feel });
        res.savedAs = res.exerciseId;
        res.status = 'done';
        goTo(a, i + 1);
      }, { kind: 'primary' }),
      UI.button('Skip this one today', function () {
        if (res.savedAs) removeTodayEntry(res.savedAs, a.date);
        res.savedAs = null;
        res.status = 'skipped';
        goTo(a, i + 1);
      }),
      UI.button(i === 0 ? '← Back to warm-up' : '← Back to previous exercise', function () { goTo(a, i - 1); })));
    main.appendChild(outline(a, w));
  }

  function choicePicker(item, a, i, res) {
    const P = App.program;
    const c = P.choices[item.choice];
    const confirmArea = h('div');
    function switchTo(id) {
      if (res.savedAs) removeTodayEntry(res.savedAs, a.date);
      delete a.results[i];
      App.state.settings.choices[item.choice] = id;
      App.persist();
      App.render();
    }
    // Checked at tap time - she may have tapped sets since the screen was drawn.
    function hasData() { return res.feel || res.savedAs || res.reps.some(function (r) { return r != null; }); }
    const radios = c.options.map(function (id) {
      return h('input', {
        type: 'radio', name: 'choice-' + item.choice, value: id, checked: id === res.exerciseId,
        onchange: function () {
          if (!hasData()) { switchTo(id); return; }
          // She has already recorded something: ask first, in place.
          radios.forEach(function (r) { r.checked = r.value === res.exerciseId; });
          UI.clear(confirmArea).appendChild(h('div', { class: 'actions' },
            h('p', { class: 'confirm-q', text: 'Switching clears what you recorded for ' + P.exercises[res.exerciseId].name + ' today. Switch anyway?' }),
            UI.button('Yes, switch', function () { switchTo(id); }, { kind: 'danger' }),
            UI.button('No, keep it', function () { UI.clear(confirmArea); })));
          confirmArea.querySelector('button').focus();
        },
      });
    });
    return h('fieldset', { class: 'choice' },
      h('legend', { text: 'Choose your ' + c.label.toLowerCase() }),
      c.options.map(function (id, k) {
        return h('label', { class: 'radio' }, radios[k],
          h('span', { text: P.exercises[id].choiceLabel || P.exercises[id].name }));
      }),
      confirmArea,
      h('p', { class: 'muted', text: 'The app remembers your choice for next time. You can change it whenever you like.' }));
  }

  /** "On your paper: ..." when the app's name differs, or the substitution note. */
  function paperLine(ex) {
    if (ex.paperNote) return ex.paperNote;
    if (!ex.paperName) return null;
    const paper = ex.paperName.replace(/\s*\([^)]*\)\s*$/, '');
    return ex.name.toLowerCase().indexOf(paper.toLowerCase()) === -1 ? 'On your paper: "' + paper + '"' : null;
  }

  function videoBlock(ex) {
    const v = ex.video;
    if (!v) {
      return UI.card('Video', 'note', h('p', { text: 'A video for this exercise has not been added yet. Ask a staff member at the gym to show you how to use this machine.' }));
    }
    const holder = h('div', { class: 'video-holder', hidden: true });
    const btn = h('button', {
      type: 'button', class: 'btn video-btn', 'aria-expanded': 'false',
      onclick: function () {
        const open = holder.hidden;
        holder.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        btn.lastChild.textContent = open ? 'Hide the video' : 'Watch how to do it (video)';
        if (open && !holder.firstChild) {
          holder.appendChild(h('iframe', {
            src: 'https://www.youtube-nocookie.com/embed/' + v.id + '?rel=0',
            title: 'Video: how to do the ' + ex.name,
            allow: 'encrypted-media; picture-in-picture; fullscreen',
            allowfullscreen: true,
            referrerpolicy: 'strict-origin-when-cross-origin',
            loading: 'lazy',
          }));
        }
      },
    }, h('span', { class: 'play', 'aria-hidden': 'true', text: '▶' }), h('span', { text: 'Watch how to do it (video)' }));
    return h('section', { class: 'card video' },
      btn,
      holder,
      h('p', { class: 'muted' },
        'Video: “' + v.title + '” by ' + v.channel + '. ',
        h('a', { href: 'https://www.youtube.com/watch?v=' + v.id, target: '_blank', rel: 'noopener' }, 'Open it on YouTube instead'),
        '.'),
      v.note ? h('p', { class: 'video-note', text: v.note }) : null);
  }

  function weightControl(ex, res, suffix, a) {
    const P = App.program;
    const id = 'weight-input';
    const err = h('p', { class: 'field-error', id: 'weight-error', 'aria-live': 'polite' });
    const input = h('input', {
      id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'weight-input',
      value: res.weight == null ? '' : String(res.weight),
      placeholder: 'e.g. 10',
      'aria-describedby': 'weight-error',
      onchange: function () {
        const v = Logic.parseWeight(input.value);
        err.textContent = v.ok ? '' : v.error;
        input.setAttribute('aria-invalid', v.ok ? 'false' : 'true');
        if (v.ok) { res.weight = v.value; resaveIfDone(res, a); App.persist(); }
      },
    });
    function set(v) {
      if (v == null) return;
      res.weight = v;
      input.value = String(v);
      err.textContent = '';
      input.setAttribute('aria-invalid', 'false');
      resaveIfDone(res, a);
      App.persist();
    }
    function current() {
      const v = Logic.parseWeight(input.value);
      return v.ok ? v.value : null;
    }
    const el = h('div', { class: 'weight' },
      h('label', { for: id, text: ex.pair ? 'Weight of each dumbbell (lb)'
        : 'Weight to use today (lb' + (ex.perSide ? ', each ' + (ex.sideWord || 'side') : '') + ')' }),
      h('div', { class: 'weight-row' },
        UI.button('− Lighter', function () {
          const c = current();
          if (c == null || c === 0) return;
          set(Logic.lighter(ex, c, P) || 0);
        }, { attrs: { 'aria-label': 'Make the weight lighter' } }),
        input,
        UI.button('+ Heavier', function () {
          const c = current();
          set(c == null ? (ex.equipment === 'dumbbell' ? P.dumbbellLadder[0] : ex.increment) : Logic.heavier(ex, c, P));
        }, { attrs: { 'aria-label': 'Make the weight heavier' } })),
      err,
      h('p', { class: 'muted', text: ex.equipment === 'dumbbell'
        ? 'Lighter / Heavier move to the next dumbbell size. You can also type the number.'
        : 'Type the number shown on the machine. Lighter / Heavier change it by ' + ex.increment + ' lb.' }));
    return { el: el, input: input, set: set };
  }

  function offerBox(rec, res, suffix, weightBox) {
    if (rec.action !== 'offer-up' && rec.action !== 'offer-down') return null;
    const up = rec.action === 'offer-up';
    const box = h('div', { class: 'offer', role: 'group', 'aria-label': up ? 'Suggested increase' : 'Suggested decrease' });
    function draw() {
      UI.clear(box);
      if (res.offer === 'yes') {
        box.appendChild(h('p', { text: '\u2713 Using ' + Logic.formatWeight(rec.offer) + suffix + ' today. You can still change the weight below.' }));
        return;
      }
      if (res.offer === 'no') {
        box.appendChild(h('p', { text: 'Staying at ' + Logic.formatWeight(rec.weight) + ' today. That is perfectly fine.' }));
        return;
      }
      box.appendChild(h('p', { class: 'big', text: up
        ? 'Ready for a little more? Suggested: ' + Logic.formatWeight(rec.offer) + '.'
        : 'Would a little lighter feel better? Suggested: ' + Logic.formatWeight(rec.offer) + '.' }));
      box.appendChild(h('div', { class: 'actions' },
        UI.button('Yes, use ' + Logic.formatWeight(rec.offer), function () {
          res.offer = 'yes';
          weightBox.set(rec.offer);
          draw();
        }, { kind: 'primary' }),
        UI.button('No, keep ' + Logic.formatWeight(rec.weight), function () {
          res.offer = 'no';
          weightBox.set(rec.weight);
          draw();
        })));
    }
    draw();
    return box;
  }

  function repsPicker(res, s, ex, a) {
    const p = App.program.prescription;
    const opts = [{ value: p.repsMin - 1, label: 'Under ' + p.repsMin }];
    for (let r = p.repsMin; r <= p.repsMax; r++) opts.push({ value: r, label: String(r) });
    opts.push({ value: p.repsMax + 1, label: 'More than ' + p.repsMax });
    return Controls.pickerGroup('Set ' + (s + 1) + ': how many reps did you do' + (ex.perSide ? ' (each ' + (ex.sideWord || 'side') + ')' : '') + '?', opts,
      function (v) { return res.reps[s] === v; },
      function (v) { res.reps[s] = v; resaveIfDone(res, a); }, 'reps');
  }

  function feelPicker(res, a) {
    const f = App.program.effort.feel;
    const opts = ['easy', 'right', 'hard'].map(function (k) { return { value: k, label: f[k].label, help: f[k].help }; });
    return Controls.pickerGroup('After both sets: how did it feel?', opts,
      function (v) { return res.feel === v; },
      function (v) { res.feel = v; resaveIfDone(res, a); }, 'feel');
  }

  // ---------------------------------------------------------------- finish

  function renderFinish(main, a, w) {
    const P = App.program;
    main.appendChild(h('h1', { text: 'Last step: save your workout' }));
    main.appendChild(h('p', { class: 'lead', text: 'Here is what you did today.' }));
    const rows = w.items.map(function (item, i) {
      const res = a.results[i];
      const id = res ? res.exerciseId : App.slotExercise(item);
      const ex = P.exercises[id];
      let text = 'Not done';
      if (res && res.status === 'done') {
        text = Logic.describeEntry({ weight: res.weight, reps: res.reps, feel: res.feel }, ex, P);
      } else if (res && res.status === 'skipped') text = 'Skipped today';
      return h('li', {}, h('strong', { text: ex.name + ': ' }), text);
    });
    main.appendChild(UI.card('Today\u2019s workout', '', h('ul', { class: 'list' }, rows)));
    const anyDone = w.items.some(function (item, i) { return a.results[i] && a.results[i].status === 'done'; });
    if (!anyDone) {
      main.appendChild(h('p', { text: 'You did not record any exercises today, so nothing will be saved - and that is fine. ' + w.title + ' will be ready for your next strength day.' }));
    }
    main.appendChild(h('div', { class: 'actions' },
      UI.button(anyDone ? 'Save and finish' : 'Close this workout', function () {
        if (!anyDone) {
          App.state.active = null;
          App.persist();
          App.go('today');
          return;
        }
        const done = [];
        const skipped = [];
        w.items.forEach(function (item, i) {
          const res = a.results[i];
          if (res && res.status === 'done') done.push(res.exerciseId);
          else skipped.push(res ? res.exerciseId : App.slotExercise(item));
        });
        App.state.sessions = App.state.sessions.filter(function (s) { return s.date !== a.date; });
        App.state.sessions.push({ date: a.date, workout: a.workout, done: done, skipped: skipped });
        App.state.active = null;
        App.persist();
        App.go('today');
      }, { kind: 'primary' }),
      UI.button('← Back to the last exercise', function () { goTo(a, w.items.length - 1); })));
    main.appendChild(h('p', { class: 'muted', text: 'Your weights are already saved. Next time, the app will suggest what to do for each exercise.' }));
  }

  window.WorkoutScreen = { render: render, stopTimer: stopTimer };
})();
