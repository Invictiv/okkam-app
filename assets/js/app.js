// OKKAM Dashboard — вход, навигация, рабочие модули.
import { sb, configured, signIn, signOut, getSession, loadMe, setMe, logEvent, emailToLogin, humanError, updateMyName, changeMyPassword } from './api.js';
import { icon } from './icons.js';
import { esc, $, $$, toast, initials, avatarColor, modal, ago } from './ui.js';
import { renderAdmin } from './admin.js';

const app = document.getElementById('app');
const desktop = window.okkamDesktop || null;

export const state = {
  session: null,
  profile: null,
  modules: [],
  isAdmin: false,
  filter: '',
  category: 'Все',
};

// ---------- Избранное и недавние (локально, на этом устройстве) ----------
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const favKey = () => `okkam-fav-${state.profile?.id}`;
const recentKey = () => `okkam-recent-${state.profile?.id}`;
const favs = () => store.get(favKey(), []);
const recents = () => store.get(recentKey(), []);
function toggleFav(slug) {
  const f = favs();
  store.set(favKey(), f.includes(slug) ? f.filter((s) => s !== slug) : [...f, slug]);
}
function pushRecent(slug) {
  store.set(recentKey(), [slug, ...recents().filter((s) => s !== slug)].slice(0, 6));
}

// ---------- Тема ----------
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('okkam-theme', next); } catch {}
  desktop?.setTheme?.(next);
  $('#themeBtn') && ($('#themeBtn').innerHTML = icon(next === 'dark' ? 'sun' : 'moon', 18));
}

// ---------- URL модуля ----------
export function moduleUrl(m) {
  if (m.url) return m.url;
  return new URL(`${encodeURIComponent(m.slug)}/`, location.href.split('#')[0]).href;
}
const isExternal = (m) => {
  try { return new URL(moduleUrl(m)).origin !== location.origin; } catch { return false; }
};

// =====================================================================
//  Вход
// =====================================================================
function renderLogin(errorText = '') {
  const next = new URLSearchParams(location.hash.split('?')[1] || '').get('next');
  app.innerHTML = `
  <div class="login">
    ${desktop ? '<div class="desktop-drag"></div>' : ''}
    <section class="login-hero">
      <div class="grid-bg"></div>
      <img class="logo" src="assets/img/logo.svg" alt="OKKAM">
      <div>
        <h1>Все складские инструменты — в одном месте</h1>
        <p>Маркировка, инвентаризация, реестры и отчёты. Доступ к каждому модулю настраивает администратор.</p>
        <div class="hero-chips">
          <span>${icon('shield', 16)} Защищённый вход</span>
          <span>${icon('layers', 16)} ${'20+'} модулей</span>
          <span>${icon('monitor', 16)} Веб и ПК</span>
        </div>
      </div>
      <small>© ${new Date().getFullYear()} OKKAM</small>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <img class="logo-sm" src="assets/img/logo.svg" alt="OKKAM">
        <h2>Вход в систему</h2>
        <p class="sub">Введите логин и пароль, выданные администратором</p>
        ${configured ? `
        <form id="loginForm" autocomplete="on">
          <div class="field"><label for="lg">Логин или e-mail</label>
            <div class="input-wrap">${icon('user', 18)}<input class="input" id="lg" name="login" autocomplete="username" required placeholder="ivanov"></div></div>
          <div class="field"><label for="pw">Пароль</label>
            <div class="input-wrap">${icon('lock', 18)}<input class="input" id="pw" name="password" type="password" autocomplete="current-password" required placeholder="••••••••">
              <button type="button" class="btn btn-ghost btn-icon btn-sm input-action" id="pwEye" title="Показать пароль">${icon('eye', 18)}</button></div></div>
          <div class="form-error" id="loginErr" ${errorText ? '' : 'hidden'}>${icon('alert', 18)}<span>${esc(errorText)}</span></div>
          <button class="btn btn-primary" type="submit" id="loginBtn">Войти ${icon('arrowRight', 18)}</button>
        </form>` : `
        <div class="setup-note">
          <b>Подключение не настроено.</b><br>
          Укажите адрес и anon-ключ Supabase в <code>assets/js/config.js</code>
          (или в переменных репозитория <code>SUPABASE_URL</code> и <code>SUPABASE_ANON_KEY</code>). Подробно — в README.
        </div>`}
        <div class="login-foot">
          <span>${desktop ? `Приложение v${esc(desktop.version)}` : 'Веб-версия'}</span>
          <button class="btn btn-ghost btn-sm" id="themeBtn" title="Тема">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18)}</button>
        </div>
      </div>
    </section>
  </div>`;
  $('#themeBtn').onclick = toggleTheme;
  if (!configured) return;
  const pw = $('#pw');
  $('#pwEye').onclick = () => {
    pw.type = pw.type === 'password' ? 'text' : 'password';
    $('#pwEye').innerHTML = icon(pw.type === 'password' ? 'eye' : 'eyeOff', 18);
  };
  const last = store.get('okkam-last-login', '');
  if (last) { $('#lg').value = last; setTimeout(() => pw.focus(), 50); } else setTimeout(() => $('#lg').focus(), 50);

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn');
    const login = $('#lg').value.trim();
    if (!login || !pw.value) return showLoginError('Введите логин и пароль');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Входим…';
    try {
      const session = await signIn(login, pw.value);
      store.set('okkam-last-login', login);
      await enter(session, true);
      if (next && safeNext(next)) location.replace(next);
    } catch (err) {
      showLoginError(humanError(err));
      btn.disabled = false;
      btn.innerHTML = `Войти ${icon('arrowRight', 18)}`;
    }
  };
}
function showLoginError(text) {
  const box = $('#loginErr');
  if (!box) return renderLogin(text);
  box.hidden = false;
  box.querySelector('span').textContent = text;
  box.style.animation = 'none'; box.offsetHeight; box.style.animation = '';
}

