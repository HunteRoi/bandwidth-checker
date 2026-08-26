// fixed cutoff (not the statistical outlier bound) — anything under this is worth a look regardless of a machine's usual spread
// Default is overridden by /config (LOW_SPEED_THRESHOLD_MBPS env var).
let LOW_SPEED_THRESHOLD_MBPS = 10.0;

const pad2 = n => String(n).padStart(2, '0');
const formatDateDDMMYYYY = d => `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
const formatTimeHHMMSS = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

const lowOutliersMachineSelect = document.getElementById('low-outliers-machine');
const lowOutliersTableBody = document.querySelector('#low-outliers-table tbody');
const lowOutliersStats = document.getElementById('low-outliers-stats');

const populateMachineSelectors = () => {
  [lowOutliersMachineSelect, dailyMachineSelect].forEach(select => {
    const previousValue = select.value;
    select.innerHTML = machineKeys
      .map(key => `<option value="${key}">${machineLabel(machinesData[key].meta)}</option>`)
      .join('');
    select.value = machineKeys.includes(previousValue) ? previousValue : machineKeys[0];
  });
};

const renderLowOutlierTable = () => {
  const machine = machinesData[lowOutliersMachineSelect.value];
  if (!machine) return;
  const lowPoints = machine.points
    .filter(p => p.y < LOW_SPEED_THRESHOLD_MBPS)
    .sort((a, b) => b.x - a.x);

  lowOutliersStats.innerHTML =
    `<span>${lowPoints.length}</span> reading(s) below <span>${LOW_SPEED_THRESHOLD_MBPS.toFixed(1)} Mbps</span> ` +
    `(median: <span>${machine.stats.median.toFixed(2)} Mbps</span>)`;

  lowOutliersTableBody.innerHTML = lowPoints.length
    ? lowPoints.map(p => {
        const d = new Date(p.x);
        return `<tr><td>${formatDateDDMMYYYY(d)}</td><td>${formatTimeHHMMSS(d)}</td>` +
          `<td class="speed-outlier">${p.y.toFixed(2)}</td></tr>`;
      }).join('')
    : '<tr><td colspan="3">No low-speed outliers recorded.</td></tr>';
};
