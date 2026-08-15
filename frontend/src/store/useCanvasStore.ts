import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type NodeType = 'Rect' | 'Circle' | 'Text' | 'Image' | 'Frame' | 'Triangle' | 'Line';

export interface ComponentPropDef {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'color' | 'image';
  defaultValue: any;
}

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
  rotation?: number;
  // Component features
  isMasterComponent?: boolean;
  componentName?: string;
  componentId?: string;
  variant?: 'default' | 'hover' | 'active' | 'disabled';
  variants?: {
    hover?: Partial<CanvasNode>;
    active?: Partial<CanvasNode>;
    disabled?: Partial<CanvasNode>;
  };
  propsDefinition?: ComponentPropDef[];
  propOverrides?: Record<string, any>;
  boundProps?: Record<string, string>; // Maps node field (e.g. 'text') to propId
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
  
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;

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

  createComponent: (ids: string[], name: string) => void;
  spawnInstance: (masterId: string, x: number, y: number) => void;
  updateVariant: (masterId: string, variantName: 'hover' | 'active' | 'disabled', properties: Partial<CanvasNode>) => void;
  propagateComponent: (masterId: string) => void;
  detachInstance: (id: string) => void;
  addPropDefinition: (masterId: string, propDef: ComponentPropDef) => void;
  updatePropDefinition: (masterId: string, propId: string, propDef: Partial<ComponentPropDef>) => void;
  removePropDefinition: (masterId: string, propId: string) => void;
  updatePropOverride: (instanceId: string, propId: string, value: any) => void;
  bindProp: (nodeId: string, field: string, propId: string | null) => void;
  
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
  
  toastMessage: null,
  setToastMessage: (toastMessage) => {
    set({ toastMessage });
    if (toastMessage) {
      setTimeout(() => set({ toastMessage: null }), 3000);
    }
  },

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

  createComponent: (ids, name) => {
    const { nodes, past } = get();
    
    if (ids.length === 1) {
      set({
        past: [...past, nodes],
        future: [],
        nodes: nodes.map(n => n.id === ids[0] ? {
          ...n,
          isMasterComponent: true,
          componentName: name,
          variant: 'default',
          variants: {},
          propsDefinition: []
        } : n)
      });
      return;
    }

    const nodesToGroup = nodes.filter(n => ids.includes(n.id));
    if (nodesToGroup.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodesToGroup.forEach(n => {
      const nx = n.x;
      const ny = n.y;
      const nw = n.type === 'Circle' ? (n.radius || 0) * 2 : (n.width || 0);
      const nh = n.type === 'Circle' ? (n.radius || 0) * 2 : (n.height || 0);
      const cx = n.type === 'Circle' ? nx - (n.radius || 0) : nx;
      const cy = n.type === 'Circle' ? ny - (n.radius || 0) : ny;
      
      minX = Math.min(minX, cx);
      minY = Math.min(minY, cy);
      maxX = Math.max(maxX, cx + nw);
      maxY = Math.max(maxY, cy + nh);
    });

    const newFrameId = uuidv4();
    const newFrame: CanvasNode = {
      id: newFrameId,
      type: 'Frame',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      fill: 'transparent',
      isMasterComponent: true,
      componentName: name,
      variant: 'default',
      variants: {},
      propsDefinition: []
    };

    const newNodes = nodes.map(n => {
      if (ids.includes(n.id)) {
        return {
          ...n,
          parentId: newFrameId,
          x: n.x - minX,
          y: n.y - minY
        };
      }
      return n;
    });

    set({
      past: [...past, nodes],
      future: [],
      nodes: [...newNodes, newFrame],
      selectedIds: [newFrameId]
    });
  },

  spawnInstance: (masterId, x, y) => {
    const { nodes, past } = get();
    const master = nodes.find(n => n.id === masterId);
    if (!master) return;

    const newNodes: CanvasNode[] = [];
    const idMap = new Map<string, string>(); // Maps master id to new instance id

    const cloneNode = (node: CanvasNode, newParentId?: string, overrideX?: number, overrideY?: number) => {
      const newId = uuidv4();
      idMap.set(node.id, newId);
      
      const { isMasterComponent, componentName, variants, propsDefinition, id, ...baseProps } = node;
      
      const cloned: CanvasNode = {
        ...baseProps,
        id: newId,
        x: overrideX !== undefined ? overrideX : node.x,
        y: overrideY !== undefined ? overrideY : node.y,
        parentId: newParentId || undefined,
        componentId: node.id,
        variant: 'default',
        propOverrides: {}
      };
      
      newNodes.push(cloned);

      // Clone children
      nodes.filter(n => n.parentId === node.id).forEach(child => {
        cloneNode(child, newId);
      });

      return newId;
    };

    const rootInstanceId = cloneNode(master, undefined, x, y);

    set({
      past: [...past, nodes],
      future: [],
      nodes: [...nodes, ...newNodes],
      selectedIds: [rootInstanceId]
    });
  },

  updateVariant: (masterId, variantName, properties) => {
    const { nodes, past } = get();
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.map(n => {
        if (n.id === masterId && n.isMasterComponent) {
          const currentVariants = n.variants || {};
          return {
            ...n,
            variants: {
              ...currentVariants,
              [variantName]: {
                ...(currentVariants[variantName] || {}),
                ...properties
              }
            }
          };
        }
        return n;
      })
    });
  },

  propagateComponent: (masterId) => {
    const { nodes, past } = get();
    const master = nodes.find(n => n.id === masterId);
    if (!master) return;

    const { isMasterComponent, componentName, variants, id, x, y, parentId, ...baseProps } = master;

    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.map(n => {
        if (n.componentId === masterId) {
          // Keep instance's specific x, y, parentId, id, variant state
          return {
            ...baseProps,
            id: n.id,
            x: n.x,
            y: n.y,
            parentId: n.parentId,
            componentId: n.componentId,
            variant: n.variant,
            linkTo: n.linkTo,
            // we override their dimensions/colors with the master's base props
          };
        }
        return n;
      })
    });
  },

  addPropDefinition: (masterId, propDef) => {
    const { nodes, past } = get();
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.map(n => n.id === masterId ? {
        ...n,
        propsDefinition: [...(n.propsDefinition || []), propDef]
      } : n)
    });
  },

  updatePropDefinition: (masterId, propId, propDef) => {
    const { nodes, past } = get();
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.map(n => n.id === masterId ? {
        ...n,
        propsDefinition: (n.propsDefinition || []).map(p => p.id === propId ? { ...p, ...propDef } : p)
      } : n)
    });
  },

  removePropDefinition: (masterId, propId) => {
    const { nodes, past } = get();
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.map(n => n.id === masterId ? {
        ...n,
        propsDefinition: (n.propsDefinition || []).filter(p => p.id !== propId)
      } : n)
    });
  },

  updatePropOverride: (instanceId, propId, value) => {
    const { nodes, past } = get();
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.map(n => n.id === instanceId ? {
        ...n,
        propOverrides: { ...(n.propOverrides || {}), [propId]: value }
      } : n)
    });
  },

  bindProp: (nodeId, field, propId) => {
    const { nodes, past } = get();
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.map(n => {
        if (n.id === nodeId) {
          const newBoundProps = { ...(n.boundProps || {}) };
          if (propId) {
            newBoundProps[field] = propId;
          } else {
            delete newBoundProps[field];
          }
          return { ...n, boundProps: newBoundProps };
        }
        return n;
      })
    });
  },



  detachInstance: (id) => {
    const { nodes, past } = get();
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.map(n => {
        if (n.id === id && n.componentId) {
          // It's already fully rendered in CanvasArea (CanvasArea handles the visual merging).
          // Wait, if it detaches, we need it to freeze its current look.
          // Since propagation explicitly copies props, an instance actually HAS all the base props on itself.
          // EXCEPT if we rely on CanvasArea merging.
          // I will ensure CanvasArea does NOT merge, but just uses the node's own props.
          // That means propagateComponent is what keeps them in sync.
          // So detaching just removes componentId and variant.
          const { componentId, variant, ...rest } = n;
          return rest;
        }
        return n;
      })
    });
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
