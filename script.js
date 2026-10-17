'use strict';
const K = 'tabunganku_v1', $ = q => document.querySelector(q);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Supabase Cloud Database & Auth ---------- */
const SUPABASE_URL = 'https://bwztfzjysblxigrdggau.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3enRmemp5c2JseGlncmRnZ2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNTc0NDgsImV4cCI6MjEwNzczMzQ0OH0.dw5PwIHWfOlKhcFNxealvwKoRS5MVIhLbQdBzz-F6D4';
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
let currentUser = null;

let S = (() => {
  let d;
  try { d = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  return Object.assign({ s: null, tx: [], ms: [], log: [], theme: 'dark', hideBalance: false }, d && typeof d === 'object' ? d : {});
})();

let isUnlocked = false;
let isBalanceHidden = Boolean(S.hideBalance);
let balRange = 'all';
let analyticsPeriod = 'all';
let c2Filter = 'all';
const isPinActive = () => Boolean(S?.s?._security?.pinEnabled && S?.s?._security?.pinHash);

async function hashPin(pin) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode('nabungwise_salt_' + pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('Crypto subtle error, fallback to simple hash:', e);
    }
  }
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i);
    hash |= 0;
  }
  return 'fallback_' + Math.abs(hash);
}

async function syncToCloud() {
  if (!sb || !currentUser) return;
  try {
    const payload = {
      user_id: currentUser.id,
      settings: S.s || {},
      transactions: S.tx || [],
      milestones: S.ms || [],
      logs: S.log || [],
      theme: S.theme,
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from('user_savings').upsert(payload);
    if (error) console.error('Cloud save error:', error);
  } catch (err) {
    console.error('Cloud save failed:', err);
  }
}

async function fetchFromCloud() {
  if (!sb || !currentUser) return;
  try {
    const { data, error } = await sb.from('user_savings').select('*').eq('user_id', currentUser.id).maybeSingle();
    if (error) {
      console.error('Fetch cloud error:', error);
      return;
    }
    if (data && data.settings && typeof data.settings === 'object' && Object.keys(data.settings).length) {
      S = {
        s: data.settings,
        tx: Array.isArray(data.transactions) ? data.transactions : [],
        ms: Array.isArray(data.milestones) ? data.milestones : [],
        log: Array.isArray(data.logs) ? data.logs : [],
        theme: data.theme || S.theme
      };
      localStorage.setItem(K, JSON.stringify(S));
      applyTheme();
      render();
      toast('Data tabungan tersinkronisasi dari Cloud');
    } else {
      // Belum ada data di cloud untuk akun ini, unggah data lokal jika ada
      if (S.s) {
        await syncToCloud();
        toast('Data lokal berhasil dicadangkan ke Cloud');
      }
    }
  } catch (err) {
    console.error('Error fetching cloud data:', err);
  }
}

const save = () => {
  try {
    localStorage.setItem(K, JSON.stringify(S));
  } catch (e) {
    toast('Gagal menyimpan data lokal');
  }
  syncToCloud();
};

const rp = (n, forceShow = false) => {
  if (isBalanceHidden && !forceShow) return 'Rp ••••••••';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
};
const p2 = n => String(n).padStart(2, '0'), iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, today = () => iso(new Date());
const pd = s => new Date(s + 'T00:00:00'), fd = s => pd(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const fdo = d => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const DAYS = { harian: 1, mingguan: 7, bulanan: 30 }, UNIT = { harian: 'hari', mingguan: 'minggu', bulanan: 'bulan' }, FREQ = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' };
const CAT = { in: ['Gaji', 'Bonus', 'Hadiah', 'Sisihan Rutin', 'Lainnya'], out: ['Kebutuhan', 'Darurat', 'Hiburan', 'Pendidikan', 'Lainnya'] };
const MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const opts = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
const GR = '#10b981', RD = '#f87171', AM = '#fbbf24', BL = '#60a5fa';
let tt; const toast = m => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); };

/* ---------- Ikon SVG Profesional (Zero Emojis) ---------- */
const ICONS = {
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>',
  milestone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
  streak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
  in: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"></path></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="M7 15h0M2 9.5h20"></path></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'
};

function updatePrivacyButtonUI() {
  const iconSpan = $('#privacy-icon');
  const labelSpan = $('#privacy-label');
  const btn = $('#btn-privacy');
  if (!btn) return;
  if (iconSpan) iconSpan.innerHTML = isBalanceHidden ? ICONS.eyeOff : ICONS.eye;
  if (labelSpan) labelSpan.textContent = isBalanceHidden ? 'Sembunyi' : 'Privasi';
  btn.title = isBalanceHidden ? 'Tampilkan Nominal Saldo' : 'Sembunyikan Nominal Saldo';
}

function toggleBalancePrivacy() {
  isBalanceHidden = !isBalanceHidden;
  S.hideBalance = isBalanceHidden;
  save();
  updatePrivacyButtonUI();
  render();
  toast(isBalanceHidden ? 'Nominal saldo disembunyikan' : 'Nominal saldo ditampilkan');
}

/* ---------- Perhitungan & Forecasting Dinamis ---------- */
const sum = (t, l = S.tx) => l.filter(x => x.type === t).reduce((a, x) => a + x.amount, 0);

function calc(l = S.tx) {
  const s = S.s || { initial: 0, target: 0, routine: 0, freq: 'mingguan', start: today() };
  const i = sum('in', l), o = sum('out', l), bal = s.initial + i - o;
  return {
    i, o, bal,
    pct: s.target > 0 ? Math.max(0, Math.min(100, bal / s.target * 100)) : 0,
    rem: Math.max(0, s.target - bal)
  };
}

function est(bal, target = S.s?.target, r = S.s?.routine, f = S.s?.freq) {
  if (target === undefined || target === null || target <= 0) return null;
  const rem = target - bal;
  if (rem <= 0) return { done: 1 };
  if (!(r > 0)) return null;
  const n = Math.ceil(rem / r), d = new Date();
  if (f === 'bulanan') d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n * (DAYS[f] || 7));
  return { n, d };
}

const estTxt = (e, f = S.s?.freq || 'mingguan') => {
  if (!e) return 'Isi nominal rutin';
  if (e.done) return 'Target tercapai';
  return `${fdo(e.d)} <small>(${e.n} ${UNIT[f] || 'periode'} lagi)</small>`;
};

function scheduleAnalysis() {
  const s = S.s;
  if (!s) return null;
  const c = calc();
  const startDate = pd(s.start);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const msElapsed = Math.max(0, now - startDate);
  const daysElapsed = Math.floor(msElapsed / 864e5);
  const unitDays = DAYS[s.freq] || 7;
  const periodsElapsed = daysElapsed / unitDays;

  // Jadwal baseline saldo yang seharusnya terkumpul sampai hari ini
  const expectedBal = s.initial + (periodsElapsed * s.routine);
  const diffBal = c.bal - expectedBal; // Positif: surplus, Negatif: defisit
  const diffPeriods = s.routine > 0 ? (diffBal / s.routine) : 0;

  // Kecepatan menabung aktual riil sejak tanggal mulai
  const effectiveDays = Math.max(1, daysElapsed);
  const netSavedActual = c.bal - s.initial;
  const actualPerDay = netSavedActual / effectiveDays;
  const actualPerUnit = actualPerDay * unitDays;

  // Estimasi berdasarkan target setoran rutin
  const estRoutine = est(c.bal, s.target, s.routine, s.freq);

  // Estimasi berdasarkan tempo aktual
  let estActual = null;
  if (c.rem <= 0) {
    estActual = { done: 1 };
  } else if (actualPerDay > 0) {
    const daysNeeded = Math.ceil(c.rem / actualPerDay);
    const dateActual = new Date();
    dateActual.setDate(dateActual.getDate() + daysNeeded);
    const periodsNeeded = Math.ceil(daysNeeded / unitDays);
    estActual = { n: periodsNeeded, d: dateActual, perUnit: actualPerUnit };
  }

  let status = 'on_track';
  let badgeClass = 'ahead';
  let aheadText = 'Sesuai Rencana';

  if (c.rem <= 0) {
    status = 'achieved';
    badgeClass = 'achieved';
    aheadText = 'Target Tercapai';
  } else if (Math.abs(diffBal) < (s.routine * 0.15)) {
    status = 'on_track';
    badgeClass = 'ahead';
    aheadText = 'Tepat Sesuai Jadwal';
  } else if (diffBal > 0) {
    status = 'ahead';
    badgeClass = 'ahead';
    aheadText = `${diffPeriods.toFixed(1)} ${UNIT[s.freq]} Lebih Cepat`;
  } else {
    status = 'behind';
    badgeClass = 'behind';
    aheadText = `${Math.abs(diffPeriods).toFixed(1)} ${UNIT[s.freq]} Tertinggal`;
  }

  return {
    daysElapsed,
    periodsElapsed,
    expectedBal,
    diffBal,
    diffPeriods,
    status,
    badgeClass,
    aheadText,
    estRoutine,
    estActual,
    actualPerUnit,
    actualPerDay
  };
}

function nextMilestone() {
  const c = calc(), s = S.s;
  if (!s || !S.ms || !S.ms.length) return null;
  const sortedMs = [...S.ms].sort((a, b) => a.amount - b.amount);
  const upcoming = sortedMs.find(m => m.amount > c.bal);
  if (!upcoming) return { allDone: true, last: sortedMs[sortedMs.length - 1] };
  const pct = Math.max(0, Math.min(100, (c.bal / upcoming.amount) * 100));
  const rem = upcoming.amount - c.bal;
  return { milestone: upcoming, pct, rem };
}

function monthly() {
  const m = {};
  S.tx.forEach(x => {
    const k = x.date.slice(0, 7);
    m[k] = m[k] || { k, i: 0, o: 0, n: 0 };
    m[k][x.type === 'in' ? 'i' : 'o'] += x.amount;
    m[k].n++;
  });
  return Object.values(m).sort((a, b) => a.k.localeCompare(b.k));
}

const mlabel = k => MN[+k.slice(5) - 1].slice(0, 3) + ' ' + k.slice(2, 4);
const mlong = k => MN[+k.slice(5) - 1] + ' ' + k.slice(0, 4);

function balSeries(range = 'all') {
  if (!S.s) return { L: [], D: [] };
  const allTx = [...S.tx].sort((a, b) => a.date.localeCompare(b.date) || (a.ts || 0) - (b.ts || 0));
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let startDateStr = S.s.start || today();
  if (range === '1m') {
    const d = new Date(now); d.setDate(d.getDate() - 30);
    startDateStr = iso(d);
  } else if (range === '3m') {
    const d = new Date(now); d.setDate(d.getDate() - 90);
    startDateStr = iso(d);
  } else if (range === '6m') {
    const d = new Date(now); d.setDate(d.getDate() - 180);
    startDateStr = iso(d);
  } else if (range === '1y') {
    const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
    startDateStr = iso(d);
  } else {
    if (allTx.length && allTx[0].date < startDateStr) {
      startDateStr = allTx[0].date;
    }
  }

  let startBal = S.s.initial;
  allTx.forEach(x => {
    if (x.date < startDateStr) {
      startBal += x.type === 'in' ? x.amount : -x.amount;
    }
  });

  const rangeTx = allTx.filter(x => x.date >= startDateStr);
  const dates = [startDateStr];
  const balances = [startBal];
  let curBal = startBal;

  rangeTx.forEach(x => {
    curBal += x.type === 'in' ? x.amount : -x.amount;
    if (dates[dates.length - 1] === x.date) {
      balances[balances.length - 1] = curBal;
    } else {
      dates.push(x.date);
      balances.push(curBal);
    }
  });

  const td = today();
  if (dates[dates.length - 1] !== td) {
    dates.push(td);
    balances.push(curBal);
  }

  // Downsample jika titik data terlalu banyak agar kurva tetap bersih dan tidak bertumpuk
  if (dates.length > 35) {
    const step = Math.ceil(dates.length / 30);
    const sampledDates = [];
    const sampledBalances = [];
    for (let i = 0; i < dates.length; i += step) {
      sampledDates.push(dates[i]);
      sampledBalances.push(balances[i]);
    }
    if (sampledDates[sampledDates.length - 1] !== dates[dates.length - 1]) {
      sampledDates.push(dates[dates.length - 1]);
      sampledBalances.push(balances[balances.length - 1]);
    }
    return {
      L: sampledDates.map(fd),
      rawDates: sampledDates,
      D: sampledBalances
    };
  }

  return {
    L: dates.map(fd),
    rawDates: dates,
    D: balances
  };
}

const wk = s => {
  const d = pd(s);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return iso(d);
};

function streak() {
  const w = [...new Set(S.tx.filter(x => x.type === 'in').map(x => wk(x.date)))].sort();
  let best = 0, run = 0, prev = null;
  w.forEach(k => {
    run = prev && Math.round((pd(k) - pd(prev)) / 864e5) === 7 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  });
  let cur = 0;
  const d = pd(wk(today()));
  if (!w.includes(iso(d))) d.setDate(d.getDate() - 7);
  while (w.includes(iso(d))) { cur++; d.setDate(d.getDate() - 7); }
  return { cur, best };
}

