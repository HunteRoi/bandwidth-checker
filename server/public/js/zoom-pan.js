// Minimum visible span so wheel-zoom / manual input can't collapse the range to nothing.
// Default is overridden by /config (MIN_RANGE_MS env var).
let MIN_RANGE_MS = 60 * 1000;

// drag-to-pan state
let isPanning = false;
let panStartClientX = 0;
let panStartMin = 0;
let panStartMax = 0;
let panPixelsPerMs = 0;

const rangeStartInput = document.getElementById('range-start');
const rangeEndInput = document.getElementById('range-end');
const rangeResetButton = document.getElementById('range-reset');

const toInputValue = ms => {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromInputValue = value => {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const setRange = (min, max) => {
  min = Math.max(dataMin, Math.min(min, dataMax));
  max = Math.max(dataMin, Math.min(max, dataMax));
  if (min > max) { const tmp = min; min = max; max = tmp; }
  if (max - min < MIN_RANGE_MS) {
    const mid = (min + max) / 2;
    min = Math.max(dataMin, mid - MIN_RANGE_MS / 2);
    max = Math.min(dataMax, min + MIN_RANGE_MS);
  }
  currentMin = min;
  currentMax = max;
  rangeStartInput.value = toInputValue(min);
  rangeEndInput.value = toInputValue(max);
  updateChartForRange(min, max);
};

const onWheelZoom = evt => {
  if (!chartInstance) return;
  evt.preventDefault();
  const xScaleId = Object.keys(chartInstance.scales).find(id => chartInstance.scales[id].isHorizontal());
  const xScale = chartInstance.scales[xScaleId];
  if (!xScale) return;
  const rect = evt.currentTarget.getBoundingClientRect();
  const cursorValue = xScale.getValueForPixel(evt.clientX - rect.left);
  const width = currentMax - currentMin;
  const factor = evt.deltaY < 0 ? 0.8 : 1.25; // deltaY < 0 => scroll up => zoom in
  const fullWidth = dataMax - dataMin;
  const newWidth = Math.min(fullWidth, Math.max(MIN_RANGE_MS, width * factor));
  const ratio = width === 0 ? 0.5 : (cursorValue - currentMin) / width;
  let newMin = cursorValue - newWidth * ratio;
  let newMax = cursorValue + newWidth * (1 - ratio);
  if (newMin < dataMin) { newMax += dataMin - newMin; newMin = dataMin; }
  if (newMax > dataMax) { newMin -= newMax - dataMax; newMax = dataMax; }
  setRange(newMin, newMax);
};

const onPanStart = evt => {
  if (evt.button !== 0 || !chartInstance) return;
  const xScaleId = Object.keys(chartInstance.scales).find(id => chartInstance.scales[id].isHorizontal());
  const xScale = chartInstance.scales[xScaleId];
  if (!xScale || currentMax === currentMin) return;
  const pxMin = xScale.getPixelForValue(currentMin);
  const pxMax = xScale.getPixelForValue(currentMax);
  if (pxMax === pxMin) return;
  isPanning = true;
  panStartClientX = evt.clientX;
  panStartMin = currentMin;
  panStartMax = currentMax;
  panPixelsPerMs = (pxMax - pxMin) / (currentMax - currentMin);
  evt.currentTarget.classList.add('panning');
  evt.preventDefault();
};

const onPanMove = evt => {
  if (!isPanning) return;
  evt.preventDefault();
  const deltaValue = (evt.clientX - panStartClientX) / panPixelsPerMs;
  // dragging follows the cursor: moving right reveals earlier points, so subtract the delta
  let newMin = panStartMin - deltaValue;
  let newMax = panStartMax - deltaValue;
  if (newMin < dataMin) { newMax += dataMin - newMin; newMin = dataMin; }
  if (newMax > dataMax) { newMin -= newMax - dataMax; newMax = dataMax; }
  setRange(newMin, newMax);
};

const onPanEnd = () => {
  if (!isPanning) return;
  isPanning = false;
  document.getElementById('myChart').classList.remove('panning');
};

rangeStartInput.addEventListener('change', () => {
  const min = fromInputValue(rangeStartInput.value);
  if (min !== null) setRange(min, currentMax);
});
rangeEndInput.addEventListener('change', () => {
  const max = fromInputValue(rangeEndInput.value);
  if (max !== null) setRange(currentMin, max);
});
rangeResetButton.addEventListener('click', () => setRange(dataMin, dataMax));
