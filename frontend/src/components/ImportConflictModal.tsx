import React, { useEffect } from 'react';
import {
  Upload,
  PlusCircle,
  RefreshCw,
  X,
  Layers,
  FileCode,
  AlertTriangle,
} from 'lucide-react';
import { useProjectStore, getProjectNodeStats } from '../store/useProjectStore';
import { useCanvasStore } from '../store/useCanvasStore';

export const ImportConflictModal: React.FC = () => {
  const isImportConflictModalOpen = useProjectStore((s) => s.isImportConflictModalOpen);
  const pendingImport = useProjectStore((s) => s.pendingImport);
  const resolvePendingImport = useProjectStore((s) => s.resolvePendingImport);
  const cancelPendingImport = useProjectStore((s) => s.cancelPendingImport);
  const currentNodes = useCanvasStore((s) => s.nodes || []);

  // Keyboard shortcut: Esc to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isImportConflictModalOpen) {
        cancelPendingImport();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImportConflictModalOpen, cancelPendingImport]);

  if (!isImportConflictModalOpen || !pendingImport) return null;

  const currentStats = getProjectNodeStats(currentNodes);
  const importedStats = getProjectNodeStats(pendingImport.parsedNodes);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={cancelPendingImport}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Upload size={17} />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-slate-800 tracking-tight">
                Import JSON to Canvas
              </h3>
              <p className="text-[11px] text-slate-500">
                Choose how to import elements into your existing canvas
              </p>
            </div>
          </div>
          <button
            onClick={cancelPendingImport}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            title="Cancel (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content & Info Summary */}
        <div className="p-6">
          {/* Status banner */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 mb-5 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={15} />
            </div>
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-semibold">Your canvas already contains elements.</span>
              <p className="text-amber-800/90 mt-0.5">
                Would you like to remove the previous elements, or add the elements from the JSON file to the canvas along with the existing elements?
              </p>
            </div>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                <Layers size={13} className="text-slate-400" />
                <span>Existing Canvas</span>
              </div>
              <div className="text-base font-bold text-slate-800">
                {currentStats.totalElements} <span className="text-xs font-normal text-slate-500">elements</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {currentStats.framesCount} frame{currentStats.framesCount !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider mb-1">
                <FileCode size={13} className="text-indigo-500" />
                <span>Imported File</span>
              </div>
              <div className="text-base font-bold text-indigo-900 truncate" title={pendingImport.fileName}>
                {importedStats.totalElements} <span className="text-xs font-normal text-indigo-600">elements</span>
              </div>
              <div className="text-[11px] text-indigo-700/80 truncate mt-0.5" title={pendingImport.fileName}>
                {importedStats.framesCount} frame{importedStats.framesCount !== 1 ? 's' : ''} • {pendingImport.fileName}
              </div>
            </div>
          </div>

          {/* Action Choice Buttons */}
          <div className="flex flex-col gap-3">
            {/* Option A: Add / Merge */}
            <button
              type="button"
              onClick={() => resolvePendingImport('append')}
              className="group p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-400 transition-all text-left flex items-start gap-3.5 cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <PlusCircle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-indigo-950">
                    Add to Canvas (Keep Existing)
                  </span>
                  <span className="text-[10px] bg-indigo-200/70 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-indigo-800/80 mt-1 leading-relaxed">
                  Keep all {currentStats.totalElements} existing elements and place the {importedStats.totalElements} imported elements alongside them without overlapping.
                </p>
              </div>
            </button>

            {/* Option B: Replace / Remove */}
            <button
              type="button"
              onClick={() => resolvePendingImport('replace')}
              className="group p-4 rounded-xl border border-slate-200 bg-white hover:bg-red-50/30 hover:border-red-300 transition-all text-left flex items-start gap-3.5 cursor-pointer shadow-xs hover:shadow-md"
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <RefreshCw size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-slate-800 group-hover:text-red-900 transition-colors">
                  Replace Existing Canvas (Remove Previous)
                </div>
                <p className="text-xs text-slate-500 group-hover:text-red-700/80 mt-1 leading-relaxed transition-colors">
                  Clear all previous elements and load only the {importedStats.totalElements} elements from the JSON file.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Esc</kbd> to cancel
          </span>
          <button
            type="button"
            onClick={cancelPendingImport}
            className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