function insights() {
  const c = calc(), t = S.tx, a = [], ins = t.filter(x => x.type === 'in'), m = monthly(), st = streak(), sa = scheduleAnalysis();
  if (!t.length) return [
    { icon: ICONS.wallet, title: 'Mulai Menabung', text: 'Catat setoran pertamamu untuk mengaktifkan analisis dan prediksi otomatis.' }
  ];

  if (sa) {
    if (sa.status === 'ahead') {
      a.push({ icon: ICONS.bolt, title: 'Performa Unggul', text: `Tabunganmu <b>surplus ${rp(sa.diffBal)}</b> (${sa.diffPeriods.toFixed(1)} ${UNIT[S.s.freq]} lebih cepat dari jadwal).` });
    } else if (sa.status === 'behind') {
      a.push({ icon: ICONS.clock, title: 'Perlu Setoran Tambahan', text: `Tabungan tertinggal <b>${rp(Math.abs(sa.diffBal))}</b> dari jadwal. Tambah setoran ekstra untuk mengejar target.` });
    } else if (sa.status === 'achieved') {
      a.push({ icon: ICONS.check, title: 'Target Tercapai', text: `Luar biasa! Kamu telah mengumpulkan <b>${rp(c.bal)}</b> dan mencapai target tabungan.` });
    } else {
      a.push({ icon: ICONS.target, title: 'Tepat Sesuai Jadwal', text: `Perkembangan tabunganmu stabil dan sejalan dengan target rutin ${rp(S.s.routine)}/${UNIT[S.s.freq]}.` });
    }

    if (sa.actualPerUnit > 0) {
      a.push({ icon: ICONS.chart, title: 'Laju Bersih Aktual', text: `Kecepatan menabung bersihmu rata-rata <b>${rp(sa.actualPerUnit)} / ${UNIT[S.s.freq]}</b>.` });
    }
  }

  if (ins.length) {
    a.push({ icon: ICONS.in, title: 'Rata-rata Setoran', text: `Rata-rata nominal setoranmu adalah <b>${rp(c.i / ins.length)}</b> dari total ${ins.length} kali menabung.` });
  }

  const n = new Date(), k = today().slice(0, 7), pk = iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)).slice(0, 7);
  const cm = m.find(x => x.k === k), pm = m.find(x => x.k === pk);
  if (cm && pm && pm.i > 0) {
    const d = (cm.i - pm.i) / pm.i * 100;
    a.push({ icon: d >= 0 ? ICONS.chart : ICONS.out, title: 'Tren Bulanan', text: `Setoran bulan ini <b>${d >= 0 ? 'naik' : 'turun'} ${Math.abs(d).toFixed(0)}%</b> dibanding bulan lalu.` });
  }

  if (c.i > 0) {
    const r = c.o / c.i * 100;
    if (r > 30) {
      a.push({ icon: ICONS.shield, title: 'Perhatian Arus Kas', text: `Penarikan mencapai <b>${r.toFixed(0)}%</b> dari dana disetor. Kurangi penarikan agar target lekas tercapai.` });
    } else {
      a.push({ icon: ICONS.check, title: 'Arus Kas Sehat', text: `Rasio penarikan sangat aman, hanya <b>${r.toFixed(0)}%</b> dari total dana yang kamu setorkan.` });
    }
  }

  if (st.cur > 0) {
    a.push({ icon: ICONS.streak, title: 'Saving Streak', text: `Disiplin menabung <b>${st.cur} minggu berturut-turut</b> (rekor terbaikmu: ${st.best} minggu).` });
  }

  return a;
}

const insCard = () => `
<section class="card insights-card">
  <h3>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ac2)"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
    Wawasan & Evaluasi Tabungan
  </h3>
  <div class="insights-list">
    ${insights().map(i => `
      <div class="insight-item">
        <div class="insight-icon">${i.icon}</div>
        <div class="insight-content">
          <div style="font-weight:600;color:var(--tx-bright);margin-bottom:2px">${esc(i.title)}</div>
          <div class="mu">${i.text}</div>
        </div>
      </div>
    `).join('')}
  </div>
</section>`;

/* ---------- Grafik SVG Interaktif ---------- */
function chart(id, L, series, bar, options = {}) {
  const el = $('#' + id);
  if (!el) return;
  if (!L || !L.length) {
    el.innerHTML = '<p class="mu empty">Belum ada data untuk ditampilkan.</p>';
    return;
  }
  const W = 640, H = 260, P = { l: 60, r: 16, t: 18, b: 32 }, iw = W - P.l - P.r, ih = H - P.t - P.b;
  const n = L.length, all = series.flatMap(s => s.D);
  const mx = Math.max(...all, 1), mn = Math.min(...all, 0);
  const X = i => P.l + (bar || n === 1 ? iw * (i + .5) / n : iw * i / Math.max(1, n - 1));
  const Y = v => P.t + ih * (1 - (v - mn) / ((mx - mn) || 1));
  const sh = v => {
    const a = Math.abs(v);
    return (v < 0 ? '-' : '') + (a >= 1e9 ? +(a / 1e9).toFixed(1) + ' M' : a >= 1e6 ? +(a / 1e6).toFixed(1) + ' jt' : a >= 1e3 ? Math.round(a / 1e3) + ' rb' : a);
  };

  let g = '';
  // Garis grid horizontal & label sumbu Y
  for (let k = 0; k <= 4; k++) {
    const v = mn + (mx - mn) * k / 4, y = Y(v);
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="gl"/><text x="${P.l - 8}" y="${y + 4}" text-anchor="end" class="ax">${sh(v)}</text>`;
  }

  // Garis batas nol jika ada nilai negatif
  if (mn < 0 && mx > 0) {
    const y0 = Y(0);
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y0}" y2="${y0}" stroke="var(--bd)" stroke-width="1.5"/>`;
  }

  // Label sumbu X dinamis (tidak saling bertumpukan)
  const maxLabels = Math.min(6, n);
  const step = Math.max(1, Math.ceil(n / maxLabels));
  L.forEach((l, i) => {
    if (i % step === 0 || i === n - 1) {
      g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="ax">${l}</text>`;
    }
  });

  // Gambar series grafik
  series.forEach((s, j) => {
    if (bar) {
      const bw = iw / n / (series.length + 0.6);
      s.D.forEach((v, i) => {
        const y = Y(v), y0 = Y(0);
        g += `<rect class="chart-bar" data-series="${j}" data-idx="${i}" x="${X(i) - bw * series.length / 2 + j * bw}" y="${Math.min(y, y0)}" width="${Math.max(3, bw * .85)}" height="${Math.max(2, Math.abs(y0 - y))}" rx="3" fill="${s.c}"/>`;
      });
    } else {
      const pts = s.D.map((v, i) => `${X(i)},${Y(v)}`);
      g += `<path d="M${pts.join('L')}" fill="none" stroke="${s.c}" stroke-width="${s.width || 2.8}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
      if (s.area && n > 1) {
        g += `<path d="M${X(0)},${Y(mn)}L${pts.join('L')}L${X(n - 1)},${Y(mn)}Z" fill="${s.c}" opacity=".14"/>`;
      }
      if (!s.dash && n <= 30) {
        s.D.forEach((v, i) => g += `<circle cx="${X(i)}" cy="${Y(v)}" r="3.5" fill="${s.c}" stroke="var(--bg)" stroke-width="1.5"/>`);
      }
    }
  });

  // Elemen garis pemandu & titik aktif interaktif
  g += `<line id="${id}-guide" class="chart-guide" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" style="display:none"/>`;
  if (!bar) {
    series.forEach((s, j) => {
      if (!s.dash) {
        g += `<circle id="${id}-dot-${j}" class="chart-glow-dot" r="5" style="display:none;fill:${s.c}"/>`;
      }
    });
  }

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}</svg><div class="tip"></div><div class="lg">${series.map(s => `<span><i style="background:${s.c}"></i>${s.N}</span>`).join('')}</div>`;

  const tip = el.querySelector('.tip'), svg = el.querySelector('svg');
  const guide = el.querySelector(`#${id}-guide`);

  svg.onpointermove = e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
    let i = n === 1 ? 0 : bar ? Math.floor((x - P.l) / iw * n) : Math.round((x - P.l) / iw * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));

    const cx = X(i);
    if (guide) {
      guide.setAttribute('x1', cx);
      guide.setAttribute('x2', cx);
      guide.style.display = 'block';
    }

    if (!bar) {
      series.forEach((s, j) => {
        const dot = el.querySelector(`#${id}-dot-${j}`);
        if (dot && s.D[i] !== undefined) {
          dot.setAttribute('cx', cx);
          dot.setAttribute('cy', Y(s.D[i]));
          dot.style.display = 'block';
        }
      });
    }

    tip.style.display = 'block';
    const tipLeft = Math.min(Math.max(6, cx / W * r.width - 70), Math.max(6, r.width - 180));
    tip.style.left = tipLeft + 'px';

    if (options.customTip) {
      tip.innerHTML = options.customTip(i, L[i], series);
    } else {
      let content = `<b style="display:block;margin-bottom:4px;color:var(--tx-bright)">${L[i]}</b>`;
      series.forEach(s => {
        content += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;margin-top:2px">
          <span><i style="background:${s.c}"></i>${s.N}:</span>
          <b>${rp(s.D[i])}</b>
        </div>`;
      });
      tip.innerHTML = content;
    }
  };

  svg.onpointerleave = () => {
    tip.style.display = 'none';
    if (guide) guide.style.display = 'none';
    if (!bar) {
      series.forEach((_, j) => {
        const dot = el.querySelector(`#${id}-dot-${j}`);
        if (dot) dot.style.display = 'none';
      });
    }
  };
}

function projChart(id, b, t, r, f) {
  const el = $('#' + id);
  if (!el) return;
  if (!(t > 0) || !(r > 0)) {
    el.innerHTML = '<p class="mu empty">Isi nominal tabungan rutin dan target untuk melihat grafik proyeksi.</p>';
    return;
  }
  if (b >= t) {
    el.innerHTML = '<p class="mu empty" style="color:var(--ac2);font-weight:600">Target sudah tercapai</p>';
    return;
  }
  const e = est(b, t, r, f);
  if (!e || e.done) {
    el.innerHTML = '<p class="mu empty">Target sudah tercapai</p>';
    return;
  }
  const st = Math.max(1, Math.ceil(e.n / 24)), ks = [];
  for (let k = 0; k < e.n; k += st) ks.push(k);
  if (ks[ks.length - 1] !== e.n) ks.push(e.n);
  
  chart(id, ks.map(k => `${UNIT[f]} ${k}`), [
    { N: 'Saldo Proyeksi', c: GR, D: ks.map(k => Math.min(t, b + k * r)), area: 1 },
    { N: 'Garis Target', c: AM, D: ks.map(() => t), dash: '5 4' }
  ]);
}

