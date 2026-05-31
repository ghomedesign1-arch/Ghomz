/**
 * Lightweight forecasting helpers.
 *
 * We use a weighted moving average over the last N completed periods, giving
 * more weight to recent months. No external service or ML library — this is
 * enough to surface a "next 3 months" projection on the analytics page.
 */

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * Weighted moving average of the last `window` historical points. Linear
 * weights so the most recent point has the highest weight.
 */
export function weightedMovingAverage(
  history: number[],
  window: number,
): number {
  if (history.length === 0) return 0;
  const slice = history.slice(-window);
  let weightedSum = 0;
  let weightTotal = 0;
  slice.forEach((v, i) => {
    const weight = i + 1; // 1, 2, …, window
    weightedSum += v * weight;
    weightTotal += weight;
  });
  return weightedSum / weightTotal;
}

/**
 * Produces N forward periods by feeding the previous forecast back into the
 * window. Returned series is labeled "Forecast — <month>".
 */
export function forecastNext(
  history: SeriesPoint[],
  horizon: number,
  window = 3,
): SeriesPoint[] {
  if (history.length === 0) return [];
  const values = history.map((p) => p.value);
  const out: SeriesPoint[] = [];

  let lastDate = monthFromLabel(history[history.length - 1].label);
  for (let i = 0; i < horizon; i++) {
    const projected = weightedMovingAverage(values, window);
    values.push(projected);
    lastDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 1);
    out.push({
      label: lastDate.toLocaleString("en-US", { month: "short" }),
      value: projected,
    });
  }
  return out;
}

/**
 * Returns a unified series with `actual` and `forecast` keys so we can render
 * a single dashed-line chart for the projection.
 */
export function buildForecastSeries(history: SeriesPoint[], horizon = 3) {
  const forecast = forecastNext(history, horizon);
  const actual = history.map((p) => ({
    label: p.label,
    actual: p.value,
    forecast: undefined as number | undefined,
  }));
  if (history.length > 0) {
    // Connect the dashed line to the last actual point.
    actual[actual.length - 1] = {
      ...actual[actual.length - 1],
      forecast: history[history.length - 1].value,
    };
  }
  const tail = forecast.map((p) => ({
    label: p.label,
    actual: undefined as number | undefined,
    forecast: p.value,
  }));
  return [...actual, ...tail];
}

function monthFromLabel(label: string): Date {
  const now = new Date();
  const probe = new Date(`${label} 1, ${now.getFullYear()}`);
  return isNaN(probe.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1) : probe;
}