function safeNext(u) {
  try { const x = new URL(u, location.href); return x.origin === location.origin && x.href !== location.href ? x.href : null; }
  catch { return null; }
}

async function enter(session, fresh = false) {
  state.session = session;
  const me = await loadMe(session.user.id);
  if (!me.profile.is_active) {
    await sb.auth.signOut();
    throw new Error('Учётная запись заблокирована. Обратитесь к администратору');
  }
  Object.assign(state, me);
  shareAccess();
  setMe(me.profile);
  if (fresh) logEvent('login', desktop ? 'desktop' : 'web', { ua: navigator.userAgent.slice(0, 160) }).catch(() => {});
  renderShell();
  route();
}

// =====================================================================
//  Каркас: боковое меню + верхняя панель
// =====================================================================
function renderShell() {
  const p = state.profile;
  const name = p.full_name || emailToLogin(p.email);
  app.innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="sb-head"><a href="#/"><img src="assets/img/logo.svg" alt="OKKAM"></a></div>
      <nav class="sb-nav" id="sbNav"></nav>
      <div class="sb-foot">
        <div class="user-chip">
          <div class="avatar" style="background:${avatarColor(p.email)}">${esc(initials(p.full_name, p.email))}</div>
          <div class="meta"><div class="name">${esc(name)}</div><div class="role">${esc(p.role?.name || 'Без роли')}</div></div>
          <a class="btn btn-ghost btn-icon btn-sm" href="#/profile" title="Профиль">${icon('user', 18)}</a>
          <button class="btn btn-ghost btn-icon btn-sm" id="logoutBtn" title="Выйти">${icon('logout', 18)}</button>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon menu-toggle" id="menuBtn">${icon('menu', 20)}</button>
        <div class="crumbs" id="crumbs"></div>
        <div class="spacer"></div>
        <div class="input-wrap search">${icon('search', 18)}<input class="input" id="search" placeholder="Поиск модулей…" autocomplete="off"><span class="kbd">Ctrl K</span></div>
        <button class="btn btn-ghost btn-icon" id="themeBtn" title="Сменить тему">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18)}</button>
      </header>
      <main class="content" id="content"></main>
    </div>
  </div>`;
  $('#themeBtn').onclick = toggleTheme;
  $('#logoutBtn').onclick = async () => { await signOut(); location.hash = '#/login'; };
  $('#menuBtn').onclick = () => openSidebar(true);
  const search = $('#search');
  search.oninput = () => {
    state.filter = search.value;
    if (!/^#\/?$/.test(location.hash)) location.hash = '#/';
    else renderHome();
  };
  document.onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.focus(); search.select(); }
  };
  renderNav();
}

function openSidebar(open) {
  $('#sidebar')?.classList.toggle('open', open);
  $('.scrim')?.remove();
  if (open) {
    const s = document.createElement('div');
    s.className = 'scrim';
    s.onclick = () => openSidebar(false);
    document.body.appendChild(s);
  }
}

function renderNav() {
  const h = location.hash || '#/';
  const link = (href, ic, text, extra = '') =>
    `<a class="sb-link ${h === href || (href.startsWith('#/m/') && h.startsWith(href + '?')) ? 'active' : ''}" href="${href}">${icon(ic, 19)}<span class="t">${esc(text)}</span>${extra}</a>`;
  const groups = {};
  for (const m of state.modules) (groups[m.category || 'Общее'] ||= []).push(m);
  let html = link('#/', 'home', 'Главная');
  for (const [cat, list] of Object.entries(groups)) {
    html += `<div class="sb-section">${esc(cat)}</div>`;
    html += list.map((m) => link(`#/m/${encodeURIComponent(m.slug)}`, m.icon, m.title,
      !m.in_menu ? `<span title="Скрытый модуль">${icon('hidden', 14, 'hint')}</span>` : '')).join('');
  }
  if (state.isAdmin) {
    html += `<div class="sb-section">Администрирование</div>`;
    html += link('#/admin', 'activity', 'Обзор');
    html += link('#/admin/users', 'users', 'Пользователи');
    html += link('#/admin/roles', 'shield', 'Роли и доступ');
    html += link('#/admin/modules', 'layers', 'Модули');
    html += link('#/admin/audit', 'clock', 'Журнал');
  }
  $('#sbNav').innerHTML = html;
  $$('#sbNav a').forEach((a) => a.addEventListener('click', () => openSidebar(false)));
  $('.sb-link.active')?.scrollIntoView({ block: 'nearest' });
}

