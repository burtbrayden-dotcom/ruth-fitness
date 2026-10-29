/*
 * Tiny DOM helpers. Everything is built with createElement/textContent -
 * no innerHTML anywhere, so text from saved data can never become markup.
 * Loaded as window.UI.
 */
(function (root) {
  'use strict';

  /**
   * h('button', {class: 'btn', onclick: fn, 'aria-pressed': 'true'}, 'Label', childNode)
   * Props starting with "on" become event listeners; class/text/value/
   * checked/disabled are set as properties; everything else as attributes.
   */
  function h(tag, props) {
    const el = document.createElement(tag);
    const p = props || {};
    Object.keys(p).forEach(function (k) {
      const v = p[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value' || k === 'checked' || k === 'disabled') el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(el, c); }); return; }
    el.appendChild(typeof child === 'string' || typeof child === 'number'
      ? document.createTextNode(String(child)) : child);
  }

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function button(label, onclick, opts) {
    const o = opts || {};
    return h('button', Object.assign({ type: 'button', class: 'btn ' + (o.kind || 'secondary'), onclick: onclick }, o.attrs || {}), label);
  }

  /** A titled box. kind: '' | 'caution' | 'good' | 'offer' | 'note' */
  function card(title, kind) {
    const body = Array.prototype.slice.call(arguments, 2);
    return h('section', { class: 'card ' + (kind || '') },
      title ? h('h2', { text: title }) : null,
      body);
  }

  /** Message area that screen readers announce when its text changes. */
  function liveMessage(id) {
    return h('p', { id: id, class: 'message', role: 'status', 'aria-live': 'polite' });
  }

  function setMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('error', !!isError);
    el.setAttribute('role', isError ? 'alert' : 'status');
  }

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  function longDate(d) {
    return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  function shortDate(d) {
    return DAYS[d.getDay()].slice(0, 3) + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  }

  function num(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  root.UI = {
    h: h, clear: clear, button: button, card: card,
    liveMessage: liveMessage, setMessage: setMessage,
    DAYS: DAYS, longDate: longDate, shortDate: shortDate, num: num,
  };
})(window);
