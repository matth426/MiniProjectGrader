import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FC } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCode2,
  FileSpreadsheet,
  Loader2,
  Play,
  Sparkles,
  Upload,
} from 'lucide-react';

interface UploadedFile {
  name: string;
  size: number;
  text: string;
  metaSummary: string;
}

interface UploadStageProps {
  notebookFile: UploadedFile | null;
  csvFile: UploadedFile | null;
  isGrading: boolean;
  error: string | null;
  onNotebookLoaded: (file: UploadedFile) => void;
  onCsvLoaded: (file: UploadedFile) => void;
  onLoadSample: () => void;
  onRunGrade: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const RUBRIC_OVERVIEW = [
  { part: 'Part A', title: 'Sampling & Reproducibility', pts: 5 },
  { part: 'Part B', title: 'Verify, Encode & Clean', pts: 15 },
  { part: 'Part C', title: 'Exploratory Data Analysis', pts: 10 },
  { part: 'Part D', title: 'Simple Regression (M1 & M2)', pts: 20 },
  { part: 'Part E', title: 'Multiple Regression (M3, M4, Ext)', pts: 20 },
  { part: 'Part F', title: 'Diagnostics & Influence', pts: 10 },
  { part: 'Part G', title: 'Cross-Validation & Prediction', pts: 10 },
  { part: 'Part H', title: 'Conclusion & Dataset Export', pts: 8 },
  { part: 'Org', title: 'Reproducibility & Readability', pts: 2 },
];

export const UploadStage: FC<UploadStageProps> = ({
  notebookFile,
  csvFile,
  isGrading,
  error,
  onNotebookLoaded,
  onCsvLoaded,
  onLoadSample,
  onRunGrade,
}) => {
  const nbInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [dragTarget, setDragTarget] = useState<'nb' | 'csv' | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);

