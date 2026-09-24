import React, { useState, useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Component, Unlink, ArrowRight, RefreshCw, Monitor, Smartphone, Target, X, MousePointer, Link2 } from 'lucide-react';
import type { CanvasNode } from '../store/useCanvasStore';
import { v4 as uuidv4 } from 'uuid';

const generateReactCode = (master: CanvasNode, descendants: CanvasNode[]) => {
  const propsDef = master.propsDefinition || [];
  let propsInterface = '';
  if (propsDef.length > 0) {
    propsInterface = `interface ${master.componentName || 'Component'}Props {\n`;
    propsDef.forEach(p => {
      const tsType = p.type === 'color' || p.type === 'image' ? 'string' : p.type;
      propsInterface += `  ${p.name}?: ${tsType};\n`;
    });
    propsInterface += `}\n\n`;
  }

  let code = propsInterface;
  code += `export const ${master.componentName || 'Component'} = (props: ${master.componentName || 'Component'}Props) => {\n`;
  if (propsDef.length > 0) {
    code += `  const { \n`;
    propsDef.forEach(p => {
      code += `    ${p.name} = ${typeof p.defaultValue === 'string' ? `'${p.defaultValue}'` : p.defaultValue},\n`;
    });
    code += `  } = props;\n\n`;
  }

  const renderNode = (node: CanvasNode, isRoot = false): string => {
    const isMasterRoot = isRoot && node.isMasterComponent;
    const tag = isMasterRoot ? 'div' : node.type;
    
    let propsStr = '';
    // Build explicit React props based on bindings
    const getVal = (field: string, rawVal: any) => {
      const boundPropId = node.boundProps?.[field];
      if (boundPropId) {
        const propDef = propsDef.find(p => p.id === boundPropId);
        if (propDef) return propDef.name;
      }
      if (typeof rawVal === 'string') return `'${rawVal}'`;
      return rawVal;
    };

    if (node.type === 'Text') {
      propsStr += ` text={${getVal('text', node.text)}}`;
      propsStr += ` fontSize={${getVal('fontSize', node.fontSize)}}`;
    } else if (node.type === 'Rect' || node.type === 'Circle') {
      propsStr += ` fill={${getVal('fill', node.fill)}}`;
    }

    if (isMasterRoot) {
      return `  return (\n    <${tag} className="relative w-[${node.width}px] h-[${node.height}px]">\n${
        descendants.filter(d => d.parentId === node.id).map(d => `      ` + renderNode(d, false)).join('\n')
      }\n    </${tag}>\n  );`;
    }

    return `<${tag}${propsStr} />`;
  };

  code += renderNode(master, true);
  code += `\n};\n`;
  return code;
};

const EASING_DESCRIPTIONS: Record<string, string> = {
  'ease': 'Default smooth curve: starts gently, speeds up, and slows to a soft stop.',
  'ease-in': 'Starts slowly and accelerates toward the end (heavy momentum).',
  'ease-out': 'Starts fast and decelerates gracefully (snappy, responsive).',
  'ease-in-out': 'Starts slow, peaks in the middle, and decelerates at the end.',
  'linear': 'Constant speed from beginning to end (robotic, mechanical).',
};

const HoverPreviewCard: React.FC<{
  effect: string;
  duration: number;
  timing: string;
}> = ({ effect, duration, timing }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const active = isHovered || isPlaying;

  const triggerPlay = () => {
    setIsPlaying(true);
    setTimeout(() => {
      setIsPlaying(false);
    }, Math.max(duration + 350, 700));
  };

  const timingCss = timing === 'ease' ? 'ease' :
    timing === 'ease-in' ? 'ease-in' :
    timing === 'ease-out' ? 'ease-out' :
    timing === 'ease-in-out' ? 'ease-in-out' : 'linear';

  let hoverStyle: React.CSSProperties = {};
  if (active) {
    switch (effect) {
      case 'scale-up':
        hoverStyle = { transform: 'scale(1.12)' };
        break;
      case 'scale-down':
        hoverStyle = { transform: 'scale(0.88)' };
        break;
      case 'lift':
        hoverStyle = { 
          transform: 'translateY(-6px)', 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)' 
        };
        break;
      case 'glow':
        hoverStyle = { 
          boxShadow: '0 0 24px 6px rgba(74, 58, 255, 0.85)',
          transform: 'scale(1.03)'
        };
        break;
      case 'darken':
        hoverStyle = { 
          filter: 'brightness(0.55)',
          opacity: 0.75
        };
        break;
      case 'brighten':
        hoverStyle = { 
          filter: 'brightness(1.4)',
          boxShadow: '0 0 20px 4px rgba(255, 255, 255, 0.9), 0 4px 12px rgba(74, 58, 255, 0.3)'
        };
        break;
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-1">
      <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold uppercase tracking-wider">
        <span>Hover Preview</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#4A3AFF] font-mono lowercase bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{effect}</span>
          <button
            type="button"
            onClick={triggerPlay}
            title="Play preview animation"
            className="text-[10px] text-slate-600 hover:text-[#4A3AFF] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:border-indigo-300 font-medium cursor-pointer shadow-xs transition-colors"
          >
            ▶ Play
          </button>
        </div>
      </div>
      <div className="flex items-center justify-center py-5 bg-white rounded-md border border-dashed border-slate-200 overflow-hidden min-h-[72px]">
        <button
          type="button"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            transitionProperty: 'all',
            transitionDuration: `${duration}ms`,
            transitionTimingFunction: timingCss,
            ...hoverStyle,
          }}
          className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white shadow-sm cursor-pointer select-none bg-[#4A3AFF]"
        >
          Hover Me
        </button>
      </div>
      <div className="flex justify-between items-center text-[10px] text-slate-400">
        <span>Hover button or click Play</span>
        <span className="font-mono text-slate-500">{timing} • {duration}ms</span>
      </div>
    </div>
  );
};

