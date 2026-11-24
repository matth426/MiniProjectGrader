/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { TopBar } from './components/TopBar.tsx';
import type { ActiveTab } from './components/TopBar.tsx';
import { UploadStage } from './components/UploadStage.tsx';
import { GradingReportView } from './components/GradingReportView.tsx';
import { StatisticalAuditView } from './components/StatisticalAuditView.tsx';
import { NotebookInspectorView } from './components/NotebookInspectorView.tsx';
import { formatReportAsMarkdown } from './lib/formatReport.ts';
import {
  buildSampleNotebookText,
  SAMPLE_CSV_FILENAME,
  SAMPLE_CSV_TEXT,
  SAMPLE_NOTEBOOK_FILENAME,
} from './lib/sampleSubmission.ts';
import type { GradeApiResponse, GradingReport } from './types/grading.ts';

interface LoadedFile {
  name: string;
  size: number;
  text: string;
  metaSummary: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');
  const [notebookFile, setNotebookFile] = useState<LoadedFile | null>(null);
  const [csvFile, setCsvFile] = useState<LoadedFile | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<GradeApiResponse | null>(null);
  const [editedReport, setEditedReport] = useState<GradingReport | null>(null);
  const [isModified, setIsModified] = useState(false);

  const handleLoadSample = () => {
    setError(null);
    const nbText = buildSampleNotebookText();
    const nbParsed = JSON.parse(nbText) as { cells: unknown[] };
    setNotebookFile({
      name: SAMPLE_NOTEBOOK_FILENAME,
      size: nbText.length,
      text: nbText,
      metaSummary: `${nbParsed.cells.length} notebook cells (sample)`,
    });
    setCsvFile({
      name: SAMPLE_CSV_FILENAME,
      size: SAMPLE_CSV_TEXT.length,
      text: SAMPLE_CSV_TEXT,
      metaSummary: '30 rows · 22 columns (sample)',
    });
  };

  const handleRunGrade = async () => {
    if (!notebookFile || !csvFile) return;
    setIsGrading(true);
    setError(null);

    try {
      const response = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookText: notebookFile.text,
          csvText: csvFile.text,
          notebookFilename: notebookFile.name,
          csvFilename: csvFile.name,
        }),
      });

      const payload = (await response.json()) as GradeApiResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Grading failed with status ${response.status}`);
      }

      setResult(payload);
      setEditedReport(payload.report);
      setIsModified(false);
      setActiveTab('report');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grade submission.');
    } finally {
      setIsGrading(false);
    }
  };

  const handleAdjustScore = (id: string, newScore: number) => {
    if (!editedReport) return;
    const updatedRows = editedReport.rubricScores.map((r) =>
      r.id === id ? { ...r, score: newScore } : r,
    );
    const updatedSubtotals = editedReport.partSubtotals.map((ps) => {
      const partRows = updatedRows.filter((r) => r.part === ps.part);
      return {
        ...ps,
        score: partRows.reduce((acc, r) => acc + r.score, 0),
      };
    });
    const totalScore = updatedSubtotals.reduce((acc, ps) => acc + ps.score, 0);

    setEditedReport({
      ...editedReport,
      rubricScores: updatedRows,
      partSubtotals: updatedSubtotals,
      totalScore,
    });
    setIsModified(true);
  };

  const handleResetScores = () => {
    if (!result) return;
    setEditedReport(result.report);
    setIsModified(false);
  };

  const handleExportReport = () => {
    if (!editedReport || !result) return;
    const md = formatReportAsMarkdown(
      editedReport,
      result.csvVerification,
      result.notebookAnalysis,
    );
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = editedReport.student.name.replace(/[^a-z0-9]+/gi, '_') || 'Student';
    a.href = url;
    a.download = `${safeName}_GradingReport.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        hasResult={Boolean(result && editedReport)}
        onSelectTab={setActiveTab}
        onExportReport={handleExportReport}
      />

      <main className="flex-1">
        {activeTab === 'upload' && (
          <UploadStage
            notebookFile={notebookFile}
            csvFile={csvFile}
            isGrading={isGrading}
            error={error}
            onNotebookLoaded={(f) => {
              setNotebookFile(f);
              setError(null);
            }}
            onCsvLoaded={(f) => {
              setCsvFile(f);
              setError(null);
            }}
            onLoadSample={handleLoadSample}
            onRunGrade={handleRunGrade}
          />
        )}

        {activeTab === 'report' && result && editedReport && (
          <GradingReportView
            report={editedReport}
            csvVerification={result.csvVerification}
            notebookAnalysis={result.notebookAnalysis}
            isModified={isModified}
            onAdjustScore={handleAdjustScore}
            onResetScores={handleResetScores}
          />
        )}

        {activeTab === 'stats' && result && (
          <StatisticalAuditView
            csvVerification={result.csvVerification}
            detectedM2Predictor={result.notebookAnalysis.detectedM2Predictor}
          />
        )}

        {activeTab === 'inspector' && result && (
          <NotebookInspectorView notebookAnalysis={result.notebookAnalysis} />
        )}
      </main>
    </div>
  );
}
