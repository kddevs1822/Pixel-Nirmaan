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
}

export interface Project extends ProjectMetadata {
  nodes: any[];
}

interface ProjectState {
  projects: ProjectMetadata[];
  activeProject: Project | null;
  selectedFolder: string;
  isLoading: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  lastSavedAt: Date | null;
  isProjectModalOpen: boolean;

  openProjectModal: () => void;
  closeProjectModal: () => void;
  setSelectedFolder: (folder: string) => void;

  fetchProjects: () => Promise<void>;
  selectProject: (id: string) => Promise<boolean>;
  createProject: (name: string, folder?: string, description?: string) => Promise<Project | null>;
  updateProjectMeta: (
    id: string,
    updates: { name?: string; folder?: string; description?: string; outputPath?: string }
  ) => Promise<boolean>;
  saveCurrentProjectNodes: (nodes: any[]) => Promise<boolean>;
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

  openProjectModal: () => set({ isProjectModalOpen: true }),
  closeProjectModal: () => set({ isProjectModalOpen: false }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder }),

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
      const projectPayload = project.nodes;
      if (Array.isArray(projectPayload)) {
        useCanvasStore.getState().setNodes(projectPayload);
        useCanvasStore.getState().setStateVariables([]);
        useCanvasStore.getState().setDataSources([]);
      } else if (projectPayload && typeof projectPayload === 'object') {
        useCanvasStore.getState().setNodes((projectPayload as any).nodes || []);
        useCanvasStore.getState().setStateVariables((projectPayload as any).stateVariables || []);
        useCanvasStore.getState().setDataSources((projectPayload as any).dataSources || []);
      } else {
        useCanvasStore.getState().setNodes([]);
        useCanvasStore.getState().setStateVariables([]);
        useCanvasStore.getState().setDataSources([]);
      }

      return true;
    } catch (error) {
      console.error('Error selecting project:', error);
      set({ isLoading: false });
      return false;
    }
  },

  createProject: async (name: string, folder = 'General', description = '') => {
    try {
      const currentCanvasState = useCanvasStore.getState();
      const payload = {
        nodes: currentCanvasState.nodes || [],
        stateVariables: currentCanvasState.stateVariables || [],
        dataSources: currentCanvasState.dataSources || [],
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
    if (Array.isArray(payloadInput)) {
      finalPayload = {
        nodes: payloadInput,
        stateVariables: useCanvasStore.getState().stateVariables || [],
        dataSources: useCanvasStore.getState().dataSources || [],
      };
    } else if (!payloadInput || typeof payloadInput !== 'object') {
      finalPayload = {
        nodes: useCanvasStore.getState().nodes || [],
        stateVariables: useCanvasStore.getState().stateVariables || [],
        dataSources: useCanvasStore.getState().dataSources || [],
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