const ANIMATION_DESCRIPTIONS: Record<string, string> = {
  'bounce': 'Bounces rhythmically up and down with gravity curves.',
  'pulse': 'Gently pulses scale and opacity rhythmically.',
  'spin': 'Continuously rotates 360 degrees smoothly.',
  'fade-in': 'Smoothly fades in from transparent (0%) to visible (100%).',
  'slide-up': 'Slides upward into view from below while fading in.',
  'slide-down': 'Slides downward into view from above while fading in.',
  'slide-left': 'Slides leftward into view from right while fading in.',
  'slide-right': 'Slides rightward into view from left while fading in.',
};

const AnimationPreviewCard: React.FC<{
  type: string;
  duration: number;
  infinite: boolean;
  trigger?: 'auto' | 'click' | 'dblclick' | 'hover' | 'focus' | 'scroll';
  nodeType?: string;
  fill?: string;
}> = ({ type, duration, infinite, trigger = 'auto', nodeType, fill }) => {
  const [key, setKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTriggeredByClick, setIsTriggeredByClick] = useState(false);

  const restartAnimation = () => {
    setIsPaused(false);
    setIsTriggeredByClick(true);
    setKey(prev => prev + 1);
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  let animationName = '';
  let timing = 'ease-out';
  switch (type) {
    case 'bounce':
      animationName = 'bounceSubtle';
      timing = 'ease-in-out';
      break;
    case 'pulse':
      animationName = 'pulseSubtle';
      timing = 'ease-in-out';
      break;
    case 'spin':
      animationName = 'spinSmooth';
      timing = 'linear';
      break;
    case 'fade-in':
      animationName = 'fadeIn';
      timing = 'ease-out';
      break;
    case 'slide-up':
      animationName = 'slideUp';
      timing = 'ease-out';
      break;
    case 'slide-down':
      animationName = 'slideDown';
      timing = 'ease-out';
      break;
    case 'slide-left':
      animationName = 'slideLeft';
      timing = 'ease-out';
      break;
    case 'slide-right':
      animationName = 'slideRight';
      timing = 'ease-out';
      break;
    case 'scale-up':
      animationName = 'scaleUp';
      timing = 'ease-out';
      break;
    case 'scale-down':
      animationName = 'scaleDown';
      timing = 'ease-out';
      break;
    case 'lift':
      animationName = 'lift';
      timing = 'ease-out';
      break;
    case 'glow':
      animationName = 'glow';
      timing = 'ease-out';
      break;
    case 'darken':
      animationName = 'darken';
      timing = 'ease-out';
      break;
    case 'brighten':
      animationName = 'brighten';
      timing = 'ease-out';
      break;
  }

  const isAnimating = 
    trigger === 'auto' || 
    trigger === 'scroll' ||
    (trigger === 'hover' && isHovered) || 
    (trigger === 'focus' && isFocused) ||
    ((trigger === 'click' || trigger === 'dblclick') && isTriggeredByClick);

  const iterationCount = infinite ? 'infinite' : '1';
  const fillMode = infinite ? 'none' : 'forwards';

  const animStyle: React.CSSProperties = {
    animationName: isAnimating ? animationName : 'none',
    animationDuration: `${duration}ms`,
    animationTimingFunction: timing,
    animationIterationCount: iterationCount,
    animationFillMode: fillMode,
    animationPlayState: isPaused ? 'paused' : 'running',
    backgroundColor: (fill && fill !== '#ffffff' && fill !== 'transparent') ? fill : '#4A3AFF',
  };

  const isCircle = nodeType === 'Circle';

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2 text-xs">
      {/* Header Row 1: Title & Controls */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Animation Preview</span>
        <div className="flex items-center gap-1">
          {infinite && trigger === 'auto' && (
            <button
              type="button"
              onClick={togglePause}
              title={isPaused ? "Resume animation" : "Pause animation"}
              className="text-[10px] text-slate-600 hover:text-[#4A3AFF] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:border-indigo-300 font-medium cursor-pointer shadow-xs transition-colors"
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
          )}
          <button
            type="button"
            onClick={restartAnimation}
            title="Replay animation"
            className="text-[10px] text-slate-600 hover:text-[#4A3AFF] px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:border-indigo-300 font-medium cursor-pointer shadow-xs transition-colors flex items-center gap-0.5"
          >
            <span>↺</span> Replay
          </button>
        </div>
      </div>

      {/* Header Row 2: Badges */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[#4A3AFF] font-mono lowercase bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-medium">
          {type}
        </span>
        <span className="text-[10px] text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-medium uppercase">
          {trigger}
        </span>
      </div>

      {/* Preview Box */}
      <div className="flex items-center justify-center py-5 bg-white rounded-md border border-dashed border-slate-200 overflow-hidden min-h-[85px] relative">
        <div
          key={key}
          style={animStyle}
          tabIndex={0}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onClick={() => {
            if (trigger === 'click') {
              setIsTriggeredByClick(true);
              setKey(prev => prev + 1);
            }
          }}
          onDoubleClick={() => {
            if (trigger === 'dblclick') {
              setIsTriggeredByClick(true);
              setKey(prev => prev + 1);
            }
          }}
          className={`${isCircle ? 'w-11 h-11 rounded-full' : 'px-4 py-2 rounded-lg'} text-xs font-semibold text-white shadow-sm select-none flex items-center justify-center transition-all cursor-pointer outline-none focus:ring-2 focus:ring-indigo-400`}
          title={
            trigger === 'click' ? "Click shape to test animation" : 
            trigger === 'dblclick' ? "Double-click shape to test animation" :
            trigger === 'hover' ? "Hover shape to test animation" : 
            trigger === 'focus' ? "Focus/Click shape to test animation" :
            trigger === 'scroll' ? "Triggers on scroll into view" :
            "Auto animation"
          }
        >
          <span>{nodeType || 'Element'}</span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
        <span className="truncate min-w-0 flex-1">
          {trigger === 'click' ? '👉 Click shape to test' : 
           trigger === 'dblclick' ? '✌️ Double-click shape to test' :
           trigger === 'hover' ? '🖱️ Hover shape to test' : 
           trigger === 'focus' ? '🎯 Focus shape to test' :
           trigger === 'scroll' ? '📜 Triggers on scroll into view' :
           (ANIMATION_DESCRIPTIONS[type] || 'Keyframe animation')}
        </span>
        <span className="font-mono text-slate-500 whitespace-nowrap shrink-0">{duration}ms • {infinite ? '∞' : '1x'}</span>
      </div>
    </div>
  );
};

export const RightSidebar: React.FC = () => {
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const nodes = useCanvasStore((state) => state.nodes);
  const updateNodes = useCanvasStore((state) => state.updateNodes);
  const reorderNodes = useCanvasStore((state) => state.reorderNodes);
  
  const createComponent = useCanvasStore((state) => state.createComponent);
  const updateVariant = useCanvasStore((state) => state.updateVariant);
  const propagateComponent = useCanvasStore((state) => state.propagateComponent);
  const detachInstance = useCanvasStore((state) => state.detachInstance);
  const selectNodes = useCanvasStore((state) => state.selectNodes);
  const setToastMessage = useCanvasStore((state) => state.setToastMessage);
  const addPropDefinition = useCanvasStore((state) => state.addPropDefinition);
  const removePropDefinition = useCanvasStore((state) => state.removePropDefinition);
  const updatePropOverride = useCanvasStore((state) => state.updatePropOverride);
  const bindProp = useCanvasStore((state) => state.bindProp);
  const updatePropDefinition = useCanvasStore((state) => state.updatePropDefinition);
  const generateResponsiveVariants = useCanvasStore((state) => state.generateResponsiveVariants);
  const pickingTriggerForNodeId = useCanvasStore((state) => state.pickingTriggerForNodeId);
  const setPickingTriggerForNodeId = useCanvasStore((state) => state.setPickingTriggerForNodeId);

  const [activeVariantTab, setActiveVariantTab] = useState<'default' | 'hover' | 'active' | 'disabled'>('default');
  const [showCodePreview, setShowCodePreview] = useState(false);

  const handleToggleExposedProp = (masterId: string, childId: string, field: 'text' | 'fill' | 'src') => {
    const master = nodes.find(n => n.id === masterId);
    const child = nodes.find(n => n.id === childId);
    if (!master || !child) return;

    const existingPropId = child.boundProps?.[field];
    
    if (existingPropId) {
      removePropDefinition(masterId, existingPropId);
      bindProp(childId, field, null);
    } else {
      const newPropId = uuidv4();
      const typeMap: Record<string, 'string'|'color'|'image'> = {
        'text': 'string',
        'fill': 'color',
        'src': 'image'
      };
      const type = typeMap[field];
      addPropDefinition(masterId, {
        id: newPropId,
        name: `${child.type.toLowerCase()}${field.charAt(0).toUpperCase() + field.slice(1)}`,
        type: type as any,
        defaultValue: field === 'text' ? child.text : field === 'fill' ? child.fill : ''
      });
      bindProp(childId, field, newPropId);
    }
  };

  useEffect(() => {
    setActiveVariantTab('default');
  }, [selectedIds.join(',')]);

  if (selectedIds.length === 0) {
    return (
      <div className="w-72 bg-white border-l border-slate-200 p-6 flex flex-col gap-4 z-10 shadow-sm text-slate-400 text-sm text-center pt-20 shrink-0">
        Select an element to edit its properties
      </div>
    );
  }

  const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id));
  if (selectedNodes.length === 0) return null;
  const primaryNode = selectedNodes[0];

  const parentFrame = primaryNode?.parentId ? nodes.find(n => n.id === primaryNode.parentId) : null;
  const isConnectable = !!parentFrame && parentFrame.type === 'Frame';
  const compatibleFrames = isConnectable 
    ? nodes.filter(n => n.type === 'Frame' && n.frameType === parentFrame.frameType && n.id !== parentFrame.id) 
    : [];

  const getAllDescendants = (parentId: string): CanvasNode[] => {
    const children = nodes.filter(n => n.parentId === parentId);
    let descendants = [...children];
    children.forEach(c => descendants.push(...getAllDescendants(c.id)));
    return descendants;
  };

  const masterDescendants = primaryNode.isMasterComponent ? getAllDescendants(primaryNode.id) : [];

  let curr: CanvasNode | undefined = primaryNode;
  let rootInstance: CanvasNode | undefined = undefined;
  
  if (primaryNode?.componentId) {
    while (curr?.parentId) {
      const parent = nodes.find(n => n.id === curr!.parentId);
      if (!parent || !parent.componentId) break;
      curr = parent;
    }
    rootInstance = curr;
  }
  
  const rootMaster = rootInstance?.componentId ? nodes.find(n => n.id === rootInstance.componentId) : null;

  let masterParent: CanvasNode | null = null;
  let currCheck: CanvasNode | undefined = primaryNode;
  while (currCheck?.parentId) {
    const p = nodes.find(n => n.id === currCheck!.parentId);
    if (!p) break;
    if (p.isMasterComponent) {
      masterParent = p;
      break;
    }
    currCheck = p;
  }

  const getValue = (field: keyof CanvasNode) => {
    if (primaryNode.isMasterComponent && activeVariantTab !== 'default') {
      const variantVal = primaryNode.variants?.[activeVariantTab]?.[field];
      if (variantVal !== undefined) return variantVal;
    }
    return primaryNode[field];
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, field: keyof CanvasNode, isNumber: boolean) => {
    let value: any = e.target.value;
    if (isNumber) {
      value = parseFloat(value);
      if (isNaN(value)) return;
    }
    
    if (primaryNode.isMasterComponent && activeVariantTab !== 'default') {
      updateVariant(primaryNode.id, activeVariantTab, { [field]: value });
    } else {
      updateNodes(selectedIds, { [field]: value }, true);
    }
  };

  const getShadow = (): CanvasNode['boxShadow'] => {
    if (primaryNode.isMasterComponent && activeVariantTab !== 'default') {
      const v = primaryNode.variants?.[activeVariantTab]?.boxShadow;
      if (v) return v;
    }
    return primaryNode.boxShadow;
  };

  const getHexColor = (colorStr?: string) => {
    if (!colorStr) return '#000000';
    if (colorStr.startsWith('#')) {
      return colorStr.length >= 7 ? colorStr.slice(0, 7) : '#000000';
    }
    if (colorStr.startsWith('rgb')) {
      const match = colorStr.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]).toString(16).padStart(2, '0');
        const g = parseInt(match[1]).toString(16).padStart(2, '0');
        const b = parseInt(match[2]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
      }
    }
    return '#000000';
  };

  const handleShadowChange = (updates: Partial<NonNullable<CanvasNode['boxShadow']>>) => {
    const currentShadow = getShadow() || {
      enabled: false,
      x: 0,
      y: 4,
      blur: 10,
      spread: 0,
      color: 'rgba(0,0,0,0.25)'
    };
    const newShadow = { ...currentShadow, ...updates };
    if (primaryNode.isMasterComponent && activeVariantTab !== 'default') {
      updateVariant(primaryNode.id, activeVariantTab, { boxShadow: newShadow });
    } else {
      updateNodes(selectedIds, { boxShadow: newShadow }, true);
    }
  };

  const handleAnimationChange = (updates: Partial<NonNullable<CanvasNode['animation']>>) => {
    const currentAnim = primaryNode.animation || {
      type: 'none',
      duration: 1000,
      infinite: true
    };
    const newAnim = { ...currentAnim, ...updates };
    if (primaryNode.isMasterComponent && activeVariantTab !== 'default') {
      updateVariant(primaryNode.id, activeVariantTab, { animation: newAnim });
    } else {
      updateNodes(selectedIds, { animation: newAnim }, true);
    }
  };

  const hasType = (type: string) => selectedNodes.some(n => n.type === type);
  const hasFill = selectedNodes.some(n => n.type !== 'Image' && n.type !== 'Line');
  const hasStroke = selectedNodes.some(n => n.type === 'Line');
  const hasText = selectedNodes.some(n => n.type === 'Text');
  const hasDimensions = selectedNodes.some(n => n.type === 'Rect' || n.type === 'Image' || n.type === 'Frame');
  const hasRadius = selectedNodes.some(n => n.type === 'Circle' || n.type === 'Triangle');
  
  return (
    <div className="w-72 bg-white border-l border-slate-200 p-6 flex flex-col gap-6 z-10 shadow-sm overflow-y-auto overflow-x-hidden shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-lg text-slate-800 flex items-center gap-2">
          {primaryNode.isMasterComponent && <Component size={18} className="text-[#4A3AFF]" />}
          {primaryNode.componentId && <Component size={18} className="text-[#C65D3B]" />}
          Properties
        </h3>
        <span className="text-xs font-mono font-medium px-2 py-1 bg-slate-100 text-slate-500 rounded">
          {selectedNodes.length === 1 ? primaryNode.type : 'Multiple'}
        </span>
      </div>

      {/* Component UI */}
      {selectedNodes.length >= 1 && selectedNodes.every(n => !n.isMasterComponent && !n.componentId) && (
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100">
          <button 
            onClick={() => createComponent(selectedIds, `New Component`)}
            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-[#4A3AFF] font-medium rounded transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Component size={16} /> Create Component
          </button>
        </div>
      )}

      {selectedNodes.length === 1 && (
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-100">
          {primaryNode.type === 'Frame' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Frame Name</label>
                <input 
                  type="text" 
                  value={primaryNode.name || ''} 
                  onChange={(e) => updateNodes([primaryNode.id], { name: e.target.value })}
                  className="border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-[#4A3AFF]"
                  placeholder="e.g. Home Screen"
                />
                {primaryNode.variantOf && (() => {
                  const parentPage = nodes.find(n => n.id === primaryNode.variantOf);
                  return (
                    <div className="flex items-center justify-between p-2 bg-indigo-50/60 border border-indigo-100 rounded-lg text-xs mt-2">
                      <span className="text-slate-600 font-medium">Linked Screen: <strong className="text-[#4A3AFF]">{parentPage?.name || 'Primary Page'}</strong></span>
                      <span className="px-1.5 py-0.5 bg-[#4A3AFF] text-white text-[10px] font-bold rounded uppercase">Variant</span>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Responsive Layout</span>
                  <span className="text-[10px] text-[#4A3AFF] font-bold">Auto-Reflow</span>
                </label>
                {(() => {
                  const targetPrimaryId = primaryNode.variantOf || primaryNode.id;
                  const hasVariants = nodes.some(n => n.type === 'Frame' && n.variantOf === targetPrimaryId);
                  return (
                    <button
                      onClick={() => generateResponsiveVariants(primaryNode.id)}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Smartphone size={15} className="text-emerald-400" />
                      {hasVariants ? 'Update Screen Variants' : 'Generate Screen Variants'} ({primaryNode.frameType === 'desktop' ? 'Tablet & Mobile' : primaryNode.frameType === 'tablet' ? 'Desktop & Mobile' : 'Desktop & Tablet'})
                    </button>
                  );
                })()}
                <p className="text-[11px] text-slate-400 leading-snug">
                  Creates or syncs side-by-side adapted frames so you can visually inspect & customize your design across all screen sizes.
                </p>
              </div>
            </div>
          )}

          {primaryNode.isMasterComponent && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#4A3AFF] uppercase tracking-wider">Master Component</label>
                <input 
                  type="text" 
                  value={primaryNode.componentName || ''} 
                  onChange={(e) => updateNodes([primaryNode.id], { componentName: e.target.value })}
                  className="border border-[#4A3AFF]/30 rounded px-2 py-1.5 text-sm bg-indigo-50/30 focus:outline-none focus:border-[#4A3AFF]"
                  placeholder="Component Name"
                />
              </div>

              <div className="flex flex-col gap-1 mt-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Variant State</label>
                <div className="flex flex-wrap gap-1">
                  {(['default', 'hover', 'active', 'disabled'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setActiveVariantTab(v)}
                      className={`px-2 py-1 rounded text-xs font-medium capitalize transition-colors ${
                        activeVariantTab === v ? 'bg-[#4A3AFF] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={() => { propagateComponent(primaryNode.id); setToastMessage('Changes pushed to instances!'); }}
                className="w-full mt-2 py-2 bg-[#1A1A1D] hover:bg-opacity-90 text-white font-medium rounded transition-colors text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Push Changes to Instances
              </button>

              {masterDescendants.length > 0 && (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-100">
                  <label className="text-xs font-semibold text-[#4A3AFF] uppercase tracking-wider">
                    Available Elements
                  </label>
                  <div className="flex flex-col gap-2">
                    {masterDescendants.map(child => {
                      const textPropId = child.boundProps?.text;
                      const fillPropId = child.boundProps?.fill;
                      const srcPropId = child.boundProps?.src;
                      
                      const textProp = textPropId ? primaryNode.propsDefinition?.find(p => p.id === textPropId) : null;
                      const fillProp = fillPropId ? primaryNode.propsDefinition?.find(p => p.id === fillPropId) : null;
                      const srcProp = srcPropId ? primaryNode.propsDefinition?.find(p => p.id === srcPropId) : null;

                      return (
                        <div key={child.id} className="flex flex-col gap-2 p-2 bg-slate-50 border border-slate-100 rounded">
                          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            {child.type} <span className="text-[10px] text-slate-400 font-normal">({child.id.slice(0, 4)})</span>
                          </div>
                          
                          {child.type === 'Text' && (
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-800">
                                <input 
                                  type="checkbox" 
                                  checked={!!textPropId} 
                                  onChange={() => handleToggleExposedProp(primaryNode.id, child.id, 'text')} 
                                  className="accent-[#4A3AFF]"
                                />
                                Expose Text as prop
                              </label>
                              {textProp && (
                                <input 
                                  type="text" 
                                  value={textProp.name}
                                  onChange={(e) => updatePropDefinition(primaryNode.id, textProp.id, { name: e.target.value })}
                                  placeholder="Prop name (e.g. titleText)"
                                  className="mt-1 ml-5 border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:border-[#4A3AFF] focus:outline-none"
                                />
                              )}
                            </div>
                          )}
                          
                          {(child.type !== 'Image' && child.type !== 'Line' && child.type !== 'Frame') && (
                            <div className="flex flex-col gap-1 mt-1">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-800">
                                <input 
                                  type="checkbox" 
                                  checked={!!fillPropId} 
                                  onChange={() => handleToggleExposedProp(primaryNode.id, child.id, 'fill')} 
                                  className="accent-[#4A3AFF]"
                                />
                                Expose Fill Color as prop
                              </label>
                              {fillProp && (
                                <input 
                                  type="text" 
                                  value={fillProp.name}
                                  onChange={(e) => updatePropDefinition(primaryNode.id, fillProp.id, { name: e.target.value })}
                                  placeholder="Prop name (e.g. bgColor)"
                                  className="mt-1 ml-5 border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:border-[#4A3AFF] focus:outline-none"
                                />
                              )}
                            </div>
                          )}

                          {child.type === 'Image' && (
                            <div className="flex flex-col gap-1 mt-1">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-800">
                                <input 
                                  type="checkbox" 
                                  checked={!!srcPropId} 
                                  onChange={() => handleToggleExposedProp(primaryNode.id, child.id, 'src')} 
                                  className="accent-[#4A3AFF]"
                                />
                                Expose Image Source as prop
                              </label>
                              {srcProp && (
                                <input 
                                  type="text" 
                                  value={srcProp.name}
                                  onChange={(e) => updatePropDefinition(primaryNode.id, srcProp.id, { name: e.target.value })}
                                  placeholder="Prop name (e.g. avatarUrl)"
                                  className="mt-1 ml-5 border border-slate-200 rounded px-2 py-1 text-xs bg-white focus:border-[#4A3AFF] focus:outline-none"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

                <button 
                  onClick={() => setShowCodePreview(true)}
                  className="w-full mt-2 py-1.5 bg-[#4A3AFF]/10 text-[#4A3AFF] hover:bg-[#4A3AFF]/20 font-medium rounded transition-colors text-xs flex items-center justify-center gap-2"
                >
                  <Component size={14} /> View React Code
                </button>

              {showCodePreview && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
                      <h3 className="font-semibold text-slate-800">React Code Preview</h3>
                      <button onClick={() => setShowCodePreview(false)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <div className="p-4 overflow-auto bg-slate-900 text-slate-300 font-mono text-sm leading-relaxed whitespace-pre">
                      {generateReactCode(primaryNode, getAllDescendants(primaryNode.id))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {rootInstance && rootMaster && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#C65D3B] uppercase tracking-wider">Component Instance</label>
                <div className="flex gap-2">
                  <select 
                    value={rootInstance.variant || 'default'}
                    onChange={(e) => updateNodes([rootInstance!.id], { variant: e.target.value as any }, true)}
                    className="border border-[#C65D3B]/30 rounded px-2 py-1.5 text-sm bg-orange-50/30 flex-1"
                  >
                    <option value="default">Default</option>
                    <option value="hover">Hover</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 mt-2">
                <button 
                  onClick={() => selectNodes([rootMaster!.id])}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded transition-colors text-xs flex items-center justify-center gap-1"
                >
                  <ArrowRight size={14} /> Go to Master
                </button>
                <button 
                  onClick={() => detachInstance(rootInstance!.id)}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 font-medium rounded transition-colors text-xs flex items-center justify-center gap-1"
                >
                  <Unlink size={14} /> Detach
                </button>
              </div>

              {rootMaster.propsDefinition && rootMaster.propsDefinition.length > 0 && (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-orange-200/50">
                  <label className="text-xs font-semibold text-[#C65D3B] uppercase tracking-wider">Component Props</label>
                  {rootMaster.propsDefinition.map(prop => (
                    <div key={prop.id} className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500">{prop.name}</label>
                      <input 
                        type={prop.type === 'color' ? 'color' : prop.type === 'boolean' ? 'checkbox' : prop.type === 'number' ? 'number' : 'text'}
                        checked={prop.type === 'boolean' ? ((rootInstance!.propOverrides?.[prop.id] !== undefined) ? !!rootInstance!.propOverrides[prop.id] : !!prop.defaultValue) : undefined}
                        value={prop.type !== 'boolean' ? ((rootInstance!.propOverrides?.[prop.id] !== undefined) ? rootInstance!.propOverrides[prop.id] : (prop.defaultValue || '')) : undefined}
                        onChange={(e) => updatePropOverride(rootInstance!.id, prop.id, prop.type === 'boolean' ? e.target.checked : prop.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                        className={`border border-[#C65D3B]/30 rounded px-2 py-1.5 text-sm bg-orange-50/30 focus:outline-none focus:border-[#C65D3B] ${prop.type === 'color' ? 'h-8 w-full p-0 cursor-pointer' : ''}`}
                        placeholder={`Override ${prop.type}...`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      )}

      {selectedNodes.length === 1 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">X</label>
            <input 
              type="number" 
              value={Math.round((getValue('x') as number) || 0)} 
              onChange={(e) => handleChange(e, 'x', true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Y</label>
            <input 
              type="number" 
              value={Math.round((getValue('y') as number) || 0)} 
              onChange={(e) => handleChange(e, 'y', true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
            />
          </div>
        </div>
      )}

      {selectedNodes.length === 1 && hasDimensions && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">W</label>
              <input 
                type="number" 
                value={Math.round((getValue('width') as number) || 0)} 
                onChange={(e) => handleChange(e, 'width', true)}
                className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">H</label>
              <input 
                type="number" 
                value={Math.round((getValue('height') as number) || 0)} 
                onChange={(e) => handleChange(e, 'height', true)}
                className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {selectedNodes.length === 1 && hasRadius && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Radius</label>
          <input 
            type="number" 
            value={Math.round((getValue('radius') as number) || 0)} 
            onChange={(e) => handleChange(e, 'radius', true)}
            className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
          />
        </div>
      )}

      {hasStroke && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stroke Width</label>
          <input 
            type="number" 
            value={(getValue('strokeWidth') as number) || 1} 
            onChange={(e) => handleChange(e, 'strokeWidth', true)}
            className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
          />
        </div>
      )}

      {hasFill && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {primaryNode.type === 'Frame' ? 'Background Color' : 'Fill Color'}
            </label>
            {masterParent?.propsDefinition && masterParent.propsDefinition.filter(p => p.type === 'color').length > 0 && (
              <select
                value={primaryNode.boundProps?.fill || ''}
                onChange={(e) => bindProp(primaryNode.id, 'fill', e.target.value || null)}
                className="text-[10px] bg-indigo-50 border-none text-[#4A3AFF] font-medium outline-none rounded p-0.5"
              >
                <option value="">Bind to Prop...</option>
                {masterParent.propsDefinition.filter(p => p.type === 'color').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex gap-2 items-center">
            {/* Clickable Color Swatch Box */}
            <div 
              className="relative w-9 h-9 shrink-0 rounded-lg border border-slate-300 shadow-sm cursor-pointer overflow-hidden transition-all hover:scale-105 hover:ring-2 hover:ring-indigo-500/30"
              style={{ backgroundColor: (getValue('fill') as string) || '#ffffff' }}
              title="Click to choose color"
            >
              <input 
                type="color" 
                value={(getValue('fill') as string) || '#ffffff'} 
                onChange={(e) => handleChange(e, 'fill', false)}
                onBlur={(e) => handleChange(e, 'fill', false)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <input 
              type="text"
              value={(getValue('fill') as string) || ''}
              onChange={(e) => handleChange(e, 'fill', false)}
              onBlur={(e) => handleChange(e, 'fill', false)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 font-mono flex-1 uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="#FFFFFF"
            />
          </div>
        </div>
      )}

      {hasStroke && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stroke Color</label>
          <div className="flex gap-2 items-center">
            {/* Clickable Color Swatch Box */}
            <div 
              className="relative w-9 h-9 shrink-0 rounded-lg border border-slate-300 shadow-sm cursor-pointer overflow-hidden transition-all hover:scale-105 hover:ring-2 hover:ring-indigo-500/30"
              style={{ backgroundColor: (getValue('stroke') as string) || '#000000' }}
              title="Click to choose stroke color"
            >
              <input 
                type="color" 
                value={(getValue('stroke') as string) || '#000000'} 
                onChange={(e) => handleChange(e, 'stroke', false)}
                onBlur={(e) => handleChange(e, 'stroke', false)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <input 
              type="text"
              value={(getValue('stroke') as string) || ''}
              onChange={(e) => handleChange(e, 'stroke', false)}
              onBlur={(e) => handleChange(e, 'stroke', false)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 font-mono flex-1 uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="#000000"
            />
          </div>
        </div>
      )}

      {hasText && (
        <>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Text</label>
              {masterParent?.propsDefinition && masterParent.propsDefinition.filter(p => p.type === 'string').length > 0 && (
                <select
                  value={primaryNode.boundProps?.text || ''}
                  onChange={(e) => bindProp(primaryNode.id, 'text', e.target.value || null)}
                  className="text-[10px] bg-indigo-50 border-none text-[#4A3AFF] font-medium outline-none rounded p-0.5"
                >
                  <option value="">Bind to Prop...</option>
                  {masterParent.propsDefinition.filter(p => p.type === 'string').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            <input 
              type="text" 
              value={(getValue('text') as string) || ''} 
              onChange={(e) => handleChange(e, 'text', false)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Font Size</label>
            <input 
              type="number" 
              value={(getValue('fontSize') as number) || 16} 
              onChange={(e) => handleChange(e, 'fontSize', true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Font Family</label>
            <select 
              value={(getValue('fontFamily') as string) || 'Inter'}
              onChange={(e) => handleChange(e, 'fontFamily', false)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50"
            >
              <option value="Inter">Inter</option>
              <option value="Space Grotesk">Space Grotesk</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
            </select>
          </div>
        </>
      )}

      {hasType('Rect') && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Border Radius</label>
          <input 
            type="number" 
            value={(getValue('cornerRadius') as number) || 0} 
            onChange={(e) => handleChange(e, 'cornerRadius', true)}
            className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
          />
        </div>
      )}

      {/* Effects Panel */}
      <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Effects</label>
        
        {/* Opacity */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-600 font-medium">Opacity</span>
            <span className="font-mono text-slate-400">{getValue('opacity') !== undefined ? `${getValue('opacity')}%` : '100%'}</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={getValue('opacity') !== undefined ? (getValue('opacity') as number) : 100}
              onChange={(e) => handleChange(e, 'opacity', true)}
              className="flex-1 accent-[#4A3AFF] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <input 
              type="number" 
              min="0" 
              max="100" 
              value={getValue('opacity') !== undefined ? (getValue('opacity') as number) : 100}
              onChange={(e) => handleChange(e, 'opacity', true)}
              className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 font-mono text-center"
            />
          </div>
        </div>

        {/* Box Shadow */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Box Shadow</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={!!getShadow()?.enabled}
                onChange={(e) => handleShadowChange({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#4A3AFF]"></div>
            </label>
          </div>

          {getShadow()?.enabled && (() => {
            const shadow = getShadow()!;
            return (
              <div className="flex flex-col gap-2 p-2.5 bg-slate-50 rounded border border-slate-200 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 text-[10px] uppercase font-mono">Offset X</span>
                    <input 
                      type="number" 
                      value={shadow.x ?? 0}
                      onChange={(e) => handleShadowChange({ x: parseFloat(e.target.value) || 0 })}
                      className="border border-slate-200 rounded px-2 py-1 text-xs bg-white font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 text-[10px] uppercase font-mono">Offset Y</span>
                    <input 
                      type="number" 
                      value={shadow.y ?? 4}
                      onChange={(e) => handleShadowChange({ y: parseFloat(e.target.value) || 0 })}
                      className="border border-slate-200 rounded px-2 py-1 text-xs bg-white font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 text-[10px] uppercase font-mono">Blur</span>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      value={shadow.blur ?? 10}
                      onChange={(e) => handleShadowChange({ blur: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                      className="border border-slate-200 rounded px-2 py-1 text-xs bg-white font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-400 text-[10px] uppercase font-mono">Spread</span>
                    <input 
                      type="number" 
                      value={shadow.spread ?? 0}
                      onChange={(e) => handleShadowChange({ spread: parseFloat(e.target.value) || 0 })}
                      className="border border-slate-200 rounded px-2 py-1 text-xs bg-white font-mono"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                  <div 
                    className="relative w-8 h-8 shrink-0 rounded-lg border border-slate-300 shadow-sm cursor-pointer overflow-hidden transition-all hover:scale-105 hover:ring-2 hover:ring-indigo-500/30"
                    style={{ backgroundColor: shadow.color || 'rgba(0,0,0,0.25)' }}
                    title="Click to choose shadow color"
                  >
                    <input 
                      type="color" 
                      value={getHexColor(shadow.color)}
                      onChange={(e) => handleShadowChange({ color: e.target.value })}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <input 
                    type="text" 
                    value={shadow.color || 'rgba(0,0,0,0.25)'}
                    onChange={(e) => handleShadowChange({ color: e.target.value })}
                    className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-xs bg-white font-mono"
                    placeholder="rgba(0,0,0,0.25)"
                  />
                </div>
              </div>
            );
          })()}
        </div>

        {/* Blur (Gaussian Blur) */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-50">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-600 font-medium">Layer Blur</span>
            <span className="font-mono text-slate-400">{(getValue('filterBlur') as number) || 0}px</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" 
              min="0" 
              max="30" 
              value={(getValue('filterBlur') as number) || 0}
              onChange={(e) => handleChange(e, 'filterBlur', true)}
              className="flex-1 accent-[#4A3AFF] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <input 
              type="number" 
              min="0" 
              max="50" 
              value={(getValue('filterBlur') as number) || 0}
              onChange={(e) => handleChange(e, 'filterBlur', true)}
              className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 font-mono text-center"
            />
          </div>
        </div>
      </div>

      {/* Transitions Panel */}
      <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Transitions</label>
        
        {/* Hover Effect */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600 font-medium">Hover Effect</label>
          <select 
            value={(getValue('hoverEffect') as string) || 'none'}
            onChange={(e) => handleChange(e, 'hoverEffect', false)}
            className="border border-slate-200 rounded px-2 py-1.5 text-xs bg-slate-50 w-full"
          >
            <option value="none">None</option>
            <option value="scale-up">Scale Up (1.05x)</option>
            <option value="scale-down">Scale Down (0.95x)</option>
            <option value="lift">Lift (Elevate & Shadow)</option>
            <option value="glow">Glow (Outer Light)</option>
            <option value="darken">Darken</option>
            <option value="brighten">Brighten</option>
          </select>
        </div>

        {/* Transition Duration */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-600 font-medium">Duration</span>
            <span className="font-mono text-slate-400">{(getValue('transitionDuration') as number) ?? 300}ms</span>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="range" 
              min="50" 
              max="2000" 
              step="50"
              value={(getValue('transitionDuration') as number) ?? 300}
              onChange={(e) => handleChange(e, 'transitionDuration', true)}
              className="flex-1 accent-[#4A3AFF] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <input 
              type="number" 
              min="0" 
              max="5000" 
              step="50"
              value={(getValue('transitionDuration') as number) ?? 300}
              onChange={(e) => handleChange(e, 'transitionDuration', true)}
              className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-slate-50 font-mono text-center"
            />
          </div>
        </div>

        {/* Easing Function */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-600 font-medium">Easing</label>
          <select 
            value={(getValue('transitionTimingFunction') as string) || 'ease'}
            onChange={(e) => handleChange(e, 'transitionTimingFunction', false)}
            className="border border-slate-200 rounded px-2 py-1.5 text-xs bg-slate-50 w-full"
          >
            <option value="ease">Ease (Default - Natural)</option>
            <option value="ease-in">Ease In (Accelerates)</option>
            <option value="ease-out">Ease Out (Decelerates / Snappy)</option>
            <option value="ease-in-out">Ease In Out (Smooth S-Curve)</option>
            <option value="linear">Linear (Constant Speed)</option>
          </select>
          <p className="text-[10px] text-slate-500 leading-tight bg-slate-50 p-1.5 rounded border border-slate-100">
            {EASING_DESCRIPTIONS[(getValue('transitionTimingFunction') as string) || 'ease']}
          </p>
        </div>

        {/* Live Hover Effect Preview Section */}
        {((getValue('hoverEffect') as string) || 'none') !== 'none' && (
          <HoverPreviewCard
            effect={(getValue('hoverEffect') as string)}
            duration={(getValue('transitionDuration') as number) ?? 300}
            timing={(getValue('transitionTimingFunction') as string) || 'ease'}
          />
        )}
      </div>

      {/* Animations Panel */}
      <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Animations</label>
        
        {/* Animation Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-600 font-medium">Type</label>
          <select 
            value={primaryNode.animation?.type || 'none'}
            onChange={(e) => handleAnimationChange({ type: e.target.value as any })}
            className="border border-slate-200 rounded px-2 py-1.5 text-xs bg-slate-50 w-full"
          >
            <option value="none">None</option>
            <option value="bounce">Bounce</option>
            <option value="pulse">Pulse</option>
            <option value="spin">Spin</option>
            <option value="fade-in">Fade In</option>
            <option value="slide-up">Slide Up</option>
            <option value="slide-down">Slide Down</option>
            <option value="slide-left">Slide Left</option>
            <option value="slide-right">Slide Right</option>
          </select>
        </div>

        {primaryNode.animation?.type && primaryNode.animation.type !== 'none' && (
          <div className="flex flex-col gap-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 text-xs">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Duration</span>
                <span className="font-mono text-slate-400">{primaryNode.animation?.duration ?? 1000}ms</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="200" 
                  max="5000" 
                  step="100"
                  value={primaryNode.animation?.duration ?? 1000}
                  onChange={(e) => handleAnimationChange({ duration: parseInt(e.target.value) || 1000 })}
                  className="flex-1 accent-[#4A3AFF] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                />
                <input 
                  type="number" 
                  min="100" 
                  max="10000" 
                  step="100"
                  value={primaryNode.animation?.duration ?? 1000}
                  onChange={(e) => handleAnimationChange({ duration: parseInt(e.target.value) || 1000 })}
                  className="w-16 border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-white font-mono text-center"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-200">
              <label className="text-slate-600 font-medium text-xs">Trigger Action</label>
              <select
                value={primaryNode.animation?.trigger || 'auto'}
                onChange={(e) => handleAnimationChange({ trigger: e.target.value as any })}
                className="border border-slate-200 rounded px-2 py-1 text-xs bg-white w-full font-medium"
              >
                <option value="auto">Auto (On Load / Loop)</option>
                <option value="click">On Click</option>
                <option value="dblclick">On Double Click</option>
                <option value="hover">On Hover</option>
                <option value="focus">On Focus / Press</option>
                <option value="scroll">On Scroll into View</option>
              </select>
            </div>

            {/* Trigger Target Element Selector */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <label className="text-slate-600 font-medium text-xs">Trigger Element</label>
                {primaryNode.animation?.triggerNodeId && (
                  <button 
                    onClick={() => handleAnimationChange({ triggerNodeId: undefined })}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1 font-medium hover:underline"
                    title="Remove custom trigger element and reset to self"
                  >
                    <X size={12} /> Reset to Self
                  </button>
                )}
              </div>

              {pickingTriggerForNodeId === primaryNode.id ? (
                <div className="flex flex-col gap-1 p-2 bg-indigo-50 border border-indigo-200 rounded text-indigo-700 text-xs animate-pulse">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Target size={14} className="text-indigo-600" />
                      Click element on canvas...
                    </span>
                    <button 
                      onClick={() => setPickingTriggerForNodeId(null)}
                      className="text-slate-500 hover:text-slate-700 p-0.5"
                      title="Cancel picking"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-600/80 leading-tight">Click any other shape/frame on the canvas to make it trigger this animation.</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded text-xs shadow-sm">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <Target size={14} className={primaryNode.animation?.triggerNodeId ? "text-indigo-600 shrink-0" : "text-slate-400 shrink-0"} />
                    <span className="truncate font-medium text-slate-700">
                      {primaryNode.animation?.triggerNodeId ? (
                        nodes.find(n => n.id === primaryNode.animation?.triggerNodeId)?.name || 'Custom Element'
                      ) : (
                        'Self (This Element)'
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setPickingTriggerForNodeId(primaryNode.id);
                      setToastMessage("Click any element on canvas to set trigger source");
                    }}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shrink-0 ml-1"
                  >
                    {primaryNode.animation?.triggerNodeId ? 'Change' : 'Pick Element'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-600 text-xs font-medium">Loop Infinitely</span>
              <input 
                type="checkbox" 
                checked={primaryNode.animation?.infinite ?? true}
                onChange={(e) => handleAnimationChange({ infinite: e.target.checked })}
                className="w-4 h-4 accent-[#4A3AFF] rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {primaryNode.animation?.type && primaryNode.animation.type !== 'none' && (
          <AnimationPreviewCard
            type={primaryNode.animation.type}
            duration={primaryNode.animation.duration || 1000}
            infinite={primaryNode.animation.infinite ?? true}
            trigger={primaryNode.animation.trigger || 'auto'}
            nodeType={primaryNode.type}
            fill={primaryNode.fill}
          />
        )}
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Layering</label>
        <div className="flex gap-2">
          <button onClick={() => reorderNodes('front')} className="flex-1 p-2 flex justify-center items-center rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors" title="Bring to Front">
            <ChevronsUp size={16} />
          </button>
          <button onClick={() => reorderNodes('forward')} className="flex-1 p-2 flex justify-center items-center rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors" title="Bring Forward">
            <ChevronUp size={16} />
          </button>
          <button onClick={() => reorderNodes('backward')} className="flex-1 p-2 flex justify-center items-center rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors" title="Send Backward">
            <ChevronDown size={16} />
          </button>
          <button onClick={() => reorderNodes('back')} className="flex-1 p-2 flex justify-center items-center rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors" title="Send to Back">
            <ChevronsDown size={16} />
          </button>
        </div>
      </div>

      {isConnectable && compatibleFrames.length > 0 && (
        <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prototyping</label>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Navigate To</label>
            <select 
              value={primaryNode.linkTo || ''}
              onChange={(e) => updateNodes(selectedIds, { linkTo: e.target.value || undefined }, true)}
              className="border border-slate-200 rounded px-2 py-1.5 text-sm bg-slate-50 w-full"
            >
              <option value="">None</option>
              {compatibleFrames.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {`Frame - ${Math.round(frame.width || 0)}x${Math.round(frame.height || 0)} (ID: ${frame.id.slice(0,4)})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
