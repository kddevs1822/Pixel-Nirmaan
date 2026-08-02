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
}

export type AppMode = 'select' | 'connect' | 'preview';

interface CanvasState {
  nodes: CanvasNode[];
  selectedId: string | null;
  pan: { x: number; y: number };
  zoom: number;
  
  past: CanvasNode[][];
  future: CanvasNode[][];
  clipboard: CanvasNode | null;

  mode: AppMode;
  connectingSourceId: string | null;
  previewFrameId: string | null;

  setMode: (mode: AppMode) => void;
  setConnectingSourceId: (id: string | null) => void;
  setPreviewFrameId: (id: string | null) => void;

  addNode: (node: Omit<CanvasNode, 'id'>) => void;
  updateNode: (id: string, node: Partial<CanvasNode>, saveHistory?: boolean) => void;
  selectNode: (id: string | null) => void;
  deleteNode: () => void;
  duplicateNode: () => void;
  copyNode: () => void;
  pasteNode: () => void;
  reorderNode: (id: string, action: 'front' | 'back' | 'forward' | 'backward') => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  undo: () => void;
  redo: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  selectedId: null,
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
      selectedId: newNode.id,
    });
  },

  updateNode: (id, partialNode, saveHistory = false) => {
    const { nodes, past } = get();
    set({
      ...(saveHistory && { past: [...past, nodes], future: [] }),
      nodes: nodes.map(n => n.id === id ? { ...n, ...partialNode } : n)
    });
  },

  selectNode: (id) => {
    set({ selectedId: id });
  },

  deleteNode: () => {
    const { nodes, selectedId, past } = get();
    if (!selectedId) return;
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.filter(n => n.id !== selectedId),
      selectedId: null,
    });
  },

  duplicateNode: () => {
    const { nodes, selectedId, past } = get();
    if (!selectedId) return;
    const nodeToDuplicate = nodes.find(n => n.id === selectedId);
    if (!nodeToDuplicate) return;
    
    const newNode = {
      ...nodeToDuplicate,
      id: uuidv4(),
      x: nodeToDuplicate.x + 20,
      y: nodeToDuplicate.y + 20,
    };
    
    set({
      past: [...past, nodes],
      future: [],
      nodes: [...nodes, newNode],
      selectedId: newNode.id,
    });
  },

  copyNode: () => {
    const { nodes, selectedId } = get();
    if (!selectedId) return;
    const nodeToCopy = nodes.find(n => n.id === selectedId);
    if (nodeToCopy) {
      set({ clipboard: nodeToCopy });
    }
  },

  pasteNode: () => {
    const { nodes, clipboard, past } = get();
    if (!clipboard) return;
    
    const newNode = {
      ...clipboard,
      id: uuidv4(),
      x: clipboard.x + 20,
      y: clipboard.y + 20,
    };
    
    set({
      past: [...past, nodes],
      future: [],
      nodes: [...nodes, newNode],
      selectedId: newNode.id,
    });
  },

  reorderNode: (id, action) => {
    const { nodes, past } = get();
    const index = nodes.findIndex(n => n.id === id);
    if (index === -1) return;

    let newNodes = [...nodes];
    const node = newNodes.splice(index, 1)[0];

    if (action === 'front') {
      newNodes.push(node);
    } else if (action === 'back') {
      newNodes.unshift(node);
    } else if (action === 'forward') {
      newNodes.splice(Math.min(nodes.length - 1, index + 1), 0, node);
    } else if (action === 'backward') {
      newNodes.splice(Math.max(0, index - 1), 0, node);
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
      selectedId: null, // Reset selection on undo
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
      selectedId: null,
    });
  },
}));
