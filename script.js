/* =============================================================
   Vizualizace zdravotnických prostředků 2020–2024
   Načítá data/data.json a vykresluje 3 grafy v Chart.js 4.
   ============================================================= */

const COLORS = {
  '01': getCss('--c-01'),
  '02': getCss('--c-02'),
  '03': getCss('--c-03'),
  '04': getCss('--c-04'),
  '05': getCss('--c-05'),
  '06': getCss('--c-06'),
  '07': getCss('--c-07'),
  '08': getCss('--c-08'),
  '09': getCss('--c-09'),
  '10': getCss('--c-10'),
  '11': getCss('--c-11'),
};
const INK       = getCss('--ink');
const INK_MUTED = getCss('--ink-muted');
const LINE      = getCss('--line');
const SERIF     = '"Newsreader", Georgia, serif';
const SANS      = '"Public Sans", -apple-system, sans-serif';

// Globální nastavení Chart.js
Chart.defaults.font.family = SANS;
Chart.defaults.font.size = 12;
Chart.defaults.color = INK_MUTED;
Chart.defaults.borderColor = LINE;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.boxHeight = 8;
Chart.defaults.plugins.legend.labels.padding = 14;

const fmtKc = (v) => new Intl.NumberFormat('cs-CZ', {
  maximumFractionDigits: v >= 100 ? 0 : 2
}).format(v);
const fmtInt = (v) => new Intl.NumberFormat('cs-CZ').format(Math.round(v));
const fmtPct = (v) => (v >= 0 ? '+' : '') + v.toFixed(0) + ' %';

