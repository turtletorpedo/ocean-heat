async function loadCSV(url) {
  const txt = await (await fetch(url + "?cachebust=" + Date.now())).text();
  const rows = txt.trim().split(/\r?\n/);
  if (rows.length < 2) throw new Error("CSV seems empty");
  const header = rows[0].split(",");
  if (header[0].trim() !== "year" || header[1].trim() !== "ohc_zj") {
    console.warn("CSV header should be: year,ohc_zj — got:", header);
  }
  const years = [], ohc = [];
  for (let i = 1; i < rows.length; i++) {
    const [y, v] = rows[i].split(",");
    const yy = parseInt(y, 10);
    const vv = parseFloat(v);
    if (Number.isFinite(yy) && Number.isFinite(vv)) { years.push(yy); ohc.push(vv); }
  }
  return { years, ohc };
}

function updateSinceBirth(years, ohc) {
  const input = document.getElementById('birthYear');
  const target = document.getElementById('sinceBirth');
  const birth = +input.value;
  let idxBirth = years.findIndex(y => y >= birth);
  if (idxBirth === -1) idxBirth = 0;
  const latest = ohc[ohc.length - 1];
  const delta = (latest - ohc[idxBirth]).toFixed(1);
  target.textContent = `Heat added since ${birth}: ${delta} ZJ`;
}

let chart;

async function draw() {
  const { years, ohc } = await loadCSV("data/ohc_tidy.csv");
  const ctx = document.getElementById('chart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'OHC (ZJ)',
        data: ohc,
        fill: false,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: 'ZJ' } } }
    }
  });
  updateSinceBirth(years, ohc);
  document.getElementById('birthYear').addEventListener('input', () => updateSinceBirth(years, ohc));
}

document.getElementById('reloadBtn').addEventListener('click', draw);

// Kickoff
draw().catch(err => {
  console.error(err);
  document.getElementById('sinceBirth').textContent = "Load error: " + err.message + ". Did you run data/fetch_data.sh?";
});