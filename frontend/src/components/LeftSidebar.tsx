import React, { useRef, useState } from 'react';
import { 
  Square, Circle, Type, Image as ImageIcon, Monitor, Tablet, Smartphone, Triangle, Minus, Spline, 
  MousePointer2, Link, Layers, Box, Edit2, Trash2, Edit3, CheckSquare, ToggleRight, ListFilter, 
  FormInput, Plus, X, Variable, FileText
} from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { NodeType } from '../store/useCanvasStore';

export const LeftSidebar: React.FC = () => {
  const { 
    addNode, nodes, pan, zoom, mode, setMode, spawnInstance, selectNodes, deleteComponent, setPan,
    stateVariables, addStateVariable, deleteStateVariable 
  } = useCanvasStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'tools' | 'components' | 'variables'>('tools');

  // Variable Creation & Edit State
  const [showAddVarModal, setShowAddVarModal] = useState(false);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [varName, setVarName] = useState('');
  const [varType, setVarType] = useState<'string' | 'number' | 'boolean' | 'array' | 'object'>('string');
  const [varDefaultVal, setVarDefaultVal] = useState('');

  const { updateStateVariable } = useCanvasStore();

  const masterComponents = nodes.filter(n => n.isMasterComponent);

  const getCenterOffset = () => {
    const centerX = (window.innerWidth / 2 - pan.x) / zoom;
    const centerY = (window.innerHeight / 2 - pan.y) / zoom;
    return { x: centerX - 50, y: centerY - 50 };
  };

  const handleAdd = (type: NodeType | 'Frame-Desktop' | 'Frame-Tablet' | 'Frame-Mobile' | 'Curve') => {
    const { x, y } = getCenterOffset();
    const frames = nodes.filter(n => n.type === 'Frame');
    
    let parentId = undefined;
    let localX = x;
    let localY = y;

    if (!type.startsWith('Frame')) {
      for (let i = frames.length - 1; i >= 0; i--) {
        const f = frames[i];
        if (x >= f.x && x <= f.x + (f.width || 0) && y >= f.y && y <= f.y + (f.height || 0)) {
          parentId = f.id;
          localX = x - f.x;
          localY = y - f.y;
          break;
        }
      }
    }
    
    if (type === 'Rect') addNode({ type: 'Rect', x: localX, y: localY, width: 100, height: 100, fill: '#C65D3B', cornerRadius: 0, parentId });
    else if (type === 'Circle') addNode({ type: 'Circle', x: localX + 50, y: localY + 50, radius: 50, fill: '#4A3AFF', parentId });
    else if (type === 'Triangle') addNode({ type: 'Triangle', x: localX + 50, y: localY + 50, radius: 50, fill: '#F2A93B', parentId });
    else if (type === 'Line') addNode({ type: 'Line', x: localX, y: localY, points: [0, 0, 100, 100], stroke: '#1A1A1D', strokeWidth: 4, parentId });
    else if (type === 'Curve') addNode({ type: 'Line', x: localX, y: localY, points: [0, 0, 50, 0, 100, 0], tension: 0.5, stroke: '#1A1A1D', strokeWidth: 4, parentId });
    else if (type === 'Text') addNode({ type: 'Text', x: localX, y: localY, text: 'Modern Craft', fontSize: 32, fontFamily: 'Space Grotesk', fill: '#1A1A1D', parentId });
    else if (type === 'Image') fileInputRef.current?.click();
    else if (type === 'Frame-Desktop') addNode({ type: 'Frame', x: x - (window.innerWidth / 2) + 50, y: y - (window.innerHeight / 2) + 50, width: window.innerWidth, height: window.innerHeight, fill: '#ffffff', frameType: 'desktop', name: `Desktop ${frames.length + 1}` });
    else if (type === 'Frame-Tablet') addNode({ type: 'Frame', x: x - 384 + 50, y: y - 512 + 50, width: 768, height: 1024, fill: '#ffffff', frameType: 'tablet', name: `Tablet ${frames.length + 1}` });
    else if (type === 'Frame-Mobile') addNode({ type: 'Frame', x: x - 196 + 50, y: y - 426 + 50, width: 393, height: 852, fill: '#ffffff', frameType: 'mobile', name: `Mobile ${frames.length + 1}` });
    else if (type === 'TextInput') addNode({ type: 'TextInput', x: localX, y: localY, width: 220, height: 40, fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 1.5, placeholder: 'Enter text...', inputType: 'text', parentId });
    else if (type === 'TextArea') addNode({ type: 'TextArea', x: localX, y: localY, width: 260, height: 90, fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 1.5, placeholder: 'Enter text area content...', parentId });
    else if (type === 'Checkbox') addNode({ type: 'Checkbox', x: localX, y: localY, width: 140, height: 24, text: 'Checkbox Label', defaultChecked: false, parentId });
    else if (type === 'Switch') addNode({ type: 'Switch', x: localX, y: localY, width: 110, height: 26, text: 'Toggle Option', defaultChecked: false, parentId });
    else if (type === 'SelectDropdown') addNode({ type: 'SelectDropdown', x: localX, y: localY, width: 200, height: 40, fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 1.5, placeholder: 'Select option...', options: ['Option 1', 'Option 2', 'Option 3'], parentId });
    else if (type === 'FormContainer') addNode({ type: 'FormContainer', x: localX, y: localY, width: 340, height: 260, fill: '#F8FAFC', stroke: '#64748B', name: 'Contact Form', parentId });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const { x, y } = getCenterOffset();
        const frames = nodes.filter(n => n.type === 'Frame');
        let parentId = undefined;
        let localX = x;
        let localY = y;
        for (let i = frames.length - 1; i >= 0; i--) {
          const f = frames[i];
          if (x >= f.x && x <= f.x + (f.width || 0) && y >= f.y && y <= f.y + (f.height || 0)) {
            parentId = f.id;
            localX = x - f.x;
            localY = y - f.y;
            break;
          }
        }
        addNode({ type: 'Image', x: localX, y: localY, width: 200, height: 200, src: event.target?.result as string, parentId });
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSpawnInstance = (masterId: string) => {
    const { x, y } = getCenterOffset();
    spawnInstance(masterId, x, y);
  };

  const parseVariableDefaultValue = (str: string, type: string) => {
    if (type === 'number') return Number(str) || 0;
    if (type === 'boolean') return str === 'true' || str === '1';
    if (type === 'array' || type === 'object') {
      if (!str.trim()) return type === 'array' ? [] : {};
      try {
        return JSON.parse(str);
      } catch {
        try {
          return new Function(`return (${str})`)();
        } catch {
          return type === 'array' ? [] : {};
        }
      }
    }
    return str;
  };

  const handleCreateOrUpdateVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!varName.trim()) return;

    const parsedVal = parseVariableDefaultValue(varDefaultVal, varType);
    const cleanName = varName.trim().replace(/\s+/g, '_');

    if (editingVarId) {
      updateStateVariable(editingVarId, {
        name: cleanName,
        type: varType,
        defaultValue: parsedVal,
      });
    } else {
      addStateVariable({
        name: cleanName,
        type: varType,
        defaultValue: parsedVal,
      });
    }

    setEditingVarId(null);
    setVarName('');
    setVarDefaultVal('');
    setShowAddVarModal(false);
  };

  const handleStartEditVariable = (v: any) => {
    setEditingVarId(v.id);
    setVarName(v.name);
    setVarType(v.type);
    setVarDefaultVal(typeof v.defaultValue === 'object' ? JSON.stringify(v.defaultValue) : String(v.defaultValue ?? ''));
    setShowAddVarModal(true);
  };

  const handleStartAddVariable = () => {
    setEditingVarId(null);
    setVarName('');
    setVarType('string');
    setVarDefaultVal('');
    setShowAddVarModal(true);
  };

  return (
    <div className="flex h-full shrink-0 z-10">
      {/* Primary Toolbar */}
      <div className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-6 gap-2 shadow-sm shrink-0 overflow-y-auto z-20">
        <div className="flex flex-col items-center gap-1 w-full pb-4 border-b border-slate-100">
          <button 
            onClick={() => { setMode('select'); setActiveTab('tools'); }} 
            className={`p-3 rounded-xl transition-colors ${mode === 'select' && activeTab === 'tools' ? 'bg-[#4A3AFF] text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`} 
            title="Select Tool"
          >
            <MousePointer2 size={20} />
          </button>
          <button 
            onClick={() => { setMode('connect'); setActiveTab('tools'); }} 
            className={`p-3 rounded-xl transition-colors ${mode === 'connect' ? 'bg-[#4A3AFF] text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`} 
            title="Connect Tool"
          >
            <Link size={20} />
          </button>
          <button 
            onClick={() => setActiveTab(activeTab === 'components' ? 'tools' : 'components')} 
            className={`p-3 rounded-xl transition-colors ${activeTab === 'components' ? 'bg-[#C65D3B] text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`} 
            title="Component Library"
          >
            <Layers size={20} />
          </button>
          <button 
            onClick={() => setActiveTab(activeTab === 'variables' ? 'tools' : 'variables')} 
            className={`p-3 rounded-xl transition-colors ${activeTab === 'variables' ? 'bg-[#10B981] text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`} 
            title="State Variables"
          >
            <Variable size={20} />
          </button>
        </div>

        {/* Artboard Frames */}
        <div className="flex flex-col items-center gap-1 w-full pt-2 pb-4 border-b border-slate-100">
          <button onClick={() => handleAdd('Frame-Desktop')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Desktop Frame"><Monitor size={20} /></button>
          <button onClick={() => handleAdd('Frame-Tablet')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Tablet Frame"><Tablet size={20} /></button>
          <button onClick={() => handleAdd('Frame-Mobile')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Mobile Frame"><Smartphone size={20} /></button>
        </div>

        {/* Basic Visual Shapes */}
        <div className="flex flex-col items-center gap-1 w-full pt-2 pb-4 border-b border-slate-100">
          <button onClick={() => handleAdd('Rect')} className="p-3 rounded-xl hover:bg-orange-50 text-slate-500 hover:text-[#C65D3B] transition-colors" title="Rectangle"><Square size={22} /></button>
          <button onClick={() => handleAdd('Circle')} className="p-3 rounded-xl hover:bg-indigo-50 text-slate-500 hover:text-[#4A3AFF] transition-colors" title="Circle"><Circle size={22} /></button>
          <button onClick={() => handleAdd('Triangle')} className="p-3 rounded-xl hover:bg-yellow-50 text-slate-500 hover:text-yellow-600 transition-colors" title="Triangle"><Triangle size={22} /></button>
          <button onClick={() => handleAdd('Line')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Line"><Minus size={22} /></button>
          <button onClick={() => handleAdd('Curve')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Curve"><Spline size={22} /></button>
          <button onClick={() => handleAdd('Text')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Text"><Type size={22} /></button>
          <button onClick={() => handleAdd('Image')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Upload Image"><ImageIcon size={22} /></button>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
        </div>

        {/* Interactive Controls Palette */}
        <div className="flex flex-col items-center gap-1 w-full pt-2">
          <button onClick={() => handleAdd('TextInput')} className="p-3 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors" title="Text Input"><Edit3 size={20} /></button>
          <button onClick={() => handleAdd('TextArea')} className="p-3 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors" title="Text Area"><FileText size={20} /></button>
          <button onClick={() => handleAdd('Checkbox')} className="p-3 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors" title="Checkbox"><CheckSquare size={20} /></button>
          <button onClick={() => handleAdd('Switch')} className="p-3 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors" title="Switch Toggle"><ToggleRight size={20} /></button>
          <button onClick={() => handleAdd('SelectDropdown')} className="p-3 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors" title="Dropdown Select"><ListFilter size={20} /></button>
          <button onClick={() => handleAdd('FormContainer')} className="p-3 rounded-xl hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 transition-colors" title="Form Container"><FormInput size={20} /></button>
        </div>
      </div>

      {/* Component Library Drawer */}
      {activeTab === 'components' && (
        <div className="w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 animate-in slide-in-from-left-4 duration-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-heading font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-[#C65D3B]" /> Component Library
            </h2>
            <button onClick={() => setActiveTab('tools')} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto">
            {masterComponents.length === 0 ? (
              <div className="text-sm text-slate-400 text-center mt-8">
                <Box size={32} className="mx-auto mb-3 opacity-20" />
                <p>No components yet.</p>
                <p className="mt-2 text-xs">Select any element and click "Create Component" in the right sidebar.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {masterComponents.map(comp => (
                  <div 
                    key={comp.id} 
                    className="group relative p-3 rounded-xl border border-slate-200 hover:border-[#4A3AFF] hover:bg-indigo-50/30 transition-all flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center shrink-0 text-[#4A3AFF] cursor-pointer" onClick={() => handleSpawnInstance(comp.id)}>
                      <Box size={20} />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSpawnInstance(comp.id)}>
                      <h4 className="font-medium text-sm text-slate-700 truncate group-hover:text-[#4A3AFF] transition-colors">{comp.componentName || 'Unnamed Component'}</h4>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mt-0.5">{comp.type}</p>
                    </div>
                    
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-md p-1 shadow-sm">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          selectNodes([comp.id]);
                          const cx = window.innerWidth / 2;
                          const cy = window.innerHeight / 2;
                          setPan({ x: cx - (comp.x * zoom), y: cy - (comp.y * zoom) });
                        }}
                        className="p-1.5 text-slate-400 hover:text-[#4A3AFF] hover:bg-indigo-50 rounded transition-colors"
                        title="Edit Master Component"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this component and all its instances?')) {
                            deleteComponent(comp.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete Component"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* State Variables Drawer */}
      {activeTab === 'variables' && (
        <div className="w-72 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 animate-in slide-in-from-left-4 duration-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-heading font-bold text-slate-800 flex items-center gap-2">
              <Variable size={18} className="text-emerald-600" /> State Variables
            </h2>
            <button onClick={() => setActiveTab('tools')} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <button
              onClick={handleStartAddVariable}
              className="w-full mb-4 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
            >
              <Plus size={15} /> Add Variable
            </button>

            {/* Create / Edit Variable Inline Form */}
            {showAddVarModal && (
              <form onSubmit={handleCreateOrUpdateVariable} className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{editingVarId ? 'Edit State Variable' : 'New State Variable'}</span>
                  <button type="button" onClick={() => setShowAddVarModal(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Variable Name</label>
                  <input
                    type="text"
                    placeholder="e.g. isModalOpen"
                    value={varName}
                    onChange={(e) => setVarName(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Type</label>
                  <select
                    value={varType}
                    onChange={(e) => setVarType(e.target.value as any)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array (JSON / JS)</option>
                    <option value="object">Object (JSON / JS)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Default Value</label>
                  <input
                    type="text"
                    placeholder={varType === 'boolean' ? 'true / false' : varType === 'object' ? "{ name: 'John' }" : 'Initial value'}
                    value={varDefaultVal}
                    onChange={(e) => setVarDefaultVal(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddVarModal(false)}
                    className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"
                  >
                    {editingVarId ? 'Update Variable' : 'Save Variable'}
                  </button>
                </div>
              </form>
            )}

            {/* Variable List */}
            {stateVariables.length === 0 ? (
              <div className="text-sm text-slate-400 text-center mt-6">
                <Variable size={28} className="mx-auto mb-2 opacity-30 text-emerald-600" />
                <p className="text-xs font-medium text-slate-500">No variables declared.</p>
                <p className="mt-1 text-[11px] text-slate-400">Add variables to bind canvas node properties and inputs.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {stateVariables.map((v) => (
                  <div key={v.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between group hover:border-emerald-300 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800 truncate">{v.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium tracking-wide uppercase">
                          {v.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        Default: <span className="font-mono text-slate-600">{JSON.stringify(v.defaultValue)}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEditVariable(v)}
                        className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-emerald-50"
                        title="Edit Variable"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteStateVariable(v.id)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
                        title="Delete Variable"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
