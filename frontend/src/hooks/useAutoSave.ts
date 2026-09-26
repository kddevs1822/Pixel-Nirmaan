import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';

export const useAutoSave = () => {
  const nodes = useCanvasStore((state) => state.nodes);
  const stateVariables = useCanvasStore((state) => state.stateVariables);
  const activeProject = useProjectStore((state) => state.activeProject);
  const saveCurrentProjectNodes = useProjectStore((state) => state.saveCurrentProjectNodes);
  const user = useAuthStore((state) => state.user);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);
  const lastSavedJson = useRef<string>('');

  // Update lastSavedJson whenever a new project is loaded
  useEffect(() => {
    if (activeProject) {
      lastSavedJson.current = JSON.stringify(activeProject.nodes || []);
      isInitialMount.current = true;
    }
  }, [activeProject?.id]);

  // Debounced auto-save on node or state variable changes
  useEffect(() => {
    if (!user || !activeProject) return;

    // Skip saving on initial project load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const payload = { nodes, stateVariables };
    const currentJson = JSON.stringify(payload);
    if (currentJson === lastSavedJson.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      const success = await saveCurrentProjectNodes(payload as any);
      if (success) {
        lastSavedJson.current = currentJson;
      }
    }, 1500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [nodes, stateVariables, activeProject?.id, user, saveCurrentProjectNodes]);

  // Manual save with Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && e.key === 's') {
        e.preventDefault();
        if (user && activeProject) {
          const payload = { nodes, stateVariables };
          saveCurrentProjectNodes(payload as any);
          lastSavedJson.current = JSON.stringify(payload);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, stateVariables, activeProject, user, saveCurrentProjectNodes]);
};
