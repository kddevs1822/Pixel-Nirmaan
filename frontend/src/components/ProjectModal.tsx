import React, { useState } from 'react';
import {
  X,
  Plus,
  Folder,
  Trash2,
  Edit2,
  Check,
  Search,
  Layout,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useProjectStore, type ProjectMetadata } from '../store/useProjectStore';

export const ProjectModal: React.FC = () => {
  const isProjectModalOpen = useProjectStore((state) => state.isProjectModalOpen);
  const closeProjectModal = useProjectStore((state) => state.closeProjectModal);
  const projects = useProjectStore((state) => state.projects || []);
  const activeProject = useProjectStore((state) => state.activeProject);
  const selectProject = useProjectStore((state) => state.selectProject);
  const createProject = useProjectStore((state) => state.createProject);
  const updateProjectMeta = useProjectStore((state) => state.updateProjectMeta);
  const deleteProject = useProjectStore((state) => state.deleteProject);

  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectFolder, setNewProjectFolder] = useState('Websites');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editFolder, setEditFolder] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);

  if (!isProjectModalOpen) return null;

  // Extract unique folders safely
  const allFolders = Array.from(new Set(projects.map((p) => p.folder || 'General')));

  // Filter projects by selected folder and search safely
  const filteredProjects = projects.filter((p) => {
    const matchesFolder = selectedFolder === 'All' || (p.folder || 'General') === selectedFolder;
    const nameStr = (p.name || '').toLowerCase();
    const folderStr = (p.folder || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || nameStr.includes(q) || folderStr.includes(q);
    return matchesFolder && matchesSearch;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    await createProject(newProjectName.trim(), newProjectFolder.trim() || 'General');
    setNewProjectName('');
    setIsCreating(false);
  };

  const handleStartEdit = (p: ProjectMetadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(p.id);
    setEditName(p.name || '');
    setEditFolder(p.folder || 'General');
  };

  const handleSaveEdit = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editName.trim()) return;
    await updateProjectMeta(id, {
      name: editName.trim(),
      folder: editFolder.trim() || 'General',
    });
    setEditingProjectId(null);
  };

  const handleDeleteClick = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete({ id, name });
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    await deleteProject(projectToDelete.id);
    setProjectToDelete(null);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeProjectModal}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold font-heading text-slate-800 tracking-tight">
              Projects & Website Folders
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Switch between different website UI designs or create new project folders.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm transition-all cursor-pointer hover:opacity-95"
              style={{ backgroundColor: '#4A3AFF' }}
            >
              <Plus size={15} />
              <span>New Project</span>
            </button>
            <button
              onClick={closeProjectModal}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Inline Create Form */}
        {isCreating && (
          <form
            onSubmit={handleCreateSubmit}
            className="p-4 bg-indigo-50/60 border-b border-indigo-100 flex items-center gap-3 animate-in slide-in-from-top-2 duration-150"
          >
            <div className="flex-1">
              <input
                type="text"
                placeholder="Project Name (e.g. Portfolio Website)"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 text-sm bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="w-48">
              <input
                type="text"
                placeholder="Folder (e.g. Websites)"
                value={newProjectFolder}
                onChange={(e) => setNewProjectFolder(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={!newProjectName.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Controls: Search & Folder Chips */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
          {/* Folder tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              onClick={() => setSelectedFolder('All')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedFolder === 'All'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({projects.length})
            </button>
            {allFolders.map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFolder(f)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedFolder === f
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Folder size={12} />
                <span>{f}</span>
                <span className="text-[10px] opacity-75">
                  ({projects.filter((p) => (p.folder || 'General') === f).length})
                </span>
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative w-56 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Project Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-slate-400 flex flex-col items-center">
              <Layout size={36} className="mb-2 text-slate-300 stroke-1" />
              <p className="text-sm font-medium">No projects found</p>
              <p className="text-xs text-slate-400 mt-1">
                Click "+ New Project" to create your first design.
              </p>
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isActive = activeProject?.id === p.id;
              const isEditing = editingProjectId === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isActive && !isEditing) selectProject(p.id);
                  }}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50/20 shadow-sm ring-1 ring-indigo-500/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  {/* Card Top */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      {isEditing ? (
                        <div className="w-full flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="px-2 py-1 text-sm font-semibold border border-indigo-300 rounded focus:outline-none"
                          />
                          <input
                            type="text"
                            value={editFolder}
                            placeholder="Folder"
                            onChange={(e) => setEditFolder(e.target.value)}
                            className="px-2 py-0.5 text-xs border border-slate-200 rounded focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-800 text-sm truncate group-hover:text-indigo-600 transition-colors">
                              {p.name}
                            </h3>
                            {isActive && (
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                            <Folder size={12} className="text-slate-400" />
                            <span>{p.folder || 'General'}</span>
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        {isEditing ? (
                          <button
                            onClick={(e) => handleSaveEdit(p.id, e)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                            title="Save"
                          >
                            <Check size={16} />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={(e) => handleStartEdit(p, e)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Rename / Move Folder"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(p.id, p.name, e)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Project"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom / Footer */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock size={11} />
                      <span>Updated {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Recently'}</span>
                    </div>

                    {p.outputPath ? (
                      <span className="truncate max-w-[140px] text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                        📁 {p.outputPath.split(/[\\/]/).pop()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300">No export folder set</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{projects.length} total projects across your folders</span>
          <button
            onClick={closeProjectModal}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-white text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Custom PixelNirmaan Delete Confirmation Modal */}
      {projectToDelete && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setProjectToDelete(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 max-w-sm w-full text-center animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-bold font-heading text-slate-800 tracking-tight mb-1.5">
              Delete Project?
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-700">"{projectToDelete.name}"</span>? All canvas designs in this project will be permanently removed.
            </p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
