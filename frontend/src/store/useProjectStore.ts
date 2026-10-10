import { create } from 'zustand';
import { useCanvasStore } from './useCanvasStore';
import { useAuthStore } from './useAuthStore';

export interface ProjectMetadata {
  id: string;
  name: string;
  description?: string | null;
  folder: string;
  outputPath?: string | null;
  createdAt: string;
  updatedAt: string;
  nodes?: any;
}

export interface Project extends ProjectMetadata {
  nodes: any;
}

export interface PendingImportPayload {
  fileName: string;
  projectName: string;
  targetFolder: string;
  parsedNodes: any[];
  parsedVars: any[];
  parsedSources: any[];
  options?: { importIntoCurrent?: boolean; folder?: string };
}

export interface ProjectCheckpoint {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  stats: {
    totalElements: number;
    framesCount: number;
    componentsCount: number;
  };
  payload: {
    nodes: any[];
    stateVariables: any[];
    dataSources: any[];
  };
}

interface ProjectState {
  projects: ProjectMetadata[];
  activeProject: Project | null;
  selectedFolder: string;
  isLoading: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  lastSavedAt: Date | null;
  isProjectModalOpen: boolean;
  pendingImport: PendingImportPayload | null;
  isImportConflictModalOpen: boolean;
  checkpoints: ProjectCheckpoint[];
  isVersionHistoryOpen: boolean;

  openProjectModal: () => void;
  closeProjectModal: () => void;
  setSelectedFolder: (folder: string) => void;
  openVersionHistory: () => void;
  closeVersionHistory: () => void;

