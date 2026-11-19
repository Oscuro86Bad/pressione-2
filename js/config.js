/* ============================================================
   PRESSIONE 2.0 — configurazione generale
   Diario pressorio personale, PWA senza build.
   ============================================================ */
window.DP = window.DP || {};

DP.VERSION = '2.1.0';
DP.BUILD = '2026-11-19';

DP.CONFIG = {
  appName: 'Pressione 2.0',
  repoUrl: 'https://github.com/Oscuro86Bad/pressione-2',
  pagesUrl: 'https://oscuro86bad.github.io/pressione-2/',

  // Chiavi di archiviazione locale
  storageKey: 'dp2_state_v1',
  githubConfigKey: 'dp2_github_config_v1',

  // Repository privato in cui salvare il diario (configurabile nell'app)
  github: {
    apiBase: 'https://api.github.com',
    defaultRepo: 'pressione-dati',
    defaultBranch: 'main',
    defaultPath: 'diario.json',
    repoUrl: 'https://github.com/new?name=pressione-dati&visibility=private',
    tokenUrl: 'https://github.com/settings/personal-access-tokens/new'
  },

  // Obiettivo personale predefinito (pressione misurata a casa: 135/85)
  target: { sys: 135, dia: 85 },
  limits: { sysLow: 90, diaLow: 60, pulseLow: 50, pulseHigh: 100 },

  // Intervalli del report
  periods: [
    { days: 7, label: '7 giorni' },
    { days: 14, label: '14 giorni' },
    { days: 30, label: '30 giorni' },
    { days: 90, label: '3 mesi' },
    { days: 0, label: 'Tutto' },
    { days: -1, label: 'Personalizzato' }
  ],

  // Testi di aiuto
  tips: [
    'Riposa 5 minuti seduto prima di misurare.',
    'Schiena appoggiata, piedi a terra, braccio appoggiato e all’altezza del cuore.',
    'Usa sempre lo stesso braccio, se il medico non indica diversamente.',
    'Misura la mattina prima dei farmaci e la sera prima di cena, alla stessa ora.',
    'Fai due misurazioni a un minuto di distanza e registra la seconda (o la media).',
    'Non parlare, non muoverti e non tenere le gambe incrociate durante la misurazione.',
    'Evita caffè, sigarette e attività fisica nei 30 minuti precedenti.'
  ],

  disclaimer:
    'Questa app è un diario personale: non è un dispositivo medico, non fa diagnosi e non sostituisce il parere del medico. Non modificare mai una terapia in base a questi dati. Per valori molto elevati (ad esempio 180/120 mmHg) o in presenza di sintomi importanti (mal di testa forte, dolore al petto, difficoltà a respirare, disturbi alla vista) contatta subito il medico o i servizi di emergenza.',

  emergency:
    'Valori molto elevati. Se hai sintomi importanti (mal di testa forte, dolore al petto, difficoltà a respirare, disturbi alla vista) contatta subito il medico o i servizi di emergenza. Non modificare la terapia da solo.',

  methodNote:
    'Misurazioni registrate dall’assistito con un misuratore da braccio. I valori sono inseriti manualmente o letti dalla foto del display e non sono stati validati da personale sanitario.'
};

DP.clone = function (value) {
  if (value === undefined || value === null) return value;
  if (window.structuredClone) {
    try { return window.structuredClone(value); } catch (e) { /* fallback */ }
  }
  return JSON.parse(JSON.stringify(value));
};

DP.isObj = function (v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
};

DP.toInt = function (value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};
