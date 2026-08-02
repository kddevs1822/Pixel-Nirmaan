import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type NodeType = 'Rect' | 'Circle' | 'Text' | 'Image' | 'Frame' | 'Triangle' | 'Line';

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  cornerRadius?: number;
  src?: string;
  parentId?: string;
  points?: number[];
  tension?: number;
  frameType?: 'desktop' | 'tablet' | 'mobile';
  linkTo?: string;
  scaleX?: number;
  scaleY?: number;
}

export type AppMode = 'select' | 'connect' | 'preview';

interface CanvasState {
  nodes: CanvasNode[];
  selectedIds: string[];
  pan: { x: number; y: number };
  zoom: number;
  
  past: CanvasNode[][];
  future: CanvasNode[][];
  clipboard: CanvasNode[] | null;

  mode: AppMode;
  connectingSourceId: string | null;
  previewFrameId: string | null;

  setMode: (mode: AppMode) => void;
  setConnectingSourceId: (id: string | null) => void;
  setPreviewFrameId: (id: string | null) => void;

  addNode: (node: Omit<CanvasNode, 'id'>) => void;
  updateNode: (id: string, node: Partial<CanvasNode>, saveHistory?: boolean) => void;
  updateNodes: (ids: string[], node: Partial<CanvasNode>, saveHistory?: boolean) => void;
  selectNodes: (ids: string[]) => void;
  toggleNodeSelection: (id: string) => void;
  deleteNodes: () => void;
  duplicateNodes: () => void;
  copyNodes: () => void;
  pasteNodes: () => void;
  reorderNodes: (action: 'front' | 'back' | 'forward' | 'backward') => void;
  
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  undo: () => void;
  redo: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  selectedIds: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
  
  past: [],
  future: [],
  clipboard: null,

  mode: 'select',
  connectingSourceId: null,
  previewFrameId: null,

  setMode: (mode) => set({ mode, connectingSourceId: null }),
  setConnectingSourceId: (connectingSourceId) => set({ connectingSourceId }),
  setPreviewFrameId: (previewFrameId) => set({ previewFrameId }),

  addNode: (node) => {
    const { nodes, past } = get();
    const newNode = { ...node, id: uuidv4() };
    set({
      past: [...past, nodes],
      future: [],
      nodes: [...nodes, newNode],
      selectedIds: [newNode.id],
    });
  },

  updateNode: (id, partialNode, saveHistory = false) => {
    const { nodes, past } = get();
    set({
      ...(saveHistory && { past: [...past, nodes], future: [] }),
      nodes: nodes.map(n => n.id === id ? { ...n, ...partialNode } : n)
    });
  },

  updateNodes: (ids, partialNode, saveHistory = false) => {
    const { nodes, past } = get();
    set({
      ...(saveHistory && { past: [...past, nodes], future: [] }),
      nodes: nodes.map(n => ids.includes(n.id) ? { ...n, ...partialNode } : n)
    });
  },

  selectNodes: (ids) => {
    set({ selectedIds: ids });
  },

  toggleNodeSelection: (id) => {
    const { selectedIds } = get();
    if (selectedIds.includes(id)) {
      set({ selectedIds: selectedIds.filter(selId => selId !== id) });
    } else {
      set({ selectedIds: [...selectedIds, id] });
    }
  },

  deleteNodes: () => {
    const { nodes, selectedIds, past } = get();
    if (selectedIds.length === 0) return;
    
    // Also delete any children if we are deleting a frame/group
    const idsToDelete = new Set([...selectedIds]);
    nodes.forEach(n => {
      if (n.parentId && idsToDelete.has(n.parentId)) {
        idsToDelete.add(n.id);
      }
    });

    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.filter(n => !idsToDelete.has(n.id)),
      selectedIds: [],
    });
  },

  duplicateNodes: () => {
    const { nodes, selectedIds, past } = get();
    if (selectedIds.length === 0) return;
    
    const nodesToDuplicate = nodes.filter(n => selectedIds.includes(n.id));
    const newIds: string[] = [];
    const newNodes = nodesToDuplicate.map(node => {
      const newId = uuidv4();
      newIds.push(newId);
      return {
        ...node,
        id: newId,
        x: node.x + 20,
        y: node.y + 20,
      };
    });
    
    set({
      past: [...past, nodes],
      future: [],
      nodes: [...nodes, ...newNodes],
      selectedIds: newIds,
    });
  },

  copyNodes: () => {
    const { nodes, selectedIds } = get();
    if (selectedIds.length === 0) return;
    const nodesToCopy = nodes.filter(n => selectedIds.includes(n.id));
    set({ clipboard: nodesToCopy });
  },

  pasteNodes: () => {
    const { nodes, clipboard, past } = get();
    if (!clipboard || clipboard.length === 0) return;
    
    const newIds: string[] = [];
    const newNodes = clipboard.map(node => {
      const newId = uuidv4();
      newIds.push(newId);
      return {
        ...node,
        id: newId,
        x: node.x + 20,
        y: node.y + 20,
      };
    });
    
    set({
      past: [...past, nodes],
      future: [],
      nodes: [...nodes, ...newNodes],
      selectedIds: newIds,
    });
  },

  reorderNodes: (action) => {
    const { nodes, selectedIds, past } = get();
    if (selectedIds.length === 0) return;

    let newNodes = [...nodes];
    const nodesToMove = newNodes.filter(n => selectedIds.includes(n.id));
    const otherNodes = newNodes.filter(n => !selectedIds.includes(n.id));

    if (action === 'front') {
      newNodes = [...otherNodes, ...nodesToMove];
    } else if (action === 'back') {
      newNodes = [...nodesToMove, ...otherNodes];
    } else if (action === 'forward') {
      // Simplistic forward (just moves them to the end of their current general position)
      // True forward is complex for multi-select, this acts mostly like front for now
      newNodes = [...otherNodes, ...nodesToMove];
    } else if (action === 'backward') {
      newNodes = [...nodesToMove, ...otherNodes];
    }

    set({ past: [...past, nodes], future: [], nodes: newNodes });
  },

  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),

  undo: () => {
    const { past, future, nodes } = get();
    if (past.length === 0) return;
    
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    set({
      past: newPast,
      future: [nodes, ...future],
      nodes: previous,
      selectedIds: [], 
    });
  },

  redo: () => {
    const { past, future, nodes } = get();
    if (future.length === 0) return;
    
    const next = future[0];
    const newFuture = future.slice(1);
    
    set({
      past: [...past, nodes],
      future: newFuture,
      nodes: next,
      selectedIds: [],
    });
  },
}));
