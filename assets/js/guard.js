/*
 * OKKAM guard — подключается в <head> каждой страницы модуля сразу после config.js:
 *   <script src="../assets/js/config.js"></script>
 *   <script src="../assets/js/guard.js"></script>
 *
 * Страница скрыта, пока сервер не подтвердит, что у пользователя есть доступ к модулю
 * (функция can_access в Supabase). Без входа — переход на форму входа дашборда.
 * Код модуля определяется по имени папки; можно задать явно: <script ... data-module="hd">.
 */
(function () {
  'use strict';
  var KEY = 'okkam-auth';
  var cfg = window.OKKAM_CONFIG || {};
  var script = document.currentScript;
  var root = new URL('../../', script.src);                 // корень сайта (где index.html дашборда)
  var dash = cfg.dashboardUrl ? new URL(cfg.dashboardUrl) : root;
  var inFrame = window.self !== window.top;

  var slug = script.getAttribute('data-module') ||
    decodeURIComponent((location.pathname.slice(root.pathname.length).split('/')[0]) || '');

  // Внутри дашборда (тот же домен) список доступных модулей уже получен с сервера —
  // показываем модуль сразу, без лишнего запроса.
  if (inFrame) {
    try {
      var acc = window.parent.OKKAM_ACCESS;
      if (acc && acc.slugs && acc.slugs.indexOf(slug) !== -1) { tidy(); return; }
    } catch (e) { /* родитель с другого домена — проверяем как обычно */ }
  }

  var hide = document.createElement('style');
  hide.textContent = 'html{visibility:hidden!important}' +
    '#okkam-guard-wait{visibility:visible!important;position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
    'background:#f3f4f8;color:#8f95a8;font:500 14px -apple-system,Segoe UI,Roboto,sans-serif}';
  document.head.appendChild(hide);
  var wait = document.createElement('div');
  wait.id = 'okkam-guard-wait';
  wait.textContent = 'Проверка доступа…';
  document.documentElement.appendChild(wait);

  function reveal() {
    hide.remove();
    wait.remove();
    tidy();
  }

  // Кнопки «Назад» в старых модулях ведут на okkam.space — внутри дашборда прячем,
  // при прямом открытии ведём на дашборд.
  function tidy() {
    var run = function () {
      var links = document.querySelectorAll('a.back-btn, a[href="http://okkam.space"], a[href="https://okkam.space/"], a[href="http://okkam.space/"]');
      for (var i = 0; i < links.length; i++) {
        if (inFrame) links[i].style.display = 'none';
        else links[i].href = dash.href;
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }

  function toLogin() {
    var target = dash.href.split('#')[0] + '#/login?next=' + encodeURIComponent(location.href);
    if (inFrame) { try { window.top.location.href = dash.href.split('#')[0] + '#/login'; return; } catch (e) {} }
    location.replace(target);
  }

  function screen(title, text, withRetry) {
    var draw = function () {
      hide.remove();
      wait.remove();
      document.documentElement.style.background = '#f3f4f8';
      document.body.innerHTML =
        '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;min-height:100vh;display:grid;place-items:center;background:#f3f4f8;color:#171a26;padding:20px">' +
        '<div style="max-width:420px;text-align:center;background:#fff;border-radius:20px;padding:36px 30px;box-shadow:0 18px 50px rgba(16,20,40,.12)">' +
        '<div style="width:64px;height:64px;margin:0 auto 18px;border-radius:18px;display:grid;place-items:center;background:rgba(255,111,50,.12);color:#ff6f32">' +
        '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>' +
        '<h2 style="font-size:22px;margin:0 0 8px">' + title + '</h2>' +
        '<p style="color:#5d6377;margin:0 0 22px;line-height:1.5">' + text + '</p>' +
        (withRetry ? '<button onclick="location.reload()" style="height:42px;padding:0 18px;border-radius:10px;border:1px solid #ddd;background:#fff;font-weight:600;cursor:pointer;margin-right:8px">Повторить</button>' : '') +
        '<a href="' + dash.href + '" target="_top" style="display:inline-flex;align-items:center;height:42px;padding:0 18px;border-radius:10px;background:linear-gradient(135deg,#e85a1e,#ff6f32);color:#fff;font-weight:600;text-decoration:none">На главную</a>' +
        '</div></div>';
    };
    if (document.body) draw(); else document.addEventListener('DOMContentLoaded', draw);
  }

  // Модуль открыт с другого сервера (например okkam.space) внутри дашборда:
  // сессия хранится на домене дашборда, поэтому здесь доверяем рамке дашборда.
  if (location.origin !== dash.origin) {
    var anc = location.ancestorOrigins;
    if (inFrame && anc && anc.length && anc[anc.length - 1] === dash.origin) return reveal();
    if (cfg.dashboardUrl) { location.replace(dash.href.split('#')[0] + '#/m/' + encodeURIComponent(slug)); return; }
  }

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    return screen('Доступ не настроен', 'Не заполнен assets/js/config.js — вход в систему недоступен.');
  }

  var session;
  try { session = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { session = null; }
  if (!session || !session.access_token) return toLogin();

  // Короткий кэш, чтобы обновление страницы не ждало сервер
  var cacheKey = 'okkam-guard:' + slug;
  try {
    var c = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (c && c.u === session.user.id && Date.now() - c.t < 5 * 60e3 && session.expires_at * 1000 > Date.now()) reveal();
  } catch (e) {}

  function refresh() {
    return fetch(cfg.supabaseUrl + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }).then(function (r) {
      if (!r.ok) throw { auth: true };
      return r.json();
    }).then(function (s) {
      if (!s.expires_at) s.expires_at = Math.floor(Date.now() / 1000) + (s.expires_in || 3600);
      localStorage.setItem(KEY, JSON.stringify(s));
      session = s;
    });
  }

  function check() {
    return fetch(cfg.supabaseUrl + '/rest/v1/rpc/can_access', {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseAnonKey,
        Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ module: slug }),
    }).then(function (r) {
      if (r.status === 401) throw { auth: true };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  var expired = !session.expires_at || session.expires_at * 1000 < Date.now() + 30e3;
  (expired ? refresh() : Promise.resolve())
    .then(check)
    .then(function (ok) {
      if (ok === true) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ u: session.user.id, t: Date.now() })); } catch (e) {}
        reveal();
      } else {
        try { sessionStorage.removeItem(cacheKey); } catch (e) {}
        screen('Нет доступа', 'У вашей учётной записи нет доступа к этому разделу. Обратитесь к администратору.');
      }
    })
    .catch(function (err) {
      try { sessionStorage.removeItem(cacheKey); } catch (e) {}
      if (err && err.auth) { localStorage.removeItem(KEY); return toLogin(); }
      screen('Нет связи', 'Не удалось проверить доступ. Проверьте подключение к интернету.', true);
    });
})();
