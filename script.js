'use strict';
const K = 'tabunganku_v1', $ = q => document.querySelector(q);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let S = (() => { let d; try { d = JSON.parse(localStorage.getItem(K)); } catch (e) {} return Object.assign({ s: null, tx: [], ms: [], log: [], theme: 'dark' }, d && typeof d === 'object' ? d : {}); })();
const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { toast('Gagal menyimpan data'); } };
const rp = n => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const p2 = n => String(n).padStart(2, '0'), iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`, today = () => iso(new Date());
const pd = s => new Date(s + 'T00:00:00'), fd = s => pd(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const fdo = d => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const DAYS = { harian: 1, mingguan: 7, bulanan: 30 }, UNIT = { harian: 'hari', mingguan: 'minggu', bulanan: 'bulan' }, FREQ = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' };
const CAT = { in: ['Gaji', 'Bonus', 'Hadiah', 'Sisihan Rutin', 'Lainnya'], out: ['Kebutuhan', 'Darurat', 'Hiburan', 'Pendidikan', 'Lainnya'] };
const MN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const opts = (o, sel) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
const GR = '#10b981', RD = '#f87171', AM = '#fbbf24', BL = '#60a5fa';
let tt; const toast = m => { const t = $('#toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); };

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
  if (e.done) return 'Target tercapai 🎉';
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
  let aheadText = 'Sesuai target rencana';

  if (c.rem <= 0) {
    status = 'achieved';
    badgeClass = 'achieved';
    aheadText = 'Target telah tercapai 🎉';
  } else if (Math.abs(diffBal) < (s.routine * 0.15)) {
    status = 'on_track';
    badgeClass = 'ahead';
    aheadText = `Tepat sesuai jadwal rencana (${periodsElapsed.toFixed(1)} ${UNIT[s.freq]} berjalan)`;
  } else if (diffBal > 0) {
    status = 'ahead';
    badgeClass = 'ahead';
    aheadText = `Lebih cepat ~${diffPeriods.toFixed(1)} ${UNIT[s.freq]} (surplus ${rp(diffBal)})`;
  } else {
    status = 'behind';
    badgeClass = 'behind';
    aheadText = `Tertinggal ~${Math.abs(diffPeriods).toFixed(1)} ${UNIT[s.freq]} (kekurangan ${rp(Math.abs(diffBal))})`;
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

function balSeries() {
  const t = [...S.tx].sort((a, b) => a.date.localeCompare(b.date));
  const first = [S.s.start, ...t.map(x => x.date)].sort()[0];
  let r = S.s.initial;
  const L = [first], D = [r];
  t.forEach(x => {
    r += x.type === 'in' ? x.amount : -x.amount;
    if (L[L.length - 1] === x.date) D[D.length - 1] = r;
    else { L.push(x.date); D.push(r); }
  });
  return { L: L.map(fd), D };
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
  if (!t.length) return ['Belum ada transaksi. Catat setoran pertamamu untuk melihat analisis mendalam.'];
  
  if (sa) {
    if (sa.status === 'ahead') {
      a.push(`🚀 Luar biasa! Posisi tabunganmu ${sa.aheadText}. Kamu unggul dari jadwal target.`);
    } else if (sa.status === 'behind') {
      a.push(`⚠️ ${sa.aheadText}. Disarankan menambah setoran berkala untuk mengejar kembali jadwal target.`);
    } else if (sa.status === 'achieved') {
      a.push(`🎉 Selamat! Kamu telah mencapai atau melampaui target tabungan Rp${rp(S.s.target)}.`);
    } else {
      a.push(`🎯 Konsistensi sangat baik! Tabunganmu berjalan sesuai jadwal rencana setoran rutin.`);
    }
    if (sa.actualPerUnit > 0) {
      a.push(`Kecepatan tabungan bersih aktual rata-rata: ${rp(sa.actualPerUnit)} / ${UNIT[S.s.freq]}.`);
    }
  }

  if (ins.length) a.push(`Rata-rata setoran: ${rp(c.i / ins.length)} dari total ${ins.length} kali menabung.`);

  const n = new Date(), k = today().slice(0, 7), pk = iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)).slice(0, 7);
  const cm = m.find(x => x.k === k), pm = m.find(x => x.k === pk);
  if (cm && pm && pm.i > 0) {
    const d = (cm.i - pm.i) / pm.i * 100;
    a.push(`Setoran bulan ini ${d >= 0 ? 'meningkat' : 'turun'} ${Math.abs(d).toFixed(0)}% dibandingkan bulan lalu.`);
  }

  if (c.i > 0) {
    const r = c.o / c.i * 100;
    a.push(r > 30 ? `⚠️ Rasio penarikan mencapai ${r.toFixed(0)}% dari setoran. Batasi penarikan agar target lekas tercapai.` : `Rasio penarikan sehat, hanya ${r.toFixed(0)}% dari total dana disetor. Pertahankan!`);
  }

  const oc = {};
  t.filter(x => x.type === 'out').forEach(x => oc[x.cat] = (oc[x.cat] || 0) + x.amount);
  const top = Object.entries(oc).sort((a, b) => b[1] - a[1])[0];
  if (top) a.push(`Kategori penarikan terbesar: ${top[0]} (${rp(top[1])}).`);

  a.push(st.cur ? `Streak disiplin menabung: ${st.cur} minggu berturut-turut (rekor terbaik: ${st.best} minggu).` : 'Belum ada streak menabung aktif. Catat setoran minggu ini untuk memulai!');
  return a;
}

const insCard = () => `<section class="card"><h3>💡 Financial Insights & Evaluasi</h3><ul class="ins">${insights().map(i => `<li>${i}</li>`).join('')}</ul></section>`;

/* ---------- Grafik SVG Interaktif ---------- */
function chart(id, L, series, bar) {
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
  for (let k = 0; k <= 4; k++) {
    const v = mn + (mx - mn) * k / 4, y = Y(v);
    g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}" class="gl"/><text x="${P.l - 8}" y="${y + 4}" text-anchor="end" class="ax">${sh(v)}</text>`;
  }

  const step = Math.max(1, Math.ceil(n / 6));
  L.forEach((l, i) => {
    if (i % step === 0 || i === n - 1) g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="ax">${l}</text>`;
  });

  series.forEach((s, j) => {
    if (bar) {
      const bw = iw / n / (series.length + 0.6);
      s.D.forEach((v, i) => {
        const y = Y(v), y0 = Y(0);
        g += `<rect x="${X(i) - bw * series.length / 2 + j * bw}" y="${Math.min(y, y0)}" width="${Math.max(2, bw * .85)}" height="${Math.abs(y0 - y)}" rx="3" fill="${s.c}"/>`;
      });
    } else {
      const pts = s.D.map((v, i) => `${X(i)},${Y(v)}`);
      g += `<path d="M${pts.join('L')}" fill="none" stroke="${s.c}" stroke-width="${s.width || 2.5}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
      if (s.area && n > 1) {
        g += `<path d="M${X(0)},${Y(mn)}L${pts.join('L')}L${X(n - 1)},${Y(mn)}Z" fill="${s.c}" opacity=".12"/>`;
      }
      if (!s.dash && n <= 45) {
        s.D.forEach((v, i) => g += `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="${s.c}"/>`);
      }
    }
  });

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}</svg><div class="tip"></div><div class="lg">${series.map(s => `<span><i style="background:${s.c}"></i>${s.N}</span>`).join('')}</div>`;

  const tip = el.querySelector('.tip'), svg = el.querySelector('svg');
  svg.onpointermove = e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
    let i = n === 1 ? 0 : bar ? Math.floor((x - P.l) / iw * n) : Math.round((x - P.l) / iw * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    tip.style.display = 'block';
    tip.style.left = Math.min(Math.max(6, X(i) / W * r.width - 70), Math.max(6, r.width - 160)) + 'px';
    tip.innerHTML = `<b>${L[i]}</b>` + series.map(s => `<div><i style="background:${s.c}"></i>${s.N}: ${rp(s.D[i])}</div>`).join('');
  };
  svg.onpointerleave = () => tip.style.display = 'none';
}

function projChart(id, b, t, r, f) {
  const el = $('#' + id);
  if (!el) return;
  if (!(t > 0) || !(r > 0)) {
    el.innerHTML = '<p class="mu empty">Isi nominal tabungan rutin dan target untuk melihat grafik proyeksi.</p>';
    return;
  }
  if (b >= t) {
    el.innerHTML = '<p class="mu empty" style="color:var(--ac2);font-weight:600">Target sudah tercapai 🎉</p>';
    return;
  }
  const e = est(b, t, r, f);
  if (!e || e.done) {
    el.innerHTML = '<p class="mu empty">Target sudah tercapai 🎉</p>';
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

/* ---------- Navigasi ---------- */
const NAV = [
  ['dashboard', 'Dashboard'],
  ['riwayat', 'Riwayat'],
  ['analytics', 'Analytics'],
  ['target', 'Target Tabungan'],
  ['prediksi', 'Prediksi'],
  ['simulator', 'Simulator'],
  ['kalender', 'Kalender'],
  ['laporan', 'Laporan'],
  ['backup', 'Backup & Restore'],
  ['pengaturan', 'Pengaturan']
];

$('#nav').innerHTML = NAV.map(n => `<a href="#${n[0]}">${n[1]}</a>`).join('');

function render() {
  const v = S.s ? (location.hash.slice(1) || 'dashboard') : 'setup';
  const f = V[v] || V.dashboard;
  document.body.classList.toggle('nosetup', !S.s);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.hash === '#' + v));
  $('#ttl').textContent = (NAV.find(n => n[0] === v) || [0, 'Pengaturan Awal Tabungan'])[1];
  $('#side').classList.remove('open');
  const ov = $('#side-overlay'); if (ov) ov.classList.remove('show');
  f();
}

const st4 = (l, v, s) => `<div class="card"><span class="mu">${l}</span><b>${v}</b><small>${s || ''}</small></div>`;
const bar = p => `<div class="bar"><i style="width:${Math.min(100, Math.max(0, p))}%"></i></div>`;
const V = {};

/* ---------- Pengaturan Awal & Pengaturan ---------- */
function settingsForm(first) {
  const s = S.s || {};
  $('#view').innerHTML = `<section class="card ${first ? 'narrow' : ''}"><h2>${first ? '👋 Selamat datang! Atur Target Tabunganmu' : 'Pengaturan Tabungan'}</h2>
  <p class="mu">${first ? 'Tentukan target dan jadwal tabunganmu. Semua data perhitungan akan dihitung dari pengaturan ini secara otomatis.' : 'Perubahan saldo awal akan tercatat pada log riwayat di bawah.'}</p>
  <form id="sf" class="grid2">
    <label>Saldo Awal (Rp)<input name="initial" type="number" min="0" step="1" required placeholder="Contoh: 5000000" value="${s.initial ?? ''}"></label>
    <label>Target Nominal Tabungan (Rp)<input name="target" type="number" min="1" step="1" required placeholder="Contoh: 100000000" value="${s.target ?? ''}"></label>
    <label>Nominal Target Menabung Rutin (Rp)<input name="routine" type="number" min="1" step="1" required placeholder="Contoh: 700000" value="${s.routine ?? ''}"></label>
    <label>Tanggal Mulai Menabung<input name="start" type="date" required value="${s.start ?? today()}"></label>
    <label>Frekuensi Menabung<select name="freq" required><option value="" disabled ${s.freq ? '' : 'selected'}>Pilih frekuensi</option>${opts(FREQ, s.freq || 'mingguan')}</select></label>
    <div class="row" style="grid-column:1/-1"><button class="btn">${first ? 'Mulai Menabung Sekarang 🚀' : 'Simpan Perubahan Pengaturan'}</button></div>
  </form>
  ${first ? '<p class="mu" style="margin-top:16px">Sudah punya file backup sebelumnya? <label class="btn ghost" style="display:inline-block;cursor:pointer;color:var(--tx);margin-left:6px">Pulihkan JSON<input type="file" id="imp0" accept=".json" hidden></label></p>' : ''}</section>
  ${first ? '' : `<section class="card"><h3>Tampilan Tema</h3><button class="btn ghost" id="th2">Ganti tema (${S.theme === 'dark' ? 'Mode Gelap 🌙' : 'Mode Terang ☀️'})</button></section>
  <section class="card"><h3>Log Riwayat Perubahan Saldo Awal</h3>${S.log.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Sebelumnya</th><th class="r">Saldo Awal Baru</th></tr></thead><tbody>${[...S.log].reverse().map(l => `<tr><td>${fd(l.date)}</td><td>${l.from === null ? 'Saldo awal pertama kali diatur' : rp(l.from)}</td><td class="r in">${rp(l.to)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mu">Belum ada perubahan saldo awal.</p>'}</section>`}`;

  $('#sf').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const n = {
      initial: Math.max(0, Math.round(+f.get('initial'))),
      target: Math.max(1, Math.round(+f.get('target'))),
      routine: Math.max(1, Math.round(+f.get('routine'))),
      start: f.get('start'),
      freq: f.get('freq')
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

  if ($('#th2')) $('#th2').onclick = toggleTheme;
  if ($('#imp0')) $('#imp0').onchange = e => importJSON(e.target.files[0]);
}

V.setup = () => settingsForm(true);
V.pengaturan = () => settingsForm(false);

/* ---------- Dashboard ---------- */
const sorted = l => [...l].sort((a, b) => b.date.localeCompare(a.date) || (b.ts || 0) - (a.ts || 0));

function rows(l, act) {
  if (!l.length) return '<p class="mu empty">Tidak ada transaksi tercatat.</p>';
  return `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Catatan</th><th class="r">Nominal</th>${act ? '<th>Aksi</th>' : ''}</tr></thead><tbody>${l.map(x => `<tr><td>${fd(x.date)}</td><td><span class="bd ${x.type}">${x.type === 'in' ? 'Setoran' : 'Penarikan'}</span></td><td>${esc(x.cat)}</td><td>${esc(x.note) || '-'}</td><td class="r ${x.type}">${x.type === 'in' ? '+' : '-'}${rp(x.amount)}</td>${act ? `<td class="r nw"><button class="ib" data-a="edit" data-id="${x.id}" title="Edit">✏️</button> <button class="ib" data-a="del" data-id="${x.id}" title="Hapus">🗑️</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

V.dashboard = () => {
  const c = calc(), s = S.s, e = est(c.bal), st = streak(), sa = scheduleAnalysis(), nm = nextMilestone();

  let milestoneSnippet = 'Belum ada milestone dibuat';
  if (nm) {
    if (nm.allDone) {
      milestoneSnippet = `Semua milestone tercapai! 🏆 (${esc(nm.last?.name)})`;
    } else {
      milestoneSnippet = `${esc(nm.milestone.name)}: ${rp(nm.milestone.amount)} <small>(Kurang ${rp(nm.rem)})</small>`;
    }
  }

  $('#view').innerHTML = `
  <div class="stats">
    <div class="card hero">
      <span>Saldo Terkini</span>
      <b>${rp(c.bal)}</b>
      <small>Saldo awal ${rp(s.initial)} · Progres ${c.pct.toFixed(1)}%</small>
    </div>
    ${st4('Target Tabungan', rp(s.target), 'Rutin ' + rp(s.routine) + ' / ' + UNIT[s.freq])}
    ${st4('Status Jadwal', `<span class="pill ${sa.badgeClass}">${sa.status === 'ahead' ? '🚀 Lebih Cepat' : sa.status === 'behind' ? '⚠️ Tertinggal' : sa.status === 'achieved' ? '🎉 Tercapai' : '🎯 On Track'}</span>`, sa.aheadText)}
    ${st4('Sisa Target', rp(c.rem), c.rem ? `${(100 - c.pct).toFixed(1)}% lagi untuk dicapai` : 'Target Tercapai 🎉')}
    ${st4('Milestone Berikutnya', nm && !nm.allDone ? esc(nm.milestone.name) : 'Semua Tercapai', milestoneSnippet)}
    ${st4('🔥 Saving Streak', st.cur + ' minggu berturut-turut', 'Rekor terbaik: ' + st.best + ' minggu')}
  </div>

  <section class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <h3>Progres Menuju Target (${rp(s.target)})</h3>
      <span style="font-weight:600;color:var(--ac2)">${c.pct.toFixed(1)}%</span>
    </div>
    ${bar(c.pct)}
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-top:6px;font-size:13px" class="mu">
      <span>Estimasi Rencana Rutin: <b style="color:var(--tx)">${estTxt(e)}</b></span>
      <span>Estimasi Tempo Aktual: <b style="color:var(--tx)">${sa.estActual ? (sa.estActual.done ? 'Target tercapai 🎉' : fdo(sa.estActual.d) + ` (${sa.estActual.n} ${UNIT[s.freq]} lagi)`) : 'Belum cukup data transaksi'}</b></span>
    </div>
  </section>

  <div class="g2">
    <section class="card">
      <h3>Perkembangan Saldo Riil</h3>
      <div class="ch" id="c1"></div>
    </section>
    ${insCard()}
  </div>

  <section class="card" style="margin-top:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <h3 style="margin:0">Transaksi Terbaru</h3>
      <a href="#riwayat" class="mu" style="font-size:13px;text-decoration:none">Lihat semua transaksi →</a>
    </div>
    ${rows(sorted(S.tx).slice(0, 5))}
  </section>`;

  const b = balSeries();
  chart('c1', b.L, [{ N: 'Saldo Tabungan', c: GR, D: b.D, area: 1 }]);
};

/* ---------- Transaksi Modal ---------- */
function openTx(id, defaultDate) {
  const x = S.tx.find(t => t.id === id) || { type: 'in', date: defaultDate || today(), cat: '', note: '' };
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
  const list = S.tx.filter(t => t.id !== id).concat([{ ...n, id: 'temp' }]);
  const a = calc(), b = calc(list);
  if (b.bal < 0) {
    toast('Saldo tabungan tidak mencukupi untuk melakukan penarikan sebesar nominal tersebut');
    return;
  }
  if (n.type !== 'out') return commit(n, id);

  const e = est(b.bal);
  $('#dlg').innerHTML = `<div><h3>⚠️ Konfirmasi Dampak Penarikan</h3><div class="imp">
  <div>Saldo Tabungan<b>${rp(a.bal)} → ${rp(b.bal)}</b></div>
  <div>Progres Target<b>${a.pct.toFixed(1)}% → ${b.pct.toFixed(1)}%</b></div>
  <div>Sisa Target<b>${rp(a.rem)} → ${rp(b.rem)}</b></div>
  <div>Estimasi Tercapai<b>${e ? (e.done ? 'Tercapai' : fdo(e.d)) : '-'}</b></div></div>
  <p class="mu" style="margin-top:10px">Penarikan ${rp(n.amount)} akan memperlambat jadwal pencapaian target tabunganmu.</p>
  <div class="row"><button class="btn ghost" id="bk">Batal</button><button class="btn red" id="ok">Tetap Tarik Dana</button></div></div>`;
  $('#bk').onclick = () => $('#dlg').close();
  $('#ok').onclick = () => { $('#ok').disabled = true; commit(n, id); };
}

function commit(n, id) {
  if (id) {
    const i = S.tx.findIndex(t => t.id === id);
    if (i < 0) return;
    S.tx[i] = { ...S.tx[i], ...n, id };
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

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b) return;
  const { a, id } = b.dataset;
  if (a === 'edit') openTx(id);
  if (a === 'del' && confirm('Hapus transaksi ini? Saldo dan proyeksi akan dihitung ulang.')) {
    const t = S.tx.filter(x => x.id !== id);
    if (calc(t).bal < 0) return toast('Tidak bisa dihapus karena menyebabkan saldo tabungan menjadi negatif');
    S.tx = t;
    save();
    toast('Transaksi berhasil dihapus');
    render();
  }
  if (a === 'delms') {
    S.ms = S.ms.filter(m => m.id !== id);
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
  const c = calc(), s = S.s, ins = S.tx.filter(x => x.type === 'in'), m = monthly();
  const mx = ins.length ? Math.max(...ins.map(x => x.amount)) : 0;
  const sa = scheduleAnalysis();
  const netSaved = c.i - c.o;
  const savingRate = c.i > 0 ? (netSaved / c.i * 100) : 0;

  // Kumulatif target rencana vs realisasi aktual
  const bSeries = balSeries();
  const L = bSeries.L;
  const actualData = bSeries.D;
  const unitDays = DAYS[s.freq] || 7;
  const plannedData = L.map((_, idx) => {
    return s.initial + (idx * s.routine);
  });

  $('#view').innerHTML = `
  <div class="stats">
    ${st4('Rata-rata Setoran', rp(ins.length ? c.i / ins.length : 0), ins.length + ' kali setoran')}
    ${st4('Laju Tabungan Aktual', rp(sa.actualPerUnit), 'rata-rata per ' + UNIT[s.freq])}
    ${st4('Total Setoran', rp(c.i), 'Disimpan ke tabungan')}
    ${st4('Total Penarikan', rp(c.o), `${savingRate.toFixed(1)}% rasio simpanan bersih`)}
    ${st4('Setoran Terbesar', rp(mx), 'Pernah disetor')}
  </div>

  <div class="g2">
    <section class="card">
      <h3>Target Rencana vs Realisasi Riil Tabungan</h3>
      <div class="ch" id="c_plan"></div>
    </section>
    <section class="card">
      <h3>Setoran vs Penarikan (Bulanan)</h3>
      <div class="ch" id="c2"></div>
    </section>
  </div>

  <div class="g2" style="margin-top:16px">
    <section class="card">
      <h3>Status Deviasi Jadwal & Evaluasi</h3>
      <div style="display:grid;gap:12px;margin-top:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="mu">Posisi terhadap target jadwal:</span>
          <span class="pill ${sa.badgeClass}">${sa.aheadText}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="mu">Saldo seharusnya saat ini (rencana):</span>
          <b>${rp(sa.expectedBal)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="mu">Saldo riil terkini:</span>
          <b style="color:var(--ac2)">${rp(c.bal)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="mu">Selisih kumulatif (surplus / defisit):</span>
          <b style="color:${sa.diffBal >= 0 ? 'var(--ac2)' : 'var(--amb)'}">${sa.diffBal >= 0 ? '+' : ''}${rp(sa.diffBal)}</b>
        </div>
      </div>
    </section>
    ${insCard()}
  </div>

  <section class="card" style="margin-top:16px">
    <h3>Tabel Ringkasan Arus Kas Bulanan</h3>
    ${monthTable(m)}
  </section>`;

  chart('c_plan', L, [
    { N: 'Realisasi Aktual', c: GR, D: actualData, area: 1 },
    { N: 'Target Rencana', c: BL, D: plannedData, dash: '5 4' }
  ]);
  chart('c2', m.map(x => mlabel(x.k)), [
    { N: 'Setoran', c: GR, D: m.map(x => x.i) },
    { N: 'Penarikan', c: RD, D: m.map(x => x.o) }
  ], 1);
};

const monthTable = m => m.length ? `<div class="tw"><table><thead><tr><th>Bulan</th><th class="r">Setoran</th><th class="r">Penarikan</th><th class="r">Tabungan Bersih</th><th class="r">Jumlah Transaksi</th></tr></thead><tbody>${[...m].reverse().map(x => `<tr><td>${mlong(x.k)}</td><td class="r in">+${rp(x.i)}</td><td class="r out">-${rp(x.o)}</td><td class="r" style="font-weight:600;color:${x.i - x.o >= 0 ? 'var(--ac2)' : 'var(--red)'}">${x.i - x.o >= 0 ? '+' : ''}${rp(x.i - x.o)}</td><td class="r">${x.n}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mu empty">Belum ada transaksi pada periode bulanan.</p>';

/* ---------- Target & Milestone ---------- */
V.target = () => {
  const c = calc(), s = S.s, ms = [...S.ms].sort((a, b) => a.amount - b.amount);
  $('#view').innerHTML = `
  <section class="card">
    <h2>Target Utama Tabungan</h2>
    <form id="tg" class="row wrap">
      <label>Target Nominal Baru (Rp)<input name="t" type="number" min="1" step="1" required value="${s.target}"></label>
      <button class="btn">Perbarui Target</button>
    </form>
    <div class="bar big" style="margin-top:20px">
      <i style="width:${c.pct}%"></i>
      ${ms.map(m => `<u style="left:${Math.min(100, m.amount / s.target * 100)}%" title="${esc(m.name)}: ${rp(m.amount)}"></u>`).join('')}
    </div>
    <p class="mu">${c.pct.toFixed(1)}% tercapai dari target ${rp(s.target)} · Garis penanda kuning pada progress bar adalah milestone.</p>
  </section>

  <section class="card">
    <h3>Milestone Pencapaian</h3>
    <p class="mu">Bagi target besar menjadi tonggak-tonggak kecil yang lebih mudah dicapai.</p>
    <form id="mf" class="row wrap" style="margin:12px 0 16px">
      <label>Nama Milestone<input name="n" required maxlength="40" placeholder="Contoh: Dana Darurat Tahap 1"></label>
      <label>Target Nominal (Rp)<input name="a" type="number" min="1" step="1" required placeholder="Contoh: 10000000"></label>
      <button class="btn">+ Tambah Milestone</button>
    </form>
    <div>
      ${ms.length ? ms.map(m => {
        const p = Math.min(100, Math.max(0, c.bal / m.amount * 100));
        return `<div class="milestone-item" style="flex-direction:column;align-items:stretch;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <b>${p >= 100 ? '✅' : '🎯'} ${esc(m.name)}</b>
            <span>${rp(m.amount)} <button class="ib" data-a="delms" data-id="${m.id}" title="Hapus">🗑️</button></span>
          </div>
          ${bar(p)}
          <small class="mu">${p >= 100 ? '🎉 Milestone ini telah tercapai!' : `Kurang ${rp(m.amount - c.bal)} (${p.toFixed(1)}% tercapai)`}</small>
        </div>`;
      }).join('') : '<p class="mu empty">Belum ada milestone yang ditambahkan.</p>'}
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
    ${st4('Sisa Nominal Target', rp(c.rem), `${c.pct.toFixed(1)}% telah terkumpul`)}
    ${st4('Status Jadwal', `<span class="pill ${sa.badgeClass}">${sa.status === 'ahead' ? '🚀 Lebih Cepat' : sa.status === 'behind' ? '⚠️ Tertinggal' : sa.status === 'achieved' ? '🎉 Tercapai' : '🎯 On Track'}</span>`, sa.aheadText)}
    ${st4('Estimasi (Setoran Rutin)', estTxt(eRoutine, s.freq), 'Rencana: ' + rp(s.routine) + ' / ' + UNIT[s.freq])}
    ${st4('Estimasi (Tempo Aktual)', eActual ? (eActual.done ? 'Target tercapai 🎉' : `${fdo(eActual.d)} <small>(${eActual.n} ${UNIT[s.freq]} lagi)</small>`) : 'Perlu lebih banyak data', 'Laju riil: ' + rp(sa.actualPerUnit) + ' / ' + UNIT[s.freq])}
  </div>

  <section class="card">
    <h3>Perbandingan Dua Skenario Proyeksi Masa Depan</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:12px 0">
      <div style="background:var(--bg);border:1px solid var(--bd);padding:14px;border-radius:12px">
        <div style="display:flex;align-items:center;gap:6px;font-weight:600;color:var(--ac2);margin-bottom:6px">
          <span style="font-size:18px">📌</span> Skenario A: Disiplin Sesuai Rencana
        </div>
        <p class="mu" style="font-size:13px">Asumsi kamu menyetor rutin <b>${rp(s.routine)}</b> setiap <b>${UNIT[s.freq]}</b> mulai hari ini tanpa putus.</p>
        <div style="margin-top:10px">
          <div>Estimasi Tanggal: <b>${eRoutine ? (eRoutine.done ? 'Tercapai' : fdo(eRoutine.d)) : '-'}</b></div>
          <div class="mu">Waktu yang dibutuhkan: <b>${eRoutine ? (eRoutine.done ? '0' : eRoutine.n) : '-'} ${UNIT[s.freq]}</b></div>
        </div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--bd);padding:14px;border-radius:12px">
        <div style="display:flex;align-items:center;gap:6px;font-weight:600;color:var(--amb);margin-bottom:6px">
          <span style="font-size:18px">⚡</span> Skenario B: Realistis Berdasarkan Tempo Riil
        </div>
        <p class="mu" style="font-size:13px">Dihitung dari rata-rata performa menabung bersih aktualmu sejak tanggal <b>${fd(s.start)}</b> (${rp(sa.actualPerUnit)} / ${UNIT[s.freq]}).</p>
        <div style="margin-top:10px">
          <div>Estimasi Tanggal: <b>${eActual ? (eActual.done ? 'Tercapai' : fdo(eActual.d)) : 'Belum bisa diprediksi'}</b></div>
          <div class="mu">Waktu yang dibutuhkan: <b>${eActual ? (eActual.done ? '0' : eActual.n) : '-'} ${UNIT[s.freq]}</b></div>
        </div>
      </div>
    </div>
    <div class="ch" id="c_proj" style="margin-top:16px"></div>
  </section>

  ${insCard()}`;

  // Grafik proyeksi komparatif
  if (c.rem <= 0) {
    $('#c_proj').innerHTML = '<p class="mu empty" style="color:var(--ac2);font-weight:600">Target Rp' + rp(s.target) + ' telah tercapai sepenuhnya! 🎉</p>';
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
    <p class="mu">Uji coba berbagai skenario setoran, perubahan nominal rutin, atau setoran tambahan/penarikan satu kali tanpa memengaruhi data tabungan asli.</p>
    <form id="sm" class="grid2" style="margin-top:14px">
      <label>Saldo Tabungan Dasar (Rp)
        <input name="b" type="number" min="0" step="1" value="${c.bal}">
      </label>
      <label>Target Tabungan (Rp)
        <input name="t" type="number" min="1" step="1" value="${s.target}">
      </label>
      <label>Nominal Tabungan Rutin (Rp)
        <input name="r" type="number" min="1" step="1" value="${s.routine}" placeholder="Nominal rutin...">
      </label>
      <label>Frekuensi Menabung
        <select name="f">${opts(FREQ, s.freq)}</select>
      </label>
      <label>Tambahan Setoran Satu Kali / Bonus (Rp)
        <input name="bonus" type="number" min="0" step="1" value="0" placeholder="0">
      </label>
      <label>Rencana Penarikan Satu Kali (Rp)
        <input name="withdraw" type="number" min="0" step="1" value="0" placeholder="0">
      </label>
    </form>
    <div id="so" style="margin-top:16px"></div>
  </section>

  <section class="card">
    <h3>Grafik Proyeksi Simulasi</h3>
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
        <h4 style="color:var(--ac2);margin:0 0 6px">Target Sudah Tercapai! 🎉</h4>
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
          impactText = `<p style="color:var(--ac2);font-weight:600;margin-top:6px">⚡ Tambahan setoran Rp${rp(bonus)} mempercepat target tercapai sebanyak ~${delta} ${UNIT[fr]} lebih awal!</p>`;
        } else if (delta < 0) {
          impactText = `<p style="color:var(--red);font-weight:600;margin-top:6px">⚠️ Penarikan Rp${rp(withdraw)} menunda pencapaian target sebanyak ~${Math.abs(delta)} ${UNIT[fr]}.</p>`;
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
        <span><b>${rp(t)}</b> / ${rp(wt)} ${wt > 0 && t >= wt ? '✅ Tercapai' : ''}</span>
      </div>
      ${bar(p)}
    </div>`;
  }

  // Detail tanggal yang dipilih
  const curDetail = map[selectedCalDate] || { in: 0, out: 0, sumIn: 0, sumOut: 0, list: [] };
  const curSched = sched(selectedCalDate);

  $('#view').innerHTML = `
  <section class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <button class="ib" id="pv" title="Bulan sebelumnya">‹</button>
      <h3 style="margin:0">${MN[m]} ${y}</h3>
      <button class="ib" id="nx" title="Bulan berikutnya">›</button>
    </div>
    <div class="cal">${cells}</div>
    <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:12px" class="mu">
      <span><span class="dt in"></span> Setoran</span>
      <span><span class="dt out"></span> Penarikan</span>
      <span>⬚ Jadwal setoran rutin</span>
      <span><b>Bold</b> Hari ini</span>
    </div>

    <!-- Detail interaktif tanggal terpilih -->
    <div class="cal-detail">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <b style="font-size:15px">📅 ${fdo(pd(selectedCalDate))}</b>
          ${curSched ? '<span class="pill ahead" style="margin-left:8px">Jadwal Menabung Rutin</span>' : ''}
        </div>
        <button class="btn" id="btn-add-day">+ Catat Transaksi di Tanggal Ini</button>
      </div>

      ${curDetail.list.length ? `
        <div style="display:flex;gap:14px;font-size:13px;margin:6px 0">
          ${curDetail.sumIn ? `<span style="color:var(--ac2)">Total Setoran: +${rp(curDetail.sumIn)}</span>` : ''}
          ${curDetail.sumOut ? `<span style="color:var(--red)">Total Penarikan: -${rp(curDetail.sumOut)}</span>` : ''}
        </div>
        ${rows(curDetail.list, true)}
      ` : '<p class="mu empty" style="padding:10px 0">Tidak ada transaksi pada tanggal ini.</p>'}
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
      <button class="btn noprint" onclick="window.print()">🖨️ Cetak / Ekspor PDF</button>
    </div>
    <p class="mu">Dihasilkan pada: ${fdo(new Date())} · Periode aktif sejak: ${fd(s.start)}</p>
    <div class="stats" style="margin-top:14px">
      ${st4('Saldo Awal', rp(s.initial), 'Ditetapkan pada ' + fd(s.start))}
      ${st4('Total Setoran', rp(c.i), 'Dari ' + S.tx.filter(x => x.type === 'in').length + ' kali setor')}
      ${st4('Total Penarikan', rp(c.o), 'Dari ' + S.tx.filter(x => x.type === 'out').length + ' kali tarik')}
      ${st4('Saldo Terkini', rp(c.bal), c.pct.toFixed(1) + '% dari target ' + rp(s.target))}
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
    <h2>Backup & Pulihkan Data</h2>
    <p class="mu">Amankan seluruh data tabungan, transaksi, milestone, dan pengaturan ke file JSON lokal di perangkatmu.</p>
    <div class="row wrap" style="margin-top:14px">
      <button class="btn" id="bj">⬇️ Unduh Backup JSON</button>
      <label class="btn ghost" style="cursor:pointer;color:var(--tx);display:inline-flex;align-items:center">
        ⬆️ Impor & Pulihkan JSON
        <input type="file" id="ij" accept=".json" hidden>
      </label>
      <button class="btn ghost" id="bc">📄 Ekspor Riwayat Transaksi CSV</button>
    </div>
  </section>

  <section class="card">
    <h3 style="color:var(--red)">Zona Berbahaya: Reset Semua Data</h3>
    <p class="mu">Tindakan ini akan menghapus permanen seluruh data tabungan, riwayat transaksi, dan pengaturan di peramban ini. Pastikan kamu sudah mengunduh backup JSON terlebih dahulu.</p>
    <div style="margin-top:12px">
      <button class="btn red" id="rs">Reset Seluruh Data Tabungan</button>
    </div>
  </section>`;

  $('#bj').onclick = () => dl(`tabunganku-backup-${today()}.json`, JSON.stringify(S, null, 2), 'application/json');
  $('#ij').onchange = e => { importJSON(e.target.files[0]); e.target.value = ''; };
  $('#bc').onclick = () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    dl(`transaksi-${today()}.csv`, '\ufeffTanggal,Jenis,Kategori,Nominal,Catatan\n' + sorted(S.tx).map(x => [x.date, x.type === 'in' ? 'Setoran' : 'Penarikan', x.cat, x.amount, x.note].map(q).join(',')).join('\n'), 'text/csv');
  };
  $('#rs').onclick = () => {
    if (confirm('PERINGATAN: Yakin ingin menghapus SEMUA data? Tindakan ini tidak dapat dibatalkan.')) {
      S = { s: null, tx: [], ms: [], log: [], theme: S.theme };
      save();
      location.hash = '';
      render();
    }
  };
};

/* ---------- Tema & Inisialisasi ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
}

function toggleTheme() {
  S.theme = S.theme === 'dark' ? 'light' : 'dark';
  save();
  applyTheme();
  render();
}

const closeSide = () => {
  $('#side').classList.remove('open');
  const ov = $('#side-overlay'); if (ov) ov.classList.remove('show');
};
const openSide = () => {
  $('#side').classList.add('open');
  const ov = $('#side-overlay'); if (ov) ov.classList.add('show');
};

$('#th').onclick = toggleTheme;
$('#add').onclick = () => openTx();
$('#mb').onclick = openSide;
if ($('#sb-close')) $('#sb-close').onclick = closeSide;
if ($('#side-overlay')) $('#side-overlay').onclick = closeSide;
window.addEventListener('hashchange', render);

applyTheme();
render();
