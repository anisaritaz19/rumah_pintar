const $ = s => document.querySelector(s);
const COL = {normal:'#7f7f7f', rule:'#2ca02c', q:'#1f77b4', rand:'#e6a817', red:'#d62728', org:'#ff7f0e'};
const ACT_COL = ['#e6a817', '#d62728', '#2ca02c'];
const f2 = (x, n = 2) => Number(x).toFixed(n).replace('.', ',');
let S = null;

document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.remove('on')); b.classList.add('on');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on')); $('#' + b.dataset.t).classList.add('on');
  if (b.dataset.t === 'ringkasan' && S) drawSummary();
  if (b.dataset.t === 'simulasi' && S) $('#goDay').click();
  if (b.dataset.t === 'kebijakan' && S) $('#goPol').click();
});

function setup(c) { const r = devicePixelRatio || 1, w = c.clientWidth, h = +c.getAttribute('height'); c.width = w * r; c.height = h * r; const g = c.getContext('2d'); g.scale(r, r); g.clearRect(0, 0, w, h); g.font = '11px sans-serif'; return [g, w, h]; }
const ink = () => getComputedStyle(document.body).color;
function axes(g, w, h, m, ymin, ymax, ylab, xticks) {
  g.strokeStyle = 'rgba(128,128,128,.25)'; g.fillStyle = ink(); g.textAlign = 'right';
  for (let i = 0; i <= 4; i++) { const y = m.t + (h - m.t - m.b) * i / 4, v = ymax - (ymax - ymin) * i / 4; g.beginPath(); g.moveTo(m.l, y); g.lineTo(w - m.r, y); g.stroke(); g.fillText(f2(v, Math.abs(ymax) < 5 ? 2 : 1), m.l - 4, y + 4); }
  g.textAlign = 'center'; xticks.forEach(([x, t]) => g.fillText(t, x, h - m.b + 14));
  if (ylab) { g.save(); g.translate(11, (h - m.b + m.t) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(ylab, 0, 0); g.restore(); }
}
function lineChart(c, series, ylab, xlab) {
  const [g, w, h] = setup(c), m = {l: 48, r: 12, t: 12, b: 34};
  let all = series.flatMap(s => s.y), ymin = Math.min(...all), ymax = Math.max(...all); const pad = (ymax - ymin) * .1 || 1; ymin -= pad; ymax += pad;
  const xs = series[0].x, xmin = Math.min(...xs), xmax = Math.max(...xs), X = v => m.l + (w - m.l - m.r) * (v - xmin) / ((xmax - xmin) || 1), Y = v => m.t + (h - m.t - m.b) * (ymax - v) / (ymax - ymin);
  const ticks = [0, 1, 2, 3, 4].map(i => { const v = xmin + (xmax - xmin) * i / 4; return [X(v), Math.round(v)]; });
  axes(g, w, h, m, ymin, ymax, ylab, ticks);
  series.forEach(s => { g.strokeStyle = s.c; g.lineWidth = s.dash ? 1.4 : 2.2; g.setLineDash(s.dash ? [6, 4] : []); g.beginPath(); s.x.forEach((v, i) => i ? g.lineTo(X(v), Y(s.y[i])) : g.moveTo(X(v), Y(s.y[i]))); g.stroke(); });
  g.setLineDash([]); let lx = m.l + 6; series.forEach(s => { g.fillStyle = s.c; g.fillRect(lx, m.t + 2, 10, 10); g.fillStyle = ink(); g.textAlign = 'left'; g.fillText(s.n, lx + 14, m.t + 11); lx += 22 + g.measureText(s.n).width; });
  g.fillStyle = ink(); g.textAlign = 'center'; g.fillText(xlab, w / 2, h - 3);
}

async function init() {
  S = await (await fetch('/api/summary')).json();
  const dd = $('#dateSel'); [...S.test_days].reverse().forEach(d => dd.add(new Option(d + ' (uji)', d))); S.val_days.slice(-30).forEach(d => dd.add(new Option(d + ' (validasi)', d)));
  drawSummary();
}
function drawSummary() {
  const bt = S.baseline.test, q = S.q_test_mean, sav = 100 * (bt.normal.cost - q.cost) / bt.normal.cost, savR = 100 * (bt.normal.cost - bt.rule.cost) / bt.normal.cost;
  $('#kpis').innerHTML = [
    ['', S.pre.hari_lengkap_dipakai + ' hari', 'Hari lengkap dipakai (dari ' + S.pre.hari_total + ')'], ['g', f2(sav) + '%', 'Penghematan biaya Q-Learning (uji, rata² 5 seed)'],
    ['o', f2(savR) + '%', 'Penghematan aturan tarif (uji)'], ['r', f2(q.delay) + ' kWh·jam', 'Tundaan rata² Q-Learning / hari'], ['', f2(bt.normal.peak_kwh) + ' → ' + f2(q.peak_kwh), 'Energi jam puncak kWh/hari: tanpa kontrol → Q']
  ].map(k => `<div class="kpi ${k[0]}"><b>${k[1]}</b><span>${k[2]}</span></div>`).join('');
  const [g, w, h] = setup($('#cBar')), m = {l: 40, r: 10, t: 20, b: 40};
  const items = [['Tanpa kontrol', bt.normal.cost, COL.normal], ['Acak', bt.random.cost, COL.rand], ['Aturan tarif', bt.rule.cost, COL.rule], ['Q-Learning', q.cost, COL.q]];
  const mx = Math.max(...items.map(i => i[1])) * 1.1, mn = 0; axes(g, w, h, m, mn, mx, 'Biaya harian (UTR)', []);
  const bw = (w - m.l - m.r) / items.length;
  items.forEach((it, i) => { const y = m.t + (h - m.t - m.b) * (mx - it[1]) / (mx - mn); g.fillStyle = it[2]; g.fillRect(m.l + i * bw + bw * .18, y, bw * .64, h - m.b - y); g.fillStyle = ink(); g.textAlign = 'center'; g.fillText(f2(it[1]), m.l + i * bw + bw / 2, y - 4); g.fillText(it[0], m.l + i * bw + bw / 2, h - 22); });
  const c = S.curve; lineChart($('#cCurve'), [{x: c.map(a => a[0]), y: c.map(a => a[1]), c: COL.q, n: 'Q-Learning'},
    {x: c.map(a => a[0]), y: c.map(() => S.baseline.val.normal.ret), c: COL.normal, n: 'Tanpa kontrol', dash: 1}, {x: c.map(a => a[0]), y: c.map(() => S.baseline.val.rule.ret), c: COL.rule, n: 'Aturan tarif', dash: 1}], 'Return', 'Episode');
  const best = S.best_cfg; let rows = [...S.grid].sort((a, b) => b.val_ret_mean - a.val_ret_mean);
  $('#gridTable').innerHTML = '<table><tr><th>α awal</th><th>γ</th><th>ε-decay</th><th>Return validasi (rata²)</th><th>Std</th></tr>' + rows.map((r, i) => `<tr class="${i === 0 ? 'best' : ''}"><td>${r.alpha}</td><td>${r.gamma}</td><td>${r.eps_decay}</td><td>${f2(r.val_ret_mean, 3)}</td><td>${f2(r.val_ret_std, 3)}</td></tr>`).join('') + '</table>';
  $('#notes').innerHTML = `<h3>Catatan metodologi</h3><p class="muted">Data latih ${S.split.train.awal} → ${S.split.train.akhir} (${S.split.train.n_hari} hari), validasi ${S.split.val.awal} → ${S.split.val.akhir} (${S.split.val.n_hari} hari), uji ${S.split.test.awal} → ${S.split.test.akhir} (${S.split.test.n_hari} hari). Hiperparameter dipilih pada data validasi; data uji hanya dipakai untuk evaluasi akhir. Tarif waktu-pakai (UTR = unit tarif relatif), batas tunda ${S.asumsi.CAP_KWH} kWh, λ = ${S.asumsi.LAMBDA}, dan μ = ${S.asumsi.MU} adalah asumsi simulasi, bukan bagian dari data UCI.</p>`;
}

$('#goDay').onclick = async () => {
  const d = $('#dateSel').value, qid = $('#qidSel').value; const r = await (await fetch(`/api/day?date=${d}&qid=${qid}`)).json(); if (r.error) { alert(r.error); return; }
  const N = r.result.normal, Rl = r.result.rule, Q = r.result.q, sv = 100 * (N.total.cost - Q.total.cost) / N.total.cost;
  $('#dayKpi').innerHTML = [['', f2(N.total.cost) + ' UTR', 'Biaya tanpa kontrol'], ['g', f2(Q.total.cost) + ' UTR', 'Biaya Q-Learning (hemat ' + f2(sv) + '%)'], ['o', f2(Rl.total.cost) + ' UTR', 'Biaya aturan tarif'], ['', f2(Q.total.peak_kwh) + ' kWh', 'Energi jam puncak (Q) vs ' + f2(N.total.peak_kwh) + ' tanpa kontrol'], ['r', f2(Q.total.delay) + ' kWh·jam', 'Tundaan Q-Learning']].map(k => `<div class="kpi ${k[0]}"><b>${k[1]}</b><span>${k[2]}</span></div>`).join('');
  const [g, w, h] = setup($('#cDay')), m = {l: 44, r: 10, t: 14, b: 34}; const mx = Math.max(...N.traj.map(t => t.actual), ...Q.traj.map(t => t.energy)) * 1.15;
  axes(g, w, h, m, 0, mx, 'kWh', N.traj.map((t, i) => [m.l + (w - m.l - m.r) * (i + .5) / 24, i]));
  const bw = (w - m.l - m.r) / 24, Y = v => m.t + (h - m.t - m.b) * (mx - v) / mx;
  N.traj.forEach((t, i) => { const x = m.l + i * bw; if (S.peak.includes(i)) { g.fillStyle = 'rgba(214,39,40,.08)'; g.fillRect(x, m.t, bw, h - m.t - m.b); }
    g.fillStyle = COL.normal; g.fillRect(x + bw * .08, Y(t.actual), bw * .38, h - m.b - Y(t.actual)); g.fillStyle = COL.q; const e = Q.traj[i].energy; g.fillRect(x + bw * .5, Y(e), bw * .38, h - m.b - Y(e)); });
  g.strokeStyle = COL.org; g.lineWidth = 2; g.beginPath(); Q.traj.forEach((t, i) => { const x = m.l + (i + .5) * bw; i ? g.lineTo(x, Y(t.backlog)) : g.moveTo(x, Y(t.backlog)); }); g.stroke();
  $('#dayLegend').innerHTML = `<span><i style="background:${COL.normal}"></i>Aktual (tanpa kontrol)</span><span><i style="background:${COL.q}"></i>Q-Learning</span><span><i style="background:${COL.org}"></i>Tundaan (kWh)</span><span><i style="background:rgba(214,39,40,.3)"></i>Jam puncak</span><span class="muted">Data ${r.split === 'train' ? 'latih' : r.split === 'val' ? 'validasi' : 'uji'} · ${r.date}</span>`;
  $('#dayTable').innerHTML = '<table><tr><th>Jam</th><th>Tarif</th><th>Aktual (kWh)</th><th>Q: aksi</th><th>Q: energi</th><th>Tundaan</th><th>Aturan: aksi</th></tr>' + Q.traj.map((t, i) => `<tr><td>${String(i).padStart(2, '0')}:00</td><td>${f2(r.price[i], 1)}</td><td>${f2(t.actual)}</td><td><span class="chip" style="background:${ACT_COL[t.action]}">${r.actions[t.action]}</span></td><td>${f2(t.energy)}</td><td>${f2(t.backlog)}</td><td><span class="chip" style="background:${ACT_COL[Rl.traj[i].action]}">${r.actions[Rl.traj[i].action]}</span></td></tr>`).join('') + '</table>';
};

$('#goTrain').onclick = async () => {
  $('#trainMsg').textContent = 'Melatih agen…'; $('#goTrain').disabled = true;
  const body = {alpha: +$('#pa').value, gamma: +$('#pg').value, eps_decay: +$('#pe').value, alpha_decay: +$('#pd').value, episodes: +$('#pn').value, seed: +$('#ps').value};
  const r = await (await fetch('/api/train', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)})).json(); $('#goTrain').disabled = false;
  if (r.error) { $('#trainMsg').textContent = r.error; return; }
  $('#trainMsg').textContent = `Selesai: ${r.episodes} episode. Model "${r.qid}" ditambahkan ke pilihan model di tab Simulasi dan Kebijakan.`;
  ['#qidSel', '#qidPol'].forEach(s => $(s).add(new Option('Model latihan ' + r.qid, r.qid))); $('#trainOut').style.display = 'block';
  const bv = r.baseline.val, mv = r.metrics.val, mt = r.metrics.test, sv = 100 * (r.baseline.test.normal.cost - mt.cost) / r.baseline.test.normal.cost;
  $('#trainKpi').innerHTML = [['', f2(mv.ret, 3), 'Return validasi (tanpa kontrol ' + f2(bv.normal.ret, 3) + ', aturan ' + f2(bv.rule.ret, 3) + ')'], ['g', f2(sv) + '%', 'Penghematan biaya pada data uji'], ['r', f2(mt.delay) + ' kWh·jam', 'Tundaan rata² data uji / hari'], ['o', f2(mt.peak_kwh), 'Energi jam puncak (uji)']].map(k => `<div class="kpi ${k[0]}"><b>${k[1]}</b><span>${k[2]}</span></div>`).join('');
  const n = r.returns.length, step = r.episodes / n; lineChart($('#cTr'), [{x: r.returns.map((_, i) => Math.round(i * step)), y: r.returns, c: COL.q, n: 'Return pelatihan'}], 'Return', 'Episode');
  lineChart($('#cTv'), [{x: r.curve.map(a => a[0]), y: r.curve.map(a => a[1]), c: COL.q, n: 'Q-Learning'}, {x: r.curve.map(a => a[0]), y: r.curve.map(() => bv.normal.ret), c: COL.normal, n: 'Tanpa kontrol', dash: 1}, {x: r.curve.map(a => a[0]), y: r.curve.map(() => bv.rule.ret), c: COL.rule, n: 'Aturan', dash: 1}], 'Return validasi', 'Episode');
};

$('#goPol').onclick = async () => {
  const r = await (await fetch(`/api/policy?qid=${$('#qidPol').value}&demand=${$('#dl').value}&ctrl=${$('#ll').value}`)).json(); if (r.error) { alert(r.error); return; }
  const [g, w, h] = setup($('#cPol')), m = {l: 70, r: 10, t: 10, b: 28}, cw = (w - m.l - m.r) / 24, ch = (h - m.t - m.b) / 4; const lab = ['0', '≤ 0,5', '≤ 1,0', '> 1,0'];
  r.map.forEach((row, b) => row.forEach((a, hh) => { g.fillStyle = ACT_COL[a]; g.fillRect(m.l + hh * cw + 1, m.t + b * ch + 1, cw - 2, ch - 2); })); g.fillStyle = ink(); g.textAlign = 'right';
  lab.forEach((t, b) => g.fillText(t + ' kWh', m.l - 6, m.t + b * ch + ch / 2 + 4)); g.textAlign = 'center'; for (let i = 0; i < 24; i += 2) g.fillText(i, m.l + i * cw + cw / 2, h - 10);
};
window.addEventListener('resize', () => { if (S && $('#ringkasan').classList.contains('on')) drawSummary(); });
init();
