import { useState } from 'react';
import type { FC } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { NotebookAnalysisResult } from '../types/grading.ts';

interface NotebookInspectorViewProps {
  notebookAnalysis: NotebookAnalysisResult;
}

export const NotebookInspectorView: FC<NotebookInspectorViewProps> = ({
  notebookAnalysis,
}) => {
  const [cellFilter, setCellFilter] = useState<'all' | 'code' | 'markdown' | 'flagged'>('all');

  const filteredCells = notebookAnalysis.cells.filter((cell) => {
    if (cellFilter === 'code') return cell.cellType === 'code';
    if (cellFilter === 'markdown') return cell.cellType === 'markdown';
    if (cellFilter === 'flagged') {
      return (
        cell.hasError ||
        cell.isTodoOnly ||
        cell.isPlaceholderOnly ||
        cell.hiddenComments.length > 0
      );
    }
    return true;
  });

  const auditFacts = [
    {
      label: 'Execution Order Ascending',
      ok: notebookAnalysis.executionOrderAscending,
      value: notebookAnalysis.executionOrderAscending
        ? `Yes (${notebookAnalysis.executedCodeCells}/${notebookAnalysis.codeCells} executed)`
        : 'Out-of-order or unexecuted cells',
    },
    {
      label: 'Error Tracebacks',
      ok: !notebookAnalysis.hasErrors,
      value: notebookAnalysis.hasErrors
        ? `Errors in cell(s) ${notebookAnalysis.errorCells.join(', ')}`
        : 'None',
    },
    {
      label: 'Workstation Seed Consistency (A vs G.1)',
      ok: !notebookAnalysis.workstationMismatch && Boolean(notebookAnalysis.workstationPartA),
      value: `Part A: ${notebookAnalysis.workstationPartA ?? 'None'} · Part G.1: ${notebookAnalysis.workstationPartG ?? 'None'}`,
    },
    {
      label: 'Forbidden Predictors (grade / id)',
      ok: notebookAnalysis.usedForbiddenPredictor.length === 0,
      value:
        notebookAnalysis.usedForbiddenPredictor.length === 0
          ? 'None detected in formulas'
          : `Detected: ${notebookAnalysis.usedForbiddenPredictor.join(', ')}`,
    },
    {
      label: 'record_data.xlsx After Part A',
      ok: !notebookAnalysis.usedRecordDataAfterPartA,
      value: notebookAnalysis.usedRecordDataAfterPartA
        ? 'Referenced after Part A!'
        : 'Not referenced after Part A',
    },
    {
      label: 'Part H.3 CSV Export (index=False)',
      ok: notebookAnalysis.savedDatasetStatementPresent,
      value: notebookAnalysis.savedDatasetStatementPresent
        ? 'to_csv(..., index=False) found'
        : 'Not detected',
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8 space-y-8">
      {/* Static Audit Grid */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Notebook Reproducibility &amp; Policy Audit
            </h2>
            <p className="text-xs text-slate-500">
              {notebookAnalysis.totalCells} total cells ({notebookAnalysis.codeCells} code ·{' '}
              {notebookAnalysis.markdownCells} markdown)
            </p>
          </div>
          {notebookAnalysis.hiddenHtmlComments.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
              {notebookAnalysis.hiddenHtmlComments.length} HTML comment(s) stripped &amp; isolated
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {auditFacts.map((fact) => (
            <div
              key={fact.label}
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600">{fact.label}</span>
                {fact.ok ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    OK
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-red-700">
                    <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    ALERT
                  </span>
                )}
              </div>
              <p className="font-mono text-xs font-medium text-slate-900">{fact.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cell Viewer */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Notebook Cells ({filteredCells.length})
          </h2>
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            {(
              [
                ['all', 'All Cells'],
                ['code', 'Code'],
                ['markdown', 'Markdown'],
                ['flagged', 'Flagged / Empty'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setCellFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  cellFilter === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredCells.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No cells match the selected filter.
            </div>
          ) : (
            filteredCells.map((cell) => {
              const isFlagged =
                cell.hasError ||
                cell.isTodoOnly ||
                cell.isPlaceholderOnly ||
                cell.hiddenComments.length > 0;
              return (
                <article
                  key={cell.index}
                  className={`rounded-xl border bg-white overflow-hidden ${
                    cell.hasError
                      ? 'border-red-300'
                      : isFlagged
                        ? 'border-amber-300'
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs">
                    <div className="flex items-center gap-2 font-mono text-slate-700">
                      <span className="font-semibold text-slate-900">
                        Cell #{cell.index}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{cell.cellType}</span>
                      {cell.cellType === 'code' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            In [{cell.executionCount ?? ' '}]
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] font-semibold">
                      {cell.hasError && <span className="text-red-700">ERROR TRACEBACK</span>}
                      {cell.isTodoOnly && <span className="text-amber-700">TODO ONLY</span>}
                      {cell.isPlaceholderOnly && (
                        <span className="text-amber-700">UNFILLED PLACEHOLDER</span>
                      )}
                      {cell.hiddenComments.length > 0 && (
                        <span className="text-amber-700">HTML COMMENT STRIPPED</span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <pre
                      className={`overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed ${
                        cell.cellType === 'code'
                          ? 'font-mono text-slate-800 bg-slate-50 rounded-lg p-3 border border-slate-100'
                          : 'font-sans text-slate-800'
                      }`}
                    >
                      {cell.source || '(empty cell)'}
                    </pre>

                    {cell.outputsText && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-slate-500">
                          Cell Output
                        </p>
                        <pre
                          className={`overflow-x-auto whitespace-pre-wrap rounded-lg border p-3 font-mono text-xs leading-relaxed ${
                            cell.hasError
                              ? 'border-red-200 bg-red-50 text-red-900'
                              : 'border-slate-200 bg-slate-900 text-slate-100'
                          }`}
                        >
                          {cell.outputsText}
                        </pre>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};