  const handleNotebookFile = async (file: File) => {
    setParseWarning(null);
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { cells?: unknown[] };
      const count = Array.isArray(parsed.cells) ? parsed.cells.length : 0;
      onNotebookLoaded({
        name: file.name,
        size: file.size,
        text,
        metaSummary: `${count} notebook cells`,
      });
    } catch {
      setParseWarning(`Could not parse "${file.name}" as valid Jupyter Notebook JSON (.ipynb).`);
    }
  };

  const handleCsvFile = async (file: File) => {
    setParseWarning(null);
    const text = await file.text();
    const lines = text
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    const dataRows = Math.max(0, lines.length - 1);
    const cols = lines[0] ? lines[0].split(',').length : 0;
    onCsvLoaded({
      name: file.name,
      size: file.size,
      text,
      metaSummary: `${dataRows} rows · ${cols} columns`,
    });
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>, target: 'nb' | 'csv') => {
    e.preventDefault();
    setDragTarget(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (target === 'nb') await handleNotebookFile(file);
    else await handleCsvFile(file);
  };

  const onFileInputChange = async (
    e: ChangeEvent<HTMLInputElement>,
    target: 'nb' | 'csv',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (target === 'nb') await handleNotebookFile(file);
    else await handleCsvFile(file);
    e.target.value = '';
  };

  const readyToGrade = Boolean(notebookFile && csvFile) && !isGrading;

  return (
    <div className="mx-auto max-w-[1160px] px-6 py-10 space-y-10">
      {/* Intro & Action Header */}
      <section className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 border-b border-slate-200 pb-8">
        <div className="max-w-2xl space-y-2.5">
          <p className="text-xs font-medium tracking-wide text-blue-700">
            IT365 Mini Project Assessment · 100-Point Rubric
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 text-balance">
            Generative AI Use, Study Behavior, and Exam Performance
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Upload a student&apos;s executed Jupyter notebook and cleaned CSV dataset. The
            checker deterministically recomputes OLS models, VIFs, Cronbach&apos;s α,
            diagnostic tests, and CSV constraints before evaluating written
            interpretations against the rubric.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onLoadSample}
            disabled={isGrading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-blue-700" aria-hidden="true" />
            Load Sample Submission
          </button>
          <button
            type="button"
            onClick={onRunGrade}
            disabled={!readyToGrade}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {isGrading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Verifying &amp; Grading...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                Grade Submission
              </>
            )}
          </button>
        </div>
      </section>

      {(error || parseWarning) && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-900"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">Verification Error</p>
              <p className="text-red-800">{error || parseWarning}</p>
            </div>
          </div>
          {error && readyToGrade && (
            <button
              type="button"
              onClick={onRunGrade}
              className="rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-800 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
            >
              Retry Grading
            </button>
          )}
        </div>
      )}

      {/* Two-Column File Intake */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Notebook Card */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragTarget('nb');
          }}
          onDragLeave={() => setDragTarget(null)}
          onDrop={(e) => onDrop(e, 'nb')}
          className={`flex flex-col justify-between rounded-xl border bg-white p-6 transition-colors ${
            dragTarget === 'nb'
              ? 'border-blue-600 bg-blue-50/30'
              : 'border-slate-200'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <FileCode2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    1. Student Notebook
                  </h2>
                  <p className="text-xs text-slate-500">
                    LastName_LinearRegression.ipynb
                  </p>
                </div>
              </div>
              {notebookFile && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Loaded
                </span>
              )}
            </div>

            {notebookFile ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1">
                <p className="font-mono text-sm font-medium text-slate-900 truncate">
                  {notebookFile.name}
                </p>
                <p className="text-xs text-slate-600 tabular-nums">
                  {formatBytes(notebookFile.size)} · {notebookFile.metaSummary}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center">
                <Upload className="mx-auto h-6 w-6 text-slate-400 mb-2" aria-hidden="true" />
                <p className="text-sm text-slate-700 font-medium">
                  Drop executed .ipynb file here
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Checks execution order, printed outputs, code &amp; written answers
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-100">
            <input
              ref={nbInputRef}
              type="file"
              accept=".ipynb,application/json"
              className="hidden"
              onChange={(e) => onFileInputChange(e, 'nb')}
            />
            <button
              type="button"
              onClick={() => nbInputRef.current?.click()}
              disabled={isGrading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              {notebookFile ? 'Replace Notebook' : 'Select .ipynb File'}
            </button>
            <span className="text-xs text-slate-500">JSON nbformat 4</span>
          </div>
        </div>

        {/* CSV Card */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragTarget('csv');
          }}
          onDragLeave={() => setDragTarget(null)}
          onDrop={(e) => onDrop(e, 'csv')}
          className={`flex flex-col justify-between rounded-xl border bg-white p-6 transition-colors ${
            dragTarget === 'csv'
              ? 'border-blue-600 bg-blue-50/30'
              : 'border-slate-200'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    2. Cleaned Student Dataset
                  </h2>
                  <p className="text-xs text-slate-500">
                    LastName_Dataset.csv (saved in Part H.3)
                  </p>
                </div>
              </div>
              {csvFile && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Loaded
                </span>
              )}
            </div>

            {csvFile ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1">
                <p className="font-mono text-sm font-medium text-slate-900 truncate">
                  {csvFile.name}
                </p>
                <p className="text-xs text-slate-600 tabular-nums">
                  {formatBytes(csvFile.size)} · {csvFile.metaSummary}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center">
                <Upload className="mx-auto h-6 w-6 text-slate-400 mb-2" aria-hidden="true" />
                <p className="text-sm text-slate-700 font-medium">
                  Drop cleaned .csv dataset here
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Recomputes M1–M4, Extended, VIF, α, Shapiro-Wilk, BP &amp; Cook&apos;s D
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-100">
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFileInputChange(e, 'csv')}
            />
            <button
              type="button"
              onClick={() => csvInputRef.current?.click()}
              disabled={isGrading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              {csvFile ? 'Replace CSV' : 'Select .csv File'}
            </button>
            <span className="text-xs text-slate-500">Expected n ≤ 30 rows</span>
          </div>
        </div>
      </section>

      {/* Rubric Structure Reference */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Rubric Architecture (100 Points Total)
            </h2>
            <p className="text-xs text-slate-500">
              Evaluated in 0.5-point increments across 41 rubric criteria · Part C
              sub-items normalized to 10.0 pts
            </p>
          </div>
          <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
            Tolerance: ±0.01 R²/p · ±1% coefficients
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 pt-2 border-t border-slate-100">
          {RUBRIC_OVERVIEW.map((item) => (
            <div
              key={item.part}
              className="flex items-center justify-between py-1.5 text-sm border-b border-slate-100 last:border-b-0"
            >
              <span className="text-slate-700">
                <span className="font-semibold text-slate-900">{item.part}</span>{' '}
                <span aria-hidden="true">·</span> {item.title}
              </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums ml-3">
                {item.pts} pts
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
