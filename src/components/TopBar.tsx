import type { FC } from 'react';
import { Download } from 'lucide-react';

export type ActiveTab = 'upload' | 'report' | 'stats' | 'inspector';

interface TopBarProps {
  activeTab: ActiveTab;
  hasResult: boolean;
  onSelectTab: (tab: ActiveTab) => void;
  onExportReport: () => void;
}

export const TopBar: FC<TopBarProps> = ({
  activeTab,
  hasResult,
  onSelectTab,
  onExportReport,
}) => {
  const navItems: Array<{ id: ActiveTab; label: string; requiresResult: boolean }> = [
    { id: 'upload', label: 'Submission', requiresResult: false },
    { id: 'report', label: 'Grading Report', requiresResult: true },
    { id: 'stats', label: 'Statistical Audit', requiresResult: true },
    { id: 'inspector', label: 'Notebook Inspector', requiresResult: true },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-6 py-3.5">
        <button
          type="button"
          onClick={() => onSelectTab('upload')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
        >
          IT365 Regression Grader
        </button>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const disabled = item.requiresResult && !hasResult;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectTab(item.id)}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'border-blue-700 text-slate-900 font-semibold'
                    : disabled
                      ? 'border-transparent text-slate-300 cursor-not-allowed'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          {hasResult ? (
            <button
              type="button"
              onClick={onExportReport}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export Report
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab('upload')}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              Upload Files
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-6 py-2 text-xs font-medium">
        {navItems.map((item) => {
          const disabled = item.requiresResult && !hasResult;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectTab(item.id)}
              className={`py-1 border-b-2 whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-blue-700 text-slate-900 font-semibold'
                  : disabled
                    ? 'border-transparent text-slate-300'
                    : 'border-transparent text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
