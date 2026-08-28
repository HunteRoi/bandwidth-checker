// fixed cutoff (not the statistical outlier bound) — anything under this is worth a look regardless of a machine's usual spread
// Default is overridden by /config (LOW_SPEED_THRESHOLD_MBPS env var).
let LOW_SPEED_THRESHOLD_MBPS = 10.0;

const pad2 = n => String(n).padStart(2, '0');
const formatDateDDMMYYYY = d => `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
const formatTimeHHMMSS = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

const lowOutliersTableBody = document.querySelector('#low-outliers-table tbody');
const lowOutliersStats = document.getElementById('low-outliers-stats');
const lowOutlierSortHeaders = document.querySelectorAll('#low-outliers-table thead th[data-sort]');
const lowOutlierFilterInputs = document.querySelectorAll('#low-outliers-table .filter-row input');

let lowOutlierRows = [];
let lowOutlierSort = { column: 'date', direction: 'desc' };
const lowOutlierFilters = { machine: '', date: '', time: '', speed: '' };

const buildLowOutlierRows = () => {
  lowOutlierRows = [];
  machineKeys.forEach(key => {
    const machine = machinesData[key];
    machine.points
      .filter(p => p.y < LOW_SPEED_THRESHOLD_MBPS)
      .forEach(p => {
        const d = new Date(p.x);
        lowOutlierRows.push({
          machine: machineLabel(machine.meta),
          date: formatDateDDMMYYYY(d),
          time: formatTimeHHMMSS(d),
          speed: p.y,
          timestamp: p.x
        });
      });
  });
};

const compareLowOutlierRows = (a, b, column) => {
  if (column === 'speed') return a.speed - b.speed;
  if (column === 'date' || column === 'time') return a.timestamp - b.timestamp;
  return a[column].localeCompare(b[column]);
};

const updateSortIndicators = () => {
  lowOutlierSortHeaders.forEach(th => {
    const indicator = th.querySelector('.sort-indicator');
    if (!indicator) return;
    indicator.textContent = th.dataset.sort === lowOutlierSort.column
      ? (lowOutlierSort.direction === 'asc' ? '▲' : '▼')
      : '';
  });
};

const renderLowOutlierTable = () => {
  buildLowOutlierRows();

  const filtered = lowOutlierRows.filter(row =>
    Object.entries(lowOutlierFilters).every(([column, value]) => {
      if (!value) return true;
      const cell = column === 'speed' ? row.speed.toFixed(2) : row[column];
      return cell.toString().toLowerCase().includes(value.toLowerCase());
    })
  );

  filtered.sort((a, b) => {
    const result = compareLowOutlierRows(a, b, lowOutlierSort.column);
    return lowOutlierSort.direction === 'asc' ? result : -result;
  });

  lowOutliersStats.innerHTML =
    `<span>${filtered.length}</span> of <span>${lowOutlierRows.length}</span> reading(s) below <span>${LOW_SPEED_THRESHOLD_MBPS.toFixed(1)} Mbps</span> ` +
    `across <span>${machineKeys.length}</span> machine(s)`;

  lowOutliersTableBody.innerHTML = filtered.length
    ? filtered.map(row =>
        `<tr><td>${row.machine}</td><td>${row.date}</td><td>${row.time}</td>` +
        `<td class="speed-outlier">${row.speed.toFixed(2)}</td></tr>`
      ).join('')
    : '<tr><td colspan="4">No low-speed outliers recorded.</td></tr>';

  updateSortIndicators();
};

lowOutlierSortHeaders.forEach(th => {
  th.addEventListener('click', () => {
    const column = th.dataset.sort;
    lowOutlierSort = lowOutlierSort.column === column
      ? { column, direction: lowOutlierSort.direction === 'asc' ? 'desc' : 'asc' }
      : { column, direction: column === 'speed' ? 'asc' : 'desc' };
    renderLowOutlierTable();
  });
});

lowOutlierFilterInputs.forEach(input => {
  input.addEventListener('input', () => {
    lowOutlierFilters[input.dataset.filter] = input.value;
    renderLowOutlierTable();
  });
});

