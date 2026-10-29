/*
 * Reusable workout controls: big tap-button groups (reps, how it felt)
 * and the optional rest timer. Loaded as window.Controls.
 */
(function () {
  'use strict';

  const h = UI.h;
  let timer = null;
  let onTimerStop = null;

  /** Stop whichever rest timer is running and reset its button. */
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
    if (onTimerStop) { const f = onTimerStop; onTimerStop = null; f(); }
  }

  function pickerGroup(legend, options, isOn, onPick, extraClass) {
    const fs = h('fieldset', { class: 'picker ' + (extraClass || '') }, h('legend', { text: legend }));
    const row = h('div', { class: 'picker-row' });
    const buttons = options.map(function (o) {
      const b = h('button', {
        type: 'button', class: 'btn pick', 'aria-pressed': String(isOn(o.value)),
        onclick: function () {
          onPick(o.value);
          buttons.forEach(function (x, k) { x.setAttribute('aria-pressed', String(isOn(options[k].value))); });
          App.persist();
        },
      }, h('span', { class: 'pick-label', text: o.label }), o.help ? h('span', { class: 'pick-help', text: o.help }) : null);
      return b;
    });
    buttons.forEach(function (b) { row.appendChild(b); });
    fs.appendChild(row);
    return fs;
  }

  function restTimer(seconds) {
    const out = h('p', { class: 'timer-text', 'aria-live': 'off' });
    const done = h('p', { class: 'timer-done', role: 'status' });
    const idleLabel = 'Rest timer (optional, ' + fmt(seconds) + ')';
    let btn;
    function fmt(t) { return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
    function reset() {
      out.textContent = '';
      btn.lastChild.textContent = idleLabel;
    }
    btn = h('button', {
      type: 'button', class: 'btn secondary',
      onclick: function () {
        const mine = btn.lastChild.textContent !== idleLabel;
        stopTimer();
        if (mine) return; // it was running: this tap stops it
        // Count down from a clock time, not by ticks: a locked phone pauses
        // ticks but not the clock, so the time left stays right.
        const endAt = Date.now() + seconds * 1000;
        done.textContent = '';
        btn.lastChild.textContent = 'Stop the timer';
        onTimerStop = reset;
        function tick() {
          const left = Math.ceil((endAt - Date.now()) / 1000);
          if (left <= 0) {
            stopTimer();
            done.textContent = 'Rest time is up. Start your next set when you feel ready.';
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            return;
          }
          out.textContent = 'Resting: ' + fmt(left) + ' left';
        }
        tick();
        timer = setInterval(tick, 500);
      },
    }, h('span', { text: idleLabel }));
    return h('div', { class: 'timer' }, btn, out, done);
  }

  window.Controls = { pickerGroup: pickerGroup, restTimer: restTimer, stopTimer: stopTimer };
})();