/** Načte CSS proměnnou na :root */
function getCss(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/* ------------------------------------------------------------- */
async function load() {
  const data = await fetch('data/data.json').then(r => r.json());

  fillKeyStats(data);
  drawTrend(data);
  drawPerPatient(data);
  drawGrowth(data);
}

/* ============ KLÍČOVÁ ČÍSLA NAHOŘE ============ */
function fillKeyStats(data) {
  const totals = data.totals.uhrada_kc;
  const totalsBal = data.totals.baleni;
  const uh2020 = totals[0];
  const uh2024 = totals[totals.length - 1];
  const rust = (uh2024 / uh2020 - 1) * 100;
  const bal2024 = totalsBal[totalsBal.length - 1];

  document.getElementById('stat-uhrada-2024').textContent =
    fmtKc(uh2024 / 1e9) + '\u00A0mld\u00A0Kč';
  document.getElementById('stat-rust').textContent =
    '+' + rust.toFixed(0) + '\u00A0%';
  document.getElementById('stat-baleni-2024').textContent =
    fmtKc(bal2024 / 1e6) + '\u00A0mil.';
}

/* ============ GRAF 1: STOHOVANÉ SLOUPCE V ČASE ============ */
function drawTrend(data) {
  const ctx = document.getElementById('chart-trend');
  const years = data.metadata.roky;

  // Seřadit kategorie podle celkové úhrady 2024 sestupně (nejvyšší dole = nejvíc viditelná)
  const cats = [...data.kategorie].sort((a, b) =>
    b.uhrada_kc[b.uhrada_kc.length - 1] - a.uhrada_kc[a.uhrada_kc.length - 1]
  );

  const datasets = cats.map((c) => ({
    label: c.nazev,
    data: c.uhrada_kc.map(v => v / 1e9),  // mld Kč
    backgroundColor: COLORS[c.kod],
    borderColor: '#ffffff',
    borderWidth: 1,
    barPercentage: 0.78,
    categoryPercentage: 0.78,
  }));

  new Chart(ctx, {
    type: 'bar',
    data: { labels: years, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: { display: false },
        legend: {
          position: 'bottom', align: 'start',
          labels: { padding: 12, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: LINE, borderWidth: 1,
          titleColor: INK, bodyColor: INK,
          titleFont: { family: SERIF, size: 14, weight: '600' },
          bodyFont: { family: SANS, size: 12 },
          padding: 12,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmtKc(ctx.parsed.y)}\u00A0mld\u00A0Kč`,
            footer: (items) => {
              const total = items.reduce((s, i) => s + i.parsed.y, 0);
              return `Celkem: ${fmtKc(total)}\u00A0mld\u00A0Kč`;
            }
          }
        },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 13 } } },
        y: {
          stacked: true,
          grid: { color: LINE, drawBorder: false },
          ticks: {
            callback: (v) => v.toFixed(0) + ' mld',
            font: { size: 11 }
          },
          title: { display: true, text: 'Úhrada od pojišťoven (mld Kč)', font: { size: 12 }, color: INK_MUTED }
        }
      }
    }
  });
}

/* ============ GRAF 2: ÚHRADA / PACIENT vs CELKOVÁ ÚHRADA ============ */
function drawPerPatient(data) {
  const ctx = document.getElementById('chart-perpatient');
  const lastYearIdx = data.metadata.roky.length - 1;

  // pro každou kategorii: x = úhrada/pacient, y = celková úhrada (mld), r = sqrt(pacienti) zmenšené
  const points = data.kategorie.map(c => {
    const uh = c.uhrada_kc[lastYearIdx];
    const pa = c.pacienti[lastYearIdx];
    const perP = pa > 0 ? uh / pa : 0;
    return {
      x: perP / 1000,            // tisíce Kč / pacient
      y: uh / 1e9,               // mld Kč celkem
      r: Math.max(6, Math.sqrt(pa) / 20),
      label: c.nazev,
      kod: c.kod,
      pacienti: pa,
      uhrada: uh,
      examples: c.priklady,
    };
  });

  new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: points.map(p => ({
        label: p.label,
        data: [{ x: p.x, y: p.y, r: p.r, _meta: p }],
        backgroundColor: COLORS[p.kod] + 'b3',  // alpha
        borderColor: COLORS[p.kod],
        borderWidth: 1.5,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', align: 'start', labels: { padding: 12, font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: LINE, borderWidth: 1,
          titleColor: INK, bodyColor: INK,
          titleFont: { family: SERIF, size: 14, weight: '600' },
          bodyFont: { family: SANS, size: 12 },
          padding: 12, displayColors: false,
          callbacks: {
            title: (items) => items[0].dataset.label,
            label: (ctx) => {
              const m = ctx.raw._meta;
              return [
                `Pacientů v 2024: ${fmtInt(m.pacienti)}`,
                `Úhrada celkem: ${fmtKc(m.uhrada / 1e9)} mld Kč`,
                `Úhrada / pacient: ${fmtInt(m.uhrada / m.pacienti)} Kč/rok`,
                ``,
                m.examples,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: 'logarithmic',
          title: { display: true, text: 'Úhrada na 1 pacienta a rok (tis. Kč, log škála)',
                   font: { size: 12 }, color: INK_MUTED },
          grid: { color: LINE },
          ticks: {
            callback: (v) => {
              // jen "pěkná" čísla na log škále
              const okay = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
              return okay.includes(v) ? v.toLocaleString('cs-CZ') : '';
            },
            font: { size: 11 }
          }
        },
        y: {
          title: { display: true, text: 'Celková úhrada 2024 (mld Kč)', font: { size: 12 }, color: INK_MUTED },
          grid: { color: LINE },
          ticks: { font: { size: 11 } },
          beginAtZero: true,
        }
      }
    }
  });
}

/* ============ GRAF 3: % NÁRŮST ============ */
function drawGrowth(data) {
  const ctx = document.getElementById('chart-growth');
  const lastIdx = data.metadata.roky.length - 1;

  const items = data.kategorie
    .map(c => ({
      label: c.nazev,
      kod: c.kod,
      pct: (c.uhrada_kc[lastIdx] / c.uhrada_kc[0] - 1) * 100,
      from: c.uhrada_kc[0],
      to:   c.uhrada_kc[lastIdx],
    }))
    .sort((a, b) => a.pct - b.pct);  // vzestupně

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map(i => i.label),
      datasets: [{
        data: items.map(i => i.pct),
        backgroundColor: items.map(i => COLORS[i.kod]),
        borderColor: items.map(i => COLORS[i.kod]),
        borderWidth: 0,
        barPercentage: 0.85,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          borderColor: LINE, borderWidth: 1,
          titleColor: INK, bodyColor: INK,
          titleFont: { family: SERIF, size: 14, weight: '600' },
          bodyFont: { family: SANS, size: 12 },
          padding: 12, displayColors: false,
          callbacks: {
            title: (items) => items[0].label,
            label: (ctx) => {
              const item = items[ctx.dataIndex];
              return [
                `Růst 2020→2024: ${fmtPct(item.pct)}`,
                `2020: ${fmtKc(item.from / 1e6)} mil. Kč`,
                `2024: ${fmtKc(item.to / 1e6)} mil. Kč`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: LINE },
          ticks: {
            callback: (v) => v + ' %',
            font: { size: 11 }
          },
          title: { display: true, text: 'Změna celkové úhrady 2020 → 2024',
                   font: { size: 12 }, color: INK_MUTED },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 12 } },
        }
      }
    }
  });
}

/* spustit */
load().catch(err => {
  console.error('Nepodařilo se načíst data:', err);
  document.querySelectorAll('.chart-frame').forEach(el => {
    el.innerHTML = '<p style="text-align:center;color:#b0292e;padding:40px;font-family:Newsreader,serif;">' +
      'Nepodařilo se načíst <code>data/data.json</code>. ' +
      'Spusť <code>python prepare_data.py --download</code> a otevři stránku přes lokální server (<code>python -m http.server</code>).</p>';
  });
});