  fetchProjects: () => Promise<void>;
  selectProject: (id: string) => Promise<boolean>;
  createProject: (
    name: string,
    folder?: string,
    description?: string,
    initialPayload?: any
  ) => Promise<Project | null>;
  duplicateProject: (id: string) => Promise<Project | null>;
  exportProjectAsJson: (id: string) => Promise<boolean>;
  importProjectFromJson: (
    file: File,
    options?: { importIntoCurrent?: boolean; folder?: string }
  ) => Promise<Project | null>;
  triggerJsonImport: (options?: { importIntoCurrent?: boolean; folder?: string }) => void;
  resolvePendingImport: (action: 'replace' | 'append') => Promise<void>;
  cancelPendingImport: () => void;
  createCheckpoint: (name: string, description?: string) => Promise<ProjectCheckpoint | null>;
  restoreCheckpoint: (checkpointId: string) => Promise<boolean>;
  deleteCheckpoint: (checkpointId: string) => Promise<boolean>;
  renameCheckpoint: (checkpointId: string, newName: string) => Promise<boolean>;
  updateProjectMeta: (
    id: string,
    updates: { name?: string; folder?: string; description?: string; outputPath?: string }
  ) => Promise<boolean>;
  saveCurrentProjectNodes: (payload: any) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ACTIVE_PROJECT_KEY = 'pixelnirmaan_active_project_id';

const getAuthHeaders = () => {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || ''}`,
  };
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProject: null,
  selectedFolder: 'All',
  isLoading: false,
  saveStatus: 'saved',
  lastSavedAt: null,
  isProjectModalOpen: false,
  pendingImport: null,
  isImportConflictModalOpen: false,
  checkpoints: [],
  isVersionHistoryOpen: false,

  openProjectModal: () => set({ isProjectModalOpen: true }),
  closeProjectModal: () => set({ isProjectModalOpen: false }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),
  openVersionHistory: () => set({ isVersionHistoryOpen: true }),
  closeVersionHistory: () => set({ isVersionHistoryOpen: false }),

  fetchProjects: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    set({ isLoading: true });
    try {
      const response = await fetch(`${API_URL}/projects`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      const projects: ProjectMetadata[] = data.projects || [];
      set({ projects, isLoading: false });

      if (projects.length === 0) {
        // Auto-create initial project for new user
        await get().createProject('My First Website', 'Websites');
      } else {
        // Check if there is an active project in localStorage or load the first one
        const savedId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        const exists = projects.find((p) => p.id === savedId);
        const targetId = exists ? exists.id : projects[0].id;

        // If not already loaded or different, select it
        if (!get().activeProject || get().activeProject?.id !== targetId) {
          await get().selectProject(targetId);
        }
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      set({ isLoading: false });
    }
  },

  selectProject: async (id: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_URL}/projects/${id}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to load project');
      }

      const data = await response.json();
      const project: Project = data.project;

      set({
        activeProject: project,
        isLoading: false,
        saveStatus: 'saved',
        lastSavedAt: new Date(project.updatedAt),
        isProjectModalOpen: false,
      });

      localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);

      // If project has an outputPath, update local export path
      if (project.outputPath) {
        localStorage.setItem('pixelnirmaan-output-path', project.outputPath);
      }

      // Load nodes, stateVariables & dataSources into canvas store
      let projectPayload = project.nodes;
      if (typeof projectPayload === 'string') {
        try {
          projectPayload = JSON.parse(projectPayload);
        } catch (e) {
          console.error('Error parsing stringified project payload:', e);
        }
      }

      if (Array.isArray(projectPayload)) {
        useCanvasStore.getState().setNodes(projectPayload);
        useCanvasStore.getState().setStateVariables([]);
        useCanvasStore.getState().setDataSources([]);
        set({ checkpoints: [] });
      } else if (projectPayload && typeof projectPayload === 'object') {
        useCanvasStore.getState().setNodes((projectPayload as any).nodes || []);
        useCanvasStore.getState().setStateVariables((projectPayload as any).stateVariables || []);
        useCanvasStore.getState().setDataSources((projectPayload as any).dataSources || []);
        set({ checkpoints: Array.isArray((projectPayload as any).checkpoints) ? (projectPayload as any).checkpoints : [] });
      } else {
        useCanvasStore.getState().setNodes([]);
        useCanvasStore.getState().setStateVariables([]);
        useCanvasStore.getState().setDataSources([]);
        set({ checkpoints: [] });
      }

      // Reset selection and undo/redo stacks for fresh project canvas and close modal
      useCanvasStore.setState({ selectedIds: [], past: [], future: [] });
      set({ isProjectModalOpen: false });

      return true;
    } catch (error) {
      console.error('Error selecting project:', error);
      set({ isLoading: false });
      return false;
    }
  },

  createProject: async (
    name: string,
    folder = 'General',
    description = '',
    initialPayload?: any
  ) => {
    try {
      const payload = initialPayload !== undefined ? initialPayload : {
        nodes: [],
        stateVariables: [],
        dataSources: [],
      };

      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          folder: folder.trim() || 'General',
          description: description.trim() || null,
          nodes: payload,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const data = await response.json();
      const newProject: Project = data.project;

      set((state) => ({
        projects: [newProject, ...state.projects],
      }));

      // Automatically switch to the newly created project
      await get().selectProject(newProject.id);

      useCanvasStore.getState().setToastMessage(`Project "${newProject.name}" created!`);
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      return null;
    }
  },

  updateProjectMeta: async (id, updates) => {
    try {
      const response = await fetch(`${API_URL}/projects/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update project metadata');
      }

      set((state) => {
        const updatedProjects = state.projects.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        );
        const updatedActive =
          state.activeProject && state.activeProject.id === id
            ? { ...state.activeProject, ...updates }
            : state.activeProject;

        return {
          projects: updatedProjects,
          activeProject: updatedActive,
        };
      });

      // Update localStorage outputPath if modified
      if (updates.outputPath !== undefined) {
        localStorage.setItem('pixelnirmaan-output-path', updates.outputPath);
      }

      return true;
    } catch (error) {
      console.error('Error updating project:', error);
      return false;
    }
  },

  saveCurrentProjectNodes: async (payloadInput: any) => {
    const activeProject = get().activeProject;
    set({ saveStatus: 'saving' });

    let finalPayload = payloadInput;
    const currentCheckpoints = get().checkpoints || [];
    if (Array.isArray(payloadInput)) {
      finalPayload = {
        nodes: payloadInput,
        stateVariables: useCanvasStore.getState().stateVariables || [],
        dataSources: useCanvasStore.getState().dataSources || [],
        checkpoints: currentCheckpoints,
      };
    } else if (!payloadInput || typeof payloadInput !== 'object') {
      finalPayload = {
        nodes: useCanvasStore.getState().nodes || [],
        stateVariables: useCanvasStore.getState().stateVariables || [],
        dataSources: useCanvasStore.getState().dataSources || [],
        checkpoints: currentCheckpoints,
      };
    } else {
      finalPayload = {
        nodes: payloadInput.nodes !== undefined ? payloadInput.nodes : (useCanvasStore.getState().nodes || []),
        stateVariables:
          payloadInput.stateVariables !== undefined
            ? payloadInput.stateVariables
            : (useCanvasStore.getState().stateVariables || []),
        dataSources:
          payloadInput.dataSources !== undefined
            ? payloadInput.dataSources
            : (useCanvasStore.getState().dataSources || []),
        checkpoints: payloadInput.checkpoints !== undefined ? payloadInput.checkpoints : currentCheckpoints,
      };
    }

    if (!activeProject) {
      // Offline / Guest Mode -> save to localStorage
      try {
        localStorage.setItem('pixelnirmaan_guest_project', JSON.stringify(finalPayload));
        const now = new Date();
        set({ saveStatus: 'saved', lastSavedAt: now });
        return true;
      } catch (err) {
        console.error('Guest save error:', err);
        set({ saveStatus: 'error' });
        return false;
      }
    }

    try {
      const response = await fetch(`${API_URL}/projects/${activeProject.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nodes: finalPayload }),
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      const now = new Date();
      set((state) => ({
        saveStatus: 'saved',
        lastSavedAt: now,
        activeProject: state.activeProject
          ? { ...state.activeProject, nodes: finalPayload, updatedAt: now.toISOString() }
          : null,
      }));

      return true;
    } catch (error) {
      console.error('Error saving project state:', error);
      set({ saveStatus: 'error' });
      return false;
    }
  },

  duplicateProject: async (id: string) => {
    set({ isLoading: true });
    try {
      const state = get();
      let targetProject = state.projects.find((p) => p.id === id);
      let nodesPayload = targetProject?.nodes;

      if (!nodesPayload) {
        const response = await fetch(`${API_URL}/projects/${id}`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          targetProject = data.project;
          nodesPayload = data.project?.nodes;
        }
      }

      const baseName = targetProject?.name || 'Cloned Project';
      const newName = `${baseName} (Copy)`;
      const folder = targetProject?.folder || 'General';
      const description = targetProject?.description || null;

      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newName,
          folder,
          description,
          nodes: nodesPayload || [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate project');
      }

      const data = await response.json();
      const newProject: Project = data.project;

      set((s) => ({
        projects: [newProject, ...s.projects],
        isLoading: false,
      }));

      useCanvasStore.getState().setToastMessage(`Project "${newProject.name}" duplicated!`);
      return newProject;
    } catch (error) {
      console.error('Error duplicating project:', error);
      set({ isLoading: false });
      return null;
    }
  },

  exportProjectAsJson: async (id: string) => {
    try {
      const state = get();
      let project = state.projects.find((p) => p.id === id);
      let nodesPayload = project?.nodes;

      if (state.activeProject?.id === id) {
        nodesPayload = {
          nodes: useCanvasStore.getState().nodes || [],
          stateVariables: useCanvasStore.getState().stateVariables || [],
          dataSources: useCanvasStore.getState().dataSources || [],
        };
      } else if (!nodesPayload) {
        const response = await fetch(`${API_URL}/projects/${id}`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          project = data.project;
          nodesPayload = data.project?.nodes;
        }
      }

      const exportData = {
        version: '1.0.0',
        generator: 'PixelNirmaan',
        exportedAt: new Date().toISOString(),
        project: {
          id: project?.id,
          name: project?.name || 'Untitled Project',
          folder: project?.folder || 'General',
          description: project?.description || '',
        },
        payload: nodesPayload || { nodes: [], stateVariables: [], dataSources: [] },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const filename = `${(project?.name || 'project')
        .toLowerCase()
        .replace(/[^a-z0-9]/gi, '_')}.pixelnirmaan.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      useCanvasStore.getState().setToastMessage(`Exported "${project?.name}" as JSON!`);
      return true;
    } catch (error) {
      console.error('Error exporting project:', error);
      return false;
    }
  },

  importProjectFromJson: async (
    file: File,
    options?: { importIntoCurrent?: boolean; folder?: string }
  ) => {
    set({ isLoading: true });
    try {
      const text = await file.text();
      let json = JSON.parse(text);

      if (typeof json === 'string') {
        try {
          json = JSON.parse(json);
        } catch (_) {}
      }

      let name = file.name.replace(/\.(pixelnirmaan\.json|json)$/i, '');
      let description = 'Imported from JSON file';
      let nodesPayload: any = { nodes: [], stateVariables: [], dataSources: [] };

      // Determine folder priority:
      // 1. Explicit options.folder (if !== 'All')
      // 2. Selected folder in store (if !== 'All')
      // 3. Folder specified inside json
      // 4. Current active project folder
      // 5. Default 'Websites'
      const storeSelectedFolder = get().selectedFolder;
      let targetFolder = 'Websites';

      if (options?.folder && options.folder !== 'All') {
        targetFolder = options.folder;
      } else if (storeSelectedFolder && storeSelectedFolder !== 'All') {
        targetFolder = storeSelectedFolder;
      } else if (json.project?.folder) {
        targetFolder = json.project.folder;
      } else if (json.folder) {
        targetFolder = json.folder;
      } else if (get().activeProject?.folder) {
        targetFolder = get().activeProject!.folder;
      }

      if (json && typeof json === 'object') {
        if (json.project?.name) name = json.project.name + ' (Imported)';
        else if (json.name) name = json.name + ' (Imported)';

        if (json.project?.description) description = json.project.description;
        else if (json.description) description = json.description;

        if (json.payload) {
          nodesPayload = json.payload;
        } else if (json.nodes) {
          nodesPayload = {
            nodes: Array.isArray(json.nodes) ? json.nodes : json.nodes.nodes || [],
            stateVariables: json.stateVariables || json.nodes?.stateVariables || [],
            dataSources: json.dataSources || json.nodes?.dataSources || [],
          };
        } else if (Array.isArray(json.elements)) {
          nodesPayload = {
            nodes: json.elements,
            stateVariables: json.stateVariables || [],
            dataSources: json.dataSources || [],
          };
        } else if (Array.isArray(json.canvas)) {
          nodesPayload = {
            nodes: json.canvas,
            stateVariables: json.stateVariables || [],
            dataSources: json.dataSources || [],
          };
        } else if (Array.isArray(json)) {
          nodesPayload = {
            nodes: json,
            stateVariables: [],
            dataSources: [],
          };
        }
      }

      // 1. Extract nodes, vars, sources
      const parsedNodes = Array.isArray(nodesPayload)
        ? nodesPayload
        : Array.isArray(nodesPayload?.nodes)
        ? nodesPayload.nodes
        : Array.isArray(json?.nodes)
        ? json.nodes
        : [];

      const parsedVars = Array.isArray(nodesPayload?.stateVariables)
        ? nodesPayload.stateVariables
        : Array.isArray(json?.stateVariables)
        ? json.stateVariables
        : Array.isArray(json?.payload?.stateVariables)
        ? json.payload.stateVariables
        : [];

      const parsedSources = Array.isArray(nodesPayload?.dataSources)
        ? nodesPayload.dataSources
        : Array.isArray(json?.dataSources)
        ? json.dataSources
        : Array.isArray(json?.payload?.dataSources)
        ? json.payload.dataSources
        : [];

      const isCurrentCanvas = !!options?.importIntoCurrent || (!options?.folder && !get().isProjectModalOpen);
      const currentNodes = useCanvasStore.getState().nodes || [];

      // If user requested to import into current canvas and canvas already has elements:
      if (isCurrentCanvas && currentNodes.length > 0) {
        set({
          pendingImport: {
            fileName: file.name,
            projectName: name,
            targetFolder,
            parsedNodes,
            parsedVars,
            parsedSources,
            options,
          },
          isImportConflictModalOpen: true,
          isProjectModalOpen: false,
          isLoading: false,
        });
        return get().activeProject;
      }

      // If importing into current empty canvas:
      if (isCurrentCanvas) {
        useCanvasStore.getState().setNodes(parsedNodes);
        useCanvasStore.getState().setStateVariables(parsedVars);
        useCanvasStore.getState().setDataSources(parsedSources);
        useCanvasStore.setState({ selectedIds: [], past: [], future: [] });

        set({ isProjectModalOpen: false, isLoading: false });

        const activeProject = get().activeProject;
        if (activeProject) {
          await get().saveCurrentProjectNodes({
            nodes: parsedNodes,
            stateVariables: parsedVars,
            dataSources: parsedSources,
          });
          useCanvasStore
            .getState()
            .setToastMessage(`Imported design into "${activeProject.name}" (${parsedNodes.length} elements)!`);
          return activeProject;
        } else {
          localStorage.setItem(
            'pixelnirmaan_guest_project',
            JSON.stringify({
              nodes: parsedNodes,
              stateVariables: parsedVars,
              dataSources: parsedSources,
            })
          );
          useCanvasStore
            .getState()
            .setToastMessage(`Imported design (${parsedNodes.length} elements)!`);
          return null;
        }
      }

      // Otherwise, create a new project inside targetFolder (e.g. from Projects Modal)
      useCanvasStore.getState().setNodes(parsedNodes);
      useCanvasStore.getState().setStateVariables(parsedVars);
      useCanvasStore.getState().setDataSources(parsedSources);
      useCanvasStore.setState({ selectedIds: [], past: [], future: [] });

      set({ isProjectModalOpen: false, isLoading: false });

      const user = useAuthStore.getState().user;
      const guestId = `import_${Date.now()}`;
      let createdProject: Project = {
        id: guestId,
        name,
        description,
        folder: targetFolder,
        outputPath: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: nodesPayload,
      };

      if (user) {
        try {
          const response = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              name,
              folder: targetFolder,
              description,
              nodes: nodesPayload,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.project) {
              createdProject = data.project;
              localStorage.setItem(ACTIVE_PROJECT_KEY, createdProject.id);
            }
          }
        } catch (serverErr) {
          console.warn('Backend import sync failed, saving locally:', serverErr);
        }
      } else {
        localStorage.setItem('pixelnirmaan_guest_project', JSON.stringify(nodesPayload));
      }

      set((s) => ({
        projects: [createdProject, ...s.projects.filter((p) => p.id !== createdProject.id)],
        activeProject: createdProject,
        selectedFolder: targetFolder,
        isLoading: false,
        saveStatus: 'saved',
        lastSavedAt: new Date(),
      }));

      useCanvasStore
        .getState()
        .setToastMessage(`Project "${name}" imported into "${targetFolder}" (${parsedNodes.length} elements)!`);
      return createdProject;
    } catch (error) {
      console.error('Error importing project:', error);
      set({ isLoading: false });
      useCanvasStore.getState().setToastMessage('Failed to import JSON file. Please check file format.');
      return null;
    }
  },

  resolvePendingImport: async (action: 'replace' | 'append') => {
    const pending = get().pendingImport;
    if (!pending) return;

    const currentNodes = useCanvasStore.getState().nodes || [];
    const currentVars = useCanvasStore.getState().stateVariables || [];
    const currentSources = useCanvasStore.getState().dataSources || [];

    if (action === 'replace') {
      useCanvasStore.getState().setNodes(pending.parsedNodes);
      useCanvasStore.getState().setStateVariables(pending.parsedVars);
      useCanvasStore.getState().setDataSources(pending.parsedSources);
      useCanvasStore.setState({ selectedIds: [], past: [], future: [] });

      await get().saveCurrentProjectNodes({
        nodes: pending.parsedNodes,
        stateVariables: pending.parsedVars,
        dataSources: pending.parsedSources,
      });

      useCanvasStore
        .getState()
        .setToastMessage(`Replaced canvas with ${pending.parsedNodes.length} imported elements!`);
    } else {
      // action === 'append': keep existing and add new alongside them
      const existingIdSet = new Set(currentNodes.map((n) => n.id));
      const idMap = new Map<string, string>();

      // Remap any colliding IDs
      pending.parsedNodes.forEach((n) => {
        if (existingIdSet.has(n.id)) {
          idMap.set(n.id, `node_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
        }
      });

      // Calculate layout positioning offset so imported elements are placed next to existing ones without overlapping
      const existingRootNodes = currentNodes.filter((n) => !n.parentId);
      const importedRootNodes = pending.parsedNodes.filter((n) => !n.parentId);

      let offsetX = 0;
      let offsetY = 0;

      if (existingRootNodes.length > 0 && importedRootNodes.length > 0) {
        const getNodeRight = (n: any) => {
          const w =
            typeof n.width === 'number' && n.width > 0
              ? n.width * (n.scaleX || 1)
              : typeof n.radius === 'number' && n.radius > 0
              ? n.radius * 2 * (n.scaleX || 1)
              : 120;
          return (n.x || 0) + w;
        };

        const maxExistingRight = Math.max(...existingRootNodes.map(getNodeRight));
        const minExistingTop = Math.min(...existingRootNodes.map((n) => n.y || 0));

        const minImportedLeft = Math.min(...importedRootNodes.map((n) => n.x || 0));
        const minImportedTop = Math.min(...importedRootNodes.map((n) => n.y || 0));

        // Place imported elements to the right of the rightmost existing element with a clean 100px gap
        const GAP = 100;
        offsetX = maxExistingRight + GAP - minImportedLeft;
        // Align top of imported elements with top of existing canvas
        offsetY = minExistingTop - minImportedTop;
      }

      const mappedImportedNodes = pending.parsedNodes.map((node) => {
        const newId = idMap.get(node.id) || node.id;
        const newParentId = node.parentId ? idMap.get(node.parentId) || node.parentId : undefined;
        const newVariantOf = node.variantOf ? idMap.get(node.variantOf) || node.variantOf : undefined;
        const newLinkTo = node.linkTo ? idMap.get(node.linkTo) || node.linkTo : undefined;
        const newAnimation = node.animation
          ? {
              ...node.animation,
              triggerNodeId: node.animation.triggerNodeId
                ? idMap.get(node.animation.triggerNodeId) || node.animation.triggerNodeId
                : undefined,
            }
          : undefined;

        // Shift root elements by offsetX and offsetY so they don't overlap with existing elements
        // (Children with parentId are positioned relative to their parent frame, so they automatically follow the frame)
        const isRoot = !node.parentId;
        const newX = isRoot ? (node.x || 0) + offsetX : node.x;
        const newY = isRoot ? (node.y || 0) + offsetY : node.y;

        return {
          ...node,
          id: newId,
          x: newX,
          y: newY,
          parentId: newParentId,
          variantOf: newVariantOf,
          linkTo: newLinkTo,
          animation: newAnimation,
        };
      });

      const mergedNodes = [...currentNodes, ...mappedImportedNodes];

      // Merge state variables
      const existingVarNames = new Set(currentVars.map((v) => v.name));
      const mergedVars = [...currentVars];
      pending.parsedVars.forEach((v) => {
        if (!existingVarNames.has(v.name)) {
          mergedVars.push(v);
          existingVarNames.add(v.name);
        }
      });

      // Merge data sources
      const existingSourceIds = new Set(currentSources.map((s) => s.id));
      const mergedSources = [...currentSources];
      pending.parsedSources.forEach((s) => {
        if (!existingSourceIds.has(s.id)) {
          mergedSources.push(s);
          existingSourceIds.add(s.id);
        }
      });

      useCanvasStore.getState().setNodes(mergedNodes);
      useCanvasStore.getState().setStateVariables(mergedVars);
      useCanvasStore.getState().setDataSources(mergedSources);

      // Select newly imported root nodes
      const importedRootIds = mappedImportedNodes.filter((n) => !n.parentId).map((n) => n.id);
      if (importedRootIds.length > 0) {
        useCanvasStore.setState({ selectedIds: importedRootIds });
      }

      await get().saveCurrentProjectNodes({
        nodes: mergedNodes,
        stateVariables: mergedVars,
        dataSources: mergedSources,
      });

      useCanvasStore
        .getState()
        .setToastMessage(`Added ${mappedImportedNodes.length} imported elements to canvas (${mergedNodes.length} total)!`);
    }

    set({
      pendingImport: null,
      isImportConflictModalOpen: false,
    });
  },

  cancelPendingImport: () => {
    set({
      pendingImport: null,
      isImportConflictModalOpen: false,
    });
    useCanvasStore.getState().setToastMessage('Import cancelled.');
  },

  createCheckpoint: async (name: string, description?: string) => {
    const currentNodes = useCanvasStore.getState().nodes || [];
    const currentVars = useCanvasStore.getState().stateVariables || [];
    const currentSources = useCanvasStore.getState().dataSources || [];

    const stats = getProjectNodeStats(currentNodes);
    const newCheckpoint: ProjectCheckpoint = {
      id: `cp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim() || `Milestone ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      description: description?.trim() || undefined,
      createdAt: new Date().toISOString(),
      stats,
      payload: {
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        stateVariables: JSON.parse(JSON.stringify(currentVars)),
        dataSources: JSON.parse(JSON.stringify(currentSources)),
      },
    };

    const updatedCheckpoints = [newCheckpoint, ...(get().checkpoints || [])].slice(0, 50);
    set({ checkpoints: updatedCheckpoints });

    await get().saveCurrentProjectNodes({
      nodes: currentNodes,
      stateVariables: currentVars,
      dataSources: currentSources,
      checkpoints: updatedCheckpoints,
    });

    useCanvasStore.getState().setToastMessage(`Saved milestone "${newCheckpoint.name}"!`);
    return newCheckpoint;
  },

  restoreCheckpoint: async (checkpointId: string) => {
    const checkpoint = (get().checkpoints || []).find((cp) => cp.id === checkpointId);
    if (!checkpoint) return false;

    const currentNodes = useCanvasStore.getState().nodes || [];
    const currentVars = useCanvasStore.getState().stateVariables || [];
    const currentSources = useCanvasStore.getState().dataSources || [];

    // Safety backup of current working state before rollback
    const backupStats = getProjectNodeStats(currentNodes);
    const backupCheckpoint: ProjectCheckpoint = {
      id: `cp_${Date.now()}_backup`,
      name: `Backup before restoring "${checkpoint.name}"`,
      createdAt: new Date().toISOString(),
      stats: backupStats,
      payload: {
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        stateVariables: JSON.parse(JSON.stringify(currentVars)),
        dataSources: JSON.parse(JSON.stringify(currentSources)),
      },
    };

    const updatedCheckpoints = [backupCheckpoint, ...(get().checkpoints || [])].slice(0, 50);

    // Apply checkpoint payload to canvas store
    useCanvasStore.getState().setNodes(checkpoint.payload.nodes || []);
    useCanvasStore.getState().setStateVariables(checkpoint.payload.stateVariables || []);
    useCanvasStore.getState().setDataSources(checkpoint.payload.dataSources || []);
    useCanvasStore.setState({ selectedIds: [], past: [], future: [] });

    set({ checkpoints: updatedCheckpoints, isVersionHistoryOpen: false });

    await get().saveCurrentProjectNodes({
      nodes: checkpoint.payload.nodes || [],
      stateVariables: checkpoint.payload.stateVariables || [],
      dataSources: checkpoint.payload.dataSources || [],
      checkpoints: updatedCheckpoints,
    });

    useCanvasStore
      .getState()
      .setToastMessage(`Restored canvas to version "${checkpoint.name}"!`);
    return true;
  },

  deleteCheckpoint: async (checkpointId: string) => {
    const updatedCheckpoints = (get().checkpoints || []).filter((cp) => cp.id !== checkpointId);
    set({ checkpoints: updatedCheckpoints });

    await get().saveCurrentProjectNodes({
      checkpoints: updatedCheckpoints,
    });

    useCanvasStore.getState().setToastMessage('Checkpoint deleted.');
    return true;
  },

  renameCheckpoint: async (checkpointId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    const updatedCheckpoints = (get().checkpoints || []).map((cp) =>
      cp.id === checkpointId ? { ...cp, name: trimmed } : cp
    );
    set({ checkpoints: updatedCheckpoints });

    await get().saveCurrentProjectNodes({
      checkpoints: updatedCheckpoints,
    });

    useCanvasStore.getState().setToastMessage(`Checkpoint renamed to "${trimmed}".`);
    return true;
  },

  triggerJsonImport: (options?: { importIntoCurrent?: boolean; folder?: string }) => {
    const input = document.getElementById('pixelnirmaan-global-json-import-input') as HTMLInputElement;
    if (input) {
      input.dataset.importIntoCurrent = options?.importIntoCurrent ? 'true' : 'false';
      input.dataset.folder = options?.folder || '';
      input.value = '';
      input.click();
    }
  },

  deleteProject: async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/projects/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      const remainingProjects = get().projects.filter((p) => p.id !== id);
      set({ projects: remainingProjects });

      // If active project was deleted, switch to another or create new
      if (get().activeProject?.id === id) {
        if (remainingProjects.length > 0) {
          await get().selectProject(remainingProjects[0].id);
        } else {
          await get().createProject('My First Website', 'Websites');
        }
      }

      useCanvasStore.getState().setToastMessage('Project deleted.');
      return true;
    } catch (error) {
      console.error('Error deleting project:', error);
      return false;
    }
  },
}));

export const getProjectNodeStats = (nodesPayload: any) => {
  let nodes: any[] = [];
  if (Array.isArray(nodesPayload)) {
    nodes = nodesPayload;
  } else if (nodesPayload && typeof nodesPayload === 'object' && Array.isArray(nodesPayload.nodes)) {
    nodes = nodesPayload.nodes;
  }

  let totalElements = 0;
  let framesCount = 0;
  let componentsCount = 0;

  const traverse = (items: any[]) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      totalElements++;
      if (item.type === 'frame' || item.type === 'artboard') framesCount++;
      if (item.type === 'component' || item.isComponent || item.componentId) componentsCount++;
      if (Array.isArray(item.children)) {
        traverse(item.children);
      }
    }
  };

  traverse(nodes);

  return { totalElements, framesCount, componentsCount };
};
