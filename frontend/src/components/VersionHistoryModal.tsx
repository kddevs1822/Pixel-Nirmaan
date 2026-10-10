import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  Plus,
  RotateCcw,
  Trash2,
  Edit2,
  Check,
  Download,
  Clock,
  Layers,
  Box,
  AlertTriangle,
  BookmarkCheck,
  Sparkles,
} from 'lucide-react';
import {
  useProjectStore,
  getProjectNodeStats,
  type ProjectCheckpoint,
} from '../store/useProjectStore';
import { useCanvasStore } from '../store/useCanvasStore';

export const VersionHistoryModal: React.FC = () => {
  const isVersionHistoryOpen = useProjectStore((s) => s.isVersionHistoryOpen);
  const closeVersionHistory = useProjectStore((s) => s.closeVersionHistory);
  const checkpoints = useProjectStore((s) => s.checkpoints || []);
  const activeProject = useProjectStore((s) => s.activeProject);
  const createCheckpoint = useProjectStore((s) => s.createCheckpoint);
  const restoreCheckpoint = useProjectStore((s) => s.restoreCheckpoint);
  const deleteCheckpoint = useProjectStore((s) => s.deleteCheckpoint);
  const renameCheckpoint = useProjectStore((s) => s.renameCheckpoint);
  const currentNodes = useCanvasStore((s) => s.nodes || []);

  const [newCheckpointName, setNewCheckpointName] = useState('');
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [checkpointToRestore, setCheckpointToRestore] = useState<ProjectCheckpoint | null>(null);
  const [checkpointToDelete, setCheckpointToDelete] = useState<ProjectCheckpoint | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVersionHistoryOpen) {
        if (checkpointToRestore) setCheckpointToRestore(null);
        else if (checkpointToDelete) setCheckpointToDelete(null);
        else closeVersionHistory();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVersionHistoryOpen, checkpointToRestore, checkpointToDelete, closeVersionHistory]);

  if (!isVersionHistoryOpen) return null;

  const currentStats = getProjectNodeStats(currentNodes);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckpointName.trim()) return;
    await createCheckpoint(newCheckpointName.trim());
    setNewCheckpointName('');
  };

  const handleStartEdit = (cp: ProjectCheckpoint, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCheckpointId(cp.id);
    setEditName(cp.name);
  };

  const handleSaveEdit = async (cpId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    await renameCheckpoint(cpId, editName.trim());
    setEditingCheckpointId(null);
  };

  const handleDownloadSnapshot = (cp: ProjectCheckpoint, e: React.MouseEvent) => {
    e.stopPropagation();
    const exportData = {
      version: '1.0.0',
      generator: 'PixelNirmaan',
      checkpoint: {
        id: cp.id,
        name: cp.name,
        createdAt: cp.createdAt,
      },
      project: {
        name: activeProject?.name || 'Untitled Project',
        folder: activeProject?.folder || 'General',
      },
      payload: cp.payload,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const filename = `${(cp.name || 'checkpoint').toLowerCase().replace(/[^a-z0-9]/gi, '_')}.pixelnirmaan.json`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatCheckpointTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={closeVersionHistory}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-xs">
              <History size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold font-heading text-slate-800 tracking-tight flex items-center gap-2">
                <span>Version History</span>
                {activeProject && (
                  <span className="text-xs font-normal text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                    {activeProject.name}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Save milestone checkpoints, inspect past snapshots, and rollback anytime.
              </p>
            </div>
          </div>
          <button
            onClick={closeVersionHistory}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Milestone Quick Create Bar */}
        <form
          onSubmit={handleCreateSubmit}
          className="p-4 bg-indigo-50/50 border-b border-indigo-100/80 flex items-center gap-3"
        >
          <div className="relative flex-1">
            <BookmarkCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
            <input
              type="text"
              placeholder="Milestone name (e.g. Hero Section Completed, v1.0 Launch)..."
              value={newCheckpointName}
              onChange={(e) => setNewCheckpointName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
            />
          </div>
          <button
            type="submit"
            disabled={!newCheckpointName.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer hover:shadow"
          >
            <Plus size={14} />
            <span>Save Milestone</span>
          </button>
        </form>

        {/* Checkpoint Timeline List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Current Live State Card */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-800">Current Working Canvas</h4>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    LIVE
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Box size={11} className="text-slate-400" />
                    <span>{currentStats.totalElements} element{currentStats.totalElements !== 1 ? 's' : ''}</span>
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Layers size={11} className="text-slate-400" />
                    <span>{currentStats.framesCount} frame{currentStats.framesCount !== 1 ? 's' : ''}</span>
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Active state</span>
          </div>

          {/* Timeline separator */}
          <div className="relative flex items-center justify-center my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <span className="relative px-3 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Saved Checkpoints ({checkpoints.length})
            </span>
          </div>

          {/* Checkpoint Cards */}
          {checkpoints.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Clock size={22} />
              </div>
              <p className="text-sm font-semibold text-slate-700">No checkpoints saved yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Enter a milestone name above and click "Save Milestone" to snapshot your canvas state at this moment.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-100 ml-4 pl-6 space-y-4">
              {checkpoints.map((cp) => {
                const isEditing = editingCheckpointId === cp.id;
                const stats = cp.stats || getProjectNodeStats(cp.payload?.nodes);

                return (
                  <div key={cp.id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[31px] top-4 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 group-hover:scale-125 transition-transform shadow-xs" />

                    <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-3">
                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              className="px-2.5 py-1 text-xs font-semibold border border-indigo-300 rounded-lg focus:outline-none flex-1"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveEdit(cp.id, e)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                              title="Save Name"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCheckpointId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                {cp.name}
                              </h4>
                              {cp.id.includes('backup') && (
                                <span className="text-[9px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.2 rounded border border-amber-200">
                                  AUTO-BACKUP
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <Clock size={11} />
                              <span>{formatCheckpointTime(cp.createdAt)}</span>
                              <span className="opacity-50">•</span>
                              <span className="text-[10px] opacity-75">
                                {new Date(cp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        {!isEditing && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCheckpointToRestore(cp)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                              title="Rollback canvas to this checkpoint"
                            >
                              <RotateCcw size={12} />
                              <span>Restore</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadSnapshot(cp, e)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                              title="Export version snapshot as JSON"
                            >
                              <Download size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleStartEdit(cp, e)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                              title="Rename checkpoint"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCheckpointToDelete(cp)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete checkpoint"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Stats badges */}
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 font-medium border border-slate-100">
                          <Box size={10} className="text-slate-400" />
                          <span>{stats.totalElements} element{stats.totalElements !== 1 ? 's' : ''}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-indigo-50/60 text-indigo-700 font-medium border border-indigo-100/60">
                          <Layers size={10} className="text-indigo-500" />
                          <span>{stats.framesCount} frame{stats.framesCount !== 1 ? 's' : ''}</span>
                        </span>
                        {stats.componentsCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-medium border border-amber-100">
                            <Sparkles size={10} className="text-amber-500" />
                            <span>{stats.componentsCount} component{stats.componentsCount !== 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{checkpoints.length} saved milestone{checkpoints.length !== 1 ? 's' : ''} in project history</span>
          <button
            type="button"
            onClick={closeVersionHistory}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for Rollback / Restore */}
      {checkpointToRestore && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setCheckpointToRestore(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <RotateCcw size={22} />
            </div>

            <h3 className="text-lg font-bold font-heading text-slate-800 tracking-tight mb-1.5">
              Restore This Version?
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Your canvas will be restored to <span className="font-semibold text-slate-700">"{checkpointToRestore.name}"</span>.
            </p>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 text-left mb-6">
              <span className="font-bold">Safe Rollback:</span> A backup of your current working canvas will automatically be saved to your version history before restoring.
            </div>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setCheckpointToRestore(null)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = checkpointToRestore;
                  setCheckpointToRestore(null);
                  await restoreCheckpoint(target.id);
                }}
                className="flex-1 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              >
                Restore Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Delete Checkpoint */}
      {checkpointToDelete && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setCheckpointToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle size={22} />
            </div>

            <h3 className="text-lg font-bold font-heading text-slate-800 tracking-tight mb-1.5">
              Delete Milestone?
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to delete checkpoint <span className="font-semibold text-slate-700">"{checkpointToDelete.name}"</span>? This snapshot will be removed from your history.
            </p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setCheckpointToDelete(null)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = checkpointToDelete;
                  setCheckpointToDelete(null);
                  await deleteCheckpoint(target.id);
                }}
                className="flex-1 py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
