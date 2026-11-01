// Работа с Supabase: клиент, вход/выход, данные для админки.
// supabase-js 2.45.4, собран в один файл (assets/vendor) — не зависим от внешних CDN
import { createClient } from '../vendor/supabase.js';

const cfg = window.OKKAM_CONFIG || {};
export const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

// Ключ хранилища фиксирован — его читает guard.js на страницах модулей
export const STORAGE_KEY = 'okkam-auth';

export const sb = configured
  ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true },
    })
  : null;

export function loginToEmail(login) {
  const v = String(login || '').trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${cfg.loginDomain || 'okkam.local'}`;
}
export function emailToLogin(email) {
  const d = '@' + (cfg.loginDomain || 'okkam.local');
  return email && email.endsWith(d) ? email.slice(0, -d.length) : email;
}

const RU_ERRORS = [
  [/invalid login credentials/i, 'Неверный логин или пароль'],
  [/user is banned/i, 'Учётная запись заблокирована. Обратитесь к администратору'],
  [/email not confirmed/i, 'E-mail не подтверждён'],
  [/failed to fetch|networkerror|load failed/i, 'Нет связи с сервером. Проверьте интернет'],
  [/rate limit|too many/i, 'Слишком много попыток. Подождите минуту'],
  [/already been registered|already registered|already exists/i, 'Такой пользователь уже существует'],
  [/password should be at least/i, 'Пароль слишком короткий (минимум 6 символов)'],
  [/duplicate key/i, 'Запись с таким идентификатором уже есть'],
  [/violates row-level security|permission denied/i, 'Недостаточно прав'],
];
export function humanError(e) {
  const msg = String(e?.message || e || 'Ошибка');
  for (const [re, ru] of RU_ERRORS) if (re.test(msg)) return ru;
  return msg;
}
function check({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Сессия ----------
export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}
export async function signIn(login, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email: loginToEmail(login), password });
  if (error) throw error;
  return data.session;
}
export async function signOut() {
  await logEvent('logout').catch(() => {});
  await sb.auth.signOut();
}

export async function loadMe(userId) {
  const profile = check(await sb.from('profiles').select('*, role:roles(*)').eq('id', userId).maybeSingle());
  if (!profile) throw new Error('Профиль не найден. Выполните supabase/schema.sql в проекте Supabase');
  const modules = check(await sb.rpc('my_modules'));
  sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {});
  return { profile, modules: modules || [], isAdmin: !!profile.role?.is_admin };
}

let me = null;
export function setMe(p) { me = p; }
export async function logEvent(action, target = null, details = {}) {
  if (!me) return;
  await sb.from('audit_log').insert({ user_id: me.id, email: me.email, action, target, details });
}

export async function updateMyName(id, full_name) {
  check(await sb.from('profiles').update({ full_name }).eq('id', id));
}
export async function changeMyPassword(password) {
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

// ---------- Админка ----------
export const admin = {
  async users() {
    return check(await sb.from('profiles').select('*, role:roles(id,name,color,is_admin)').order('created_at'));
  },
  async roles() {
    return check(await sb.from('roles').select('*').order('created_at'));
  },
  async modules() {
    return check(await sb.from('modules').select('*').order('sort').order('title'));
  },
  async roleModules() {
    return check(await sb.from('role_modules').select('*'));
  },
  async userModules(userId) {
    return check(await sb.from('user_modules').select('*').eq('user_id', userId));
  },
  async audit(limit = 300) {
    return check(await sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit));
  },

  async fn(body) {
    const { data, error } = await sb.functions.invoke('admin-users', { body });
    if (error) {
      let msg = error.message;
      try { msg = (await error.context.json()).error || msg; } catch (_) {}
      if (/failed to send|not found|404/i.test(msg)) msg = 'Функция admin-users не развёрнута в Supabase (см. README)';
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },
  createUser: (p) => admin.fn({ action: 'create', ...p }),
  setPassword: (user_id, password) => admin.fn({ action: 'set_password', user_id, password }),
  setActive: (user_id, active) => admin.fn({ action: 'set_active', user_id, active }),
  deleteUser: (user_id) => admin.fn({ action: 'delete', user_id }),

  async updateUser(id, patch) {
    check(await sb.from('profiles').update(patch).eq('id', id));
    await logEvent('admin.user_update', id, patch);
  },
  async setUserOverrides(userId, map) {
    // map: { slug: true | false | null }
    check(await sb.from('user_modules').delete().eq('user_id', userId));
    const rows = Object.entries(map).filter(([, v]) => v !== null).map(([module_slug, allow]) => ({ user_id: userId, module_slug, allow }));
    if (rows.length) check(await sb.from('user_modules').insert(rows));
    await logEvent('admin.user_access', userId, { overrides: rows.length });
  },

  async saveRole(role) {
    const { id, ...rest } = role;
    if (id) check(await sb.from('roles').update(rest).eq('id', id));
    else check(await sb.from('roles').insert(rest));
    await logEvent(id ? 'admin.role_update' : 'admin.role_create', rest.slug);
  },
  async deleteRole(id, slug) {
    check(await sb.from('roles').delete().eq('id', id));
    await logEvent('admin.role_delete', slug);
  },
  async toggleRoleModule(role_id, module_slug, on) {
    if (on) check(await sb.from('role_modules').insert({ role_id, module_slug }));
    else check(await sb.from('role_modules').delete().eq('role_id', role_id).eq('module_slug', module_slug));
  },

  async saveModule(mod, originalSlug) {
    if (originalSlug) check(await sb.from('modules').update(mod).eq('slug', originalSlug));
    else check(await sb.from('modules').insert(mod));
    await logEvent(originalSlug ? 'admin.module_update' : 'admin.module_create', mod.slug);
  },
  async deleteModule(slug) {
    check(await sb.from('modules').delete().eq('slug', slug));
    await logEvent('admin.module_delete', slug);
  },
};
