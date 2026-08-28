const safeDate = time => new Date(parseInt(time)).toUTCString();

const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
};

// Modified Z-score (Iglewicz & Hoaglin): robust to skewed/bimodal data because it's
// built from the median and median absolute deviation (MAD) instead of mean/stddev,
// which the earlier IQR-only approach let get pulled around by the low-speed cluster.
// Defaults below are overridden by /config (OUTLIER_THRESHOLD / MAD_CONSISTENCY_CONSTANT env vars).
let OUTLIER_THRESHOLD = 1.5;
// consistency constant that scales MAD to be comparable to stddev under a normal distribution (Φ⁻¹(0.75))
let MAD_CONSISTENCY_CONSTANT = 0.6745;

const computeStats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const median = quantile(sorted, 0.5);
  const deviations = values.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = quantile(deviations, 0.5) || 0;
  // Mbps distance from the median that a point needs to exceed to be flagged
  const flagDistance = mad === 0 ? 0 : (OUTLIER_THRESHOLD * mad) / MAD_CONSISTENCY_CONSTANT;
  return {
    median,
    mad,
    lowerBound: median - flagDistance,
    upperBound: median + flagDistance
  };
};

// a point counts as an outlier if it's statistically far from this machine's median in either
// direction, OR below the fixed low-speed cutoff — the latter guarantees the low-speed cluster
// is always highlighted even when the statistical lower bound sits close to zero
const isOutlierValue = (stats, v) => v < Math.max(stats.lowerBound, LOW_SPEED_THRESHOLD_MBPS) || v > stats.upperBound;
