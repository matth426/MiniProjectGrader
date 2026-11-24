import { useState } from 'react';
import type { FC } from 'react';
import type { CsvVerificationResult, OlsModelResult } from '../types/grading.ts';

interface StatisticalAuditViewProps {
  csvVerification: CsvVerificationResult;
  detectedM2Predictor: string | null;
}

export const StatisticalAuditView: FC<StatisticalAuditViewProps> = ({
  csvVerification,
  detectedM2Predictor,
}) => {
  const { models, cronbachAlpha, descriptives, correlationsWithMidterm, highCollinearPairs } =
    csvVerification;

  const matchedM2 =
    (detectedM2Predictor &&
      models.m2Candidates.find((m) => m.modelId === `M2_${detectedM2Predictor}`)) ||
    [...models.m2Candidates].sort((a, b) => b.adjR2 - a.adjR2)[0] ||
    null;

  const coreModels: OlsModelResult[] = [
    models.m1,
    matchedM2,
    models.m3,
    models.m4,
    models.extended,
  ]
    .filter((m): m is OlsModelResult => m !== null)
    .sort((a, b) => b.adjR2 - a.adjR2);

  const [selectedModelId, setSelectedModelId] = useState<string>(
    models.m4?.modelId || coreModels[0]?.modelId || '',
  );

  const activeModel =
    coreModels.find((m) => m.modelId === selectedModelId) ||
    models.m2Candidates.find((m) => m.modelId === selectedModelId) ||
    coreModels[0] ||
    null;

  const bestAdjR2 = coreModels[0];
  const lowestAic = [...coreModels].sort((a, b) => a.aic - b.aic)[0];

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 space-y-8">
      {/* Summary Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Cleaned Sample Size</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            n = {csvVerification.rowCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {csvVerification.columnCount} columns · {csvVerification.dummyColumns.length} dummies
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Cronbach&apos;s α (k = 3)</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {cronbachAlpha ? cronbachAlpha.alpha.toFixed(4) : 'N/A'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {cronbachAlpha
              ? cronbachAlpha.acceptable
                ? 'Acceptable (≥ 0.70)'
                : 'Below 0.70 threshold'
              : 'Columns missing'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Highest Adjusted R²</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {bestAdjR2 ? bestAdjR2.adjR2.toFixed(4) : 'N/A'}
          </p>
          <p className="mt-1 text-xs text-slate-600 truncate">
            {bestAdjR2 ? bestAdjR2.label : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Lowest AIC (statsmodels)</p>
          <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {lowestAic ? lowestAic.aic.toFixed(2) : 'N/A'}
          </p>
          <p className="mt-1 text-xs text-slate-600 truncate">
            {lowestAic ? lowestAic.label : '—'}
          </p>
        </div>
      </section>

      {/* Model Comparison Table */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              All Models Comparison (Sorted by Adjusted R²)
            </h2>
            <p className="text-xs text-slate-500">
              Recomputed directly from uploaded CSV · Click any row to inspect full coefficients &amp; diagnostics
            </p>
          </div>
          {detectedM2Predictor && (
            <span className="font-mono text-xs text-slate-600">
              Detected M2 predictor: {detectedM2Predictor}
            </span>
          )}
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Model</th>
                <th className="px-4 py-2.5 font-semibold">Formula</th>
                <th className="px-3 py-2.5 font-semibold text-right">k</th>
                <th className="px-3 py-2.5 font-semibold text-right">R²</th>
                <th className="px-3 py-2.5 font-semibold text-right">Adj. R²</th>
                <th className="px-3 py-2.5 font-semibold text-right">RMSE</th>
                <th className="px-3 py-2.5 font-semibold text-right">AIC</th>
                <th className="px-3 py-2.5 font-semibold text-right">F p-value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {coreModels.map((m) => {
                const isSelected = activeModel?.modelId === m.modelId;
                return (
                  <tr
                    key={m.modelId}
                    onClick={() => setSelectedModelId(m.modelId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                      {m.label}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                      {m.formula}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {m.numPredictors}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {m.r2.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {m.adjR2.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {m.rmse.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {m.aic.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {m.fPValue < 0.0001 ? m.fPValue.toExponential(2) : m.fPValue.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Model Inspector */}
      {activeModel && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Detailed OLS Audit: {activeModel.label}
              </h2>
              <p className="font-mono text-xs text-slate-600 mt-0.5">
                {activeModel.formula}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {coreModels.map((m) => (
                <button
                  key={m.modelId}
                  type="button"
                  onClick={() => setSelectedModelId(m.modelId)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeModel.modelId === m.modelId
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {m.modelId.startsWith('M2_') ? 'M2' : m.modelId}
                </button>
              ))}
            </div>
          </div>

          {/* Coefficients Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Term</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Estimate (β)</th>
                  <th className="px-3 py-2.5 font-semibold text-right">SE</th>
                  <th className="px-3 py-2.5 font-semibold text-right">t-stat</th>
                  <th className="px-3 py-2.5 font-semibold text-right">p-value</th>
                  <th className="px-3 py-2.5 font-semibold text-right">95% CI</th>
                  <th className="px-3 py-2.5 font-semibold text-right">VIF</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Std. β</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeModel.coefficients.map((c) => (
                  <tr key={c.term}>
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                      {c.term}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {c.estimate.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {c.se.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {c.tStat.toFixed(3)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                        c.pValue < 0.05 ? 'font-semibold text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      {c.pValue < 0.0001 ? c.pValue.toExponential(2) : c.pValue.toFixed(4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      [{c.ciLower.toFixed(3)}, {c.ciUpper.toFixed(3)}]
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                        c.vif !== undefined && c.vif > 5
                          ? 'font-semibold text-amber-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {c.vif === undefined
                        ? '—'
                        : Number.isFinite(c.vif)
                          ? c.vif.toFixed(2)
                          : 'Inf'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {c.standardizedBeta === undefined ? '—' : c.standardizedBeta.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Diagnostics & CV */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900">
                Residual Diagnostics &amp; Influence
              </h3>
              <dl className="grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-slate-600">Shapiro-Wilk (Normality)</dt>
                <dd className="font-mono text-right text-slate-900 tabular-nums">
                  W = {activeModel.diagnostics.shapiroW.toFixed(4)} (p ={' '}
                  {activeModel.diagnostics.shapiroP.toFixed(4)})
                </dd>

                <dt className="text-slate-600">Breusch-Pagan (Homoscedasticity)</dt>
                <dd className="font-mono text-right text-slate-900 tabular-nums">
                  LM = {activeModel.diagnostics.breuschPaganLM.toFixed(3)} (p ={' '}
                  {activeModel.diagnostics.breuschPaganP.toFixed(4)})
                </dd>

                <dt className="text-slate-600">Durbin-Watson (Autocorrelation)</dt>
                <dd className="font-mono text-right text-slate-900 tabular-nums">
                  {activeModel.diagnostics.durbinWatson.toFixed(4)}
                </dd>

                <dt className="text-slate-600">
                  Cook&apos;s D &gt; {activeModel.diagnostics.cooksThreshold.toFixed(3)} (4/n)
                </dt>
                <dd className="font-mono text-right text-slate-900 tabular-nums">
                  {activeModel.diagnostics.flaggedCooksRows.length === 0
                    ? '0 rows'
                    : activeModel.diagnostics.flaggedCooksRows
                        .map((r) => `id=${r.id ?? r.rowIndex} (${r.cooksD.toFixed(2)})`)
                        .join(', ')}
                </dd>

                <dt className="text-slate-600">|Studentized Residual| &gt; 3</dt>
                <dd className="font-mono text-right text-slate-900 tabular-nums">
                  {activeModel.diagnostics.flaggedStudentizedRows.length === 0
                    ? '0 rows'
                    : activeModel.diagnostics.flaggedStudentizedRows
                        .map((r) => `id=${r.id ?? r.rowIndex} (${r.studentizedT.toFixed(2)})`)
                        .join(', ')}
                </dd>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2.5">
              <h3 className="text-sm font-semibold text-slate-900">
                Error Metrics &amp; 5-Fold Cross-Validation Benchmark
              </h3>
              <dl className="grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-slate-600">In-Sample MAE / RMSE</dt>
                <dd className="font-mono text-right text-slate-900 tabular-nums">
                  {activeModel.mae.toFixed(3)} / {activeModel.rmse.toFixed(3)}
                </dd>

                <dt className="text-slate-600">5-Fold CV R² (Mean ± SD)</dt>
                <dd className="font-mono text-right text-slate-900 tabular-nums">
                  {activeModel.cv5Fold
                    ? `${activeModel.cv5Fold.r2Mean.toFixed(4)} ± ${activeModel.cv5Fold.r2Sd.toFixed(4)}`
                    : 'N/A'}
                </dd>

                <dt className="text-slate-600">5-Fold CV RMSE (Mean ± SD)</dt>
                <dd className="font-mono text-right text-slate-900 tabular-nums">
                  {activeModel.cv5Fold
                    ? `${activeModel.cv5Fold.rmseMean.toFixed(3)} ± ${activeModel.cv5Fold.rmseSd.toFixed(3)}`
                    : 'N/A'}
                </dd>
              </dl>
              {activeModel.cv5Fold && (
                <p className="text-[11px] text-slate-500 pt-1">
                  {activeModel.cv5Fold.note}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Descriptives & Correlations */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Descriptive Statistics (9 Core Columns)
          </h2>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 font-semibold">Variable</th>
                  <th className="px-3 py-2 font-semibold text-right">Mean</th>
                  <th className="px-3 py-2 font-semibold text-right">SD</th>
                  <th className="px-3 py-2 font-semibold text-right">Min</th>
                  <th className="px-3 py-2 font-semibold text-right">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {descriptives.map((d) => (
                  <tr key={d.variable}>
                    <td className="px-3 py-2 font-mono font-medium text-slate-900">
                      {d.variable}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {d.mean.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {d.sd.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {d.min.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {d.max.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Correlations with Midterm &amp; Collinear Pairs (|r| &gt; 0.7)
          </h2>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 font-semibold">Predictor</th>
                  <th className="px-3 py-2 font-semibold text-right">Pearson r</th>
                  <th className="px-3 py-2 font-semibold text-right">Spearman ρ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {correlationsWithMidterm.map((c) => (
                  <tr key={c.variable}>
                    <td className="px-3 py-2 font-mono font-medium text-slate-900">
                      {c.variable}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {c.pearson.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {c.spearman.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {highCollinearPairs.length > 0 && (
            <div className="pt-2 space-y-1.5">
              <p className="text-xs font-semibold text-slate-900">
                Pairs with |r| &gt; 0.70 ({highCollinearPairs.length})
              </p>
              <div className="text-xs text-slate-600 font-mono space-y-1">
                {highCollinearPairs.map((p, idx) => (
                  <div key={idx}>
                    {p.var1} ↔ {p.var2}: r = {p.pearson.toFixed(3)} (ρ ={' '}
                    {p.spearman.toFixed(3)})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
