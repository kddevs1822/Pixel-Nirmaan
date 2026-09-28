import { useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';

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
      const cmdOrCtrl = e.ctrlKey || e.metaKey;

      // 1. Always handle Escape (clear focus, trigger picker, preview mode, or selection)
      if (key === 'Escape' || code === 'Escape') {
        const { pickingTriggerForNodeId, setPickingTriggerForNodeId, pickingActionTarget, setPickingActionTarget, mode, setMode, selectNodes } = useCanvasStore.getState();
        if (document.activeElement && (document.activeElement as HTMLElement).blur) {
          (document.activeElement as HTMLElement).blur();
        }
        if (pickingActionTarget) {
          setPickingActionTarget(null);
          return;
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

      // 2. Cmd/Ctrl + S: Save Project (Works everywhere, even while focused on an input)
      if (cmdOrCtrl && (key === 's' || key === 'S' || code === 'KeyS')) {
        e.preventDefault();
        const { nodes, stateVariables, setToastMessage } = useCanvasStore.getState();
        const { activeProject, saveCurrentProjectNodes } = useProjectStore.getState();
        const user = useAuthStore.getState().user;
        if (user && activeProject) {
          saveCurrentProjectNodes({ nodes, stateVariables } as any);
          setToastMessage('💾 Project saved successfully!');
        } else {
          setToastMessage('💾 Changes saved locally');
        }
        return;
      }

      // 3. Handle Enter inside text inputs to submit/release focus
      if (key === 'Enter' || code === 'Enter') {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && isTextEditingElement(activeEl) && activeEl.tagName !== 'TEXTAREA') {
          activeEl.blur();
        }
      }

      // 4. Check if actively typing in an input element
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isTyping = isTextEditingElement(target) || (target === activeEl && isTextEditingElement(activeEl));

      if (isTyping) {
        // Let the input handle its own native editing (typing, backspace, selection)
        return;
      }

      // If activeEl was left focused on an input but the user pressed a canvas shortcut, release it
      if (activeEl && isTextEditingElement(activeEl)) {
        activeEl.blur();
      }

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
        reorderNodes,
        addNode,
        mode,
        setMode,
        zoom, 
        setZoom, 
        setPan, 
        pan,
        setToastMessage,
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

      // Reorder layers:
      // Cmd/Ctrl + [ : Send to Back
      if (cmdOrCtrl && (key === '[' || code === 'BracketLeft')) {
        e.preventDefault();
        reorderNodes('back');
        setToastMessage('Sent to Back');
        return;
      }
      // Cmd/Ctrl + ] : Bring to Front
      if (cmdOrCtrl && (key === ']' || code === 'BracketRight')) {
        e.preventDefault();
        reorderNodes('front');
        setToastMessage('Brought to Front');
        return;
      }
      // [ : Send Backward
      if (!cmdOrCtrl && !e.altKey && (key === '[' || code === 'BracketLeft')) {
        e.preventDefault();
        reorderNodes('backward');
        setToastMessage('Sent Backward');
        return;
      }
      // ] : Bring Forward
      if (!cmdOrCtrl && !e.altKey && (key === ']' || code === 'BracketRight')) {
        e.preventDefault();
        reorderNodes('forward');
        setToastMessage('Brought Forward');
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
        return;
      }

      // 5. Tool Shortcuts (Single keys, when not holding Ctrl / Cmd / Alt)
      if (!cmdOrCtrl && !e.altKey && !e.shiftKey) {
        const k = key.toLowerCase();

        // V: Select Tool
        if (k === 'v') {
          e.preventDefault();
          setMode('select');
          setToastMessage('Pointer Tool (V)');
          return;
        }

        // C: Connect Tool
        if (k === 'c') {
          e.preventDefault();
          const next = mode === 'connect' ? 'select' : 'connect';
          setMode(next);
          setToastMessage(next === 'connect' ? 'Connect Tool (C)' : 'Pointer Tool (V)');
          return;
        }

        // P: Toggle Preview Mode
        if (k === 'p') {
          e.preventDefault();
          const next = mode === 'preview' ? 'select' : 'preview';
          setMode(next);
          setToastMessage(next === 'preview' ? 'Preview Mode (P)' : 'Design Mode (P)');
          return;
        }

        // Quick shape placement at center of visible canvas
        const centerX = (window.innerWidth / 2 - pan.x) / zoom;
        const centerY = (window.innerHeight / 2 - pan.y) / zoom;
        const localX = Math.round(centerX - 50);
        const localY = Math.round(centerY - 50);

        // R: Rectangle
        if (k === 'r') {
          e.preventDefault();
          addNode({ type: 'Rect', x: localX, y: localY, width: 100, height: 100, fill: '#C65D3B', cornerRadius: 0 });
          setToastMessage('Added Rectangle (R)');
          return;
        }

        // O: Circle
        if (k === 'o') {
          e.preventDefault();
          addNode({ type: 'Circle', x: localX + 50, y: localY + 50, radius: 50, fill: '#4A3AFF' });
          setToastMessage('Added Circle (O)');
          return;
        }

        // T: Text
        if (k === 't') {
          e.preventDefault();
          addNode({ type: 'Text', x: localX, y: localY, text: 'Pixel Nirmaan', fontSize: 32, fontFamily: 'Space Grotesk', fill: '#1A1A1D' });
          setToastMessage('Added Text (T)');
          return;
        }

        // F: Desktop Frame
        if (k === 'f') {
          e.preventDefault();
          const frames = nodes.filter(n => n.type === 'Frame');
          addNode({ 
            type: 'Frame', 
            x: localX - Math.round(window.innerWidth / 4), 
            y: localY - Math.round(window.innerHeight / 4), 
            width: window.innerWidth, 
            height: window.innerHeight, 
            fill: '#ffffff', 
            frameType: 'desktop', 
            name: `Desktop ${frames.length + 1}` 
          });
          setToastMessage('Added Desktop Frame (F)');
          return;
        }

        // L: Line
        if (k === 'l') {
          e.preventDefault();
          addNode({ type: 'Line', x: localX, y: localY, points: [0, 0, 100, 100], stroke: '#1A1A1D', strokeWidth: 4 });
          setToastMessage('Added Line (L)');
          return;
        }
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