export function setCrumbs(html) { $('#crumbs').innerHTML = html; }
export function content(flush = false) {
  const c = $('#content');
  c.classList.toggle('flush', flush);
  return c;
}

// =====================================================================
//  Главная
// =====================================================================
function cardHtml(m, i) {
  const fav = favs().includes(m.slug);
  return `
  <div class="card" data-slug="${esc(m.slug)}" style="animation-delay:${Math.min(i, 12) * 30}ms" tabindex="0">
    <span class="go">${icon('arrowRight', 18)}</span>
    <div class="ib">${icon(m.icon, 24)}</div>
    <div><h4>${esc(m.title)}</h4><p>${esc(m.description || '')}</p></div>
    <div class="foot">
      <span class="badge">${esc(m.category || 'Общее')}</span>
      ${!m.in_menu ? `<span class="badge badge-warn">${icon('hidden', 12)} скрытый</span>` : ''}
      ${!m.enabled ? `<span class="badge badge-danger">выключен</span>` : ''}
      ${isExternal(m) ? `<span class="badge" title="${esc(moduleUrl(m))}">${icon('server', 12)} сервер</span>` : ''}
    </div>
    <button class="fav ${fav ? 'on' : ''}" data-fav="${esc(m.slug)}" title="${fav ? 'Убрать из избранного' : 'В избранное'}">${icon('star', 18)}</button>
  </div>`;
}

function bindCards(root) {
  $$('.card', root).forEach((c) => {
    const open = () => (location.hash = `#/m/${encodeURIComponent(c.dataset.slug)}`);
    c.addEventListener('click', (e) => { if (!e.target.closest('[data-fav]')) open(); });
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
  $$('[data-fav]', root).forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); toggleFav(b.dataset.fav); renderHome();
  }));
}

