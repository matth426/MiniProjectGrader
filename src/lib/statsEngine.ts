import Papa from 'papaparse';
import type {
  CheckStatus,
  CorrelationEntry,
  CsvCheckItem,
  CsvVerificationResult,
  CvSummary,
  DescriptiveStat,
  DiagnosticSummary,
  NotebookAnalysisResult,
  NotebookCellSummary,
  OlsModelResult,
} from '../types/grading.ts';

// ---------------------------------------------------------------------------
// 1. Linear Algebra & Statistical Distribution Helpers
// ---------------------------------------------------------------------------

function transpose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

function matmul(A: number[][], B: number[][]): number[][] {
  const rA = A.length;
  const cA = A[0].length;
  const cB = B[0].length;
  const C: number[][] = Array.from({ length: rA }, () => new Array(cB).fill(0));
  for (let i = 0; i < rA; i++) {
    for (let k = 0; k < cA; k++) {
      const aik = A[i][k];
      for (let j = 0; j < cB; j++) {
        C[i][j] += aik * B[k][j];
      }
    }
  }
  return C;
}

function invertMatrix(M: number[][]): number[][] | null {
  const n = M.length;
  const A = M.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(A[row][col]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = row;
      }
    }
    if (maxVal < 1e-12) return null;

    if (pivotRow !== col) {
      const tmp = A[col];
      A[col] = A[pivotRow];
      A[pivotRow] = tmp;
    }

    const pivot = A[col][col];
    for (let j = 0; j < 2 * n; j++) {
      A[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        A[row][j] -= factor * A[col][j];
      }
    }
  }

  return A.map((row) => row.slice(n));
}

