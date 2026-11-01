// Админка: пользователи, роли и матрица доступа, модули, журнал.
import { admin, emailToLogin, loginToEmail, humanError } from './api.js';
import { icon, ICON_NAMES } from './icons.js';
import { esc, $, $$, toast, initials, avatarColor, modal, confirmBox, ago, fmtDate, genPassword } from './ui.js';
import { state, setCrumbs, content, reloadMe, moduleUrl } from './app.js';

const ACTIONS = {
  login: ['Вход', 'ok'], logout: ['Выход', ''], open_module: ['Открыт модуль', 'brand'],
  'admin.user_create': ['Создан пользователь', 'warn'], 'admin.user_update': ['Изменён пользователь', 'warn'],
  'admin.user_access': ['Изменён доступ', 'warn'], 'admin.user_password': ['Сменён пароль', 'warn'],
  'admin.user_block': ['Заблокирован', 'danger'], 'admin.user_unblock': ['Разблокирован', 'ok'],
  'admin.user_delete': ['Удалён пользователь', 'danger'], 'admin.role_create': ['Создана роль', 'warn'],
  'admin.role_update': ['Изменена роль', 'warn'], 'admin.role_delete': ['Удалена роль', 'danger'],
  'admin.module_create': ['Добавлен модуль', 'warn'], 'admin.module_update': ['Изменён модуль', 'warn'],
  'admin.module_delete': ['Удалён модуль', 'danger'],
};
const actBadge = (a) => {
  const [t, k] = ACTIONS[a] || [a, ''];
  return `<span class="badge ${k ? 'badge-' + k : ''}">${esc(t)}</span>`;
};

function loading() {
  content().innerHTML = `<div class="page"><div class="empty"><div class="bar-loader" style="margin:0 auto"></div></div></div>`;
}
function failed(err) {
  content().innerHTML = `<div class="page"><div class="empty">${icon('alert', 44)}<h4>Не удалось загрузить данные</h4>${esc(humanError(err))}</div></div>`;
}

export async function renderAdmin(section) {
  const views = { overview, users, roles, modules, audit };
  const fn = views[section];
  if (!fn) return (location.hash = '#/admin');
  loading();
  try { await fn(); } catch (err) { console.error(err); failed(err); }
}