function renderHome() {
  setCrumbs('Главная');
  const p = state.profile;
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const q = state.filter.trim().toLowerCase();
  const all = state.modules.filter((m) => !q || `${m.title} ${m.description} ${m.slug} ${m.category}`.toLowerCase().includes(q));
  const cats = ['Все', ...new Set(state.modules.map((m) => m.category || 'Общее'))];
  if (!cats.includes(state.category)) state.category = 'Все';
  const inCat = all.filter((m) => state.category === 'Все' || (m.category || 'Общее') === state.category);
  const main = inCat.filter((m) => m.in_menu);
  const hidden = inCat.filter((m) => !m.in_menu);
  const favList = favs().map((s) => state.modules.find((m) => m.slug === s)).filter(Boolean);
  const recentList = recents().map((s) => state.modules.find((m) => m.slug === s)).filter(Boolean);

  let i = 0;
  const grid = (list) => `<div class="cards">${list.map((m) => cardHtml(m, i++)).join('')}</div>`;
  const c = content();
  c.innerHTML = `
  <div class="page">
    ${q ? '' : `
    <div class="welcome">
      <div style="position:relative;z-index:1">
        <h1>${hello}, ${esc((p.full_name || emailToLogin(p.email)).split(' ')[0])}!</h1>
        <p>${state.modules.length ? 'Выберите инструмент, чтобы начать работу.' : 'Вам пока не выдан доступ ни к одному модулю. Обратитесь к администратору.'}</p>
      </div>
      <div class="stats">
        <div class="stat"><b>${state.modules.length}</b><small>доступно модулей</small></div>
        <div class="stat"><b>${favList.length}</b><small>в избранном</small></div>
      </div>
    </div>
    ${favList.length ? `<div class="section-head"><h3>Избранное</h3></div>${grid(favList)}` : ''}
    ${recentList.length ? `<div class="section-head"><h3>Недавние</h3></div>${grid(recentList.slice(0, 4))}` : ''}
    `}
    <div class="section-head">
      <h3>${q ? `Результаты поиска «${esc(state.filter)}»` : 'Все модули'}</h3><span class="count">${main.length}</span>
      <div class="chips">${cats.map((cat) => `<button class="chip ${cat === state.category ? 'active' : ''}" data-cat="${esc(cat)}">${esc(cat)}</button>`).join('')}</div>
    </div>
    ${main.length ? grid(main) : `<div class="empty">${icon('search', 44)}<h4>Ничего не найдено</h4>Попробуйте изменить запрос или категорию</div>`}
    ${hidden.length ? `
      <div class="section-head"><h3>${icon('hidden', 18)}</h3><h3>Скрытые модули</h3><span class="count">${hidden.length}</span>
        <span class="muted" style="margin-left:8px">не показываются в общем меню — только тем, кому выдан доступ</span></div>
      ${grid(hidden)}` : ''}
  </div>`;
  $$('[data-cat]', c).forEach((b) => (b.onclick = () => { state.category = b.dataset.cat; renderHome(); }));
  bindCards(c);
}

// =====================================================================
//  Модуль во фрейме
// =====================================================================
function renderModule(slug) {
  const m = state.modules.find((x) => x.slug === slug);
  if (!m) {
    setCrumbs('Нет доступа');
    content().innerHTML = `<div class="page"><div class="empty">${icon('lock', 44)}<h4>Нет доступа к модулю</h4>
      Модуль «${esc(slug)}» не найден или вам не выдан к нему доступ.<br><br><a class="btn" href="#/">${icon('arrowLeft', 18)} На главную</a></div></div>`;
    return;
  }
  pushRecent(slug);
  logEvent('open_module', slug).catch(() => {});
  const url = moduleUrl(m);
  setCrumbs(`<a class="muted" href="#/">Главная</a><span class="muted">/</span>${esc(m.title)}`);
  const c = content(true);
  c.innerHTML = `
    <div class="frame-bar">
      <a class="btn btn-ghost btn-icon btn-sm" href="#/" title="Назад">${icon('arrowLeft', 18)}</a>
      <div class="ttl"><span class="ib">${icon(m.icon, 16)}</span>${esc(m.title)}</div>
      ${isExternal(m) ? `<span class="badge" title="${esc(url)}">${icon('server', 12)} ${esc(new URL(url).host)}</span>` : ''}
      <div class="spacer" style="flex:1"></div>
      <button class="btn btn-ghost btn-sm" id="fReload" title="Обновить">${icon('refresh', 16)} Обновить</button>
      <button class="btn btn-ghost btn-icon btn-sm" id="fFull" title="Во весь экран">${icon('maximize', 16)}</button>
      <a class="btn btn-ghost btn-icon btn-sm" href="${esc(url)}" target="_blank" rel="noopener" title="Открыть в новом окне">${icon('external', 16)}</a>
    </div>
    <div class="frame-wrap">
      <div class="frame-loader" id="fLoader"><div class="bar-loader"></div></div>
      <iframe id="frame" src="${esc(url)}" allow="clipboard-read; clipboard-write; camera; fullscreen" allowfullscreen></iframe>
    </div>`;
  const frame = $('#frame');
  frame.addEventListener('load', () => $('#fLoader')?.classList.add('out'));
  setTimeout(() => $('#fLoader')?.classList.add('out'), 8000);
  $('#fReload').onclick = () => { $('#fLoader').classList.remove('out'); frame.src = url; };
  $('#fFull').onclick = () => $('.frame-wrap').requestFullscreen?.();
}

