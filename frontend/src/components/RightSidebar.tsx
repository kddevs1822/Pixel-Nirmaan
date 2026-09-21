import React, { useState, useEffect } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { ChevronsUp, ChevronUp, ChevronDown, ChevronsDown, Component, Unlink, ArrowRight, RefreshCw, Monitor, Smartphone } from 'lucide-react';
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

  const renderNode = (node: CanvasNode, isRoot = false) => {
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

  const hasType = (type: string) => selectedNodes.some(n => n.type === type);
  const hasFill = selectedNodes.some(n => n.type !== 'Image' && n.type !== 'Line');
  const hasStroke = selectedNodes.some(n => n.type === 'Line');
  const hasText = selectedNodes.some(n => n.type === 'Text');
  const hasDimensions = selectedNodes.some(n => n.type === 'Rect' || n.type === 'Image' || n.type === 'Frame');
  const hasRadius = selectedNodes.some(n => n.type === 'Circle' || n.type === 'Triangle');
  
  return (
    <div className="w-72 bg-white border-l border-slate-200 p-6 flex flex-col gap-6 z-10 shadow-sm overflow-y-auto shrink-0">
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