function logGamma(z: number): number {
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

function tCdf(t: number, df: number): number {
  if (df <= 0) return 0.5;
  const x = df / (df + t * t);
  const ib = betaInc(x, df / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

function tInv(p: number, df: number): number {
  if (p <= 0.5) return -tInv(1 - p, df);
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function fPValue(fStat: number, df1: number, df2: number): number {
  if (fStat <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const x = df2 / (df2 + df1 * fStat);
  return Math.min(1, Math.max(0, betaInc(x, df2 / 2, df1 / 2)));
}

function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const gln = logGamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
}

function chi2PValue(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - gammaP(df / 2, chi2 / 2)));
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t) *
      Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Acklam inverse normal CDF
function normQuantile(p: number): number {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

// Royston (1992/1995) Shapiro-Wilk test
function shapiroWilk(values: number[]): { w: number; pValue: number } {
  const n = values.length;
  if (n < 4) return { w: 1, pValue: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const meanVal = mean(sorted);
  const ssq = sorted.reduce((acc, v) => acc + (v - meanVal) ** 2, 0);
  if (ssq === 0) return { w: 1, pValue: 1 };

  const m: number[] = [];
  for (let i = 1; i <= n; i++) {
    m.push(normQuantile((i - 0.375) / (n + 0.25)));
  }
  const mSumSq = m.reduce((acc, v) => acc + v * v, 0);
  const mNorm = Math.sqrt(mSumSq);
  const c = m.map((v) => v / mNorm);

  const u = 1 / Math.sqrt(n);
  const poly = (coeffs: number[], x: number) =>
    coeffs.reduce((acc, k) => acc * x + k, 0);

  const a = new Array(n).fill(0);
  const an = poly([-2.706056, 4.434685, -2.07119, -0.147981, 0.221157, c[n - 1]], u);
  a[n - 1] = an;
  a[0] = -an;

  let phi: number;
  if (n > 5) {
    const an1 = poly([-3.582633, 5.682633, -1.752461, -0.293762, 0.042981, c[n - 2]], u);
    a[n - 2] = an1;
    a[1] = -an1;
    phi =
      (mSumSq - 2 * m[n - 1] ** 2 - 2 * m[n - 2] ** 2) /
      (1 - 2 * an ** 2 - 2 * an1 ** 2);
    const sqrtPhi = Math.sqrt(phi);
    for (let i = 2; i < n - 2; i++) {
      a[i] = m[i] / sqrtPhi;
    }
  } else {
    phi = (mSumSq - 2 * m[n - 1] ** 2) / (1 - 2 * an ** 2);
    const sqrtPhi = Math.sqrt(phi);
    for (let i = 1; i < n - 1; i++) {
      a[i] = m[i] / sqrtPhi;
    }
  }

  let num = 0;
  for (let i = 0; i < n; i++) {
    num += a[i] * sorted[i];
  }
  const w = Math.min(1, (num * num) / ssq);

  let pValue = 1;
  if (n <= 11) {
    const gamma = 0.459 * n - 2.273;
    const y = -Math.log(Math.max(1e-12, gamma - Math.log(Math.max(1e-12, 1 - w))));
    const mu = -0.0006714 * n ** 3 + 0.025054 * n ** 2 - 0.39978 * n + 0.544;
    const sigma = Math.exp(-0.0020322 * n ** 3 + 0.062767 * n ** 2 - 0.77857 * n + 1.3822);
    pValue = 1 - normCdf((y - mu) / sigma);
  } else {
    const lnN = Math.log(n);
    const y = Math.log(Math.max(1e-12, 1 - w));
    const mu = 0.0038915 * lnN ** 3 - 0.083751 * lnN ** 2 - 0.31082 * lnN - 1.5861;
    const sigma = Math.exp(0.0030302 * lnN ** 2 - 0.082676 * lnN - 0.4803);
    pValue = 1 - normCdf((y - mu) / sigma);
  }

  return { w, pValue: Math.min(1, Math.max(0, pValue)) };
}

// ---------------------------------------------------------------------------
// 2. Basic Statistics & Correlations
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[], ddof = 1): number {
  const m = mean(arr);
  return arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - ddof);
}

function sd(arr: number[], ddof = 1): number {
  return Math.sqrt(variance(arr, ddof));
}

function pearson(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i++) {
    const vx = x[i] - mx;
    const vy = y[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function rankArray(arr: number[]): number[] {
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

function spearman(x: number[], y: number[]): number {
  return pearson(rankArray(x), rankArray(y));
}

// ---------------------------------------------------------------------------
// 3. OLS Engine, Diagnostics, VIF, Standardized Betas, 5-Fold CV
// ---------------------------------------------------------------------------

function seededShuffleIndices(n: number, seed: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  // Mulberry32 deterministic PRNG
  let s = seed >>> 0;
  const rand = () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

function fitRawOls(y: number[], X: number[][]): {
  beta: number[];
  xtxInv: number[][];
  residuals: number[];
  fitted: number[];
  sse: number;
  sst: number;
  r2: number;
} | null {
  const n = y.length;
  const xt = transpose(X);
  const xtx = matmul(xt, X);
  const xtxInv = invertMatrix(xtx);
  if (!xtxInv) return null;
  const xty = matmul(
    xt,
    y.map((v) => [v]),
  );
  const betaMat = matmul(xtxInv, xty);
  const beta = betaMat.map((r) => r[0]);
  const fitted = X.map((row) => row.reduce((acc, v, j) => acc + v * beta[j], 0));
  const residuals = y.map((yv, i) => yv - fitted[i]);
  const sse = residuals.reduce((acc, e) => acc + e * e, 0);
  const yMean = mean(y);
  const sst = y.reduce((acc, yv) => acc + (yv - yMean) ** 2, 0);
  const r2 = sst === 0 ? 0 : 1 - sse / sst;
  return { beta, xtxInv, residuals, fitted, sse, sst, r2 };
}

export function fitOlsModel(
  modelId: string,
  label: string,
  formula: string,
  y: number[],
  predictors: Array<{ name: string; values: number[] }>,
  rowIds: Array<string | number | null>,
  cvSeed = 1,
): OlsModelResult | null {
  const n = y.length;
  const k = predictors.length;
  if (n <= k + 2) return null;

  const X: number[][] = Array.from({ length: n }, (_, i) => [
    1,
    ...predictors.map((p) => p.values[i]),
  ]);

  const ols = fitRawOls(y, X);
  if (!ols) return null;

  const dfResid = n - k - 1;
  const mse = ols.sse / dfResid;
  const residualSe = Math.sqrt(mse);
  const rmse = Math.sqrt(ols.sse / n);
  const mae = mean(ols.residuals.map((e) => Math.abs(e)));
  const r2 = ols.r2;
  const adjR2 = 1 - ((1 - r2) * (n - 1)) / dfResid;
  const ssr = Math.max(0, ols.sst - ols.sse);
  const fStat = k > 0 ? ssr / k / mse : 0;
  const fP = fPValue(fStat, k, dfResid);
  const aic = n * Math.log(2 * Math.PI * (ols.sse / n)) + n + 2 * (k + 1);
  const aicSimplified = n * Math.log(ols.sse / n) + 2 * (k + 1);
  const tCrit = tInv(0.975, dfResid);
  const ySd = sd(y, 1);

  const terms = ['Intercept', ...predictors.map((p) => p.name)];
  const coefficients = terms.map((term, j) => {
    const estimate = ols.beta[j];
    const se = Math.sqrt(Math.max(0, mse * ols.xtxInv[j][j]));
    const tStat = se === 0 ? 0 : estimate / se;
    const pValue = 2 * (1 - tCdf(Math.abs(tStat), dfResid));
    const ciLower = estimate - tCrit * se;
    const ciUpper = estimate + tCrit * se;

    let vif: number | undefined;
    let standardizedBeta: number | undefined;
    if (j > 0) {
      const predValues = predictors[j - 1].values;
      const xSd = sd(predValues, 1);
      standardizedBeta = ySd === 0 ? 0 : (estimate * xSd) / ySd;
      if (k >= 2) {
        const otherX = Array.from({ length: n }, (_, rowIdx) => [
          1,
          ...predictors.filter((_, idx) => idx !== j - 1).map((p) => p.values[rowIdx]),
        ]);
        const vifFit = fitRawOls(predValues, otherX);
        if (vifFit && vifFit.r2 < 1 - 1e-12) {
          vif = 1 / (1 - vifFit.r2);
        } else {
          vif = Infinity;
        }
      } else {
        vif = 1;
      }
    }

    return {
      term,
      estimate,
      se,
      tStat,
      pValue,
      ciLower,
      ciUpper,
      vif,
      standardizedBeta,
    };
  });

  // Diagnostics
  const sw = shapiroWilk(ols.residuals);

  // Breusch-Pagan
  const e2 = ols.residuals.map((e) => e * e);
  const bpFit = fitRawOls(e2, X);
  const bpLM = bpFit ? n * bpFit.r2 : 0;
  const bpP = chi2PValue(bpLM, k);

  // Durbin-Watson
  let dwNum = 0;
  for (let i = 1; i < n; i++) {
    dwNum += (ols.residuals[i] - ols.residuals[i - 1]) ** 2;
  }
  const durbinWatson = ols.sse === 0 ? 2 : dwNum / ols.sse;

  // Leverage, Cook's D, Externally studentized residuals
  const leverages: number[] = [];
  const cooksThreshold = 4 / n;
  const flaggedCooksRows: DiagnosticSummary['flaggedCooksRows'] = [];
  const flaggedStudentizedRows: DiagnosticSummary['flaggedStudentizedRows'] = [];

  for (let i = 0; i < n; i++) {
    const xi = X[i];
    // h_ii = xi^T (X^T X)^-1 xi
    let hii = 0;
    for (let r = 0; r <= k; r++) {
      let tmp = 0;
      for (let c = 0; c <= k; c++) {
        tmp += ols.xtxInv[r][c] * xi[c];
      }
      hii += xi[r] * tmp;
    }
    leverages.push(hii);

    const denom = Math.max(1e-12, 1 - hii);
    const cooksD = (ols.residuals[i] ** 2 / ((k + 1) * mse)) * (hii / (denom * denom));
    if (cooksD > cooksThreshold) {
      flaggedCooksRows.push({ rowIndex: i, id: rowIds[i] ?? null, cooksD });
    }

    const rInt = ols.residuals[i] / Math.sqrt(Math.max(1e-12, mse * denom));
    const extDenom = Math.max(1e-12, dfResid - rInt * rInt);
    const studentizedT = rInt * Math.sqrt((dfResid - 1) / extDenom);
    if (Math.abs(studentizedT) > 3) {
      flaggedStudentizedRows.push({
        rowIndex: i,
        id: rowIds[i] ?? null,
        studentizedT,
      });
    }
  }

  // 5-Fold CV benchmark
  let cv5Fold: CvSummary | null = null;
  if (n >= 10) {
    const folds = 5;
    const perm = seededShuffleIndices(n, cvSeed);
    const foldR2s: number[] = [];
    const foldRmses: number[] = [];

    for (let f = 0; f < folds; f++) {
      const start = Math.floor((f * n) / folds);
      const end = Math.floor(((f + 1) * n) / folds);
      const testIdx = new Set(perm.slice(start, end));
      const trainY: number[] = [];
      const trainX: number[][] = [];
      const testY: number[] = [];
      const testX: number[][] = [];
      for (let i = 0; i < n; i++) {
        if (testIdx.has(i)) {
          testY.push(y[i]);
          testX.push(X[i]);
        } else {
          trainY.push(y[i]);
          trainX.push(X[i]);
        }
      }
      const trFit = fitRawOls(trainY, trainX);
      if (trFit && testY.length >= 2) {
        const preds = testX.map((row) =>
          row.reduce((acc, v, j) => acc + v * trFit.beta[j], 0),
        );
        const testErrs = testY.map((yv, idx) => yv - preds[idx]);
        const testSse = testErrs.reduce((a, e) => a + e * e, 0);
        const testYMean = mean(testY);
        const testSst = testY.reduce((a, yv) => a + (yv - testYMean) ** 2, 0);
        foldR2s.push(testSst === 0 ? 0 : 1 - testSse / testSst);
        foldRmses.push(Math.sqrt(testSse / testY.length));
      }
    }

    if (foldR2s.length === folds) {
      cv5Fold = {
        folds,
        seedUsed: cvSeed,
        r2Mean: mean(foldR2s),
        r2Sd: sd(foldR2s, 0),
        rmseMean: mean(foldRmses),
        rmseSd: sd(foldRmses, 0),
        note: 'Computed via 5-fold shuffled split (JS PRNG; Python sklearn MT19937 splits differ slightly in exact fold assignment).',
      };
    }
  }

  return {
    modelId,
    label,
    formula,
    n,
    numPredictors: k,
    r2,
    adjR2,
    fStat,
    fPValue: fP,
    mae,
    rmse,
    aic,
    aicSimplified,
    residualSe,
    coefficients,
    diagnostics: {
      shapiroW: sw.w,
      shapiroP: sw.pValue,
      breuschPaganLM: bpLM,
      breuschPaganP: bpP,
      durbinWatson,
      cooksThreshold,
      flaggedCooksRows,
      flaggedStudentizedRows,
      maxLeverage: Math.max(...leverages),
    },
    cv5Fold,
  };
}

// ---------------------------------------------------------------------------
// 4. CSV Verification & Ground-Truth Recomputation
// ---------------------------------------------------------------------------

const TEXT_TO_ORDINAL: Record<string, number> = {
  never: 1,
  rarely: 2,
  sometimes: 3,
  often: 4,
  'very often': 5,
};

const ORDINAL_PAIRS: Array<[string, string]> = [
  ['ai_freq', 'ai_freq_n'],
  ['ai_explain', 'ai_explain_n'],
  ['ai_verify', 'ai_verify_n'],
  ['try_first', 'try_first_n'],
];

export function verifyCsv(csvText: string, cvSeed = 1): CsvVerificationResult {
  const parsed = Papa.parse<Record<string, unknown>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  const rows = parsed.data || [];
  const columns = parsed.meta.fields || [];
  const rowCount = rows.length;
  const checks: CsvCheckItem[] = [];

  // 1. Row count
  checks.push({
    id: 'row_count',
    label: 'Row count (expected <= 30)',
    status: rowCount > 0 && rowCount <= 30 ? (rowCount === 30 ? 'pass' : 'warn') : 'fail',
    detail:
      rowCount === 30
        ? 'Exactly 30 rows present.'
        : rowCount < 30 && rowCount >= 25
          ? `${rowCount} rows present (fewer than 30; verify row removal is justified in B.4).`
          : `${rowCount} rows found (expected 30 minus justified removals).`,
  });

  // 2. Required columns
  const requiredBase = [
    'id',
    'ai_freq',
    'ai_explain',
    'ai_verify',
    'try_first',
    'ai_purpose',
    'conf_concepts',
    'conf_solve',
    'conf_assess',
    'attendance',
    'class_standing',
    'prelim',
    'midterm',
    'ai_freq_n',
    'ai_explain_n',
    'ai_verify_n',
    'try_first_n',
    'confidence',
  ];
  const dummyColumns = columns.filter(
    (c) =>
      c.startsWith('ai_purpose_') ||
      c.startsWith('purpose_') ||
      (c.startsWith('ai_') &&
        !requiredBase.includes(c) &&
        !['ai_freq', 'ai_explain', 'ai_verify'].includes(c)),
  );
  // Prefer strict ai_purpose_ dummies first, fallback to purpose_
  const purposeDummies = columns.filter((c) => c.startsWith('ai_purpose_'));
  const effectiveDummies = purposeDummies.length > 0 ? purposeDummies : dummyColumns;

  const missingCols = requiredBase.filter((c) => !columns.includes(c));
  checks.push({
    id: 'columns_present',
    label: 'Required & encoded columns present',
    status: missingCols.length === 0 && effectiveDummies.length >= 1 ? 'pass' : 'fail',
    detail:
      missingCols.length === 0 && effectiveDummies.length >= 1
        ? `All base/encoded columns present plus ${effectiveDummies.length} dummy column(s): ${effectiveDummies.join(', ')}.`
        : `Missing columns: ${missingCols.join(', ') || 'none'}; dummy columns found: ${effectiveDummies.join(', ') || 'none'}.`,
  });

  // 3. Missing values
  let missingCellCount = 0;
  for (const row of rows) {
    for (const col of columns) {
      const v = row[col];
      if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && Number.isNaN(v))) {
        missingCellCount++;
      }
    }
  }
  checks.push({
    id: 'no_missing',
    label: 'No missing values',
    status: missingCellCount === 0 ? 'pass' : 'fail',
    detail:
      missingCellCount === 0
        ? '0 missing values across all cells.'
        : `${missingCellCount} missing/NaN cell(s) detected.`,
  });

  // 4. Duplicate IDs
  const ids = rows.map((r) => r['id']).filter((v) => v !== null && v !== undefined);
  const uniqueIds = new Set(ids.map((v) => String(v)));
  const hasIdCol = columns.includes('id');
  checks.push({
    id: 'no_duplicates',
    label: 'No duplicate student IDs',
    status: hasIdCol && uniqueIds.size === rowCount ? 'pass' : 'fail',
    detail: hasIdCol
      ? `${uniqueIds.size} unique IDs across ${rowCount} rows.`
      : 'Column `id` not found.',
  });

  // 5. Validation ranges & zeros
  const rangeViolations: string[] = [];
  const zeroExamRows: CsvVerificationResult['zeroExamRows'] = [];

  rows.forEach((r, idx) => {
    for (const col of ['conf_concepts', 'conf_solve', 'conf_assess']) {
      const v = Number(r[col]);
      if (columns.includes(col) && (Number.isNaN(v) || v < 0 || v > 10)) {
        rangeViolations.push(`Row ${idx} ${col}=${r[col]}`);
      }
    }
    for (const col of ['ai_freq_n', 'ai_explain_n', 'ai_verify_n', 'try_first_n']) {
      const v = Number(r[col]);
      if (columns.includes(col) && (Number.isNaN(v) || v < 1 || v > 5)) {
        rangeViolations.push(`Row ${idx} ${col}=${r[col]}`);
      }
    }
    for (const col of ['attendance', 'class_standing', 'prelim', 'midterm']) {
      const v = Number(r[col]);
      if (columns.includes(col) && (Number.isNaN(v) || v < 0 || v > 100)) {
        rangeViolations.push(`Row ${idx} ${col}=${r[col]}`);
      }
    }
    const prelimVal = columns.includes('prelim') ? Number(r['prelim']) : null;
    const midtermVal = columns.includes('midterm') ? Number(r['midterm']) : null;
    if (prelimVal === 0 || midtermVal === 0) {
      zeroExamRows.push({
        rowIndex: idx,
        id: (r['id'] as string | number) ?? null,
        prelim: prelimVal,
        midterm: midtermVal,
      });
    }
  });

  checks.push({
    id: 'value_ranges',
    label: 'Validation rules (0–10, 1–5, 0–100)',
    status: rangeViolations.length === 0 ? 'pass' : 'fail',
    detail:
      rangeViolations.length === 0
        ? 'All values within valid bounds.'
        : `${rangeViolations.length} range violation(s): ${rangeViolations.slice(0, 3).join('; ')}`,
  });

  checks.push({
    id: 'zero_scores',
    label: 'Exact-zero exam scores check',
    status: zeroExamRows.length === 0 ? 'pass' : 'warn',
    detail:
      zeroExamRows.length === 0
        ? 'No 0 scores in prelim or midterm.'
        : `${zeroExamRows.length} row(s) have a 0 exam score (verify whether examined/justified in B.4).`,
  });

  // 6. Ordinal mapping consistency
  const mappingMismatches: string[] = [];
  for (const [textCol, numCol] of ORDINAL_PAIRS) {
    if (!columns.includes(textCol) || !columns.includes(numCol)) continue;
    rows.forEach((r, idx) => {
      const txt = String(r[textCol] ?? '')
        .trim()
        .toLowerCase();
      const expected = TEXT_TO_ORDINAL[txt];
      const actual = Number(r[numCol]);
      if (expected !== undefined && actual !== expected) {
        mappingMismatches.push(`Row ${idx} ${textCol}="${r[textCol]}" vs ${numCol}=${actual}`);
      }
    });
  }
  checks.push({
    id: 'ordinal_mapping',
    label: 'Text-to-_n ordinal mapping consistency',
    status:
      ORDINAL_PAIRS.every(([t, n]) => columns.includes(t) && columns.includes(n)) &&
      mappingMismatches.length === 0
        ? 'pass'
        : 'fail',
    detail:
      mappingMismatches.length === 0
        ? 'All _n columns match text categories (1–5).'
        : `${mappingMismatches.length} mismatch(es): ${mappingMismatches.slice(0, 3).join('; ')}`,
  });

  // 7. Confidence composite check
  const confMismatches: string[] = [];
  if (
    columns.includes('confidence') &&
    columns.includes('conf_concepts') &&
    columns.includes('conf_solve') &&
    columns.includes('conf_assess')
  ) {
    rows.forEach((r, idx) => {
      const calc =
        (Number(r['conf_concepts']) + Number(r['conf_solve']) + Number(r['conf_assess'])) / 3;
      const actual = Number(r['confidence']);
      if (Math.abs(calc - actual) > 0.01) {
        confMismatches.push(`Row ${idx}: expected ${calc.toFixed(3)}, got ${actual}`);
      }
    });
  } else {
    confMismatches.push('Missing confidence or component columns.');
  }
  checks.push({
    id: 'confidence_composite',
    label: 'Confidence composite mean (tol 0.01)',
    status: confMismatches.length === 0 ? 'pass' : 'fail',
    detail:
      confMismatches.length === 0
        ? 'confidence equals mean(conf_concepts, conf_solve, conf_assess) within 0.01.'
        : confMismatches.slice(0, 3).join('; '),
  });

  // 8. Dummy columns check
  let dummyOk = effectiveDummies.length >= 1;
  let dummyDetail = '';
  if (effectiveDummies.length === 0) {
    dummyDetail = 'No ai_purpose_* dummy columns found.';
  } else {
    let invalidDummy = 0;
    let rowSumOver1 = 0;
    let rowSumZeroCount = 0;
    for (const r of rows) {
      let rowSum = 0;
      for (const dc of effectiveDummies) {
        const val = r[dc];
        const num = val === true ? 1 : val === false ? 0 : Number(val);
        if (val === true || val === false) {
          invalidDummy++; // boolean instead of 0/1 int
        } else if (num !== 0 && num !== 1) {
          invalidDummy++;
        }
        rowSum += Number.isNaN(num) ? 0 : num;
      }
      if (rowSum > 1) rowSumOver1++;
      if (rowSum === 0) rowSumZeroCount++;
    }
    if (invalidDummy > 0 || rowSumOver1 > 0 || rowSumZeroCount === 0) {
      dummyOk = false;
    }
    dummyDetail = `${effectiveDummies.length} dummy cols; ${rowSumZeroCount} rows in omitted reference category; ${invalidDummy} non-int/non-0-1 entries.`;
  }
  checks.push({
    id: 'dummies_valid',
    label: 'Dummies are 0/1 integers with omitted reference',
    status: dummyOk ? 'pass' : 'fail',
    detail: dummyDetail,
  });

  // Helper to extract numeric column
  const getCol = (name: string): number[] => rows.map((r) => Number(r[name]));
  const hasNumericCol = (name: string) =>
    columns.includes(name) && rows.every((r) => !Number.isNaN(Number(r[name])));

  // Cronbach's alpha
  let cronbachAlpha: CsvVerificationResult['cronbachAlpha'] = null;
  if (
    hasNumericCol('conf_concepts') &&
    hasNumericCol('conf_solve') &&
    hasNumericCol('conf_assess') &&
    rowCount > 2
  ) {
    const c1 = getCol('conf_concepts');
    const c2 = getCol('conf_solve');
    const c3 = getCol('conf_assess');
    const sumScore = c1.map((v, i) => v + c2[i] + c3[i]);
    const v1 = variance(c1, 1);
    const v2 = variance(c2, 1);
    const v3 = variance(c3, 1);
    const vSum = variance(sumScore, 1);
    const alpha = vSum === 0 ? 0 : (3 / 2) * (1 - (v1 + v2 + v3) / vSum);

    const v1p = variance(c1, 0);
    const v2p = variance(c2, 0);
    const v3p = variance(c3, 0);
    const vSump = variance(sumScore, 0);
    const alphaPop = vSump === 0 ? 0 : (3 / 2) * (1 - (v1p + v2p + v3p) / vSump);

    cronbachAlpha = {
      k: 3,
      alpha,
      alphaPop,
      acceptable: alpha >= 0.7,
      itemVariances: {
        conf_concepts: v1,
        conf_solve: v2,
        conf_assess: v3,
      },
      sumVariance: vSum,
    };
  }

  // Descriptives for 9 core numeric columns
  const nineCols = [
    'midterm',
    'prelim',
    'attendance',
    'class_standing',
    'confidence',
    'ai_freq_n',
    'ai_explain_n',
    'ai_verify_n',
    'try_first_n',
  ];
  const descriptives: DescriptiveStat[] = [];
  for (const col of nineCols) {
    if (!hasNumericCol(col) || rowCount < 2) continue;
    const vals = getCol(col);
    descriptives.push({
      variable: col,
      n: vals.length,
      mean: mean(vals),
      sd: sd(vals, 1),
      min: Math.min(...vals),
      max: Math.max(...vals),
    });
  }

  // Correlations with midterm + collinear pairs
  const correlationsWithMidterm: CsvVerificationResult['correlationsWithMidterm'] = [];
  const highCollinearPairs: CorrelationEntry[] = [];
  const presentNine = nineCols.filter((c) => hasNumericCol(c));
  if (hasNumericCol('midterm') && rowCount >= 3) {
    const mid = getCol('midterm');
    for (const col of presentNine) {
      if (col === 'midterm') continue;
      const vals = getCol(col);
      correlationsWithMidterm.push({
        variable: col,
        pearson: pearson(vals, mid),
        spearman: spearman(vals, mid),
      });
    }
    correlationsWithMidterm.sort((a, b) => Math.abs(b.pearson) - Math.abs(a.pearson));

    for (let i = 0; i < presentNine.length; i++) {
      for (let j = i + 1; j < presentNine.length; j++) {
        const v1 = getCol(presentNine[i]);
        const v2 = getCol(presentNine[j]);
        const rP = pearson(v1, v2);
        const rS = spearman(v1, v2);
        if (Math.abs(rP) > 0.7) {
          highCollinearPairs.push({
            var1: presentNine[i],
            var2: presentNine[j],
            pearson: rP,
            spearman: rS,
          });
        }
      }
    }
  }

  // Models
  const rowIds = rows.map((r) => (r['id'] as string | number) ?? null);
  const y = hasNumericCol('midterm') ? getCol('midterm') : [];

  const buildPreds = (names: string[]) => {
    if (!names.every((n) => hasNumericCol(n))) return null;
    return names.map((name) => ({ name, values: getCol(name) }));
  };

  const m1Preds = buildPreds(['ai_freq_n']);
  const m1 =
    y.length > 0 && m1Preds
      ? fitOlsModel('M1', 'Model 1 (Simple: ai_freq_n)', 'midterm ~ ai_freq_n', y, m1Preds, rowIds, cvSeed)
      : null;

  const m2Candidates: OlsModelResult[] = [];
  const allowedM2Predictors = [
    'prelim',
    'attendance',
    'class_standing',
    'confidence',
    'conf_concepts',
    'conf_solve',
    'conf_assess',
    'ai_explain_n',
    'ai_verify_n',
    'try_first_n',
  ];
  for (const pred of allowedM2Predictors) {
    const p = buildPreds([pred]);
    if (y.length > 0 && p) {
      const m2 = fitOlsModel(
        `M2_${pred}`,
        `Model 2 Candidate (${pred})`,
        `midterm ~ ${pred}`,
        y,
        p,
        rowIds,
        cvSeed,
      );
      if (m2) m2Candidates.push(m2);
    }
  }

  const m3Preds = buildPreds(['ai_freq_n', 'ai_explain_n', 'ai_verify_n', 'try_first_n']);
  const m3 =
    y.length > 0 && m3Preds
      ? fitOlsModel(
          'M3',
          'Model 3 (AI Behavior)',
          'midterm ~ ai_freq_n + ai_explain_n + ai_verify_n + try_first_n',
          y,
          m3Preds,
          rowIds,
          cvSeed,
        )
      : null;

  const m4Preds = buildPreds(['ai_freq_n', 'ai_verify_n', 'try_first_n', 'confidence', 'prelim']);
  const m4 =
    y.length > 0 && m4Preds
      ? fitOlsModel(
          'M4',
          'Model 4 (Full Core)',
          'midterm ~ ai_freq_n + ai_verify_n + try_first_n + confidence + prelim',
          y,
          m4Preds,
          rowIds,
          cvSeed,
        )
      : null;

  const extNames = ['ai_freq_n', 'ai_verify_n', 'try_first_n', 'confidence', 'prelim', ...effectiveDummies];
  const extPreds = effectiveDummies.length > 0 ? buildPreds(extNames) : null;
  const extended =
    y.length > 0 && extPreds
      ? fitOlsModel(
          'Extended',
          'Extended Model (M4 + Dummies)',
          `midterm ~ ${extNames.join(' + ')}`,
          y,
          extPreds,
          rowIds,
          cvSeed,
        )
      : null;

  return {
    rowCount,
    columnCount: columns.length,
    columns,
    checks,
    cronbachAlpha,
    descriptives,
    correlationsWithMidterm,
    highCollinearPairs,
    models: {
      m1,
      m2Candidates,
      m3,
      m4,
      extended,
    },
    dummyColumns: effectiveDummies,
    zeroExamRows,
  };
}

// ---------------------------------------------------------------------------
// 5. Notebook (.ipynb) Static Analyzer
// ---------------------------------------------------------------------------

function joinSource(src: unknown): string {
  if (Array.isArray(src)) return src.map((s) => String(s)).join('');
  if (typeof src === 'string') return src;
  return '';
}

function extractCellOutputs(outputs: unknown): {
  text: string;
  hasError: boolean;
  errorText: string | null;
} {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return { text: '', hasError: false, errorText: null };
  }
  const parts: string[] = [];
  let hasError = false;
  let errorText: string | null = null;

  for (const out of outputs) {
    if (!out || typeof out !== 'object') continue;
    const o = out as Record<string, unknown>;
    if (o.output_type === 'error') {
      hasError = true;
      const ename = String(o.ename ?? 'Error');
      const evalue = String(o.evalue ?? '');
      errorText = `${ename}: ${evalue}`;
      parts.push(`[ERROR] ${errorText}`);
    } else if (o.output_type === 'stream') {
      parts.push(joinSource(o.text));
    } else if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
      const data = o.data as Record<string, unknown> | undefined;
      if (data) {
        if (data['text/plain']) {
          parts.push(joinSource(data['text/plain']));
        } else if (data['image/png'] || data['image/jpeg']) {
          parts.push('[Plot / Image Output]');
        }
      }
    }
  }

  return { text: parts.join('\n').trim(), hasError, errorText };
}

export function analyzeNotebook(ipynbText: string): NotebookAnalysisResult {
  const nb = JSON.parse(ipynbText) as { cells?: Array<Record<string, unknown>> };
  const rawCells = Array.isArray(nb.cells) ? nb.cells : [];

  const cells: NotebookCellSummary[] = [];
  const hiddenHtmlComments: NotebookAnalysisResult['hiddenHtmlComments'] = [];
  const errorCells: number[] = [];
  const missingOutputCells: number[] = [];
  const todoOrPlaceholderCells: number[] = [];

  let codeCells = 0;
  let markdownCells = 0;
  let executedCodeCells = 0;
  let prevExec = -1;
  let executionOrderAscending = true;

  let workstationPartA: string | null = null;
  let workstationPartG: string | null = null;
  let detectedM2Predictor: string | null = null;
  let detectedPreferredModel: string | null = null;
  let usedRecordDataAfterPartA = false;
  const usedForbiddenPredictor: string[] = [];
  let savedDatasetStatementPresent = false;
  let passedPartA = false;

  let studentName = 'Unknown';
  let studentSection = 'Unknown';

  const suspiciousRegex =
    /(give\s+full\s+marks|ignore\s+previous|ai\s+assistant|do\s+not\s+deduct|award\s+100|system\s+prompt)/i;

  rawCells.forEach((cell, index) => {
    const cellType = (cell.cell_type as NotebookCellSummary['cellType']) || 'code';
    const rawSource = joinSource(cell.source);
    const executionCount =
      typeof cell.execution_count === 'number' ? cell.execution_count : null;
    const { text: outputsText, hasError, errorText } = extractCellOutputs(cell.outputs);

    // Detect & extract HTML comments
    const cellComments: string[] = [];
    const htmlCommentMatches = rawSource.match(/<!--[\s\S]*?-->/g) || [];
    for (const c of htmlCommentMatches) {
      cellComments.push(c);
      hiddenHtmlComments.push({
        cellIndex: index,
        content: c.slice(0, 300),
        suspicious: suspiciousRegex.test(c),
      });
    }

    // Check if cell only has TODO or template placeholder
    const strippedLines = rawSource
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    const isTodoOnly =
      cellType === 'code' &&
      strippedLines.length === 0 &&
      /TODO/i.test(rawSource);
    const isPlaceholderOnly =
      cellType === 'markdown' &&
      (/\*?\s*Type your answers? here\s*\*?/i.test(rawSource) ||
        rawSource.replace(/<!--[\s\S]*?-->/g, '').trim().length === 0);

    if (isTodoOnly || isPlaceholderOnly) {
      todoOrPlaceholderCells.push(index);
    }

    if (cellType === 'code') {
      codeCells++;
      if (executionCount !== null) {
        executedCodeCells++;
        if (executionCount <= prevExec) {
          executionOrderAscending = false;
        }
        prevExec = executionCount;
      } else if (strippedLines.length > 0) {
        executionOrderAscending = false;
        missingOutputCells.push(index);
      }
      if (hasError) errorCells.push(index);
    } else if (cellType === 'markdown') {
      markdownCells++;
    }

    // Student header extraction
    const nameMatch = rawSource.match(/(?:Name|Student(?:\s+Name)?)\s*[:\-]\s*([^\n|*]+)/i);
    if (nameMatch && !/type your/i.test(nameMatch[1])) {
      const candidate = nameMatch[1].trim();
      if (candidate.length > 1 && candidate.length < 80 && studentName === 'Unknown') {
        studentName = candidate;
      }
    }
    const secMatch = rawSource.match(/Section\s*[:\-]\s*([^\n|*]+)/i);
    if (secMatch && !/type your/i.test(secMatch[1])) {
      const candidate = secMatch[1].trim();
      if (candidate.length >= 1 && candidate.length < 40 && studentSection === 'Unknown') {
        studentSection = candidate;
      }
    }

    // Part detection
    if (/##?\s*Part\s*B/i.test(rawSource)) {
      passedPartA = true;
    }

    if (cellType === 'code') {
      // Workstation number in Part A
      const wsMatch = rawSource.match(/WORKSTATION_NUMBER\s*=\s*(\d+)/);
      if (wsMatch) workstationPartA = wsMatch[1];

      const rsSampleMatch = rawSource.match(/\.sample\([^)]*random_state\s*=\s*(\d+)/);
      if (rsSampleMatch && !workstationPartA) workstationPartA = rsSampleMatch[1];

      // Workstation number in KFold (Part G)
      const kfMatch = rawSource.match(/KFold\([^)]*random_state\s*=\s*([A-Za-z0-9_]+)/);
      if (kfMatch) {
        if (/^\d+$/.test(kfMatch[1])) {
          workstationPartG = kfMatch[1];
        } else if (kfMatch[1] === 'WORKSTATION_NUMBER' && workstationPartA) {
          workstationPartG = workstationPartA;
        } else {
          workstationPartG = kfMatch[1];
        }
      }

      // Detect record_data.xlsx after Part A
      if (passedPartA && /record_data\.xlsx/i.test(rawSource)) {
        usedRecordDataAfterPartA = true;
      }

      // Detect forbidden predictors grade or id in formulas or X lists
      const formulaMatches = rawSource.match(/midterm\s*~\s*['"`\w\s+*.()]+/g) || [];
      for (const fm of formulaMatches) {
        if (/\bgrade\b/i.test(fm) && !usedForbiddenPredictor.includes('grade')) {
          usedForbiddenPredictor.push('grade');
        }
        if (/\bid\b/i.test(fm) && !usedForbiddenPredictor.includes('id')) {
          usedForbiddenPredictor.push('id');
        }
        // Check single predictor M2 candidate (excluding ai_freq_n and multi-predictor formulas)
        if (!fm.includes('+') && !/ai_freq_n/.test(fm)) {
          const singlePred = fm.match(/midterm\s*~\s*([a-zA-Z0-9_]+)/);
          if (singlePred && singlePred[1]) {
            detectedM2Predictor = singlePred[1];
          }
        }
      }

      if (/to_csv\([^)]*index\s*=\s*False/i.test(rawSource)) {
        savedDatasetStatementPresent = true;
      }
    }

    if (cellType === 'markdown') {
      const prefMatch = rawSource.match(/preferred\s+model[^.\n]*?(Model\s*[1-4]|Extended|M[1-4])/i);
      if (prefMatch) detectedPreferredModel = prefMatch[1];
    }

    cells.push({
      index,
      cellType,
      executionCount,
      source: rawSource.replace(/<!--[\s\S]*?-->/g, '[HTML comment stripped]'),
      outputsText: outputsText.slice(0, 2500),
      hasError,
      errorText,
      isTodoOnly,
      isPlaceholderOnly,
      hiddenComments: cellComments,
    });
  });

  const workstationMismatch =
    workstationPartA !== null &&
    workstationPartG !== null &&
    workstationPartA !== workstationPartG;

  return {
    totalCells: rawCells.length,
    codeCells,
    markdownCells,
    executedCodeCells,
    executionOrderAscending,
    hasErrors: errorCells.length > 0,
    errorCells,
    missingOutputCells,
    workstationPartA,
    workstationPartG,
    workstationMismatch,
    detectedM2Predictor,
    detectedPreferredModel,
    usedRecordDataAfterPartA,
    usedForbiddenPredictor,
    savedDatasetStatementPresent,
    hiddenHtmlComments,
    todoOrPlaceholderCells,
    studentHeaderGuess: {
      name: studentName,
      section: studentSection,
      workstation: workstationPartA ?? 'Unknown',
    },
    cells,
  };
}
