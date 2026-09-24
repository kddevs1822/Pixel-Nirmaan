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
  fontWeight?: string;
  textAlign?: string;
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
  name?: string;
  variantOf?: string;
  sourceNodeId?: string;
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
  boundProps?: Record<string, string>;

  // Effects
  opacity?: number;           // 0–100 (default 100)
  boxShadow?: {
    enabled: boolean;
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: string;
  };
  filterBlur?: number;        // Gaussian blur in px (0 = none)

  // Transitions
  transitionDuration?: number; // ms (default 300)
  transitionTimingFunction?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
  hoverEffect?: 'none' | 'scale-up' | 'scale-down' | 'lift' | 'glow' | 'darken' | 'brighten';

  // Animations
  animation?: {
    type: 'none' | 'bounce' | 'pulse' | 'spin' | 'fade-in' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right';
    duration: number;   // ms
    infinite: boolean;
    trigger?: 'auto' | 'click' | 'dblclick' | 'hover' | 'focus' | 'scroll';
    triggerNodeId?: string;
  };
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

  pickingTriggerForNodeId: string | null;

  setMode: (mode: AppMode) => void;
  setConnectingSourceId: (id: string | null) => void;
  setPreviewFrameId: (id: string | null) => void;
  setPickingTriggerForNodeId: (id: string | null) => void;
  
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
  deleteComponent: (id: string) => void;
  addPropDefinition: (masterId: string, propDef: ComponentPropDef) => void;
  updatePropDefinition: (masterId: string, propId: string, propDef: Partial<ComponentPropDef>) => void;
  removePropDefinition: (masterId: string, propId: string) => void;
  updatePropOverride: (instanceId: string, propId: string, value: any) => void;
  bindProp: (nodeId: string, field: string, propId: string | null) => void;
  generateResponsiveVariants: (frameId: string) => void;
  
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setNodes: (nodes: CanvasNode[]) => void;
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
  pickingTriggerForNodeId: null,

  setMode: (mode) => set({ mode, connectingSourceId: null, pickingTriggerForNodeId: null }),
  setConnectingSourceId: (connectingSourceId) => set({ connectingSourceId }),
  setPreviewFrameId: (previewFrameId) => set({ previewFrameId }),
  setPickingTriggerForNodeId: (pickingTriggerForNodeId) => set({ pickingTriggerForNodeId }),
  
  toastMessage: null,
  setToastMessage: (toastMessage) => {
    set({ toastMessage });
    if (toastMessage) {
      setTimeout(() => set({ toastMessage: null }), 3000);
    }
  },

  setNodes: (nodes) => set({ nodes, selectedIds: [], past: [], future: [] }),

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
      for (let i = newNodes.length - 1; i >= 0; i--) {
        if (selectedIds.includes(newNodes[i].id)) {
          const node = newNodes[i];
          let nextSiblingIdx = -1;
          for (let j = i + 1; j < newNodes.length; j++) {
            if (newNodes[j].parentId === node.parentId && !selectedIds.includes(newNodes[j].id)) {
              nextSiblingIdx = j;
              break;
            }
          }
          if (nextSiblingIdx !== -1) {
            [newNodes[i], newNodes[nextSiblingIdx]] = [newNodes[nextSiblingIdx], newNodes[i]];
          }
        }
      }
    } else if (action === 'backward') {
      for (let i = 0; i < newNodes.length; i++) {
        if (selectedIds.includes(newNodes[i].id)) {
          const node = newNodes[i];
          let prevSiblingIdx = -1;
          for (let j = i - 1; j >= 0; j--) {
            if (newNodes[j].parentId === node.parentId && !selectedIds.includes(newNodes[j].id)) {
              prevSiblingIdx = j;
              break;
            }
          }
          if (prevSiblingIdx !== -1) {
            [newNodes[i], newNodes[prevSiblingIdx]] = [newNodes[prevSiblingIdx], newNodes[i]];
          }
        }
      }
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

  deleteComponent: (id: string) => {
    const { nodes, past } = get();
    const idsToDelete = new Set<string>();
    const markDelete = (targetId: string) => {
      idsToDelete.add(targetId);
      nodes.filter(n => n.parentId === targetId).forEach(c => markDelete(c.id));
    };
    nodes.filter(n => n.id === id || n.componentId === id).forEach(n => markDelete(n.id));
    set({
      past: [...past, nodes],
      future: [],
      nodes: nodes.filter(n => !idsToDelete.has(n.id)),
      selectedIds: [],
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

  generateResponsiveVariants: (frameId: string) => {
    const { nodes, past, setToastMessage } = get();
    const sourceFrame = nodes.find(n => n.id === frameId && n.type === 'Frame');
    if (!sourceFrame) return;

    const primaryFrameId = sourceFrame.variantOf || sourceFrame.id;
    const primaryFrame = nodes.find(n => n.id === primaryFrameId && n.type === 'Frame') || sourceFrame;

    const primaryType = primaryFrame.frameType || 'desktop';
    const sWidth = primaryFrame.width || (primaryType === 'desktop' ? (window.innerWidth || 1440) : primaryType === 'tablet' ? 768 : 393);

    const allTypes: ('desktop' | 'tablet' | 'mobile')[] = ['desktop', 'tablet', 'mobile'];
    const targetTypes = allTypes.filter(t => t !== primaryType);

    const getDimensions = (type: 'desktop' | 'tablet' | 'mobile') => {
      if (type === 'desktop') return { width: window.innerWidth || 1440, height: window.innerHeight || 900 };
      if (type === 'tablet') return { width: 768, height: 1024 };
      return { width: 393, height: 852 };
    };

    const getDescendants = (parentId: string, currentNodesList: CanvasNode[]): CanvasNode[] => {
      const children = currentNodesList.filter(n => n.parentId === parentId);
      let list = [...children];
      children.forEach(c => list.push(...getDescendants(c.id, currentNodesList)));
      return list;
    };

    const primaryDescendants = getDescendants(primaryFrame.id, nodes);
    const baseName = (primaryFrame.name || 'Screen').replace(/\s*-\s*(Desktop|Tablet|Mobile)$/i, '');

    let updatedNodes = [...nodes];
    const affectedFrameIds: string[] = [];
    let isUpdateMode = false;

    targetTypes.forEach(targetType => {
      const { width: targetWidth, height: targetHeight } = getDimensions(targetType);
      const scaleX = targetWidth / sWidth;
      const fontScale = Math.max(0.65, Math.min(1.2, scaleX));

      // Look for an existing variant frame for this primary frame and device type
      let existingFrame = updatedNodes.find(n => 
        n.type === 'Frame' && 
        n.variantOf === primaryFrame.id && 
        n.frameType === targetType
      );

      if (!existingFrame) {
        // --- CREATE NEW VARIANT FRAME ---
        const rootFrames = updatedNodes.filter(n => n.type === 'Frame' && !n.parentId);
        let rightmostX = primaryFrame.x + sWidth;
        rootFrames.forEach(f => {
          const edge = f.x + (f.width || 0);
          if (edge > rightmostX) rightmostX = edge;
        });

        const newFrameId = uuidv4();
        affectedFrameIds.push(newFrameId);
        const targetLabel = targetType.charAt(0).toUpperCase() + targetType.slice(1);

        const newFrame: CanvasNode = {
          ...primaryFrame,
          id: newFrameId,
          frameType: targetType,
          name: `${baseName} - ${targetLabel}`,
          variantOf: primaryFrame.id,
          x: rightmostX + 60,
          y: primaryFrame.y,
          width: targetWidth,
          height: targetHeight,
          parentId: undefined,
        };

        const idMap: Record<string, string> = {};
        idMap[primaryFrame.id] = newFrameId;
        primaryDescendants.forEach(d => {
          idMap[d.id] = uuidv4();
        });

        const clonedDescendants: CanvasNode[] = primaryDescendants.map(child => {
          const newId = idMap[child.id];
          const newParentId = child.parentId ? idMap[child.parentId] || newFrameId : newFrameId;
          const isDirectChildOfFrame = child.parentId === primaryFrame.id;
          const nodeScaleX = isDirectChildOfFrame ? scaleX : 1;
          const fontS = isDirectChildOfFrame ? fontScale : 1;

          const updated: CanvasNode = {
            ...child,
            id: newId,
            parentId: newParentId,
            sourceNodeId: child.id,
            x: Math.round(child.x * nodeScaleX),
            y: Math.round(child.y * (isDirectChildOfFrame ? Math.min(scaleX, 1) : 1)),
          };

          if (child.width !== undefined) updated.width = Math.max(10, Math.round(child.width * nodeScaleX));
          if (child.height !== undefined && child.type !== 'Text') {
            updated.height = Math.max(10, Math.round(child.height * (isDirectChildOfFrame ? Math.min(scaleX, 1) : 1)));
          }
          if (child.radius !== undefined) updated.radius = Math.max(4, Math.round(child.radius * nodeScaleX));
          if (child.fontSize !== undefined) updated.fontSize = Math.max(10, Math.round(child.fontSize * fontS));
          if (child.strokeWidth !== undefined) updated.strokeWidth = Math.max(1, Math.round(child.strokeWidth * fontS));
          if (child.points !== undefined) updated.points = child.points.map(p => Math.round(p * nodeScaleX));

          return updated;
        });

        updatedNodes.push(newFrame, ...clonedDescendants);
      } else {
        // --- UPDATE EXISTING VARIANT FRAME (DO NOT CREATE DUPLICATE) ---
        isUpdateMode = true;
        affectedFrameIds.push(existingFrame.id);

        const existingDescendants = getDescendants(existingFrame.id, updatedNodes);
        
        const idMap: Record<string, string> = {};
        idMap[primaryFrame.id] = existingFrame.id;

        const matchedVariantChildIds = new Set<string>();

        // 1. Match primary children to existing variant children strictly
        primaryDescendants.forEach(pChild => {
          let match = existingDescendants.find(eChild => eChild.sourceNodeId === pChild.id);
          if (!match) {
            match = existingDescendants.find(eChild => 
              !matchedVariantChildIds.has(eChild.id) &&
              !eChild.sourceNodeId &&
              eChild.type === pChild.type &&
              eChild.name === pChild.name
            );
          }

          if (match) {
            idMap[pChild.id] = match.id;
            matchedVariantChildIds.add(match.id);
          } else {
            idMap[pChild.id] = uuidv4();
          }
        });

        // 2. Identify nodes to remove (only remove if cloned from primary and deleted from primary)
        const primaryDescendantIdSet = new Set(primaryDescendants.map(p => p.id));
        const nodesToRemoveIds = new Set<string>();

        existingDescendants.forEach(eChild => {
          if (eChild.sourceNodeId && !primaryDescendantIdSet.has(eChild.sourceNodeId)) {
            nodesToRemoveIds.add(eChild.id);
          }
        });

        updatedNodes = updatedNodes.filter(n => !nodesToRemoveIds.has(n.id));

        // 3. Update existing variant children or add newly added primary children
        primaryDescendants.forEach(pChild => {
          const isDirectChildOfFrame = pChild.parentId === primaryFrame.id;
          const nodeScaleX = isDirectChildOfFrame ? scaleX : 1;
          const fontS = isDirectChildOfFrame ? fontScale : 1;
          const targetParentId = (pChild.parentId ? idMap[pChild.parentId] : undefined) || existingFrame!.id;

          const existingVariantChild = existingDescendants.find(e => matchedVariantChildIds.has(e.id) && idMap[pChild.id] === e.id);

          if (existingVariantChild) {
            // Update existing variant child in-place
            const updatedChild: CanvasNode = {
              ...existingVariantChild,
              sourceNodeId: pChild.id,
              parentId: targetParentId,
              name: pChild.name,
              fill: pChild.fill,
              stroke: pChild.stroke,
              text: pChild.text,
              src: pChild.src,
              linkTo: pChild.linkTo,
              opacity: pChild.opacity,
              fontFamily: pChild.fontFamily,
              fontWeight: pChild.fontWeight,
              textAlign: pChild.textAlign,
            };

            // Sync layout changes from primary
            updatedChild.x = Math.round(pChild.x * nodeScaleX);
            updatedChild.y = Math.round(pChild.y * (isDirectChildOfFrame ? Math.min(scaleX, 1) : 1));
            if (pChild.width !== undefined) updatedChild.width = Math.max(10, Math.round(pChild.width * nodeScaleX));
            if (pChild.height !== undefined && pChild.type !== 'Text') {
              updatedChild.height = Math.max(10, Math.round(pChild.height * (isDirectChildOfFrame ? Math.min(scaleX, 1) : 1)));
            }
            if (pChild.radius !== undefined) updatedChild.radius = Math.max(4, Math.round(pChild.radius * nodeScaleX));
            if (pChild.fontSize !== undefined) updatedChild.fontSize = Math.max(10, Math.round(pChild.fontSize * fontS));
            if (pChild.strokeWidth !== undefined) updatedChild.strokeWidth = Math.max(1, Math.round(pChild.strokeWidth * fontS));

            const idx = updatedNodes.findIndex(n => n.id === existingVariantChild.id);
            if (idx !== -1) {
              updatedNodes[idx] = updatedChild;
            }
          } else {
            // Newly added element in primary frame! Add to variant frame
            const newVariantChild: CanvasNode = {
              ...pChild,
              id: idMap[pChild.id],
              parentId: targetParentId,
              sourceNodeId: pChild.id,
              x: Math.round(pChild.x * nodeScaleX),
              y: Math.round(pChild.y * (isDirectChildOfFrame ? Math.min(scaleX, 1) : 1)),
            };

            if (pChild.width !== undefined) newVariantChild.width = Math.max(10, Math.round(pChild.width * nodeScaleX));
            if (pChild.height !== undefined && pChild.type !== 'Text') {
              newVariantChild.height = Math.max(10, Math.round(pChild.height * (isDirectChildOfFrame ? Math.min(scaleX, 1) : 1)));
            }
            if (pChild.radius !== undefined) newVariantChild.radius = Math.max(4, Math.round(pChild.radius * nodeScaleX));
            if (pChild.fontSize !== undefined) newVariantChild.fontSize = Math.max(10, Math.round(pChild.fontSize * fontS));
            if (pChild.strokeWidth !== undefined) newVariantChild.strokeWidth = Math.max(1, Math.round(pChild.strokeWidth * fontS));
            if (pChild.points !== undefined) newVariantChild.points = pChild.points.map(p => Math.round(p * nodeScaleX));

            updatedNodes.push(newVariantChild);
          }
        });
      }
    });

    set({
      past: [...past, nodes],
      future: [],
      nodes: updatedNodes,
      selectedIds: affectedFrameIds.length > 0 ? affectedFrameIds : [primaryFrame.id],
    });

    const labels = targetTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ');
    if (isUpdateMode) {
      setToastMessage(`🔄 Updated existing ${labels} screen variants!`);
    } else {
      setToastMessage(`✨ Generated ${labels} screen variants!`);
    }
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
