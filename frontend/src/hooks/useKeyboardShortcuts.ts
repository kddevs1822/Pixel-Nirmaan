import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';

const isTextEditingElement = (el: Element | null): boolean => {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    const nonTextTypes = ['range', 'color', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file'];
    return !nonTextTypes.includes(type);
  }
  return false;
};

export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingInput = isTextEditingElement(target) || !!target?.closest('textarea, [contenteditable="true"], input:not([type="range"]):not([type="checkbox"]):not([type="color"]):not([type="button"])');

      if (!isEditingInput) {
        if (document.activeElement && (document.activeElement as HTMLElement).blur) {
          (document.activeElement as HTMLElement).blur();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const code = e.code;

      // Handle Enter inside text inputs to submit/release focus
      if (key === 'Enter' || code === 'Enter') {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && isTextEditingElement(activeEl) && activeEl.tagName !== 'TEXTAREA') {
          activeEl.blur();
        }
      }

      // Always handle Escape even inside inputs
      if (key === 'Escape' || code === 'Escape') {
        const { pickingTriggerForNodeId, setPickingTriggerForNodeId, mode, setMode, selectNodes } = useCanvasStore.getState();
        if (document.activeElement && (document.activeElement as HTMLElement).blur) {
          (document.activeElement as HTMLElement).blur();
        }
        if (pickingTriggerForNodeId) {
          setPickingTriggerForNodeId(null);
          return;
        }
        if (mode === 'preview') {
          setMode('select');
        } else {
          selectNodes([]);
        }
        return;
      }

      // Ignore standard editing shortcuts if typing inside an active text input or textarea
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused = isTextEditingElement(target) || isTextEditingElement(activeEl);

      if (isInputFocused) {
        return;
      }

      const cmdOrCtrl = e.ctrlKey || e.metaKey;
      const { 
        nodes, 
        selectedIds, 
        deleteNodes, 
        duplicateNodes, 
        copyNodes, 
        pasteNodes, 
        undo, 
        redo, 
        selectNodes,
        updateNodes,
        zoom,
        setZoom,
        setPan,
      } = useCanvasStore.getState();

      // Delete / Backspace: Delete selected elements
      if (key === 'Delete' || key === 'Backspace' || code === 'Delete' || code === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          deleteNodes();
        }
        return;
      }

      // Cmd/Ctrl + A: Select All
      if (cmdOrCtrl && (key === 'a' || key === 'A' || code === 'KeyA')) {
        e.preventDefault();
        selectNodes(nodes.map(n => n.id));
        return;
      }

      // Cmd/Ctrl + D: Duplicate
      if (cmdOrCtrl && (key === 'd' || key === 'D' || code === 'KeyD')) {
        e.preventDefault();
        duplicateNodes();
        return;
      }

      // Cmd/Ctrl + C: Copy
      if (cmdOrCtrl && (key === 'c' || key === 'C' || code === 'KeyC')) {
        e.preventDefault();
        copyNodes();
        return;
      }

      // Cmd/Ctrl + X: Cut
      if (cmdOrCtrl && (key === 'x' || key === 'X' || code === 'KeyX')) {
        e.preventDefault();
        copyNodes();
        deleteNodes();
        return;
      }

      // Cmd/Ctrl + V: Paste
      if (cmdOrCtrl && (key === 'v' || key === 'V' || code === 'KeyV')) {
        e.preventDefault();
        pasteNodes();
        return;
      }

      // Cmd/Ctrl + Z: Undo
      if (cmdOrCtrl && (key === 'z' || key === 'Z' || code === 'KeyZ') && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y: Redo
      if (
        (cmdOrCtrl && e.shiftKey && (key === 'z' || key === 'Z' || code === 'KeyZ')) ||
        (cmdOrCtrl && (key === 'y' || key === 'Y' || code === 'KeyY'))
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Zoom shortcuts: Ctrl/Cmd + / - / 0
      if (cmdOrCtrl && (key === '=' || key === '+' || code === 'Equal')) {
        e.preventDefault();
        setZoom(Math.min(5, Math.round(zoom * 1.2 * 100) / 100));
        return;
      }
      if (cmdOrCtrl && (key === '-' || key === '_' || code === 'Minus')) {
        e.preventDefault();
        setZoom(Math.max(0.1, Math.round((zoom / 1.2) * 100) / 100));
        return;
      }
      if (cmdOrCtrl && (key === '0' || code === 'Digit0' || code === 'Numpad0')) {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
        return;
      }

      // Arrow keys: Nudge selected elements
      const isArrow = key.startsWith('Arrow') || code.startsWith('Arrow');
      if (isArrow && selectedIds.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        if (key === 'ArrowUp' || code === 'ArrowUp') dy = -step;
        if (key === 'ArrowDown' || code === 'ArrowDown') dy = step;
        if (key === 'ArrowLeft' || code === 'ArrowLeft') dx = -step;
        if (key === 'ArrowRight' || code === 'ArrowRight') dx = step;

        selectedIds.forEach(id => {
          const node = nodes.find(n => n.id === id);
          if (node) {
            updateNodes([id], { x: node.x + dx, y: node.y + dy }, false);
          }
        });
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);
};
