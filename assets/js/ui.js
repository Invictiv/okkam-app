// Мелкие помощники интерфейса: экранирование, тосты, модальные окна, даты.
import { icon } from './icons.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(text, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'err' ? 'alert' : 'check', 18)}<span>${esc(text)}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, kind === 'err' ? 5000 : 2800);
}

export function initials(name, email) {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
}

export function avatarColor(seed = '') {
  let x = 0;
  for (const ch of seed.split('@')[0]) x = (Math.imul(x, 31) + ch.charCodeAt(0)) >>> 0;
  const h = x % 360;
  return `linear-gradient(135deg, hsl(${h} 75% 52%), hsl(${(h + 40) % 360} 85% 62%))`;
}

const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
export function ago(iso) {
  if (!iso) return '—';
  const s = (new Date(iso) - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return 'только что';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}
export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * Модальное окно. body — HTML. onSubmit(form) может вернуть false, чтобы окно осталось открытым.
 * Возвращает { el, close }.
 */
export function modal({ title, body, submit = 'Сохранить', danger = false, wide = false, onSubmit, onOpen }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <form class="modal ${wide ? 'wide' : ''}" novalidate>
      <div class="modal-h"><h3>${esc(title)}</h3>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-close>${icon('x', 18)}</button></div>
      <div class="modal-b">${body}<div class="form-error" hidden></div></div>
      <div class="modal-f">
        <button type="button" class="btn" data-close>Отмена</button>
        ${onSubmit ? `<button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submit)}</button>` : ''}
      </div>
    </form>`;
  const form = bg.querySelector('form');
  const errBox = bg.querySelector('.form-error');
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  bg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onSubmit) return close();
    const btn = form.querySelector('[type=submit]');
    errBox.hidden = true;
    btn.disabled = true;
    try {
      const res = await onSubmit(form);
      if (res !== false) close();
    } catch (err) {
      errBox.textContent = err.message || String(err);
      errBox.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
  document.body.appendChild(bg);
  onOpen?.(form);
  setTimeout(() => form.querySelector('input:not([type=hidden]):not([type=checkbox]), select')?.focus(), 30);
  return { el: form, close };
}

export function confirmBox(title, text, okText = 'Удалить') {
  return new Promise((resolve) => {
    let ok = false;
    const m = modal({
      title, submit: okText, danger: true,
      body: `<p style="color:var(--text-2)">${esc(text)}</p>`,
      onSubmit: () => { ok = true; },
    });
    const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); resolve(ok); } });
    obs.observe(document.body, { childList: true });
  });
}

export function genPassword(len = 10) {
  const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(len));
  return [...r].map((x) => a[x % a.length]).join('');
}