// =====================================================================
//  Обзор
// =====================================================================
async function overview() {
  setCrumbs(`Администрирование<span class="muted">/</span>Обзор`);
  const [u, r, m, log] = await Promise.all([admin.users(), admin.roles(), admin.modules(), admin.audit(400)]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const logins = log.filter((e) => e.action === 'login' && new Date(e.created_at) >= today).length;
  const opens = {};
  log.filter((e) => e.action === 'open_module').forEach((e) => (opens[e.target] = (opens[e.target] || 0) + 1));
  const top = Object.entries(opens).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top[0]?.[1] || 1;
  const online = u.filter((x) => x.last_seen && Date.now() - new Date(x.last_seen) < 15 * 60e3).length;

  content().innerHTML = `
  <div class="page">
    <div class="page-head"><div><h1>Обзор</h1><p>Пользователи, доступ и активность</p></div>
      <div class="actions"><a class="btn btn-primary" href="#/admin/users">${icon('plus', 18)} Добавить пользователя</a></div></div>
    <div class="kpis">
      <div class="kpi"><div class="ib">${icon('users', 22)}</div><div><b>${u.length}</b><small>пользователей · ${u.filter((x) => !x.is_active).length} заблок.</small></div></div>
      <div class="kpi"><div class="ib">${icon('activity', 22)}</div><div><b>${online}</b><small>активны за 15 минут</small></div></div>
      <div class="kpi"><div class="ib">${icon('lock', 22)}</div><div><b>${logins}</b><small>входов сегодня</small></div></div>
      <div class="kpi"><div class="ib">${icon('layers', 22)}</div><div><b>${m.length}</b><small>модулей · ${m.filter((x) => !x.in_menu).length} скрытых</small></div></div>
      <div class="kpi"><div class="ib">${icon('shield', 22)}</div><div><b>${r.length}</b><small>ролей</small></div></div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:16px" class="ov-grid">
      <div class="panel">
        <div class="panel-head"><h3>Последние события</h3><a class="btn btn-ghost btn-sm" style="margin-left:auto" href="#/admin/audit">Весь журнал ${icon('arrowRight', 14)}</a></div>
        <div class="table-wrap"><table class="tbl"><tbody>
          ${log.slice(0, 10).map((e) => `<tr><td>${actBadge(e.action)}</td><td>${esc(emailToLogin(e.email) || '—')}</td>
            <td class="muted">${esc(modTitle(m, e.target))}</td><td class="muted" style="text-align:right">${ago(e.created_at)}</td></tr>`).join('') ||
            `<tr><td class="muted">Событий пока нет</td></tr>`}
        </tbody></table></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Популярные модули</h3></div>
        <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">
          ${top.map(([slug, n]) => `<div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><b>${esc(modTitle(m, slug))}</b><span class="muted">${n}</span></div>
            <div style="height:8px;border-radius:6px;background:var(--surface-2)"><div style="height:100%;width:${(n / max) * 100}%;border-radius:6px;background:linear-gradient(90deg,var(--brand-2),var(--brand-3))"></div></div></div>`).join('') ||
            '<span class="muted">Пока нет данных</span>'}
        </div>
      </div>
    </div>
  </div>
  <style>@media (max-width:980px){.ov-grid{grid-template-columns:1fr!important}}</style>`;
}
const modTitle = (mods, slug) => mods.find((x) => x.slug === slug)?.title || slug || '';

// =====================================================================
//  Пользователи
// =====================================================================
async function users() {
  setCrumbs(`Администрирование<span class="muted">/</span>Пользователи`);
  const [list, roles, mods] = await Promise.all([admin.users(), admin.roles(), admin.modules()]);
  let q = '';
  let roleFilter = '';

  const c = content();
  c.innerHTML = `
  <div class="page">
    <div class="page-head"><div><h1>Пользователи</h1><p>Учётные записи, роли и индивидуальный доступ</p></div>
      <div class="actions"><button class="btn btn-primary" id="addUser">${icon('plus', 18)} Новый пользователь</button></div></div>
    <div class="panel">
      <div class="panel-head">
        <div class="input-wrap">${icon('search', 16)}<input class="input" id="uq" placeholder="Поиск по имени или логину"></div>
        <select class="input" id="ur" style="width:200px;height:36px"><option value="">Все роли</option>${roles.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>
        <span class="muted" style="margin-left:auto" id="ucount"></span>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Пользователь</th><th>Роль</th><th>Статус</th><th>Последний вход</th><th></th></tr></thead>
        <tbody id="ubody"></tbody>
      </table></div>
    </div>
  </div>`;

  const draw = () => {
    const rows = list.filter((u) =>
      (!q || `${u.full_name} ${u.email}`.toLowerCase().includes(q)) && (!roleFilter || u.role_id === roleFilter));
    $('#ucount').textContent = `${rows.length} из ${list.length}`;
    $('#ubody').innerHTML = rows.map((u) => `
      <tr data-id="${u.id}">
        <td><div class="cell-user"><div class="avatar" style="background:${avatarColor(u.email)}">${esc(initials(u.full_name, u.email))}</div>
          <div><b>${esc(u.full_name || '—')}</b><div class="sub">${esc(emailToLogin(u.email))}${u.id === state.profile.id ? ' · это вы' : ''}</div></div></div></td>
        <td>${u.role ? `<span class="badge" style="color:${esc(u.role.color)};border-color:${esc(u.role.color)}55"><span class="dot"></span>${esc(u.role.name)}</span>` : '<span class="muted">без роли</span>'}</td>
        <td>${u.is_active ? '<span class="badge badge-ok">активен</span>' : '<span class="badge badge-danger">заблокирован</span>'}</td>
        <td class="muted">${ago(u.last_seen)}</td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-icon btn-sm" data-act="edit" title="Изменить">${icon('edit', 16)}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-act="pw" title="Сменить пароль">${icon('key', 16)}</button>
          ${u.id !== state.profile.id ? `
          <button class="btn btn-ghost btn-icon btn-sm" data-act="block" title="${u.is_active ? 'Заблокировать' : 'Разблокировать'}">${icon(u.is_active ? 'lock' : 'check', 16)}</button>
          <button class="btn btn-ghost btn-icon btn-sm btn-danger" data-act="del" title="Удалить">${icon('trash', 16)}</button>` : ''}
        </div></td>
      </tr>`).join('') || `<tr><td colspan="5"><div class="empty">${icon('users', 44)}<h4>Никого не найдено</h4></div></td></tr>`;
  };
  draw();
  $('#uq').oninput = (e) => { q = e.target.value.toLowerCase(); draw(); };
  $('#ur').onchange = (e) => { roleFilter = e.target.value; draw(); };
  $('#addUser').onclick = () => userCreate(roles, () => users());

  $('#ubody').onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const u = list.find((x) => x.id === b.closest('tr').dataset.id);
    if (b.dataset.act === 'edit') userEdit(u, roles, mods, () => users());
    if (b.dataset.act === 'pw') userPassword(u);
    if (b.dataset.act === 'block') {
      try {
        await admin.setActive(u.id, !u.is_active);
        toast(u.is_active ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
        users();
      } catch (err) { toast(humanError(err), 'err'); }
    }
    if (b.dataset.act === 'del') {
      if (!(await confirmBox('Удалить пользователя?', `${u.full_name || u.email} будет удалён без возможности восстановления.`))) return;
      try { await admin.deleteUser(u.id); toast('Пользователь удалён'); users(); }
      catch (err) { toast(humanError(err), 'err'); }
    }
  };
}

const roleOptions = (roles, selected) =>
  roles.map((r) => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${esc(r.name)}${r.is_admin ? ' (админ)' : ''}</option>`).join('');

function userCreate(roles, done) {
  const def = roles.find((r) => r.slug === 'worker')?.id;
  modal({
    title: 'Новый пользователь',
    submit: 'Создать',
    body: `
      <div class="field"><label>Имя и фамилия</label><input class="input" name="full_name" placeholder="Иван Петров"></div>
      <div class="row2">
        <div class="field"><label>Логин или e-mail</label><input class="input" name="login" required placeholder="ivanov"></div>
        <div class="field"><label>Роль</label><select class="input" name="role_id">${roleOptions(roles, def)}</select></div>
      </div>
      <div class="field"><label>Пароль</label>
        <div class="input-wrap"><input class="input" name="password" required minlength="6" value="${genPassword()}" style="padding-right:110px;font-family:ui-monospace,monospace">
          <button type="button" class="btn btn-ghost btn-sm input-action" data-gen>${icon('refresh', 14)} Новый</button></div>
        <small class="muted">Сообщите пароль сотруднику — он сможет сменить его в профиле.</small></div>`,
    onOpen: (f) => { $('[data-gen]', f).onclick = () => (f.password.value = genPassword()); },
    onSubmit: async (f) => {
      const login = f.login.value.trim();
      if (!login) throw new Error('Укажите логин');
      if (f.password.value.length < 6) throw new Error('Пароль должен быть не короче 6 символов');
      try {
        await admin.createUser({ login, password: f.password.value, full_name: f.full_name.value.trim(), role_id: f.role_id.value });
      } catch (err) { throw new Error(humanError(err)); }
      toast(`Создан: ${emailToLogin(loginToEmail(login))}`);
      done();
    },
  });
}

async function userEdit(u, roles, mods, done) {
  let overrides = {};
  try { (await admin.userModules(u.id)).forEach((o) => (overrides[o.module_slug] = o.allow)); }
  catch (err) { return toast(humanError(err), 'err'); }
  const rm = await admin.roleModules();

  const permHtml = (roleId) => {
    const role = roles.find((r) => r.id === roleId);
    return mods.map((m) => {
      const viaRole = role?.is_admin || rm.some((x) => x.role_id === roleId && x.module_slug === m.slug);
      const o = overrides[m.slug];
      const val = o === true ? 'allow' : o === false ? 'deny' : 'role';
      return `<div class="perm-item">
        <span style="color:var(--brand)">${icon(m.icon, 18)}</span>
        <div class="t"><b>${esc(m.title)}${!m.in_menu ? ' · скрытый' : ''}</b><small>по роли: ${viaRole ? 'есть доступ' : 'нет доступа'}</small></div>
        <select data-perm="${esc(m.slug)}" ${role?.is_admin ? 'disabled' : ''}>
          <option value="role" ${val === 'role' ? 'selected' : ''}>как у роли</option>
          <option value="allow" ${val === 'allow' ? 'selected' : ''}>разрешить</option>
          <option value="deny" ${val === 'deny' ? 'selected' : ''}>запретить</option>
        </select></div>`;
    }).join('');
  };

  modal({
    title: 'Пользователь',
    wide: true,
    body: `
      <div class="row2">
        <div class="field"><label>Имя и фамилия</label><input class="input" name="full_name" value="${esc(u.full_name || '')}"></div>
        <div class="field"><label>Роль</label><select class="input" name="role_id" ${u.id === state.profile.id ? 'disabled' : ''}>${roleOptions(roles, u.role_id)}</select></div>
      </div>
      <div class="field"><label>Логин</label><input class="input" value="${esc(emailToLogin(u.email))}" disabled></div>
      <div class="field"><label>Доступ к модулям</label>
        <small class="muted">По умолчанию доступ берётся из роли. Здесь можно выдать или запретить отдельный модуль только этому человеку.</small>
        <div class="perm-list" id="permList">${permHtml(u.role_id)}</div></div>`,
    onOpen: (f) => {
      f.role_id.onchange = () => {
        $$('[data-perm]', f).forEach((s) => (overrides[s.dataset.perm] = s.value === 'role' ? null : s.value === 'allow'));
        $('#permList', f).innerHTML = permHtml(f.role_id.value);
      };
    },
    onSubmit: async (f) => {
      const map = {};
      $$('[data-perm]', f).forEach((s) => (map[s.dataset.perm] = s.value === 'role' ? null : s.value === 'allow'));
      const patch = { full_name: f.full_name.value.trim() };
      if (u.id !== state.profile.id) patch.role_id = f.role_id.value;
      try {
        await admin.updateUser(u.id, patch);
        await admin.setUserOverrides(u.id, map);
      } catch (err) { throw new Error(humanError(err)); }
      toast('Сохранено');
      if (u.id === state.profile.id) reloadMe();
      done();
    },
  });
}

function userPassword(u) {
  modal({
    title: `Пароль: ${u.full_name || emailToLogin(u.email)}`,
    submit: 'Установить пароль',
    body: `<div class="field"><label>Новый пароль</label>
      <div class="input-wrap"><input class="input" name="password" minlength="6" value="${genPassword()}" style="padding-right:110px;font-family:ui-monospace,monospace">
        <button type="button" class="btn btn-ghost btn-sm input-action" data-gen>${icon('refresh', 14)} Новый</button></div></div>`,
    onOpen: (f) => { $('[data-gen]', f).onclick = () => (f.password.value = genPassword()); },
    onSubmit: async (f) => {
      try { await admin.setPassword(u.id, f.password.value); } catch (err) { throw new Error(humanError(err)); }
      navigator.clipboard?.writeText(f.password.value).catch(() => {});
      toast('Пароль установлен и скопирован');
    },
  });
}

// =====================================================================
//  Роли и матрица доступа
// =====================================================================
async function roles() {
  setCrumbs(`Администрирование<span class="muted">/</span>Роли и доступ`);
  const [list, mods, rm, us] = await Promise.all([admin.roles(), admin.modules(), admin.roleModules(), admin.users()]);
  const has = (r, m) => r.is_admin || rm.some((x) => x.role_id === r.id && x.module_slug === m.slug);

  const c = content();
  c.innerHTML = `
  <div class="page">
    <div class="page-head"><div><h1>Роли и доступ</h1><p>Отметьте, какие модули видит каждая роль. Изменения сохраняются сразу.</p></div>
      <div class="actions"><button class="btn btn-primary" id="addRole">${icon('plus', 18)} Новая роль</button></div></div>
    <div class="kpis">${list.map((r) => `
      <div class="kpi" style="cursor:pointer" data-role="${r.id}">
        <div class="ib" style="background:${esc(r.color)}22;color:${esc(r.color)}">${icon(r.is_admin ? 'shield' : 'users', 22)}</div>
        <div style="flex:1;min-width:0"><b style="font-size:16px">${esc(r.name)}</b><small>${us.filter((u) => u.role_id === r.id).length} польз. · ${r.is_admin ? 'всё' : mods.filter((m) => has(r, m)).length + ' модулей'}</small></div>
        <span class="muted">${icon('edit', 16)}</span>
      </div>`).join('')}</div>
    <div class="panel">
      <div class="panel-head"><h3>Матрица доступа</h3><span class="muted">Администраторы всегда имеют доступ ко всему</span></div>
      <div class="table-wrap"><table class="tbl matrix">
        <thead><tr><th>Модуль</th>${list.map((r) => `<th class="rot">${esc(r.name)}</th>`).join('')}</tr></thead>
        <tbody>${mods.map((m) => `<tr>
          <td><div class="mod"><span class="ib">${icon(m.icon, 16)}</span><div>${esc(m.title)}
            <div class="muted" style="font-weight:500;font-size:12px">${esc(m.slug)}/${!m.in_menu ? ' · скрытый' : ''}${!m.enabled ? ' · выключен' : ''}</div></div></div></td>
          ${list.map((r) => `<td class="c"><input type="checkbox" class="check" data-r="${r.id}" data-m="${esc(m.slug)}" ${has(r, m) ? 'checked' : ''} ${r.is_admin ? 'disabled' : ''}></td>`).join('')}
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
  </div>`;

  $$('.matrix .check', c).forEach((cb) => (cb.onchange = async () => {
    cb.disabled = true;
    try { await admin.toggleRoleModule(cb.dataset.r, cb.dataset.m, cb.checked); toast(cb.checked ? 'Доступ выдан' : 'Доступ снят'); }
    catch (err) { cb.checked = !cb.checked; toast(humanError(err), 'err'); }
    finally { cb.disabled = false; }
  }));
  $('#addRole').onclick = () => roleEdit(null, us, () => roles());
  $$('[data-role]', c).forEach((k) => (k.onclick = () => roleEdit(list.find((r) => r.id === k.dataset.role), us, () => roles())));
}

function roleEdit(r, us, done) {
  const isNew = !r;
  r = r || { name: '', slug: '', description: '', color: '#3D7CF5', is_admin: false };
  const users = us.filter((u) => u.role_id === r.id).length;
  const m = modal({
    title: isNew ? 'Новая роль' : 'Роль',
    submit: isNew ? 'Создать' : 'Сохранить',
    body: `
      <div class="row2">
        <div class="field"><label>Название</label><input class="input" name="name" required value="${esc(r.name)}" placeholder="Кладовщик"></div>
        <div class="field"><label>Код (латиницей)</label><input class="input" name="slug" required value="${esc(r.slug)}" placeholder="storekeeper" ${r.slug === 'admin' ? 'disabled' : ''}></div>
      </div>
      <div class="field"><label>Описание</label><input class="input" name="description" value="${esc(r.description || '')}"></div>
      <div class="field"><label>Цвет</label><input type="color" name="color" value="${esc(r.color || '#3D7CF5')}" style="width:64px;height:40px;border:0;background:none;cursor:pointer"></div>
      <label class="toggle-row"><div class="t"><b>Администратор</b><small>Полный доступ ко всем модулям и к админке</small></div>
        <span class="switch"><input type="checkbox" name="is_admin" ${r.is_admin ? 'checked' : ''} ${r.slug === 'admin' ? 'disabled' : ''}><span></span></span></label>
      ${!isNew && r.slug !== 'admin' ? `<button type="button" class="btn btn-danger" data-del style="align-self:flex-start">${icon('trash', 16)} Удалить роль${users ? ` (${users} польз. останутся без роли)` : ''}</button>` : ''}`,
    onSubmit: async (f) => {
      const slug = (f.slug.value || r.slug).trim().toLowerCase();
      if (!/^[a-z0-9_-]+$/.test(slug)) throw new Error('Код роли: только латиница, цифры, «-» и «_»');
      const row = { name: f.name.value.trim(), slug, description: f.description.value.trim(), color: f.color.value, is_admin: r.slug === 'admin' ? true : f.is_admin.checked };
      if (!row.name) throw new Error('Укажите название');
      try { await admin.saveRole(isNew ? row : { id: r.id, ...row }); } catch (err) { throw new Error(humanError(err)); }
      toast('Роль сохранена');
      done();
    },
  });
  $('[data-del]', m.el)?.addEventListener('click', async () => {
    m.close();
    if (!(await confirmBox('Удалить роль?', `Роль «${r.name}» будет удалена.`))) return;
    try { await admin.deleteRole(r.id, r.slug); toast('Роль удалена'); done(); } catch (err) { toast(humanError(err), 'err'); }
  });
}

// =====================================================================
//  Модули
// =====================================================================
async function modules() {
  setCrumbs(`Администрирование<span class="muted">/</span>Модули`);
  const list = await admin.modules();
  const c = content();
  c.innerHTML = `
  <div class="page">
    <div class="page-head"><div><h1>Модули</h1><p>Папки сайта, их видимость и адрес. Скрытые модули не видны в общем меню — только тем, кому выдан доступ.</p></div>
      <div class="actions"><button class="btn btn-primary" id="addMod">${icon('plus', 18)} Добавить модуль</button></div></div>
    <div class="panel"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Модуль</th><th>Категория</th><th>Где открывается</th><th>В меню</th><th>Включён</th><th></th></tr></thead>
      <tbody>${list.map((m) => `<tr data-slug="${esc(m.slug)}">
        <td><div class="cell-user"><div class="avatar" style="background:var(--brand-soft);color:var(--brand)">${icon(m.icon, 18)}</div>
          <div><b>${esc(m.title)}</b><div class="sub">${esc(m.slug)}/ · ${esc(m.description || '')}</div></div></div></td>
        <td><span class="badge">${esc(m.category || 'Общее')}</span></td>
        <td>${m.url ? `<span class="badge" title="${esc(m.url)}">${icon('server', 12)} ${esc(hostOf(m.url))}</span>` : '<span class="badge badge-ok">GitHub Pages</span>'}
          ${m.needs_server ? `<span class="badge badge-warn" title="Модуль использует PHP — на GitHub Pages он работать не будет">PHP</span>` : ''}</td>
        <td><label class="switch"><input type="checkbox" data-f="in_menu" ${m.in_menu ? 'checked' : ''}><span></span></label></td>
        <td><label class="switch"><input type="checkbox" data-f="enabled" ${m.enabled ? 'checked' : ''}><span></span></label></td>
        <td><div class="row-actions">
          <a class="btn btn-ghost btn-icon btn-sm" href="${esc(moduleUrl(m))}" target="_blank" rel="noopener" title="Открыть">${icon('external', 16)}</a>
          <button class="btn btn-ghost btn-icon btn-sm" data-act="edit" title="Изменить">${icon('edit', 16)}</button>
          <button class="btn btn-ghost btn-icon btn-sm btn-danger" data-act="del" title="Удалить">${icon('trash', 16)}</button></div></td>
      </tr>`).join('')}</tbody>
    </table></div></div>
  </div>`;
  $$('[data-f]', c).forEach((cb) => (cb.onchange = async () => {
    const slug = cb.closest('tr').dataset.slug;
    try { await admin.saveModule({ [cb.dataset.f]: cb.checked }, slug); toast('Сохранено'); reloadMe(); }
    catch (err) { cb.checked = !cb.checked; toast(humanError(err), 'err'); }
  }));
  $('#addMod').onclick = () => moduleEdit(null, () => modules());
  $$('[data-act]', c).forEach((b) => (b.onclick = async () => {
    const m = list.find((x) => x.slug === b.closest('tr').dataset.slug);
    if (b.dataset.act === 'edit') return moduleEdit(m, () => modules());
    if (!(await confirmBox('Удалить модуль?', `«${m.title}» исчезнет из дашборда. Файлы в папке ${m.slug}/ не удаляются.`))) return;
    try { await admin.deleteModule(m.slug); toast('Модуль удалён'); reloadMe(); modules(); } catch (err) { toast(humanError(err), 'err'); }
  }));
}
const hostOf = (u) => { try { return new URL(u).host; } catch { return u; } };

function moduleEdit(m, done) {
  const isNew = !m;
  m = m || { slug: '', title: '', description: '', icon: 'grid', category: 'Общее', url: '', in_menu: true, enabled: true, needs_server: false, sort: 100 };
  let chosen = m.icon || 'grid';
  modal({
    title: isNew ? 'Новый модуль' : 'Модуль',
    wide: true,
    submit: isNew ? 'Добавить' : 'Сохранить',
    body: `
      <div class="row2">
        <div class="field"><label>Название</label><input class="input" name="title" required value="${esc(m.title)}"></div>
        <div class="field"><label>Папка (код)</label><input class="input" name="slug" required value="${esc(m.slug)}" placeholder="invent"></div>
      </div>
      <div class="field"><label>Описание</label><input class="input" name="description" value="${esc(m.description || '')}"></div>
      <div class="row2">
        <div class="field"><label>Категория</label><input class="input" name="category" value="${esc(m.category || 'Общее')}"></div>
        <div class="field"><label>Порядок</label><input class="input" name="sort" type="number" value="${m.sort ?? 100}"></div>
      </div>
      <div class="field"><label>Внешний адрес (необязательно)</label>
        <input class="input" name="url" value="${esc(m.url || '')}" placeholder="пусто = папка на этом сайте; например https://okkam.space/invent/">
        <small class="muted">Нужен для модулей с PHP: GitHub Pages не выполняет серверный код, поэтому такие модули открываются с вашего сервера.</small></div>
      <div class="field"><label>Иконка</label><div class="icon-pick">${ICON_NAMES.map((n) =>
        `<button type="button" data-ic="${n}" class="${n === chosen ? 'on' : ''}" title="${n}">${icon(n, 18)}</button>`).join('')}</div></div>
      <div class="row2">
        <label class="toggle-row"><div class="t"><b>Показывать в меню</b><small>Выкл. — скрытый модуль</small></div>
          <span class="switch"><input type="checkbox" name="in_menu" ${m.in_menu ? 'checked' : ''}><span></span></span></label>
        <label class="toggle-row"><div class="t"><b>Включён</b><small>Выкл. — недоступен никому, кроме админов</small></div>
          <span class="switch"><input type="checkbox" name="enabled" ${m.enabled ? 'checked' : ''}><span></span></span></label>
      </div>
      <label class="toggle-row"><div class="t"><b>Требует сервер (PHP)</b><small>Пометка для администратора</small></div>
        <span class="switch"><input type="checkbox" name="needs_server" ${m.needs_server ? 'checked' : ''}><span></span></span></label>`,
    onOpen: (f) => $$('[data-ic]', f).forEach((b) => (b.onclick = () => {
      chosen = b.dataset.ic; $$('[data-ic]', f).forEach((x) => x.classList.toggle('on', x === b));
    })),
    onSubmit: async (f) => {
      const slug = f.slug.value.trim();
      if (!/^[A-Za-z0-9_-]+$/.test(slug)) throw new Error('Папка: только латиница, цифры, «-» и «_»');
      const url = f.url.value.trim();
      if (url && !/^https:\/\//i.test(url)) throw new Error('Внешний адрес должен начинаться с https://');
      const row = {
        slug, title: f.title.value.trim(), description: f.description.value.trim(), category: f.category.value.trim() || 'Общее',
        sort: Number(f.sort.value) || 100, url: url || null, icon: chosen,
        in_menu: f.in_menu.checked, enabled: f.enabled.checked, needs_server: f.needs_server.checked,
      };
      if (!row.title) throw new Error('Укажите название');
      try { await admin.saveModule(row, isNew ? null : m.slug); } catch (err) { throw new Error(humanError(err)); }
      toast('Модуль сохранён');
      reloadMe();
      done();
    },
  });
}

// =====================================================================
//  Журнал
// =====================================================================
async function audit() {
  setCrumbs(`Администрирование<span class="muted">/</span>Журнал`);
  const [log, mods] = await Promise.all([admin.audit(500), admin.modules()]);
  let q = '', kind = '';
  const c = content();
  c.innerHTML = `
  <div class="page">
    <div class="page-head"><div><h1>Журнал</h1><p>Последние 500 событий: входы, открытия модулей, действия администраторов</p></div></div>
    <div class="panel">
      <div class="panel-head">
        <div class="input-wrap">${icon('search', 16)}<input class="input" id="aq" placeholder="Пользователь или модуль"></div>
        <select class="input" id="ak" style="width:220px;height:36px"><option value="">Все события</option>
          <option value="login">Входы</option><option value="open_module">Открытия модулей</option><option value="admin.">Действия админов</option></select>
        <span class="muted" style="margin-left:auto" id="acount"></span></div>
      <div class="table-wrap" style="max-height:calc(100vh - 290px)"><table class="tbl">
        <thead><tr><th>Время</th><th>Событие</th><th>Пользователь</th><th>Объект</th></tr></thead><tbody id="abody"></tbody></table></div>
    </div>
  </div>`;
  const draw = () => {
    const rows = log.filter((e) => (!kind || e.action.startsWith(kind)) &&
      (!q || `${e.email} ${e.target} ${modTitle(mods, e.target)}`.toLowerCase().includes(q)));
    $('#acount').textContent = `${rows.length} событий`;
    $('#abody').innerHTML = rows.map((e) => `<tr><td class="muted" style="white-space:nowrap">${fmtDate(e.created_at)}</td><td>${actBadge(e.action)}</td>
      <td>${esc(emailToLogin(e.email) || '—')}</td><td class="muted">${esc(modTitle(mods, e.target))}</td></tr>`).join('') ||
      `<tr><td colspan="4"><div class="empty">${icon('clock', 44)}<h4>Событий нет</h4></div></td></tr>`;
  };
  draw();
  $('#aq').oninput = (e) => { q = e.target.value.toLowerCase(); draw(); };
  $('#ak').onchange = (e) => { kind = e.target.value; draw(); };
}
