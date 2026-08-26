// distinguishable colors so each reporting machine gets its own consistent series color
const PALETTE = [
  { bg: 'rgba(56, 189, 248, 0.85)', border: 'rgba(56, 189, 248, 1)' },
  { bg: 'rgba(251, 90, 140, 0.85)', border: 'rgba(251, 90, 140, 1)' },
  { bg: 'rgba(250, 204, 21, 0.85)', border: 'rgba(250, 204, 21, 1)' },
  { bg: 'rgba(52, 211, 153, 0.85)', border: 'rgba(52, 211, 153, 1)' },
  { bg: 'rgba(167, 139, 250, 0.85)', border: 'rgba(167, 139, 250, 1)' }
];

const machineLabel = meta => {
  if (!meta) return 'Unknown';
  const name = meta.hostname || meta.ip || meta.mac || 'Unknown';
  return meta.connection ? `${name} (${meta.connection})` : name;
};

// keyed by machine identity (mac, falling back to ip/hostname) so each machine's
// readings and outlier stats stay independent — mixing e.g. ethernet and wifi speeds
// would make median/outlier detection meaningless
let machinesData = {};
let machineKeys = [];
let dataMin = 0;
let dataMax = 0;
let currentMin = 0;
let currentMax = 0;
let chartInstance = null;

const buildChart = () => {
  const ctx = document.getElementById('myChart').getContext('2d');
  const datasets = [];
  machineKeys.forEach((key, i) => {
    const colors = PALETTE[i % PALETTE.length];
    const label = machineLabel(machinesData[key].meta);
    datasets.push({
      label: `${label} — normal`,
      data: [],
      showLine: false,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderWidth: 1,
      pointRadius: 4,
      machineKey: key,
      kind: 'normal'
    });
    datasets.push({
      label: `${label} — outliers`,
      data: [],
      showLine: false,
      backgroundColor: 'rgba(251, 90, 140, 0.9)',
      borderColor: 'rgba(251, 90, 140, 1)',
      borderWidth: 1,
      pointRadius: 4,
      machineKey: key,
      kind: 'outlier'
    });
    datasets.push({
      label: `${label} — median`,
      data: [],
      showLine: true,
      borderColor: colors.border,
      borderWidth: 2,
      borderDash: [8, 5],
      pointRadius: 0,
      fill: false,
      machineKey: key,
      kind: 'median'
    });
  });
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        xAxes: [{
          type: 'linear',
          position: 'bottom',
          ticks: {
            userCallback: (label, index, labels) => safeDate(label),
            fontColor: '#9098c4'
          },
          gridLines: { color: 'rgba(255,255,255,0.06)' },
          scaleLabel: {
            display: true,
            labelString: 'Date',
            fontColor: '#9098c4'
          }
        }],
        yAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Mbps',
            fontColor: '#9098c4'
          },
          ticks: {
            beginAtZero: true,
            fontColor: '#9098c4'
          },
          gridLines: { color: 'rgba(255,255,255,0.06)' }
        }],
      },
      legend: {
        display: true,
        labels: { fontColor: '#9098c4' }
      },
      tooltips: {
        callbacks: {
          label: function(tooltipItem, data) {
            const label = data.datasets[tooltipItem.datasetIndex].label;
            return `${label}: ${tooltipItem.value} Mbps @ ${safeDate(tooltipItem.label)}`;
          }
        }
      }
    }
  });

  const canvas = document.getElementById('myChart');
  canvas.addEventListener('wheel', onWheelZoom, { passive: false });
  canvas.addEventListener('mousedown', onPanStart);
  window.addEventListener('mousemove', onPanMove);
  window.addEventListener('mouseup', onPanEnd);
  window.addEventListener('blur', onPanEnd);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);
  canvas.addEventListener('touchcancel', onTouchEnd);
};

const updateChartForRange = (min, max) => {
  const statsEl = document.getElementById('chart-stats');

  chartInstance.options.scales.xAxes[0].ticks.min = min;
  chartInstance.options.scales.xAxes[0].ticks.max = max;

  let totalVisible = 0;
  const summaries = [];
  machineKeys.forEach(key => {
    const machine = machinesData[key];
    const visible = machine.points.filter(p => p.x >= min && p.x <= max);
    const isOutlier = v => v < machine.stats.lowerBound || v > machine.stats.upperBound;
    totalVisible += visible.length;
    summaries.push(
      `<div><strong>${machineLabel(machine.meta)}</strong>: median <span>${machine.stats.median.toFixed(2)} Mbps</span> ` +
      `&nbsp;·&nbsp; outliers <span>${visible.filter(p => isOutlier(p.y)).length}</span> of <span>${visible.length}</span> ` +
      `(outside <span>${Math.max(0, machine.stats.lowerBound).toFixed(1)}</span>–<span>${machine.stats.upperBound.toFixed(1)}</span> Mbps, ` +
      `calculated for this machine only)</div>`
    );
  });

  chartInstance.data.datasets.forEach(ds => {
    const machine = machinesData[ds.machineKey];
    if (ds.kind === 'median') {
      ds.data = [{ x: min, y: machine.stats.median }, { x: max, y: machine.stats.median }];
      return;
    }
    const visible = machine.points.filter(p => p.x >= min && p.x <= max);
    const isOutlier = v => v < machine.stats.lowerBound || v > machine.stats.upperBound;
    ds.data = ds.kind === 'outlier' ? visible.filter(p => isOutlier(p.y)) : visible.filter(p => !isOutlier(p.y));
  });
  chartInstance.update();

  statsEl.innerHTML = totalVisible ? summaries.join('') : 'No data in the selected range.';
};

const initGraph = ({ machines, series }) => {
  machineKeys = Object.keys(series || {}).filter(key => series[key].length);
  machinesData = {};
  machineKeys.forEach(key => {
    const points = series[key]
      .map(d => ({ x: Number(d.x), y: Number(d.y) }))
      .sort((a, b) => a.x - b.x);
    machinesData[key] = {
      meta: (machines && machines[key]) || {},
      points,
      stats: computeStats(points.map(p => p.y))
    };
  });
  if (!machineKeys.length) return;

  dataMin = Math.min(...machineKeys.map(key => machinesData[key].points[0].x));
  dataMax = Math.max(...machineKeys.map(key => {
    const pts = machinesData[key].points;
    return pts[pts.length - 1].x;
  }));

  buildChart();
  setRange(dataMin, dataMax);
  populateMachineSelectors();
  renderLowOutlierTable();
  initDailyStabilityChart();
};

// applies server-provided tunables (falls back to the client-side defaults if /config fails)
const applyConfig = config => {
  if (typeof config.outlierThreshold === 'number') OUTLIER_THRESHOLD = config.outlierThreshold;
  if (typeof config.madConsistencyConstant === 'number') MAD_CONSISTENCY_CONSTANT = config.madConsistencyConstant;
  if (typeof config.minRangeMs === 'number') MIN_RANGE_MS = config.minRangeMs;
  if (typeof config.lowSpeedThresholdMbps === 'number') LOW_SPEED_THRESHOLD_MBPS = config.lowSpeedThresholdMbps;
};

Promise.all([
  fetch('/config').then(response => response.json()).catch(() => ({})),
  fetch('/read').then(response => response.json())
]).then(([config, data]) => {
  applyConfig(config);
  initGraph(data);
});