// =====================================================================
//  Профиль
// =====================================================================
function renderProfile() {
  setCrumbs('Профиль');
  const p = state.profile;
  const c = content();
  c.innerHTML = `
  <div class="page" style="max-width:720px">
    <div class="page-head"><div><h1>Профиль</h1><p>Ваши данные и пароль</p></div></div>
    <div class="panel" style="padding:22px;display:flex;flex-direction:column;gap:18px">
      <div class="cell-user">
        <div class="avatar" style="width:56px;height:56px;font-size:20px;border-radius:16px;background:${avatarColor(p.email)}">${esc(initials(p.full_name, p.email))}</div>
        <div><b style="font-size:17px">${esc(p.full_name || emailToLogin(p.email))}</b>
          <div class="sub">Логин: ${esc(emailToLogin(p.email))} · ${esc(p.role?.name || 'Без роли')}</div></div>
      </div>
      <form id="nameForm" class="field"><label>Имя и фамилия</label>
        <div style="display:flex;gap:10px"><input class="input" name="full_name" value="${esc(p.full_name || '')}"><button class="btn">Сохранить</button></div></form>
      <form id="pwForm" class="field"><label>Новый пароль</label>
        <div style="display:flex;gap:10px"><input class="input" name="password" type="password" minlength="6" autocomplete="new-password" placeholder="минимум 6 символов"><button class="btn">Сменить пароль</button></div></form>
      ${desktop ? `<div class="toggle-row"><div class="t"><b>Приложение OKKAM v${esc(desktop.version)}</b><small>Обновления проверяются при запуске</small></div>
        <button class="btn btn-sm" id="updBtn">${icon('refresh', 16)} Проверить обновления</button></div>` : ''}
      <div class="muted">Последний вход: ${ago(p.last_seen)}</div>
    </div>
  </div>`;
  $('#nameForm').onsubmit = async (e) => {
    e.preventDefault();
    try { await updateMyName(p.id, e.target.full_name.value.trim()); p.full_name = e.target.full_name.value.trim(); toast('Имя сохранено'); renderShell(); route(); }
    catch (err) { toast(humanError(err), 'err'); }
  };
  $('#pwForm').onsubmit = async (e) => {
    e.preventDefault();
    const v = e.target.password.value;
    if (v.length < 6) return toast('Пароль должен быть не короче 6 символов', 'err');
    try { await changeMyPassword(v); e.target.reset(); toast('Пароль изменён'); }
    catch (err) { toast(humanError(err), 'err'); }
  };
  if (desktop) $('#updBtn').onclick = () => { desktop.checkForUpdates(); toast('Проверяем обновления…'); };
}

// =====================================================================
//  Маршрутизация
// =====================================================================
function route() {
  const h = location.hash.replace(/^#/, '') || '/';
  const path = h.split('?')[0];
  if (!state.session) return renderLogin();
  if (path === '/login') return location.replace('#/');
  renderNav();
  if (path.startsWith('/m/')) return renderModule(decodeURIComponent(path.slice(3)));
  if (path === '/profile') return renderProfile();
  if (path.startsWith('/admin')) {
    if (!state.isAdmin) return location.replace('#/');
    return renderAdmin(path.slice(6).replace(/^\//, '') || 'overview');
  }
  renderHome();
}

// Список доступных модулей для страниц модулей во фрейме (guard.js):
// они показываются сразу, без повторного запроса к серверу.
function shareAccess() {
  window.OKKAM_ACCESS = { slugs: state.modules.map((m) => m.slug) };
}

export async function reloadMe() {
  const me = await loadMe(state.session.user.id);
  Object.assign(state, me);
  shareAccess();
  renderNav();
}

window.addEventListener('hashchange', route);

if (desktop) {
  desktop.setTheme?.(document.documentElement.dataset.theme);
  desktop.onUpdateStatus?.((s) => { if (s.state === 'ready') toast(`Обновление ${s.version} загружено — установится при перезапуске`); });
}

(async function boot() {
  try {
    if (configured) {
      const session = await getSession();
      if (session) {
        try { await enter(session); }
        catch (err) { await sb.auth.signOut().catch(() => {}); state.session = null; renderLogin(humanError(err)); }
      } else renderLogin();
      sb.auth.onAuthStateChange((ev, session) => {
        if (ev === 'SIGNED_OUT') { state.session = null; state.profile = null; window.OKKAM_ACCESS = null; renderLogin(); }
        if (ev === 'TOKEN_REFRESHED' && session) state.session = session;
      });
    } else renderLogin();
  } catch (err) {
    renderLogin(humanError(err));
  } finally {
    setTimeout(() => $('#boot')?.classList.add('out'), 150);
  }
})();
