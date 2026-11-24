export type CheckStatus = 'pass' | 'fail' | 'warn' | 'unverified';

export interface CsvCheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface DescriptiveStat {
  variable: string;
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
}

export interface CorrelationEntry {
  var1: string;
  var2: string;
  pearson: number;
  spearman: number;
}

export interface CoefficientResult {
  term: string;
  estimate: number;
  se: number;
  tStat: number;
  pValue: number;
  ciLower: number;
  ciUpper: number;
  vif?: number;
  standardizedBeta?: number;
}

export interface DiagnosticSummary {
  shapiroW: number;
  shapiroP: number;
  breuschPaganLM: number;
  breuschPaganP: number;
  durbinWatson: number;
  cooksThreshold: number;
  flaggedCooksRows: Array<{ rowIndex: number; id: string | number | null; cooksD: number }>;
  flaggedStudentizedRows: Array<{ rowIndex: number; id: string | number | null; studentizedT: number }>;
  maxLeverage: number;
}

export interface CvSummary {
  folds: number;
  seedUsed: number;
  r2Mean: number;
  r2Sd: number;
  rmseMean: number;
  rmseSd: number;
  note: string;
}

export interface OlsModelResult {
  modelId: string;
  label: string;
  formula: string;
  n: number;
  numPredictors: number;
  r2: number;
  adjR2: number;
  fStat: number;
  fPValue: number;
  mae: number;
  rmse: number;
  aic: number; // statsmodels exact AIC: n*ln(2*pi*SSE/n) + n + 2*(p+1)
  aicSimplified: number; // n*ln(SSE/n) + 2*(p+1)
  residualSe: number;
  coefficients: CoefficientResult[];
  diagnostics: DiagnosticSummary;
  cv5Fold: CvSummary | null;
}

export interface CsvVerificationResult {
  rowCount: number;
  columnCount: number;
  columns: string[];
  checks: CsvCheckItem[];
  cronbachAlpha: {
    k: number;
    alpha: number;
    alphaPop: number;
    acceptable: boolean;
    itemVariances: Record<string, number>;
    sumVariance: number;
  } | null;
  descriptives: DescriptiveStat[];
  correlationsWithMidterm: Array<{ variable: string; pearson: number; spearman: number }>;
  highCollinearPairs: CorrelationEntry[];
  models: {
    m1: OlsModelResult | null;
    m2Candidates: OlsModelResult[];
    m3: OlsModelResult | null;
    m4: OlsModelResult | null;
    extended: OlsModelResult | null;
  };
  dummyColumns: string[];
  zeroExamRows: Array<{ rowIndex: number; id: string | number | null; prelim: number | null; midterm: number | null }>;
}

export interface NotebookCellSummary {
  index: number;
  cellType: 'code' | 'markdown' | 'raw';
  executionCount: number | null;
  source: string;
  outputsText: string;
  hasError: boolean;
  errorText: string | null;
  isTodoOnly: boolean;
  isPlaceholderOnly: boolean;
  hiddenComments: string[];
}

export interface NotebookAnalysisResult {
  totalCells: number;
  codeCells: number;
  markdownCells: number;
  executedCodeCells: number;
  executionOrderAscending: boolean;
  hasErrors: boolean;
  errorCells: number[];
  missingOutputCells: number[];
  workstationPartA: string | null;
  workstationPartG: string | null;
  workstationMismatch: boolean;
  detectedM2Predictor: string | null;
  detectedPreferredModel: string | null;
  usedRecordDataAfterPartA: boolean;
  usedForbiddenPredictor: string[];
  savedDatasetStatementPresent: boolean;
  hiddenHtmlComments: Array<{ cellIndex: number; content: string; suspicious: boolean }>;
  todoOrPlaceholderCells: number[];
  studentHeaderGuess: {
    name: string;
    section: string;
    workstation: string;
  };
  cells: NotebookCellSummary[];
}

export interface RubricLineScore {
  id: string;
  part: string;
  item: string;
  max: number;
  score: number;
  reason: string;
}

export interface PartSubtotal {
  part: string;
  label: string;
  max: number;
  score: number;
}

export interface RecomputationComparison {
  metric: string;
  recomputedValue: string;
  studentValue: string;
  status: 'match' | 'mismatch' | 'unverified';
  note: string;
}

export interface GradingReport {
  student: {
    name: string;
    section: string;
    workstationNumber: string;
  };
  verificationSummary: {
    csvOverall: 'pass' | 'partial' | 'fail';
    notebookRunsWithoutErrors: boolean;
    recomputationComparisons: RecomputationComparison[];
    summaryNote: string;
  };
  rubricScores: RubricLineScore[];
  partSubtotals: PartSubtotal[];
  totalScore: number;
  maxScore: number;
  integrityFlags: string[];
  topStrengths: string[];
  topFixes: string[];
  studentFeedback: string;
}

export interface GradeApiResponse {
  report: GradingReport;
  csvVerification: CsvVerificationResult;
  notebookAnalysis: NotebookAnalysisResult;
  gradedAt: string;
}
