import { useState } from 'react';
import type { FC } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  HelpCircle,
  Minus,
  Plus,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type {
  CheckStatus,
  CsvVerificationResult,
  GradingReport,
  NotebookAnalysisResult,
} from '../types/grading.ts';
import { formatReportAsMarkdown } from '../lib/formatReport.ts';

interface GradingReportViewProps {
  report: GradingReport;
  csvVerification: CsvVerificationResult;
  notebookAnalysis: NotebookAnalysisResult;
  isModified: boolean;
  onAdjustScore: (id: string, newScore: number) => void;
  onResetScores: () => void;
}

function StatusBadge({ status }: { status: CheckStatus | 'match' | 'mismatch' }) {
  if (status === 'pass' || status === 'match') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {status === 'match' ? 'MATCH' : 'PASS'}
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber-700 whitespace-nowrap">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        CHECK
      </span>
    );
  }
  if (status === 'unverified') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">
        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        UNVERIFIED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-red-700 whitespace-nowrap">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {status === 'mismatch' ? 'MISMATCH' : 'FAIL'}
    </span>
  );
}

export const GradingReportView: FC<GradingReportViewProps> = ({
  report,
  csvVerification,
  notebookAnalysis,
  isModified,
  onAdjustScore,
  onResetScores,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'deductions' | string>('all');
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  const parts = Array.from(new Set(report.rubricScores.map((r) => r.part)));
  const filteredRows = report.rubricScores.filter((r) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'deductions') return r.score < r.max;
    return r.part === filterMode;
  });

  const handleCopyMarkdown = async () => {
    const md = formatReportAsMarkdown(report, csvVerification, notebookAnalysis);
    await navigator.clipboard.writeText(md);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = formatReportAsMarkdown(report, csvVerification, notebookAnalysis);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = report.student.name.replace(/[^a-z0-9]+/gi, '_') || 'Student';
    a.href = url;
    a.download = `${safeName}_GradingReport.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyFeedback = async () => {
    await navigator.clipboard.writeText(report.studentFeedback);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  };

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 space-y-8">
      {/* 1. Student Header & Total Score */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">
              01. Student Identification
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {report.student.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>Section: <strong className="text-slate-900">{report.student.section}</strong></span>
              <span aria-hidden="true">·</span>
              <span>
                Workstation #:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">
                  {report.student.workstationNumber}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Dataset Rows:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">
                  {csvVerification.rowCount}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Notebook Errors:{' '}
                <strong className="text-slate-900">
                  {report.verificationSummary.notebookRunsWithoutErrors ? 'None' : 'Detected'}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 lg:border-l lg:border-slate-200 lg:pl-8">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Score</p>
              <p className="font-display text-4xl font-bold text-slate-900 tabular-nums">
                {report.totalScore.toFixed(1)}
                <span className="text-lg font-medium text-slate-400">
                  {' '}
                  / {report.maxScore}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedReport ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy Report
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download .md
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Verification Summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              02. Verification Summary
            </h2>
            <p className="text-xs text-slate-500">
              {report.verificationSummary.summaryNote ||
                'Deterministic CSV validation, statistical recomputation, and notebook execution audit.'}
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
            Notebook Clean Run:{' '}
            {report.verificationSummary.notebookRunsWithoutErrors ? 'YES' : 'NO'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CSV Validation Checks */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              CSV Integrity Checks
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {csvVerification.checks.map((chk) => (
                <div
                  key={chk.id}
                  className="flex items-start justify-between gap-4 px-4 py-2.5 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-900">{chk.label}</p>
                    <p className="text-slate-600">{chk.detail}</p>
                  </div>
                  <div className="pt-0.5 shrink-0">
                    <StatusBadge status={chk.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recomputation Match/Mismatch */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Statistical Recomputation vs. Notebook Output
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Metric</th>
                    <th className="px-3 py-2 font-semibold">CSV Recomputed</th>
                    <th className="px-3 py-2 font-semibold">Student Output</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.verificationSummary.recomputationComparisons.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-slate-500 text-center">
                        No numeric comparisons returned.
                      </td>
                    </tr>
                  ) : (
                    report.verificationSummary.recomputationComparisons.map((rc, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="px-3 py-2.5 font-medium text-slate-900">
                          <div>{rc.metric}</div>
                          {rc.note && (
                            <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                              {rc.note}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-800 tabular-nums">
                          {rc.recomputedValue}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-800 tabular-nums">
                          {rc.studentValue}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={rc.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 3 & 4. Score Table & Part Subtotals */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              03. Rubric Score Breakdown &amp; Subtotals
            </h2>
            <p className="text-xs text-slate-500">
              0.5-point increments · Use − / + controls to manually adjust any line item if desired
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({report.rubricScores.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('deductions')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === 'deductions'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Deductions ({report.rubricScores.filter((r) => r.score < r.max).length})
              </button>
              {parts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFilterMode(p)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    filterMode === p
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {isModified && (
              <button
                type="button"
                onClick={onResetScores}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Part Subtotals Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {report.partSubtotals.map((ps) => {
            const pct = ps.max > 0 ? ps.score / ps.max : 1;
            return (
              <div
                key={ps.part}
                className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold text-slate-900">{ps.part}</span>
                  <span className="font-mono tabular-nums">
                    {Math.round(pct * 100)}%
                  </span>
                </div>
                <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                  {ps.score.toFixed(1)}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {ps.max}
                  </span>
                </p>
              </div>
            );
          })}
        </div>

        {/* Score Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-semibold w-[36%]">Part / Rubric Item</th>
                <th className="px-3 py-3 font-semibold text-right w-16">Max</th>
                <th className="px-3 py-3 font-semibold text-center w-32">Score</th>
                <th className="px-4 py-3 font-semibold">Reason (Cell / Number Citation)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No rubric items match this filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isDeducted = row.score < row.max;
                  return (
                    <tr
                      key={row.id}
                      className={isDeducted ? 'bg-amber-50/35' : 'bg-white'}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="font-semibold text-slate-900">
                          {row.id} · {row.part}
                        </div>
                        <div className="text-slate-600 mt-0.5 leading-relaxed">
                          {row.item}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-right font-mono text-slate-600 tabular-nums">
                        {row.max.toFixed(1)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            aria-label={`Decrease score for ${row.id}`}
                            disabled={row.score <= 0}
                            onClick={() =>
                              onAdjustScore(row.id, Math.max(0, row.score - 0.5))
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span
                            className={`w-10 text-center font-mono font-semibold tabular-nums ${
                              isDeducted ? 'text-amber-800' : 'text-emerald-800'
                            }`}
                          >
                            {row.score.toFixed(1)}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase score for ${row.id}`}
                            disabled={row.score >= row.max}
                            onClick={() =>
                              onAdjustScore(row.id, Math.min(row.max, row.score + 0.5))
                            }
                            className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-700 leading-relaxed">
                        {row.reason}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 text-sm">
              <tr>
                <td className="px-4 py-3 font-display font-bold text-slate-900">
                  TOTAL SCORE
                </td>
                <td className="px-3 py-3 text-right font-mono font-semibold text-slate-600 tabular-nums">
                  {report.maxScore.toFixed(1)}
                </td>
                <td className="px-3 py-3 text-center font-mono font-bold text-blue-800 tabular-nums">
                  {report.totalScore.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  Sum of all 9 rubric parts (0.5-point increments)
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 5. Integrity Flags */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          04. Integrity &amp; Consistency Flags
        </h2>
        {report.integrityFlags.length === 0 ? (
          <p className="text-sm text-slate-600">
            None — no workstation mismatches, forbidden predictors, or consistency
            anomalies flagged.
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-800">
            {report.integrityFlags.map((flag, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-2.5"
              >
                <AlertTriangle
                  className="h-4 w-4 text-amber-700 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6. Top 3 Strengths & Fixes */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            05. Top 3 Strengths
          </h2>
          <ol className="space-y-3 text-sm text-slate-700">
            {report.topStrengths.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="font-mono text-xs font-semibold text-emerald-700 pt-0.5 tabular-nums">
                  0{idx + 1}.
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            06. Top 3 Actionable Fixes
          </h2>
          <ol className="space-y-3 text-sm text-slate-700">
            {report.topFixes.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="font-mono text-xs font-semibold text-amber-700 pt-0.5 tabular-nums">
                  0{idx + 1}.
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 7. Student-Facing Feedback */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            07. Student-Facing Feedback
          </h2>
          <button
            type="button"
            onClick={handleCopyFeedback}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {copiedFeedback ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy Feedback
              </>
            )}
          </button>
        </div>
        <p className="text-sm leading-relaxed text-slate-700">
          {report.studentFeedback}
        </p>
      </section>
    </div>
  );
};
