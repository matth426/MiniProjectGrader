import type {
  CsvVerificationResult,
  GradingReport,
  NotebookAnalysisResult,
} from '../types/grading.ts';

export function formatReportAsMarkdown(
  report: GradingReport,
  csvVerification: CsvVerificationResult,
  notebookAnalysis: NotebookAnalysisResult,
): string {
  const lines: string[] = [];

  lines.push(`# IT365 Mini Project Grading Report`);
  lines.push('');
  lines.push(
    `1. **Student:** ${report.student.name} | Section: ${report.student.section} | Workstation #: ${report.student.workstationNumber}`,
  );
  lines.push('');

  lines.push(`2. **Verification summary:**`);
  lines.push(`   - **CSV checks (${report.verificationSummary.csvOverall.toUpperCase()}):**`);
  for (const c of csvVerification.checks) {
    lines.push(`     - [${c.status.toUpperCase()}] ${c.label}: ${c.detail}`);
  }
  lines.push(`   - **Recomputation results:**`);
  if (report.verificationSummary.recomputationComparisons.length === 0) {
    lines.push(`     - Unverified: no quantitative comparisons extracted.`);
  } else {
    for (const rc of report.verificationSummary.recomputationComparisons) {
      lines.push(
        `     - [${rc.status.toUpperCase()}] ${rc.metric}: Recomputed = ${rc.recomputedValue} | Student = ${rc.studentValue} (${rc.note})`,
      );
    }
  }
  lines.push(
    `   - **Notebook runs without errors:** ${
      report.verificationSummary.notebookRunsWithoutErrors ? 'Yes' : 'No'
    } (Executed ${notebookAnalysis.executedCodeCells}/${notebookAnalysis.codeCells} code cells; ascending order: ${
      notebookAnalysis.executionOrderAscending ? 'Yes' : 'No'
    })`,
  );
  lines.push('');

  lines.push(`3. **Score table:**`);
  lines.push(`| Part/Item | Max | Score | 1-line reason |`);
  lines.push(`|---|---:|---:|---|`);
  for (const r of report.rubricScores) {
    const cleanReason = r.reason.replace(/\|/g, '/').replace(/\r?\n/g, ' ');
    lines.push(`| **${r.id}** (${r.part}): ${r.item} | ${r.max} | ${r.score} | ${cleanReason} |`);
  }
  lines.push('');

  lines.push(`4. **Part subtotals and TOTAL /100:**`);
  for (const ps of report.partSubtotals) {
    lines.push(`   - **${ps.part} (${ps.label}):** ${ps.score} / ${ps.max}`);
  }
  lines.push(`   - **TOTAL:** **${report.totalScore} / ${report.maxScore}**`);
  lines.push('');

  lines.push(`5. **Integrity / consistency flags:**`);
  if (report.integrityFlags.length === 0) {
    lines.push(`   - None`);
  } else {
    for (const f of report.integrityFlags) {
      lines.push(`   - ${f}`);
    }
  }
  lines.push('');

  lines.push(`6. **Top 3 strengths and Top 3 fixes:**`);
  lines.push(`   - **Top 3 strengths:**`);
  report.topStrengths.forEach((s, i) => {
    lines.push(`     ${i + 1}. ${s}`);
  });
  lines.push(`   - **Top 3 fixes:**`);
  report.topFixes.forEach((f, i) => {
    lines.push(`     ${i + 1}. ${f}`);
  });
  lines.push('');

  lines.push(`7. **Student-facing feedback:**`);
  lines.push(`   ${report.studentFeedback}`);

  return lines.join('\n');
}
