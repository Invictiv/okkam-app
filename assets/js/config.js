// Настройки подключения к Supabase.
// Ключ anon — публичный (он и так виден в браузере), защиту данных обеспечивают
// политики RLS из supabase/schema.sql. Service-role ключ сюда НЕ класть никогда.
// При деплое через GitHub Actions файл перезаписывается значениями из
// Settings → Secrets and variables → Actions → Variables (SUPABASE_URL, SUPABASE_ANON_KEY).
window.OKKAM_CONFIG = {
  supabaseUrl: "https://kamwcfasnypdtuhavxvw.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthbXdjZmFzbnlwZHR1aGF2eHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1MjU5MTUsImV4cCI6MjEwOTEwMTkxNX0.ZLDQzVlB2KJ07vS4h7xd70yyMTWOFvxXyu2hK9_Ol6I",
  // Адрес дашборда. Нужен модулям, которые открываются с другого сервера (okkam.space)
  dashboardUrl: "https://invictiv.github.io/okkam-app/",
  // Логин без «@» дополняется этим доменом: ivanov → ivanov@okkam.local
  loginDomain: "okkam.local",
  appName: "OKKAM",
};
