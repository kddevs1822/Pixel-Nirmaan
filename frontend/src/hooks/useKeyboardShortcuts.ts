import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';

export const useKeyboardShortcuts = () => {
  const { deleteNodes, duplicateNodes, copyNodes, pasteNodes, undo, redo } = useCanvasStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteNodes();
      } else if (cmdOrCtrl && e.key === 'd') {
        e.preventDefault();
        duplicateNodes();
      } else if (cmdOrCtrl && e.key === 'c') {
        copyNodes();
      } else if (cmdOrCtrl && e.key === 'v') {
        pasteNodes();
      } else if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (cmdOrCtrl && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      } else if (cmdOrCtrl && e.key === 'y') {
        // Windows redo
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteNodes, duplicateNodes, copyNodes, pasteNodes, undo, redo]);
};
