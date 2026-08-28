const dailyMachineSelect = document.getElementById('daily-machine');
const dailyDateInput = document.getElementById('daily-date');
const dailyStats = document.getElementById('daily-stats');
let dailyChartInstance = null;

const populateDailyMachineSelect = () => {
  const previousValue = dailyMachineSelect.value;
  dailyMachineSelect.innerHTML = machineKeys
    .map(key => `<option value="${key}">${machineLabel(machinesData[key].meta)}</option>`)
    .join('');
  dailyMachineSelect.value = machineKeys.includes(previousValue) ? previousValue : machineKeys[0];
};

const dayBounds = dateStr => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0).getTime(),
    end: new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
  };
};

const toDateInputValue = ms => {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const buildDailyChart = () => {
  const ctx = document.getElementById('dailyChart').getContext('2d');
  dailyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Speed',
        data: [],
        showLine: true,
        borderColor: 'rgba(56, 189, 248, 1)',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        pointBackgroundColor: 'rgba(56, 189, 248, 1)',
        borderWidth: 2,
        pointRadius: 3,
        lineTension: 0,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      legend: { display: false },
      scales: {
        xAxes: [{
          type: 'linear',
          position: 'bottom',
          ticks: {
            userCallback: label => new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fontColor: '#9098c4'
          },
          gridLines: { color: 'rgba(255,255,255,0.06)' },
          scaleLabel: { display: true, labelString: 'Time', fontColor: '#9098c4' }
        }],
        yAxes: [{
          scaleLabel: { display: true, labelString: 'Mbps', fontColor: '#9098c4' },
          ticks: { beginAtZero: true, fontColor: '#9098c4' },
          gridLines: { color: 'rgba(255,255,255,0.06)' }
        }]
      },
      tooltips: {
        callbacks: {
          label: tooltipItem => `${tooltipItem.value} Mbps @ ${new Date(Number(tooltipItem.label)).toLocaleTimeString()}`
        }
      }
    }
  });
};

const renderDailyChart = () => {
  const machine = machinesData[dailyMachineSelect.value];
  if (!machine || !dailyDateInput.value) return;
  const { start, end } = dayBounds(dailyDateInput.value);
  const dayPoints = machine.points.filter(p => p.x >= start && p.x <= end).sort((a, b) => a.x - b.x);
  const pointColors = dayPoints.map(p => isOutlierValue(machine.stats, p.y) ? OUTLIER_COLOR.border : machine.color.border);

  dailyChartInstance.options.scales.xAxes[0].ticks.min = start;
  dailyChartInstance.options.scales.xAxes[0].ticks.max = end;
  dailyChartInstance.data.datasets[0].data = dayPoints;
  dailyChartInstance.data.datasets[0].borderColor = machine.color.border;
  dailyChartInstance.data.datasets[0].backgroundColor = machine.color.bg;
  dailyChartInstance.data.datasets[0].pointBackgroundColor = pointColors;
  dailyChartInstance.data.datasets[0].pointBorderColor = pointColors;
  dailyChartInstance.update();

  const outlierCount = dayPoints.filter(p => isOutlierValue(machine.stats, p.y)).length;
  const dayLabel = new Date(start).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  dailyStats.innerHTML = dayPoints.length
    ? `<span>${dayPoints.length}</span> reading(s) on <span>${dayLabel}</span> &nbsp;·&nbsp; ` +
      `<span>${outlierCount}</span> outlier(s) shown in pink ` +
      `(outside <span>${Math.max(0, machine.stats.lowerBound).toFixed(1)}</span>–<span>${machine.stats.upperBound.toFixed(1)}</span> Mbps for this machine)`
    : `No readings on <span>${dayLabel}</span>`;
};

const shiftDailyDate = deltaDays => {
  const { start } = dayBounds(dailyDateInput.value);
  dailyDateInput.value = toDateInputValue(start + deltaDays * 24 * 60 * 60 * 1000);
  renderDailyChart();
};

const initDailyStabilityChart = () => {
  dailyDateInput.min = toDateInputValue(dataMin);
  dailyDateInput.max = toDateInputValue(dataMax);
  if (!dailyDateInput.value) dailyDateInput.value = toDateInputValue(dataMax);
  if (!dailyChartInstance) buildDailyChart();
  renderDailyChart();
};

dailyMachineSelect.addEventListener('change', renderDailyChart);
dailyDateInput.addEventListener('change', renderDailyChart);
document.getElementById('daily-prev').addEventListener('click', () => shiftDailyDate(-1));
document.getElementById('daily-next').addEventListener('click', () => shiftDailyDate(1));