/* ---------- Navigasi Modern dengan Ikon SVGs ---------- */
const NAV = [
  ['dashboard', 'Dashboard', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>'],
  ['riwayat', 'Riwayat Transaksi', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'],
  ['analytics', 'Analisis & Arus Kas', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>'],
  ['target', 'Target & Milestone', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>'],
  ['prediksi', 'Prediksi Waktu', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'],
  ['simulator', 'Simulator Skenario', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>'],
  ['kalender', 'Kalender Tabungan', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>'],
  ['laporan', 'Laporan Keuangan', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>'],
  ['backup', 'Cadangan & Data', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'],
  ['pengaturan', 'Pengaturan', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>']
];

$('#nav').innerHTML = NAV.map(n => `<a href="#${n[0]}">${n[2]}<span>${n[1]}</span></a>`).join('');

function render() {
  if (isPinActive() && !isUnlocked) {
    document.body.classList.add('locked');
    const btnLock = $('#btn-lock'); if (btnLock) btnLock.style.display = 'none';
    if (window.innerWidth <= 900) {
      const side = $('#side'); if (side) side.classList.remove('open');
      const ov = $('#side-overlay'); if (ov) ov.classList.remove('show');
    }
    renderLockScreen();
    return;
  }

  document.body.classList.remove('locked');
  const btnLock = $('#btn-lock'); if (btnLock) btnLock.style.display = isPinActive() ? 'inline-flex' : 'none';

  const v = S.s ? (location.hash.slice(1) || 'dashboard') : 'setup';
  const f = V[v] || V.dashboard;
  document.body.classList.toggle('nosetup', !S.s);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.hash === '#' + v));
  $('#ttl').textContent = (NAV.find(n => n[0] === v) || [0, 'Pengaturan Awal Tabungan'])[1];
  if (window.innerWidth <= 900) {
    const side = $('#side'); if (side) side.classList.remove('open');
    const ov = $('#side-overlay'); if (ov) ov.classList.remove('show');
  }
  renderAuthUI();
  f();
}

const st4 = (l, v, s, iconClass = 'emerald', iconSymbol = '') => `
<div class="card">
  <div class="stat-header">
    <span class="mu" style="font-weight:500;font-size:12.5px">${l}</span>
    ${iconSymbol ? `<div class="stat-icon ${iconClass}">${iconSymbol}</div>` : ''}
  </div>
  <div class="stat-val">${v}</div>
  <div class="stat-sub">${s || ''}</div>
</div>`;
const bar = p => `<div class="bar"><i style="width:${Math.min(100, Math.max(0, p))}%"></i></div>`;
const V = {};

/* ---------- Auth UI & Modals ---------- */
function renderAuthUI() {
  const sideEl = $('#side-user');
  const hdrEl = $('#hdr-auth');
  if (currentUser) {
    if (sideEl) {
      sideEl.innerHTML = `
      <div class="user-box">
        <span class="user-email" title="${esc(currentUser.email)}">${esc(currentUser.email)}</span>
        <span class="user-status"><span class="pulse-dot"></span> Cloud Tersinkron</span>
        <button class="btn ghost small" id="btn-logout">Keluar</button>
      </div>`;
      $('#btn-logout').onclick = handleLogout;
    }
    if (hdrEl) {
      hdrEl.innerHTML = `<button class="ib" id="btn-hdr-acc" title="${esc(currentUser.email)}">${ICONS.user} <span>Akun</span></button>`;
      $('#btn-hdr-acc').onclick = openAccountModal;
    }
  } else {
    if (sideEl) {
      sideEl.innerHTML = `
      <div class="user-box">
        <small class="mu" style="font-size:11.5px">Mode Offline (Penyimpanan Lokal)</small>
        <button class="btn small" id="btn-side-auth">Masuk / Daftar Cloud</button>
      </div>`;
      $('#btn-side-auth').onclick = () => openAuthModal();
    }
    if (hdrEl) {
      hdrEl.innerHTML = `<button class="btn ghost small" id="btn-hdr-auth">Masuk Cloud</button>`;
      $('#btn-hdr-auth').onclick = () => openAuthModal();
    }
  }
}

function openAuthModal(defaultTab = 'login') {
  const d = $('#dlg');
  let tab = defaultTab;

  const renderModal = (msg = '', isError = false) => {
    d.innerHTML = `
    <div>
      <h3>Akun Cloud TabunganKu</h3>
      <p class="mu" style="font-size:13px;margin:0">Login atau daftar akun agar data tabunganmu otomatis tersinkron antara HP dan Laptop.</p>
      <div class="auth-tabs" style="margin-top:12px">
        <button type="button" class="auth-tab ${tab === 'login' ? 'active' : ''}" id="tab-login">Masuk (Login)</button>
        <button type="button" class="auth-tab ${tab === 'signup' ? 'active' : ''}" id="tab-signup">Daftar Baru</button>
      </div>
      ${msg ? `<div style="padding:10px 12px;border-radius:10px;font-size:13px;background:${isError ? 'rgba(248,113,113,.15)' : 'rgba(16,185,129,.15)'};color:${isError ? 'var(--red)' : 'var(--ac2)'}">${esc(msg)}</div>` : ''}
      <form id="auth-form" style="display:grid;gap:12px">
        <label>Email
          <input name="email" type="email" required placeholder="nama@email.com">
        </label>
        <label>Password
          <input name="password" type="password" required minlength="6" placeholder="Minimal 6 karakter">
        </label>
        <div class="row" style="margin-top:6px">
          <button type="button" class="btn ghost" id="btn-auth-cancel">Batal</button>
          <button class="btn" id="btn-auth-submit">${tab === 'login' ? 'Masuk ke Akun' : 'Daftar Sekarang'}</button>
        </div>
      </form>
    </div>`;

    $('#tab-login').onclick = () => { tab = 'login'; renderModal(); };
    $('#tab-signup').onclick = () => { tab = 'signup'; renderModal(); };
    $('#btn-auth-cancel').onclick = () => d.close();

    $('#auth-form').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const email = f.get('email').trim();
      const password = f.get('password');
      const submitBtn = $('#btn-auth-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memproses...';

      if (tab === 'login') {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          renderModal(error.message === 'Invalid login credentials' ? 'Email atau password salah' : error.message, true);
        } else {
          d.close();
          toast('Berhasil masuk ke akun cloud');
          await fetchFromCloud();
        }
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) {
          renderModal(error.message, true);
        } else {
          if (data.session) {
            d.close();
            toast('Akun berhasil dibuat dan langsung terhubung');
            await syncToCloud();
          } else {
            renderModal('Pendaftaran berhasil! Akun Anda telah siap. Silakan klik tab Masuk untuk login.', false);
          }
        }
      }
    };
  };

  renderModal();
  d.showModal();
}

function openAccountModal() {
  const d = $('#dlg');
  d.innerHTML = `
  <div>
    <h3>Akun TabunganKu Cloud</h3>
    <div style="background:var(--bg);border:1px solid var(--bd);padding:14px;border-radius:12px;display:grid;gap:6px">
      <div class="mu" style="font-size:12px">Email Terdaftar:</div>
      <b style="font-size:15px">${esc(currentUser.email)}</b>
      <div style="color:var(--ac2);font-size:12px;margin-top:4px">● Status: Cloud Database Terhubung</div>
    </div>
    <p class="mu" style="font-size:13px">Setiap transaksi dan target otomatis tersimpan aman di cloud. Anda bisa login dari perangkat lain (HP/Laptop) menggunakan email ini.</p>
    <div class="row">
      <button class="btn ghost" id="btn-acc-close">Tutup</button>
      <button class="btn red" id="btn-acc-logout">Keluar (Logout)</button>
    </div>
  </div>`;
  $('#btn-acc-close').onclick = () => d.close();
  $('#btn-acc-logout').onclick = () => { d.close(); handleLogout(); };
  d.showModal();
}

async function handleLogout() {
  if (confirm('Yakin ingin keluar dari akun Cloud? Data lokal Anda tetap tersimpan di peramban ini.')) {
    if (sb) await sb.auth.signOut();
    currentUser = null;
    renderAuthUI();
    toast('Anda telah keluar dari akun cloud');
  }
}

/* ---------- Layar Kunci & Manajemen PIN Keamanan ---------- */
function renderLockScreen() {
  const sec = S.s?._security || {};
  $('#view').innerHTML = `
  <div class="lock-screen-wrap">
    <div class="lock-card">
      <div class="lock-icon-wrap">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <div class="lock-title">Tabungan Terkunci</div>
      <p class="lock-sub">Masukkan PIN keamanan untuk mengakses data dan saldo tabunganmu.</p>
      <form id="lock-form">
        <div class="pin-input-wrap">
          <input type="password" id="pin-field" class="pin-input" maxlength="8" inputmode="numeric" pattern="[0-9]*" placeholder="••••" autofocus autocomplete="off" required>
          <div id="pin-err-msg" style="display:none;color:var(--red);font-size:13px;font-weight:500;"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
          <button type="submit" class="btn" style="width:100%;max-width:260px;justify-content:center" id="btn-unlock-submit">
            <span>Buka Kunci</span>
          </button>
          <button type="button" class="btn ghost small" id="btn-forgot-pin" style="font-size:12.5px;color:var(--mu)">
            Lupa PIN Keamanan?
          </button>
        </div>
      </form>
    </div>
  </div>`;

  const pinInput = $('#pin-field');
  const form = $('#lock-form');
  const errMsg = $('#pin-err-msg');

  if (pinInput) {
    setTimeout(() => pinInput.focus(), 80);
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const val = pinInput.value.trim();
    if (!val) return;
    const h = await hashPin(val);
    if (h === sec.pinHash) {
      isUnlocked = true;
      document.body.classList.remove('locked');
      render();
      toast('Kunci layar dibuka');
    } else {
      pinInput.classList.add('pin-error');
      errMsg.textContent = 'PIN yang kamu masukkan salah';
      errMsg.style.display = 'block';
      pinInput.value = '';
      setTimeout(() => pinInput.classList.remove('pin-error'), 450);
    }
  };

  const btnForgot = $('#btn-forgot-pin');
  if (btnForgot) btnForgot.onclick = openForgotPinModal;
}

function openSetPinModal(isChange = false) {
  const d = $('#dlg');
  const sec = S.s?._security || {};

  d.innerHTML = `
  <div>
    <h3>${isChange ? 'Ubah PIN Keamanan' : 'Pasang PIN Keamanan Tabungan'}</h3>
    <p class="mu" style="font-size:13px;margin:0 0 14px">
      ${isChange 
        ? 'Masukkan PIN lama dan tentukan PIN baru untuk mengunci aplikasi saat dibuka.' 
        : 'Tentukan 4 sampai 6 digit angka rahasia agar saldo tabunganmu terlindungi saat membuka web ini.'}
    </p>
    <div id="pin-modal-err" style="display:none;padding:10px 12px;border-radius:10px;font-size:13px;background:rgba(248,113,113,.15);color:var(--red);margin-bottom:12px"></div>
    <form id="set-pin-form" style="display:grid;gap:12px">
      ${isChange ? `
        <label>PIN Lama Saat Ini
          <input type="password" id="old-pin" maxlength="8" inputmode="numeric" pattern="[0-9]*" placeholder="Masukkan PIN lama" required>
        </label>
      ` : ''}
      <label>PIN Baru (4 - 6 digit angka)
        <input type="password" id="new-pin" maxlength="8" inputmode="numeric" pattern="[0-9]*" placeholder="Contoh: 123456" required>
      </label>
      <label>Konfirmasi PIN Baru
        <input type="password" id="confirm-pin" maxlength="8" inputmode="numeric" pattern="[0-9]*" placeholder="Ulangi PIN baru" required>
      </label>
      <label>Petunjuk / Hint PIN (opsional)
        <input type="text" id="pin-hint" maxlength="50" placeholder="Contoh: Tahun lahir atau nomor penting" value="${esc(sec.hint || '')}">
      </label>
      <div class="row" style="margin-top:4px">
        <button type="button" class="btn ghost" id="btn-cancel-pin">Batal</button>
        <button type="submit" class="btn">${isChange ? 'Perbarui PIN' : 'Aktifkan Kunci PIN'}</button>
      </div>
    </form>
  </div>`;

  d.showModal();

  $('#btn-cancel-pin').onclick = () => d.close();

  $('#set-pin-form').onsubmit = async (e) => {
    e.preventDefault();
    const errBox = $('#pin-modal-err');
    const showErr = msg => {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    };

    if (isChange) {
      const oldVal = $('#old-pin').value.trim();
      const oldHash = await hashPin(oldVal);
      if (oldHash !== sec.pinHash) {
        showErr('PIN lama yang kamu masukkan tidak sesuai.');
        return;
      }
    }

    const newPin = $('#new-pin').value.trim();
    const confirmPin = $('#confirm-pin').value.trim();
    const hint = $('#pin-hint').value.trim();

    if (!/^\d{4,8}$/.test(newPin)) {
      showErr('PIN harus berupa 4 hingga 8 digit angka.');
      return;
    }
    if (newPin !== confirmPin) {
      showErr('Konfirmasi PIN tidak cocok dengan PIN baru.');
      return;
    }

    const pinHash = await hashPin(newPin);
    if (!S.s) S.s = {};
    S.s._security = {
      pinEnabled: true,
      pinHash,
      hint
    };
    isUnlocked = true;
    save();
    d.close();
    render();
    toast(isChange ? 'PIN keamanan berhasil diubah' : 'PIN keamanan berhasil diaktifkan');
  };
}

function openDisablePinModal() {
  const d = $('#dlg');
  const sec = S.s?._security || {};

  d.innerHTML = `
  <div>
    <h3>Nonaktifkan PIN Keamanan</h3>
    <p class="mu" style="font-size:13px;margin:0 0 14px">Masukkan PIN keamanan saat ini untuk menonaktifkan proteksi kunci layar.</p>
    <div id="disable-pin-err" style="display:none;padding:10px 12px;border-radius:10px;font-size:13px;background:rgba(248,113,113,.15);color:var(--red);margin-bottom:12px"></div>
    <form id="disable-pin-form" style="display:grid;gap:12px">
      <label>PIN Saat Ini
        <input type="password" id="cur-pin" maxlength="8" inputmode="numeric" pattern="[0-9]*" placeholder="Masukkan PIN" required>
      </label>
      <div class="row" style="margin-top:4px">
        <button type="button" class="btn ghost" id="btn-cancel-disable">Batal</button>
        <button type="submit" class="btn red">Nonaktifkan</button>
      </div>
    </form>
  </div>`;

  d.showModal();

  $('#btn-cancel-disable').onclick = () => d.close();

  $('#disable-pin-form').onsubmit = async (e) => {
    e.preventDefault();
    const curVal = $('#cur-pin').value.trim();
    const curHash = await hashPin(curVal);
    if (curHash !== sec.pinHash) {
      const errBox = $('#disable-pin-err');
      errBox.textContent = 'PIN yang kamu masukkan salah.';
      errBox.style.display = 'block';
      return;
    }

    if (S.s) {
      S.s._security = { pinEnabled: false, pinHash: null, hint: '' };
    }
    isUnlocked = true;
    save();
    d.close();
    render();
    toast('Kunci PIN berhasil dinonaktifkan');
  };
}

function openForgotPinModal() {
  const d = $('#dlg');
  const sec = S.s?._security || {};
  const hasHint = Boolean(sec.hint);

  d.innerHTML = `
  <div>
    <h3>Pemulihan PIN Keamanan</h3>
    <p class="mu" style="font-size:13px;margin:0 0 14px">
      ${currentUser 
        ? `Akunmu terhubung dengan Cloud (${esc(currentUser.email)}). Verifikasi kata sandi akun Cloud untuk mereset PIN.` 
        : `Kamu menggunakan penyimpanan lokal. Lihat petunjuk PIN atau reset PIN jika diperlukan.`}
    </p>

    ${hasHint ? `
      <div style="padding:12px;border-radius:10px;background:var(--card-sub);border:1px solid var(--bd);margin-bottom:14px">
        <div style="font-size:12px;color:var(--mu);margin-bottom:2px">Petunjuk PIN yang pernah kamu buat:</div>
        <div style="font-weight:600;color:var(--tx-bright);font-size:14px">${esc(sec.hint)}</div>
      </div>
    ` : ''}

    <div id="forgot-err" style="display:none;padding:10px 12px;border-radius:10px;font-size:13px;background:rgba(248,113,113,.15);color:var(--red);margin-bottom:12px"></div>

    ${currentUser ? `
      <form id="forgot-cloud-form" style="display:grid;gap:12px">
        <label>Kata Sandi Akun Cloud (${esc(currentUser.email)})
          <input type="password" id="cloud-pwd" placeholder="Masukkan sandi akunmu" required>
        </label>
        <div class="row">
          <button type="button" class="btn ghost" id="btn-cancel-forgot">Batal</button>
          <button type="submit" class="btn">Verifikasi & Reset PIN</button>
        </div>
      </form>
    ` : `
      <div style="display:grid;gap:10px">
        <p class="mu" style="font-size:12.5px;margin:0">
          Jika kamu benar-benar lupa PIN pada mode offline, kamu dapat mereset PIN keamanan tanpa menghapus catatan tabunganmu.
        </p>
        <div class="row">
          <button type="button" class="btn ghost" id="btn-cancel-forgot">Kembali</button>
          <button type="button" class="btn red" id="btn-reset-pin-offline">Reset PIN Sekarang</button>
        </div>
      </div>
    `}
  </div>`;

  d.showModal();

  $('#btn-cancel-forgot').onclick = () => d.close();

  if (currentUser) {
    $('#forgot-cloud-form').onsubmit = async (e) => {
      e.preventDefault();
      const pwd = $('#cloud-pwd').value;
      const errBox = $('#forgot-err');
      if (!pwd) return;

      try {
        const { error } = await sb.auth.signInWithPassword({
          email: currentUser.email,
          password: pwd
        });
        if (error) {
          errBox.textContent = 'Kata sandi akun salah: ' + error.message;
          errBox.style.display = 'block';
          return;
        }

        if (S.s) S.s._security = { pinEnabled: false, pinHash: null, hint: '' };
        isUnlocked = true;
        save();
        d.close();
        render();
        toast('PIN keamanan berhasil direset. Silakan pasang PIN baru jika diinginkan.');
      } catch (err) {
        errBox.textContent = 'Gagal memverifikasi akun: ' + err.message;
        errBox.style.display = 'block';
      }
    };
  } else {
    $('#btn-reset-pin-offline').onclick = () => {
      if (confirm('Konfirmasi: Reset PIN keamanan dan buka tabungan?')) {
        if (S.s) S.s._security = { pinEnabled: false, pinHash: null, hint: '' };
        isUnlocked = true;
        save();
        d.close();
        render();
        toast('PIN keamanan berhasil direset');
      }
    };
  }
}

/* ---------- Pengaturan Awal & Pengaturan ---------- */
function settingsForm(first) {
  const s = S.s || {};
  $('#view').innerHTML = `<section class="card ${first ? 'narrow' : ''}">
  <h2>${first ? 'Selamat Datang! Atur Target Tabunganmu' : 'Pengaturan Tabungan'}</h2>
  <p class="mu" style="margin-bottom:18px">${first ? 'Tentukan target dan jadwal menabung. Sistem akan otomatis memproyeksikan tanggal pencapaiannya.' : 'Perbarui nominal atau jadwal tabunganmu kapan saja. Perubahan saldo awal akan dicatat di log.'}</p>
  <form id="sf" class="grid2">
    <label>Saldo Awal (Rp)<input name="initial" type="number" min="0" step="1" required placeholder="Contoh: 1000000" value="${s.initial ?? ''}"></label>
    <label>Target Tabungan (Rp)<input name="target" type="number" min="1" step="1" required placeholder="Contoh: 50000000" value="${s.target ?? ''}"></label>
    <label>Target Setoran Rutin (Rp)<input name="routine" type="number" min="1" step="1" required placeholder="Contoh: 500000" value="${s.routine ?? ''}"></label>
    <label>Tanggal Mulai Menabung<input name="start" type="date" required value="${s.start ?? today()}"></label>
    <label>Frekuensi Menabung<select name="freq" required><option value="" disabled ${s.freq ? '' : 'selected'}>Pilih frekuensi</option>${opts(FREQ, s.freq || 'mingguan')}</select></label>
    <div class="row" style="grid-column:1/-1"><button class="btn">${first ? 'Mulai Menabung Sekarang' : 'Simpan Perubahan'}</button></div>
  </form>
  ${first ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--bd);display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px" class="mu">
    <span>Sudah punya cadangan data?</span>
    <button class="btn ghost small" id="btn-login-first">Masuk Cloud</button>
    <span>atau</span>
    <label class="btn ghost small" style="cursor:pointer;color:var(--tx)">Pulihkan File JSON<input type="file" id="imp0" accept=".json" hidden></label>
  </div>` : ''}</section>
  ${first ? '' : `
  <section class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap">
      <div>
        <h3 style="margin:0;display:flex;align-items:center;gap:8px">
          ${ICONS.shield} Kunci Layar & Keamanan PIN
        </h3>
        <p class="mu" style="margin:4px 0 0;font-size:13px">
          ${isPinActive() 
            ? 'Keamanan PIN aktif. Aplikasi meminta PIN setiap kali dibuka untuk melindungi saldo dan privasi tabunganmu.' 
            : 'Lindungi privasi saldo dan target tabunganmu dari orang lain saat membuka aplikasi ini.'}
        </p>
      </div>
      <div>
        <span class="badge ${isPinActive() ? 'ahead' : 'behind'}" style="font-size:12px">
          ${isPinActive() ? 'Aktif' : 'Nonaktif'}
        </span>
      </div>
    </div>
    <div class="row" style="margin-top:14px;gap:10px;flex-wrap:wrap">
      ${isPinActive() ? `
        <button type="button" class="btn small" id="btn-change-pin">Ubah PIN</button>
        <button type="button" class="btn ghost red small" id="btn-disable-pin">Nonaktifkan PIN</button>
        <button type="button" class="btn ghost small" id="btn-test-lock">Kunci Layar Sekarang</button>
      ` : `
        <button type="button" class="btn small" id="btn-setup-pin">Pasang PIN Keamanan</button>
      `}
    </div>
  </section>
  <section class="card">
    <h3>Tampilan Tema</h3>
    <p class="mu" style="margin-bottom:12px">Pilih tema tampilan yang paling nyaman untuk matamu.</p>
    <button class="btn ghost" id="th2">Ganti ke ${S.theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</button>
  </section>
  <section class="card">
    <h3>Riwayat Perubahan Saldo Awal</h3>
    ${S.log.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Sebelumnya</th><th class="r">Saldo Awal Baru</th></tr></thead><tbody>${[...S.log].reverse().map(l => `<tr><td>${fd(l.date)}</td><td>${l.from === null ? 'Saldo awal pertama' : rp(l.from)}</td><td class="r in">${rp(l.to)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mu empty">Belum ada perubahan saldo awal.</p>'}
  </section>`}`;

  $('#sf').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const n = {
      initial: Math.max(0, Math.round(+f.get('initial'))),
      target: Math.max(1, Math.round(+f.get('target'))),
      routine: Math.max(1, Math.round(+f.get('routine'))),
      start: f.get('start'),
      freq: f.get('freq'),
      _security: S.s?._security || null
    };
    if (S.s && calc().i - calc().o + n.initial < 0) {
      toast('Saldo awal membuat saldo total menjadi negatif');
      return;
    }
    if (!S.s) {
      S.log.push({ date: today(), from: null, to: n.initial });
    } else if (S.s.initial !== n.initial) {
      S.log.push({ date: today(), from: S.s.initial, to: n.initial });
    }
    S.s = n;
    save();
    toast('Pengaturan tabungan berhasil disimpan');
    if (first || location.hash !== '#dashboard') location.hash = '#dashboard';
    render();
  };

  if ($('#btn-login-first')) $('#btn-login-first').onclick = () => openAuthModal('login');
  if ($('#th2')) $('#th2').onclick = toggleTheme;
  if ($('#imp0')) $('#imp0').onchange = e => importJSON(e.target.files[0]);
  if ($('#btn-setup-pin')) $('#btn-setup-pin').onclick = () => openSetPinModal(false);
  if ($('#btn-change-pin')) $('#btn-change-pin').onclick = () => openSetPinModal(true);
  if ($('#btn-disable-pin')) $('#btn-disable-pin').onclick = () => openDisablePinModal();
  if ($('#btn-test-lock')) $('#btn-test-lock').onclick = () => {
    isUnlocked = false;
    render();
    toast('Layar tabungan dikunci');
  };
}

V.setup = () => settingsForm(true);
V.pengaturan = () => settingsForm(false);

/* ---------- Dashboard ---------- */
const sorted = l => [...l].sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));

function rows(l, act) {
  if (!l.length) return '<p class="mu empty">Tidak ada transaksi tercatat.</p>';
  return `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Catatan</th><th class="r">Nominal</th>${act ? '<th>Aksi</th>' : ''}</tr></thead><tbody>${l.map(x => `<tr><td>${fd(x.date)}</td><td><span class="bd ${x.type}">${x.type === 'in' ? '+ Setoran' : '- Penarikan'}</span></td><td>${esc(x.cat)}</td><td>${esc(x.note) || '-'}</td><td class="r ${x.type}">${x.type === 'in' ? '+' : '-'}${rp(x.amount)}</td>${act ? `<td class="r nw"><button class="ib" data-a="edit" data-id="${x.id}" title="Edit">Edit</button> <button class="ib" data-a="del" data-id="${x.id}" title="Hapus">Hapus</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

V.dashboard = () => {
  const c = calc(), s = S.s, e = est(c.bal), st = streak(), sa = scheduleAnalysis(), nm = nextMilestone();

  let milestoneSnippet = 'Belum ada milestone';
  if (nm) {
    if (nm.allDone) {
      milestoneSnippet = 'Semua milestone tercapai';
    } else {
      milestoneSnippet = `${esc(nm.milestone.name)}: ${rp(nm.milestone.amount)} · Kurang ${rp(nm.rem)}`;
    }
  }

  $('#view').innerHTML = `
  <div class="stats">
    <div class="card hero">
      <div class="hero-chip-row">
        <div class="hero-chip-badge">
          <span class="pulse-dot"></span> Tabungan Utama
        </div>
        <span class="hero-chip-badge" style="background:rgba(255,255,255,0.2)">${c.pct.toFixed(1)}% Terkumpul</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <div class="hero-balance-label" style="margin-bottom:0">Total Saldo Terkini</div>
        <button type="button" class="hero-privacy-btn" id="hero-eye-toggle" title="${isBalanceHidden ? 'Tampilkan Nominal Saldo' : 'Sembunyikan Nominal Saldo'}">
          ${isBalanceHidden ? ICONS.eyeOff : ICONS.eye}
        </button>
      </div>
      <div class="hero-balance">${rp(c.bal)}</div>
      <div class="hero-meta-row">
        <div class="hero-meta-item">Saldo Awal: <b>${rp(s.initial)}</b></div>
        <div class="hero-meta-item">Target: <b>${rp(s.target)}</b></div>
        <div class="hero-meta-item">Sisa: <b>${rp(c.rem)}</b></div>
      </div>
    </div>

    ${st4('Target Tabungan', rp(s.target), 'Rutin ' + rp(s.routine) + ' / ' + UNIT[s.freq], 'sky', ICONS.target)}
    ${st4('Status Jadwal', `<span class="pill ${sa.badgeClass}">${sa.aheadText}</span>`, sa.diffBal >= 0 ? `Surplus ${rp(sa.diffBal)} dari target` : `Kurang ${rp(Math.abs(sa.diffBal))} dari target`, 'amber', ICONS.clock)}
    ${st4('Sisa Menuju Target', rp(c.rem), c.rem ? `${(100 - c.pct).toFixed(1)}% lagi untuk dicapai` : 'Target Tercapai', 'purple', ICONS.flag)}
    ${st4('Milestone Terdekat', nm && !nm.allDone ? esc(nm.milestone.name) : 'Semua Tercapai', milestoneSnippet, 'emerald', ICONS.milestone)}
    ${st4('Saving Streak', st.cur + ' Minggu Beruntun', 'Rekor terbaik: ' + st.best + ' minggu', 'rose', ICONS.streak)}
  </div>

  <section class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <h3>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ac2)"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        Progres Target Tabungan (${rp(s.target)})
      </h3>
      <span style="font-weight:700;font-size:16px;color:var(--ac2)">${c.pct.toFixed(1)}%</span>
    </div>
    ${bar(c.pct)}
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:10px;font-size:13px" class="mu">
      <span>Estimasi Rencana Rutin: <b style="color:var(--tx-bright)">${estTxt(e)}</b></span>
      <span>Estimasi Tempo Aktual: <b style="color:var(--tx-bright)">${sa.estActual ? (sa.estActual.done ? 'Target tercapai' : fdo(sa.estActual.d) + ` (${sa.estActual.n} ${UNIT[s.freq]} lagi)`) : 'Perlu lebih banyak transaksi'}</b></span>
    </div>
  </section>

  <div class="g2">
    <section class="card">
      <div class="chart-header">
        <h3 style="margin:0;display:flex;align-items:center;gap:8px">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ac2)"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
          Grafik Pertumbuhan Saldo
        </h3>
        <div class="range-pills" id="bal-range-pills">
          <button type="button" class="range-pill ${balRange === '1m' ? 'active' : ''}" data-range="1m">1 Bln</button>
          <button type="button" class="range-pill ${balRange === '3m' ? 'active' : ''}" data-range="3m">3 Bln</button>
          <button type="button" class="range-pill ${balRange === '6m' ? 'active' : ''}" data-range="6m">6 Bln</button>
          <button type="button" class="range-pill ${balRange === '1y' ? 'active' : ''}" data-range="1y">1 Thn</button>
          <button type="button" class="range-pill ${balRange === 'all' ? 'active' : ''}" data-range="all">Semua</button>
        </div>
      </div>
      <div class="ch" id="c1"></div>
    </section>
    ${insCard()}
  </div>

  <section class="card" style="margin-top:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <h3 style="margin:0">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--ac2)"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        5 Transaksi Terakhir
      </h3>
      <a href="#riwayat" class="btn ghost small" style="text-decoration:none">Lihat Semua →</a>
    </div>
    ${rows(sorted(S.tx).slice(0, 5), true)}
  </section>`;

  if ($('#hero-eye-toggle')) $('#hero-eye-toggle').onclick = toggleBalancePrivacy;
  const b = balSeries(balRange);
  chart('c1', b.L, [{ N: 'Saldo Tabungan', c: GR, D: b.D, area: 1 }]);

  document.querySelectorAll('#bal-range-pills .range-pill').forEach(btn => {
    btn.onclick = () => {
      balRange = btn.dataset.range;
      render();
    };
  });
};

/* ---------- Transaksi Modal ---------- */
function openTx(id, defaultDate) {
  const x = S.tx.find(t => String(t.id) === String(id)) || { type: 'in', date: defaultDate || today(), cat: '', note: '' };
  const d = $('#dlg');
  d.innerHTML = `<form id="tf"><h3>${id ? 'Edit' : 'Tambah'} Transaksi</h3>
  <div class="seg">
    <label><input type="radio" name="type" value="in" ${x.type === 'in' ? 'checked' : ''}>Setoran</label>
    <label><input type="radio" name="type" value="out" ${x.type === 'out' ? 'checked' : ''}>Penarikan</label>
  </div>
  <label>Nominal (Rp)<input name="amount" type="number" min="1" step="1" required placeholder="Contoh: 700000" value="${x.amount || ''}"></label>
  <label>Tanggal<input name="date" type="date" required value="${x.date}"></label>
  <label>Kategori<select name="cat" required></select></label>
  <label>Catatan (opsional)<input name="note" maxlength="120" placeholder="Keterangan singkat" value="${esc(x.note)}"></label>
  <div class="row"><button type="button" class="btn ghost" id="cx">Batal</button><button class="btn">Simpan Transaksi</button></div></form>`;

  const fill = () => {
    const t = d.querySelector('[name=type]:checked').value;
    d.querySelector('[name=cat]').innerHTML = CAT[t].map(c => `<option ${c === x.cat ? 'selected' : ''}>${c}</option>`).join('');
  };
  d.querySelectorAll('[name=type]').forEach(r => r.onchange = fill);
  fill();
  $('#cx').onclick = () => d.close();

  $('#tf').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    attempt({
      type: f.get('type'),
      amount: Math.round(+f.get('amount')),
      date: f.get('date'),
      cat: f.get('cat'),
      note: f.get('note').trim()
    }, id);
  };
  d.showModal();
}

function attempt(n, id) {
  if (!$('#dlg').open || !(n.amount > 0)) return;
  const list = S.tx.filter(t => String(t.id) !== String(id)).concat([{ ...n, id: id || 'temp' }]);
  const a = calc(), b = calc(list);
  if (b.bal < 0) {
    toast('Saldo tabungan tidak mencukupi untuk melakukan penarikan sebesar nominal tersebut');
    return;
  }
  if (n.type !== 'out') return commit(n, id);

  const e = est(b.bal);
  $('#dlg').innerHTML = `<div><h3>Konfirmasi Dampak Penarikan</h3><div class="imp">
  <div>Saldo Tabungan<b>${rp(a.bal, true)} → ${rp(b.bal, true)}</b></div>
  <div>Progres Target<b>${a.pct.toFixed(1)}% → ${b.pct.toFixed(1)}%</b></div>
  <div>Sisa Target<b>${rp(a.rem, true)} → ${rp(b.rem, true)}</b></div>
  <div>Estimasi Tercapai<b>${e ? (e.done ? 'Tercapai' : fdo(e.d)) : '-'}</b></div></div>
  <p class="mu" style="margin-top:10px">Penarikan ${rp(n.amount, true)} akan memperlambat jadwal pencapaian target tabunganmu.</p>
  <div class="row"><button class="btn ghost" id="bk">Batal</button><button class="btn red" id="ok">Tetap Tarik Dana</button></div></div>`;
  $('#bk').onclick = () => $('#dlg').close();
  $('#ok').onclick = () => { $('#ok').disabled = true; commit(n, id); };
}

function commit(n, id) {
  if (id) {
    const i = S.tx.findIndex(t => String(t.id) === String(id));
    if (i < 0) return;
    S.tx[i] = { ...S.tx[i], ...n, id: S.tx[i].id };
  } else {
    S.tx.push({
      ...n,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now()
    });
  }
  save();
  $('#dlg').close();
  toast(id ? 'Transaksi berhasil diperbarui' : 'Transaksi baru berhasil dicatat');
  render();
}

function openDeleteTxModal(id) {
  const x = S.tx.find(t => String(t.id) === String(id));
  if (!x) {
    toast('Transaksi tidak ditemukan');
    return;
  }

  const d = $('#dlg');
  d.innerHTML = `
  <div>
    <h3>Hapus Catatan Transaksi</h3>
    <p class="mu" style="font-size:13px;margin:0 0 14px;line-height:1.5">
      Apakah kamu yakin ingin menghapus transaksi <b>${x.type === 'in' ? 'Setoran' : 'Penarikan'} (${rp(x.amount, true)})</b> kategori <b>${esc(x.cat)}</b> pada tanggal <b>${fd(x.date)}</b>? Saldo tabungan akan otomatis dihitung ulang.
    </p>
    <div class="row">
      <button type="button" class="btn ghost" id="btn-cancel-del">Batal</button>
      <button type="button" class="btn red" id="btn-confirm-del">Hapus Transaksi</button>
    </div>
  </div>`;
  d.showModal();

  $('#btn-cancel-del').onclick = () => d.close();
  $('#btn-confirm-del').onclick = () => {
    const t = S.tx.filter(item => String(item.id) !== String(id));
    if (calc(t).bal < 0) {
      d.close();
      toast('Tidak bisa dihapus karena menyebabkan saldo tabungan menjadi negatif');
      return;
    }
    S.tx = t;
    save();
    d.close();
    toast('Transaksi berhasil dihapus');
    render();
  };
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const { a, id } = b.dataset;
  if (a === 'edit') openTx(id);
  if (a === 'del') openDeleteTxModal(id);
  if (a === 'delms') {
    S.ms = S.ms.filter(m => String(m.id) !== String(id));
    save();
    render();
  }
});

/* ---------- Riwayat Transaksi ---------- */
const F = { q: '', t: '', c: '', m: '' };
V.riwayat = () => {
  const ms = [...new Set(S.tx.map(x => x.date.slice(0, 7)))].sort().reverse();
  const cats = [...new Set([...CAT.in, ...CAT.out])];
  $('#view').innerHTML = `<section class="card"><div class="fil">
    <label>Cari Transaksi<input id="fq" placeholder="Catatan atau kategori..." value="${esc(F.q)}"></label>
    <label>Jenis<select id="ft"><option value="">Semua Jenis</option><option value="in">Setoran</option><option value="out">Penarikan</option></select></label>
    <label>Kategori<select id="fc"><option value="">Semua Kategori</option>${cats.map(c => `<option>${c}</option>`).join('')}</select></label>
    <label>Bulan Transaksi<select id="fm"><option value="">Semua Periode</option>${ms.map(m => `<option value="${m}">${mlong(m)}</option>`).join('')}</select></label>
  </div><div id="tb"></div></section>`;

  $('#ft').value = F.t;
  $('#fc').value = F.c;
  $('#fm').value = F.m;

  const upd = () => {
    F.q = $('#fq').value; F.t = $('#ft').value; F.c = $('#fc').value; F.m = $('#fm').value;
    const q = F.q.toLowerCase();
    const l = sorted(S.tx).filter(x => (!F.t || x.type === F.t) && (!F.c || x.cat === F.c) && (!F.m || x.date.startsWith(F.m)) && (!q || (x.note + ' ' + x.cat).toLowerCase().includes(q)));
    $('#tb').innerHTML = rows(l, true) + (l.length ? `<p class="mu" style="margin-top:12px;font-size:13px">${l.length} transaksi ditemukan</p>` : '');
  };
  ['fq', 'ft', 'fc', 'fm'].forEach(i => $('#' + i).oninput = upd);
  upd();
};

/* ---------- Analytics ---------- */
V.analytics = () => {
  const c = calc(), s = S.s;
  const allMonths = monthly();
  const monthKeys = allMonths.map(x => x.k).reverse();
  const allYears = [...new Set(allMonths.map(x => x.k.slice(0, 4)))].sort().reverse();

  const isAll = analyticsPeriod === 'all';
  const filteredTx = isAll ? S.tx : S.tx.filter(x => x.date.startsWith(analyticsPeriod));

  const mIn = sum('in', filteredTx);
  const mOut = sum('out', filteredTx);
  const mNet = mIn - mOut;
  const mCount = filteredTx.length;
  const mInsCount = filteredTx.filter(x => x.type === 'in').length;
  const mSavingRate = mIn > 0 ? (mNet / mIn * 100) : 0;
  const mAvgIn = mInsCount > 0 ? (mIn / mInsCount) : 0;
  const mMx = mInsCount > 0 ? Math.max(...filteredTx.filter(x => x.type === 'in').map(x => x.amount)) : 0;

  const insAll = S.tx.filter(x => x.type === 'in');
  const insCountAll = insAll.length;
  const mxAll = insCountAll ? Math.max(...insAll.map(x => x.amount)) : 0;

  const sa = scheduleAnalysis();

  // Kumulatif target rencana vs realisasi aktual
  const bSeries = balSeries('all');
  const L = bSeries.L;
  const actualData = bSeries.D;
  const plannedData = L.map((_, idx) => s.initial + (idx * s.routine));

  // Filter bulanan untuk grafik Setoran vs Penarikan
  let displayM = [...allMonths];
  if (c2Filter === '6m') displayM = displayM.slice(-6);
  else if (c2Filter === '12m') displayM = displayM.slice(-12);
  else if (c2Filter !== 'all') displayM = displayM.filter(x => x.k.startsWith(c2Filter));

  // Kategori transaksi untuk periode terpilih
  const catSummary = {};
  filteredTx.forEach(x => {
    const k = x.type + '|' + x.cat;
    catSummary[k] = (catSummary[k] || 0) + x.amount;
  });

  const catRows = t => {
    const entries = Object.entries(catSummary).filter(([k]) => k.startsWith(t)).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '<tr><td class="mu" style="font-size:12.5px">Belum ada transaksi</td><td class="r">-</td></tr>';
    return entries.map(([k, v]) => `<tr><td>${k.split('|')[1]}</td><td class="r ${t}">${t === 'in' ? '+' : '-'}${rp(v)}</td></tr>`).join('');
  };

  $('#view').innerHTML = `
  <section class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
    <div>
      <h2 style="margin:0 0 4px">Analisis & Arus Kas</h2>
      <p class="mu" style="margin:0;font-size:13px">
        ${isAll 
          ? 'Menganalisis arus kas kumulatif secara menyeluruh dari seluruh riwayat tabungan.' 
          : `Menampilkan rincian arus kas khusus periode <b>${mlong(analyticsPeriod)}</b>.`}
      </p>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      <label style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;margin:0" class="mu">
        Pilih Periode:
        <select id="analytics-month-sel" class="cal-select" style="min-width:190px">
          <option value="all" ${analyticsPeriod === 'all' ? 'selected' : ''}>Semua Periode (Keseluruhan)</option>
          ${monthKeys.map(k => `<option value="${k}" ${analyticsPeriod === k ? 'selected' : ''}>${mlong(k)}</option>`).join('')}
        </select>
      </label>
    </div>
  </section>

  <div class="stats">
    ${isAll ? `
      ${st4('Rata-rata Setoran', rp(insCountAll ? c.i / insCountAll : 0), insCountAll + ' kali setoran', 'emerald', ICONS.in)}
      ${st4('Laju Tabungan Bersih', rp(sa.actualPerUnit), 'rata-rata per ' + UNIT[s.freq], 'sky', ICONS.bolt)}
      ${st4('Total Dana Disetor', rp(c.i), 'Semua setoran masuk', 'emerald', ICONS.wallet)}
      ${st4('Total Penarikan', rp(c.o), `${(c.i > 0 ? (c.i - c.o) / c.i * 100 : 0).toFixed(1)}% rasio simpanan bersih`, 'rose', ICONS.out)}
      ${st4('Setoran Terbesar', rp(mxAll), 'Paling banyak disetor', 'purple', ICONS.chart)}
    ` : `
      ${st4('Setoran Bulan Ini', rp(mIn), mInsCount + ' kali setoran masuk', 'emerald', ICONS.in)}
      ${st4('Penarikan Bulan Ini', rp(mOut), (mCount - mInsCount) + ' kali penarikan', 'rose', ICONS.out)}
      ${st4('Tabungan Bersih', rp(mNet), mNet >= 0 ? 'Surplus bulan ini' : 'Defisit bulan ini', mNet >= 0 ? 'emerald' : 'rose', ICONS.wallet)}
      ${st4('Rasio Simpanan', `${mSavingRate.toFixed(1)}%`, mIn > 0 ? 'Dari dana masuk tersimpan' : 'Belum ada setoran', 'sky', ICONS.target)}
      ${st4('Rata-rata Setoran', rp(mAvgIn), 'Nominal per transaksi', 'purple', ICONS.chart)}
    `}
  </div>

  ${isAll ? '' : `
  <div class="g2" style="margin-bottom:20px">
    <section class="card">
      <h3>Distribusi Setoran (${mlong(analyticsPeriod)})</h3>
      <div class="tw"><table><tbody>${catRows('in')}</tbody></table></div>
    </section>
    <section class="card">
      <h3>Distribusi Penarikan (${mlong(analyticsPeriod)})</h3>
      <div class="tw"><table><tbody>${catRows('out')}</tbody></table></div>
    </section>
  </div>`}

  <div class="g2">
    <section class="card">
      <h3>Target Rencana vs Realisasi Aktual</h3>
      <p class="mu" style="font-size:12.5px;margin-bottom:10px">Bandingkan garis target rencana awal dengan saldo tabunganmu.</p>
      <div class="ch" id="c_plan"></div>
    </section>
    <section class="card">
      <div class="chart-header">
        <div>
          <h3 style="margin:0">Setoran vs Penarikan per Bulan</h3>
          <p class="mu" style="font-size:12.5px;margin:2px 0 0">Perbandingan uang masuk vs uang keluar setiap periode bulanan.</p>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <select id="c2-filter" class="cal-select" style="font-size:12px;padding:4px 8px">
            <option value="all" ${c2Filter === 'all' ? 'selected' : ''}>Semua Bulan</option>
            <option value="12m" ${c2Filter === '12m' ? 'selected' : ''}>12 Bulan Terakhir</option>
            <option value="6m" ${c2Filter === '6m' ? 'selected' : ''}>6 Bulan Terakhir</option>
            ${allYears.map(yr => `<option value="${yr}" ${c2Filter === String(yr) ? 'selected' : ''}>Tahun ${yr}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="ch" id="c2"></div>
      <div style="margin-top:10px;padding:8px 12px;border-radius:10px;background:var(--bg);border:1px solid var(--bd);font-size:12px" class="mu">
        Arahkan kursor pada batang grafik di atas untuk melihat rincian surplus/defisit serta rasio penghematan setiap bulannya.
      </div>
    </section>
  </div>

  <div class="g2" style="margin-top:20px">
    <section class="card">
      <h3>Evaluasi Status Target</h3>
      <div style="display:grid;gap:12px;margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg);border-radius:10px">
          <span class="mu">Status Jadwal:</span>
          <span class="pill ${sa.badgeClass}">${sa.aheadText}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg);border-radius:10px">
          <span class="mu">Target Saldo Hari Ini:</span>
          <b>${rp(sa.expectedBal)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg);border-radius:10px">
          <span class="mu">Saldo Tabungan Aktual:</span>
          <b style="color:var(--ac2)">${rp(c.bal)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg);border-radius:10px">
          <span class="mu">Selisih Realisasi:</span>
          <b style="color:${sa.diffBal >= 0 ? 'var(--ac2)' : 'var(--amb)'}">${sa.diffBal >= 0 ? '+' : ''}${rp(sa.diffBal)}</b>
        </div>
      </div>
    </section>
    ${insCard()}
  </div>

  <section class="card" style="margin-top:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <h3 style="margin:0">Ringkasan Arus Kas Bulanan</h3>
      ${isAll ? '' : `<button type="button" class="btn ghost small" id="btn-reset-analytics-filter">Tampilkan Semua Periode</button>`}
    </div>
    ${monthTable(allMonths, isAll ? null : analyticsPeriod)}
  </section>`;

  $('#analytics-month-sel').onchange = e => {
    analyticsPeriod = e.target.value;
    render();
  };
  $('#c2-filter').onchange = e => {
    c2Filter = e.target.value;
    render();
  };
  if ($('#btn-reset-analytics-filter')) {
    $('#btn-reset-analytics-filter').onclick = () => {
      analyticsPeriod = 'all';
      render();
    };
  }

  chart('c_plan', L, [
    { N: 'Realisasi Aktual', c: GR, D: actualData, area: 1 },
    { N: 'Target Rencana', c: BL, D: plannedData, dash: '5 4' }
  ]);

  chart('c2', displayM.map(x => mlabel(x.k)), [
    { N: 'Setoran', c: GR, D: displayM.map(x => x.i) },
    { N: 'Penarikan', c: RD, D: displayM.map(x => x.o) }
  ], 1, {
    customTip: (i) => {
      const item = displayM[i];
      if (!item) return '';
      const net = item.i - item.o;
      const rate = item.i > 0 ? (net / item.i * 100) : 0;
      return `
      <b style="display:block;margin-bottom:5px;color:var(--tx-bright);font-size:13px">${mlong(item.k)}</b>
      <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:2px">
        <span><i style="background:${GR}"></i>Setoran:</span>
        <b style="color:var(--ac2)">+${rp(item.i)}</b>
      </div>
      <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:4px">
        <span><i style="background:${RD}"></i>Penarikan:</span>
        <b style="color:var(--red)">-${rp(item.o)}</b>
      </div>
      <div style="padding-top:4px;border-top:1px solid var(--bd);display:flex;justify-content:space-between;gap:12px">
        <span>Tabungan Bersih:</span>
        <b style="color:${net >= 0 ? 'var(--ac2)' : 'var(--red)'}">${net >= 0 ? '+' : ''}${rp(net)}</b>
      </div>
      <div style="font-size:11px;color:var(--mu);margin-top:2px">
        ${rate >= 0 ? `${rate.toFixed(0)}% dana berhasil dihemat` : 'Pengeluaran melebihi setoran'}
      </div>`;
    }
  });
};

const monthTable = (m, activeK = null) => m.length ? `
<div class="tw">
  <table>
    <thead>
      <tr>
        <th>Bulan</th>
        <th class="r">Setoran</th>
        <th class="r">Penarikan</th>
        <th class="r">Tabungan Bersih</th>
        <th class="r">Status</th>
        <th class="r">Jumlah Transaksi</th>
      </tr>
    </thead>
    <tbody>
      ${[...m].reverse().map(x => {
        const net = x.i - x.o;
        const isSel = activeK === x.k;
        return `<tr style="${isSel ? 'background:rgba(16,185,129,0.12);font-weight:600' : ''}">
          <td>${mlong(x.k)} ${isSel ? '<span class="pill ahead" style="padding:2px 8px;font-size:11px;margin-left:6px">Terpilih</span>' : ''}</td>
          <td class="r in">+${rp(x.i)}</td>
          <td class="r out">-${rp(x.o)}</td>
          <td class="r" style="font-weight:600;color:${net >= 0 ? 'var(--ac2)' : 'var(--red)'}">${net >= 0 ? '+' : ''}${rp(net)}</td>
          <td class="r"><span class="pill ${net >= 0 ? 'ahead' : 'behind'}" style="font-size:11px;padding:2px 8px">${net >= 0 ? 'Surplus' : 'Defisit'}</span></td>
          <td class="r">${x.n}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>` : '<p class="mu empty">Belum ada transaksi pada periode bulanan.</p>';

/* ---------- Target & Milestone ---------- */
V.target = () => {
  const c = calc(), s = S.s, ms = [...S.ms].sort((a, b) => a.amount - b.amount);
  $('#view').innerHTML = `
  <section class="card">
    <h2>Target Utama Tabungan</h2>
    <p class="mu" style="margin-bottom:14px">Perbarui target tabungan kapan saja sesuai kebutuhan finansialmu.</p>
    <form id="tg" class="row wrap">
      <label>Target Nominal Baru (Rp)<input name="t" type="number" min="1" step="1" required value="${s.target}"></label>
      <button class="btn">Perbarui Target</button>
    </form>
    <div class="bar big" style="margin-top:22px">
      <i style="width:${c.pct}%"></i>
      ${ms.map(m => `<u style="left:${Math.min(100, m.amount / s.target * 100)}%" title="${esc(m.name)}: ${rp(m.amount)}"></u>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:13px;margin-top:8px" class="mu">
      <span>Progres: <b style="color:var(--tx-bright)">${c.pct.toFixed(1)}%</b> terkumpul (${rp(c.bal)} / ${rp(s.target)})</span>
      <span>Garis kuning adalah milestone</span>
    </div>
  </section>

  <section class="card">
    <h3>Milestone Tabungan</h3>
    <p class="mu" style="margin-bottom:16px">Pecah target besar menjadi langkah-langkah kecil agar menabung terasa lebih ringan dan terarah.</p>
    <form id="mf" class="row wrap" style="margin-bottom:20px">
      <label>Nama Milestone<input name="n" required maxlength="40" placeholder="Contoh: Dana Darurat Tahap 1"></label>
      <label>Target Nominal (Rp)<input name="a" type="number" min="1" step="1" required placeholder="Contoh: 10000000"></label>
      <button class="btn">+ Tambah Milestone</button>
    </form>
    <div>
      ${ms.length ? ms.map(m => {
        const p = Math.min(100, Math.max(0, c.bal / m.amount * 100));
        return `<div class="milestone-item">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <b>${p >= 100 ? '[Tercapai]' : '[Target]'} ${esc(m.name)}</b>
            <div style="display:flex;align-items:center;gap:10px">
              <b>${rp(m.amount)}</b>
              <button class="ib" data-a="delms" data-id="${m.id}" title="Hapus">Hapus</button>
            </div>
          </div>
          ${bar(p)}
          <small class="mu">${p >= 100 ? 'Milestone ini sudah berhasil kamu capai' : `Kurang ${rp(m.amount - c.bal)} lagi (${p.toFixed(1)}% terkumpul)`}</small>
        </div>`;
      }).join('') : '<p class="mu empty">Belum ada milestone. Tambahkan milestone pertamamu di atas!</p>'}
    </div>
  </section>`;

  $('#tg').onsubmit = e => {
    e.preventDefault();
    S.s.target = Math.max(1, Math.round(+new FormData(e.target).get('t')));
    save();
    toast('Target tabungan berhasil diperbarui');
    render();
  };

  $('#mf').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    S.ms.push({
      id: Date.now().toString(36),
      name: f.get('n').trim(),
      amount: Math.round(+f.get('a'))
    });
    save();
    toast('Milestone baru berhasil ditambahkan');
    render();
  };
};

/* ---------- Prediksi Dinamis ---------- */
V.prediksi = () => {
  const c = calc(), s = S.s, sa = scheduleAnalysis();
  const eRoutine = sa.estRoutine;
  const eActual = sa.estActual;

  $('#view').innerHTML = `
  <div class="stats">
    ${st4('Sisa Nominal Target', rp(c.rem), `${c.pct.toFixed(1)}% telah terkumpul`, 'purple', ICONS.flag)}
    ${st4('Status Jadwal', `<span class="pill ${sa.badgeClass}">${sa.aheadText}</span>`, sa.diffBal >= 0 ? `Surplus ${rp(sa.diffBal)}` : `Kurang ${rp(Math.abs(sa.diffBal))}`, 'amber', ICONS.clock)}
    ${st4('Estimasi Rencana Rutin', estTxt(eRoutine, s.freq), 'Rutin: ' + rp(s.routine) + ' / ' + UNIT[s.freq], 'emerald', ICONS.target)}
    ${st4('Estimasi Tempo Aktual', eActual ? (eActual.done ? 'Target tercapai' : `${fdo(eActual.d)} <small>(${eActual.n} ${UNIT[s.freq]} lagi)</small>`) : 'Perlu lebih banyak data', 'Laju riil: ' + rp(sa.actualPerUnit) + ' / ' + UNIT[s.freq], 'sky', ICONS.bolt)}
  </div>

  <section class="card">
    <h3>Perbandingan 2 Skenario Pencapaian</h3>
    <p class="mu" style="font-size:13px;margin-bottom:14px">Lihat perbedaan tanggal target tercapai jika kamu menabung disiplin sesuai rencana vs laju riil tabunganmu saat ini.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:14px 0">
      <div style="background:var(--bg);border:1px solid var(--bd);padding:16px;border-radius:14px">
        <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:var(--ac2);margin-bottom:6px">
          Skenario A: Sesuai Rencana Rutin
        </div>
        <p class="mu" style="font-size:13px">Jika kamu konsisten menyetor rutin <b>${rp(s.routine)}</b> per <b>${UNIT[s.freq]}</b> mulai hari ini tanpa putus.</p>
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--bd)">
          <div style="font-size:13px">Estimasi Tanggal: <b style="color:var(--tx-bright)">${eRoutine ? (eRoutine.done ? 'Tercapai' : fdo(eRoutine.d)) : '-'}</b></div>
          <div class="mu" style="font-size:12.5px;margin-top:2px">Sisa waktu: <b>${eRoutine ? (eRoutine.done ? '0' : eRoutine.n) : '-'} ${UNIT[s.freq]} lagi</b></div>
        </div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--bd);padding:16px;border-radius:14px">
        <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:var(--amb);margin-bottom:6px">
          Skenario B: Realistis Menurut Tempo Riil
        </div>
        <p class="mu" style="font-size:13px">Dihitung dari rata-rata performa menabung bersih aktualmu (<b>${rp(sa.actualPerUnit)}</b> per <b>${UNIT[s.freq]}</b>).</p>
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--bd)">
          <div style="font-size:13px">Estimasi Tanggal: <b style="color:var(--tx-bright)">${eActual ? (eActual.done ? 'Tercapai' : fdo(eActual.d)) : 'Belum cukup data'}</b></div>
          <div class="mu" style="font-size:12.5px;margin-top:2px">Sisa waktu: <b>${eActual ? (eActual.done ? '0' : eActual.n) : '-'} ${UNIT[s.freq]} lagi</b></div>
        </div>
      </div>
    </div>
    <div class="ch" id="c_proj" style="margin-top:20px"></div>
  </section>

  ${insCard()}`;

  // Grafik proyeksi komparatif
  if (c.rem <= 0) {
    $('#c_proj').innerHTML = '<p class="mu empty" style="color:var(--ac2);font-weight:600">Target Rp' + rp(s.target) + ' telah tercapai sepenuhnya!</p>';
  } else {
    const maxWeeks = Math.max(eRoutine ? eRoutine.n : 10, eActual && !eActual.done ? eActual.n : 10);
    const step = Math.max(1, Math.ceil(maxWeeks / 20));
    const ks = [];
    for (let k = 0; k <= maxWeeks; k += step) ks.push(k);
    if (ks[ks.length - 1] !== maxWeeks) ks.push(maxWeeks);

    const routineSeries = ks.map(k => Math.min(s.target, c.bal + k * s.routine));
    const actualSeries = ks.map(k => Math.min(s.target, Math.max(0, c.bal + k * Math.max(0, sa.actualPerUnit))));

    chart('c_proj', ks.map(k => `${UNIT[s.freq]} ${k}`), [
      { N: 'Proyeksi Rencana Rutin', c: GR, D: routineSeries, area: 1 },
      { N: 'Proyeksi Tempo Riil', c: AM, D: actualSeries, width: 2 },
      { N: 'Garis Target Tabungan', c: RD, D: ks.map(() => s.target), dash: '5 4' }
    ]);
  }
};

/* ---------- Simulator Dinamis ---------- */
V.simulator = () => {
  const c = calc(), s = S.s;
  $('#view').innerHTML = `
  <section class="card">
    <h2>Simulator Skenario Tabungan</h2>
    <p class="mu" style="margin-bottom:16px">Coba simulasikan bagaimana targetmu tercapai jika nominal rutin dinaikkan atau jika ada bonus ekstra. Data asli tabunganmu tetap aman.</p>
    <form id="sm" class="grid2">
      <label>Saldo Tabungan Awal (Rp)
        <input name="b" type="number" min="0" step="1" value="${c.bal}">
      </label>
      <label>Target Tabungan (Rp)
        <input name="t" type="number" min="1" step="1" value="${s.target}">
      </label>
      <label>Nominal Setoran Rutin (Rp)
        <input name="r" type="number" min="1" step="1" value="${s.routine}">
      </label>
      <label>Frekuensi Menabung
        <select name="f">${opts(FREQ, s.freq)}</select>
      </label>
      <label>Bonus / Setoran Ekstra (Rp)
        <input name="bonus" type="number" min="0" step="1" value="0" placeholder="Contoh: THR, bonus...">
      </label>
      <label>Rencana Penarikan Satu Kali (Rp)
        <input name="withdraw" type="number" min="0" step="1" value="0" placeholder="0">
      </label>
    </form>
    <div id="so" style="margin-top:20px"></div>
  </section>

  <section class="card">
    <h3>Grafik Proyeksi Hasil Simulasi</h3>
    <div class="ch" id="c1"></div>
  </section>`;

  const run = () => {
    const f = new FormData($('#sm'));
    const b = Math.max(0, +f.get('b') || 0);
    const t = +f.get('t') || 0;
    const r = +f.get('r') || 0;
    const fr = f.get('f') || s.freq;
    const bonus = Math.max(0, +f.get('bonus') || 0);
    const withdraw = Math.max(0, +f.get('withdraw') || 0);

    if (!(t > 0) || !(r > 0)) {
      $('#so').innerHTML = '<p class="mu empty">Masukkan target tabungan dan nominal tabungan rutin untuk melihat hasil simulasi.</p>';
      $('#c1').innerHTML = '<p class="mu empty">Grafik proyeksi akan muncul setelah input diisi lengkap.</p>';
      return;
    }

    const effBal = Math.max(0, b + bonus - withdraw);

    if (effBal >= t) {
      $('#so').innerHTML = `
      <div style="background:rgba(16,185,129,.15);border:1px solid var(--ac);padding:14px;border-radius:12px">
        <h4 style="color:var(--ac2);margin:0 0 6px">Target Sudah Tercapai!</h4>
        <p style="margin:0">Saldo simulasi efektif (${rp(effBal)}) sudah sama atau melampaui target yang ditetapkan (${rp(t)}).</p>
      </div>`;
      $('#c1').innerHTML = '<p class="mu empty">Target sudah tercapai pada saldo awal simulasi.</p>';
      return;
    }

    const baseEst = est(b, t, r, fr);
    const effEst = est(effBal, t, r, fr);

    let impactText = '';
    if (bonus > 0 || withdraw > 0) {
      if (baseEst && effEst && !baseEst.done && !effEst.done) {
        const delta = baseEst.n - effEst.n;
        if (delta > 0) {
          impactText = `<p style="color:var(--ac2);font-weight:600;margin-top:6px">Tambahan setoran Rp${rp(bonus)} mempercepat target tercapai sebanyak ~${delta} ${UNIT[fr]} lebih awal!</p>`;
        } else if (delta < 0) {
          impactText = `<p style="color:var(--red);font-weight:600;margin-top:6px">Penarikan Rp${rp(withdraw)} menunda pencapaian target sebanyak ~${Math.abs(delta)} ${UNIT[fr]}.</p>`;
        }
      }
    }

    const mu = [0.5, 1, 1.5, 2];
    $('#so').innerHTML = `
    <div style="background:var(--bg);border:1px solid var(--bd);padding:14px;border-radius:12px;margin-bottom:14px">
      <div style="font-size:15px">Estimasi Target Tercapai: <b style="color:var(--ac2)">${estTxt(effEst, fr)}</b></div>
      <div class="mu" style="font-size:13px;margin-top:4px">Saldo Awal Simulasi Efektif: ${rp(effBal)} · Sisa Kurang: ${rp(t - effBal)}</div>
      ${impactText}
    </div>
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>Variasi Nominal Tabungan Rutin</th>
            <th class="r">Estimasi Waktu Tercapai</th>
          </tr>
        </thead>
        <tbody>
          ${mu.map(k => `<tr>
            <td>${rp(Math.round(r * k))} ${k === 1 ? '<b>(Pilihanmu)</b>' : `(${k}×)`}</td>
            <td class="r" style="font-weight:${k === 1 ? '700' : '400'}">${estTxt(est(effBal, t, Math.round(r * k), fr), fr)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

    projChart('c1', effBal, t, r, fr);
  };

  $('#sm').oninput = run;
  run();
};

/* ---------- Kalender Interaktif ---------- */
let CM = null;
let selectedCalDate = null;

const sched = ds => {
  const s = S.s;
  if (!s || ds < s.start) return false;
  if (s.freq === 'harian') return true;
  const a = pd(s.start), b = pd(ds);
  if (s.freq === 'mingguan') return Math.round((b - a) / 864e5) % 7 === 0;
  const dim = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
  return b.getDate() === Math.min(a.getDate(), dim);
};

V.kalender = () => {
  const n = new Date();
  CM = CM || { y: n.getFullYear(), m: n.getMonth() };
  selectedCalDate = selectedCalDate || today();

  const { y, m } = CM;
  const dim = new Date(y, m + 1, 0).getDate();
  const off = (new Date(y, m, 1).getDay() + 6) % 7;
  const map = {};

  S.tx.forEach(x => {
    map[x.date] = map[x.date] || { in: 0, out: 0, sumIn: 0, sumOut: 0, list: [] };
    map[x.date][x.type]++;
    map[x.date][x.type === 'in' ? 'sumIn' : 'sumOut'] += x.amount;
    map[x.date].list.push(x);
  });

  let cells = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(h => `<div class="h">${h}</div>`).join('') + '<div style="background:none"></div>'.repeat(off);

  for (let d = 1; d <= dim; d++) {
    const ds = iso(new Date(y, m, d));
    const x = map[ds] || {};
    const isSched = sched(ds);
    const isToday = ds === today();
    const isSel = ds === selectedCalDate;

    cells += `<div class="day-cell ${isSched ? 'sc' : ''} ${isToday ? 'td' : ''} ${isSel ? 'selected' : ''}" data-date="${ds}">
      <span>${d}</span>
      <div style="margin-top:2px">
        ${x.in ? '<span class="dt in" title="Ada setoran"></span>' : ''}
        ${x.out ? '<span class="dt out" title="Ada penarikan"></span>' : ''}
      </div>
    </div>`;
  }

  // Rentang pilihan tahun
  const curY = new Date().getFullYear();
  let minYear = curY - 3;
  let maxYear = curY + 7;
  S.tx.forEach(t => {
    const yVal = parseInt(t.date.slice(0, 4), 10);
    if (!isNaN(yVal)) {
      if (yVal < minYear) minYear = yVal;
      if (yVal > maxYear) maxYear = yVal;
    }
  });
  if (S.s && S.s.start) {
    const sYear = parseInt(S.s.start.slice(0, 4), 10);
    if (!isNaN(sYear) && sYear < minYear) minYear = sYear;
  }
  const yearsList = [];
  for (let yr = minYear; yr <= maxYear; yr++) {
    yearsList.push(yr);
  }

  // Ringkasan target mingguan pada bulan kalender
  const unitFactor = DAYS[S.s.freq] || 7;
  const wt = (S.s.routine * 7) / unitFactor;
  const first = new Date(y, m, 1 - off);
  let wl = '';

  for (let k = 0; k < Math.ceil((off + dim) / 7); k++) {
    const a = new Date(first);
    a.setDate(a.getDate() + k * 7);
    const b = new Date(a);
    b.setDate(b.getDate() + 6);
    const as = iso(a), bs = iso(b);
    const t = S.tx.filter(x => x.type === 'in' && x.date >= as && x.date <= bs).reduce((q, x) => q + x.amount, 0);
    const p = wt > 0 ? Math.min(100, t / wt * 100) : 0;
    wl += `<div style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:13px">
        <span>${fd(as)} – ${fd(bs)}</span>
        <span><b>${rp(t)}</b> / ${rp(wt)} ${wt > 0 && t >= wt ? '(Tercapai)' : ''}</span>
      </div>
      ${bar(p)}
    </div>`;
  }

  // Detail tanggal yang dipilih
  const curDetail = map[selectedCalDate] || { in: 0, out: 0, sumIn: 0, sumOut: 0, list: [] };
  const curSched = sched(selectedCalDate);

  $('#view').innerHTML = `
  <section class="card">
    <div class="cal-controls">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button class="ib" id="pv" title="Bulan sebelumnya">‹</button>
        <select id="cal-sel-m" class="cal-select" title="Pilih Bulan">
          ${MN.map((name, idx) => `<option value="${idx}" ${idx === m ? 'selected' : ''}>${name}</option>`).join('')}
        </select>
        <select id="cal-sel-y" class="cal-select" title="Pilih Tahun">
          ${yearsList.map(yr => `<option value="${yr}" ${yr === y ? 'selected' : ''}>${yr}</option>`).join('')}
        </select>
        <button class="ib" id="nx" title="Bulan berikutnya">›</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button type="button" class="btn ghost small" id="cal-today-btn">Hari Ini</button>
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;margin:0" class="mu">
          Pilih Tanggal:
          <input type="date" id="cal-jump-input" value="${selectedCalDate}" style="padding:5px 8px;font-size:12.5px;border-radius:8px">
        </label>
      </div>
    </div>
    <div class="cal">${cells}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12px" class="mu">
      <span><span class="dt in"></span> Setoran</span>
      <span><span class="dt out"></span> Penarikan</span>
      <span>Jadwal setoran rutin</span>
      <span><b>Bold</b> Hari ini</span>
    </div>

    <!-- Detail interaktif tanggal terpilih -->
    <div class="cal-detail">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <b style="font-size:15px;color:var(--tx-bright)">Tanggal: ${fdo(pd(selectedCalDate))}</b>
          ${curSched ? '<span class="pill ahead" style="margin-left:8px">Jadwal Rutin</span>' : ''}
        </div>
        <button class="btn small" id="btn-add-day">+ Catat Transaksi di Tanggal Ini</button>
      </div>

      ${curDetail.list.length ? `
        <div style="display:flex;gap:14px;font-size:13px;margin:6px 0">
          ${curDetail.sumIn ? `<span style="color:var(--ac2);font-weight:600">Total Setoran: +${rp(curDetail.sumIn)}</span>` : ''}
          ${curDetail.sumOut ? `<span style="color:var(--red);font-weight:600">Total Penarikan: -${rp(curDetail.sumOut)}</span>` : ''}
        </div>
        ${rows(curDetail.list, true)}
      ` : '<p class="mu empty" style="padding:14px 0">Tidak ada transaksi pada tanggal ini.</p>'}
    </div>
  </section>

  <section class="card">
    <h3>Pencapaian Target Mingguan (${MN[m]} ${y})</h3>
    ${wt > 0 ? wl : '<p class="mu">Atur nominal setoran rutin di halaman Pengaturan untuk melacak target mingguan.</p>'}
  </section>`;

  $('#pv').onclick = () => {
    CM.m--;
    if (CM.m < 0) { CM.m = 11; CM.y--; }
    render();
  };
  $('#nx').onclick = () => {
    CM.m++;
    if (CM.m > 11) { CM.m = 0; CM.y++; }
    render();
  };

  $('#cal-sel-m').onchange = e => {
    CM.m = +e.target.value;
    render();
  };
  $('#cal-sel-y').onchange = e => {
    CM.y = +e.target.value;
    render();
  };
  $('#cal-today-btn').onclick = () => {
    const now = new Date();
    CM.y = now.getFullYear();
    CM.m = now.getMonth();
    selectedCalDate = today();
    render();
  };
  $('#cal-jump-input').onchange = e => {
    const val = e.target.value;
    if (val) {
      const d = pd(val);
      CM.y = d.getFullYear();
      CM.m = d.getMonth();
      selectedCalDate = val;
      render();
    }
  };

  $('#btn-add-day').onclick = () => openTx(null, selectedCalDate);

  // Klik tanggal kalender
  document.querySelectorAll('.day-cell').forEach(cell => {
    cell.onclick = () => {
      selectedCalDate = cell.dataset.date;
      render();
    };
  });
};

/* ---------- Laporan ---------- */
V.laporan = () => {
  const c = calc(), s = S.s, cats = {};
  S.tx.forEach(x => {
    const k = x.type + '|' + x.cat;
    cats[k] = (cats[k] || 0) + x.amount;
  });

  const cr = t => {
    const entries = Object.entries(cats).filter(([k]) => k.startsWith(t)).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '<tr><td class="mu">Tidak ada transaksi</td><td class="r">-</td></tr>';
    return entries.map(([k, v]) => `<tr><td>${k.split('|')[1]}</td><td class="r ${t}">${t === 'in' ? '+' : '-'}${rp(v)}</td></tr>`).join('');
  };

  $('#view').innerHTML = `
  <section class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <h2>Laporan Keuangan & Tabungan</h2>
      <button class="btn noprint" onclick="window.print()">Cetak / Ekspor PDF</button>
    </div>
    <p class="mu" style="margin-bottom:14px">Dihasilkan pada: ${fdo(new Date())} · Dimulai sejak: ${fd(s.start)}</p>
    <div class="stats">
      ${st4('Saldo Awal', rp(s.initial), 'Ditetapkan pada ' + fd(s.start), 'sky', ICONS.bank)}
      ${st4('Total Setoran', rp(c.i), 'Dari ' + S.tx.filter(x => x.type === 'in').length + ' kali setor', 'emerald', ICONS.in)}
      ${st4('Total Penarikan', rp(c.o), 'Dari ' + S.tx.filter(x => x.type === 'out').length + ' kali tarik', 'rose', ICONS.out)}
      ${st4('Saldo Terkini', rp(c.bal), c.pct.toFixed(1) + '% dari target ' + rp(s.target), 'purple', ICONS.flag)}
    </div>
  </section>

  <section class="card">
    <h3>Arus Kas Bulanan</h3>
    ${monthTable(monthly())}
  </section>

  <div class="g2">
    <section class="card">
      <h3>Distribusi Kategori Setoran</h3>
      <div class="tw"><table><tbody>${cr('in')}</tbody></table></div>
    </section>
    <section class="card">
      <h3>Distribusi Kategori Penarikan</h3>
      <div class="tw"><table><tbody>${cr('out')}</tbody></table></div>
    </section>
  </div>`;
};

/* ---------- Backup & Restore ---------- */
function dl(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importJSON(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result), s = d.s;
      if (!s || !Array.isArray(d.tx) || ![s.initial, s.target, s.routine].every(Number.isFinite) || !DAYS[s.freq]) {
        throw new Error('Format data tidak sesuai');
      }
      const tx = d.tx.filter(x => (x.type === 'in' || x.type === 'out') && x.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(x.date)).map((x, i) => ({
        id: String(x.id || Date.now().toString(36) + i),
        type: x.type,
        amount: Math.round(x.amount),
        date: x.date,
        cat: String(x.cat || 'Lainnya'),
        note: String(x.note || ''),
        ts: x.ts || Date.now()
      }));
      if (S.s && !confirm('Data saat ini akan ditimpa dengan data dari file backup. Lanjutkan impor?')) return;
      S = {
        s: { initial: s.initial, target: s.target, routine: s.routine, start: s.start, freq: s.freq },
        tx,
        ms: Array.isArray(d.ms) ? d.ms : [],
        log: Array.isArray(d.log) ? d.log : [],
        theme: d.theme === 'light' ? 'light' : 'dark'
      };
      save();
      applyTheme();
      toast('Seluruh data tabungan berhasil dipulihkan');
      location.hash = '#dashboard';
      render();
    } catch (e) {
      toast('File backup JSON tidak valid atau rusak');
    }
  };
  r.readAsText(file);
}

V.backup = () => {
  $('#view').innerHTML = `
  <section class="card">
    <h2>Cadangan & Pemulihan Data</h2>
    <p class="mu" style="margin-bottom:16px">Simpan salinan data tabunganmu ke file JSON atau pulihkan data kapan saja tanpa khawatir hilang.</p>
    <div class="row wrap">
      <button class="btn" id="bj">Unduh Backup JSON</button>
      <label class="btn ghost" style="cursor:pointer;color:var(--tx);display:inline-flex;align-items:center">
        Impor & Pulihkan JSON
        <input type="file" id="ij" accept=".json" hidden>
      </label>
      <button class="btn ghost" id="bc">Ekspor Transaksi (CSV)</button>
    </div>
  </section>

  <section class="card">
    <h3 style="color:var(--red)">Zona Bahaya: Reset Data Tabungan</h3>
    <p class="mu" style="margin-bottom:14px">Menghapus seluruh target, transaksi, dan pengaturan tabungan di browser ini secara permanen. Pastikan kamu sudah mengunduh backup file terlebih dahulu.</p>
    <div>
      <button class="btn red" id="rs">Reset Seluruh Data Tabungan</button>
    </div>
  </section>`;

  $('#bj').onclick = () => dl(`tabunganku-backup-${today()}.json`, JSON.stringify(S, null, 2), 'application/json');
  $('#ij').onchange = e => { importJSON(e.target.files[0]); e.target.value = ''; };
  $('#bc').onclick = () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    dl(`transaksi-${today()}.csv`, '\ufeffTanggal,Jenis,Kategori,Nominal,Catatan\n' + sorted(S.tx).map(x => [x.date, x.type === 'in' ? 'Setoran' : 'Penarikan', x.cat, x.amount, x.note].map(q).join(',')).join('\n'), 'text/csv');
  };
  $('#rs').onclick = () => openResetDataModal();
};

function openResetDataModal() {
  const d = $('#dlg');
  const sec = S.s?._security || {};
  const hasPin = isPinActive();

  d.innerHTML = `
  <div>
    <h3 style="color:var(--red)">Peringatan Reset Seluruh Data</h3>
    <p class="mu" style="font-size:13px;margin:0 0 14px;line-height:1.5">
      Tindakan ini akan <b>menghapus seluruh transaksi, riwayat saldo, target tabungan, dan log</b> secara permanen. Pastikan kamu sudah mengunduh file cadangan JSON sebelum melanjutkan.
    </p>

    <div id="reset-err" style="display:none;padding:10px 12px;border-radius:10px;font-size:13px;background:rgba(248,113,113,.15);color:var(--red);margin-bottom:12px"></div>

    <form id="reset-form" style="display:grid;gap:12px">
      ${hasPin ? `
        <label style="text-align:center">
          <span style="display:block;margin-bottom:6px">Masukkan PIN Keamanan untuk Konfirmasi:</span>
          <input type="password" id="reset-pin-input" class="pin-input" maxlength="8" inputmode="numeric" pattern="[0-9]*" placeholder="••••" required autofocus style="margin:4px auto">
        </label>
      ` : `
        <label>
          <span style="display:block;margin-bottom:6px">Ketik kata <b>RESET</b> dengan huruf besar untuk mengonfirmasi:</span>
          <input type="text" id="reset-confirm-text" placeholder="Ketik RESET" required autofocus autocomplete="off">
        </label>
      `}
      <div class="row" style="margin-top:6px">
        <button type="button" class="btn ghost" id="btn-cancel-reset">Batal</button>
        <button type="submit" class="btn red">Hapus & Reset Sekarang</button>
      </div>
    </form>
  </div>`;

  d.showModal();

  $('#btn-cancel-reset').onclick = () => d.close();

  $('#reset-form').onsubmit = async (e) => {
    e.preventDefault();
    const errBox = $('#reset-err');

    if (hasPin) {
      const pinVal = $('#reset-pin-input').value.trim();
      const h = await hashPin(pinVal);
      if (h !== sec.pinHash) {
        errBox.textContent = 'PIN keamanan salah. Tindakan reset dibatalkan.';
        errBox.style.display = 'block';
        $('#reset-pin-input').value = '';
        $('#reset-pin-input').classList.add('pin-error');
        setTimeout(() => $('#reset-pin-input')?.classList.remove('pin-error'), 450);
        return;
      }
    } else {
      const textVal = $('#reset-confirm-text').value.trim();
      if (textVal !== 'RESET') {
        errBox.textContent = 'Konfirmasi teks tidak cocok. Silakan ketik RESET.';
        errBox.style.display = 'block';
        return;
      }
    }

    S = { s: null, tx: [], ms: [], log: [], theme: S.theme, hideBalance: false };
    isUnlocked = true;
    save();
    d.close();
    location.hash = '';
    render();
    toast('Seluruh data tabungan berhasil direset');
  };
}

/* ---------- Tema & Inisialisasi ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
  const th = $('#th');
  if (th) {
    const isDark = S.theme === 'dark';
    th.innerHTML = `<span class="theme-icon">${isDark ? ICONS.moon : ICONS.sun}</span> <span class="theme-label">${isDark ? 'Mode Gelap' : 'Mode Terang'}</span>`;
  }
}

function toggleTheme() {
  S.theme = S.theme === 'dark' ? 'light' : 'dark';
  save();
  applyTheme();
  render();
}

const closeSide = () => {
  const side = $('#side'); if (side) side.classList.remove('open');
  const ov = $('#side-overlay'); if (ov) ov.classList.remove('show');
};
const openSide = () => {
  const side = $('#side'); if (side) side.classList.add('open');
  const ov = $('#side-overlay'); if (ov) ov.classList.add('show');
};

$('#th').onclick = toggleTheme;
$('#add').onclick = () => openTx();
$('#mb').onclick = openSide;
if ($('#sb-close')) $('#sb-close').onclick = closeSide;
if ($('#side-overlay')) $('#side-overlay').onclick = closeSide;
if ($('#btn-privacy')) $('#btn-privacy').onclick = toggleBalancePrivacy;
if ($('#btn-lock')) {
  $('#btn-lock').onclick = () => {
    if (isPinActive()) {
      isUnlocked = false;
      render();
      toast('Layar tabungan dikunci');
    }
  };
}
window.addEventListener('hashchange', render);

applyTheme();
updatePrivacyButtonUI();
render();

// Inisialisasi Sesi Supabase Auth & Cloud Sync
if (sb) {
  sb.auth.getSession().then(({ data: { session } }) => {
    currentUser = session?.user || null;
    renderAuthUI();
    if (currentUser) fetchFromCloud();
  });

  sb.auth.onAuthStateChange(async (event, session) => {
    const prevUser = currentUser;
    currentUser = session?.user || null;
    renderAuthUI();
    if (currentUser && (!prevUser || prevUser.id !== currentUser.id)) {
      await fetchFromCloud();
    }
  });
} else {
  renderAuthUI();
}
