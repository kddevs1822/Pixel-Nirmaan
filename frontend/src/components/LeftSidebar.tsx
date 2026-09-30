import React, { useRef, useState } from 'react';
import { 
  Square, Circle, Type, Image as ImageIcon, Monitor, Tablet, Smartphone, Triangle, Minus, Spline, 
  MousePointer2, Link, Layers, Box, Edit2, Trash2, Edit3, CheckSquare, ToggleRight, ListFilter, 
  FormInput, Plus, X, Variable, FileText, Database, Play, Check, AlertCircle, RefreshCw, Upload, Globe
} from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { NodeType, DataSource, DataSourceHeader } from '../store/useCanvasStore';
import { normalizeApiUrl, executeApiFetch } from '../utils/urlUtils';
import { DEFAULT_IMAGE_PLACEHOLDER } from '../utils/nodeUtils';
import { v4 as uuidv4 } from 'uuid';

export const LeftSidebar: React.FC = () => {
  const { 
    addNode, nodes, pan, zoom, mode, setMode, spawnInstance, selectNodes, deleteComponent, setPan,
    stateVariables, addStateVariable, deleteStateVariable, updateStateVariable,
    dataSources, addDataSource, updateDataSource, deleteDataSource, setToastMessage
  } = useCanvasStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'tools' | 'components' | 'variables' | 'data'>('tools');

  // Variable Creation & Edit State
  const [showAddVarModal, setShowAddVarModal] = useState(false);
  const [editingVarId, setEditingVarId] = useState<string | null>(null);
  const [varName, setVarName] = useState('');
  const [varType, setVarType] = useState<'string' | 'number' | 'boolean' | 'array' | 'object'>('string');
  const [varDefaultVal, setVarDefaultVal] = useState('');

  // Data Source Creation & Edit State
  const [showAddDsModal, setShowAddDsModal] = useState(false);
  const [editingDsId, setEditingDsId] = useState<string | null>(null);
  const [dsName, setDsName] = useState('');
  const [dsUrl, setDsUrl] = useState('');
  const [dsMethod, setDsMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [dsHeaders, setDsHeaders] = useState<DataSourceHeader[]>([]);
  const [dsBodyTemplate, setDsBodyTemplate] = useState('');
  const [dsFetchOnLoad, setDsFetchOnLoad] = useState(false);
  const [dsTargetFrameId, setDsTargetFrameId] = useState('');
  const [dsTargetVariableId, setDsTargetVariableId] = useState('');
  const [dsResponsePath, setDsResponsePath] = useState('');

  // Image Creation Modal State
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageModalTab, setImageModalTab] = useState<'url' | 'upload'>('url');
  const [imageUrlInput, setImageUrlInput] = useState('');

  // Test request state
  const [isTestingDs, setIsTestingDs] = useState(false);
  const [testResult, setTestResult] = useState<{
    status?: number;
    statusText?: string;
    ok: boolean;
    timeMs: number;
    data?: any;
    extracted?: any;
    error?: string;
  } | null>(null);

  const masterComponents = nodes.filter(n => n.isMasterComponent);

  const getCenterOffset = () => {
    const centerX = (window.innerWidth / 2 - pan.x) / zoom;
    const centerY = (window.innerHeight / 2 - pan.y) / zoom;
    return { x: centerX - 50, y: centerY - 50 };
  };

  const getContainerPlacement = () => {
    const { x, y } = getCenterOffset();
    const containers = nodes.filter(n => n.type === 'Frame' || n.type === 'FormContainer');
    containers.sort((a, b) => {
      const areaA = (a.width || 0) * (a.height || 0);
      const areaB = (b.width || 0) * (b.height || 0);
      return areaA - areaB;
    });
    
    let parentId = undefined;
    let localX = x;
    let localY = y;

    for (const f of containers) {
      let frameAbsX = f.x;
      let frameAbsY = f.y;
      if (f.parentId) {
        const pf = nodes.find(n => n.id === f.parentId);
        if (pf) { frameAbsX += pf.x; frameAbsY += pf.y; }
      }
      if (x >= frameAbsX && x <= frameAbsX + (f.width || 0) && y >= frameAbsY && y <= frameAbsY + (f.height || 0)) {
        parentId = f.id;
        localX = x - frameAbsX;
        localY = y - frameAbsY;
        break;
      }
    }
    return { localX, localY, parentId, x, y };
  };

  const insertImage = (src: string, width = 200, height = 200) => {
    const { localX, localY, parentId } = getContainerPlacement();
    addNode({
      type: 'Image',
      x: localX,
      y: localY,
      width,
      height,
      src,
      parentId
    });
  };

  const handleAdd = (type: NodeType | 'Frame-Desktop' | 'Frame-Tablet' | 'Frame-Mobile' | 'Curve') => {
    const { localX, localY, parentId, x, y } = getContainerPlacement();
    const frames = nodes.filter(n => n.type === 'Frame');
    
    if (type === 'Rect') addNode({ type: 'Rect', x: localX, y: localY, width: 100, height: 100, fill: '#C65D3B', cornerRadius: 0, parentId });
    else if (type === 'Circle') addNode({ type: 'Circle', x: localX + 50, y: localY + 50, radius: 50, fill: '#4A3AFF', parentId });
    else if (type === 'Triangle') addNode({ type: 'Triangle', x: localX + 50, y: localY + 50, radius: 50, fill: '#F2A93B', parentId });
    else if (type === 'Line') addNode({ type: 'Line', x: localX, y: localY, points: [0, 0, 100, 100], stroke: '#1A1A1D', strokeWidth: 4, parentId });
    else if (type === 'Curve') addNode({ type: 'Line', x: localX, y: localY, points: [0, 0, 50, 0, 100, 0], tension: 0.5, stroke: '#1A1A1D', strokeWidth: 4, parentId });
    else if (type === 'Text') addNode({ type: 'Text', x: localX, y: localY, text: 'Pixel Nirmaan', fontSize: 32, fontFamily: 'Space Grotesk', fill: '#1A1A1D', parentId });
    else if (type === 'Image') {
      setImageModalTab('url');
      setImageUrlInput('');
      setShowImageModal(true);
    }
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
        insertImage(event.target?.result as string, 200, 200);
        setShowImageModal(false);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInsertUrlImage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalSrc = imageUrlInput.trim() || DEFAULT_IMAGE_PLACEHOLDER;
    insertImage(finalSrc, 240, 180);
    setShowImageModal(false);
    setImageUrlInput('');
  };

  const handleSpawnInstance = (masterId: string) => {
    const { x, y } = getCenterOffset();
    spawnInstance(masterId, x, y);
  };

  const parseVariableDefaultValue = (str: string, type: string) => {
    if (type === 'number') {
      const num = Number(str);
      return isNaN(num) ? 0 : num;
    }
    if (type === 'boolean') return str === 'true' || str === '1';
    if (type === 'string') {
      const trimmed = str.trim();
      if (trimmed === '""' || trimmed === "''") return '';
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
      }
      return str;
    }
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
    let defVal = typeof v.defaultValue === 'object' ? JSON.stringify(v.defaultValue) : String(v.defaultValue ?? '');
    if (v.type === 'string') {
      const trimmed = defVal.trim();
      if (trimmed === '""' || trimmed === "''") defVal = '';
      else if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        defVal = trimmed.slice(1, -1);
      }
    }
    setVarDefaultVal(defVal);
    setShowAddVarModal(true);
  };

  const handleStartAddVariable = () => {
    setEditingVarId(null);
    setVarName('');
    setVarType('string');
    setVarDefaultVal('');
    setShowAddVarModal(true);
  };

  // Data Source Handlers
  const handleStartAddDataSource = () => {
    setEditingDsId(null);
    setDsName('');
    setDsUrl('');
    setDsMethod('GET');
    setDsHeaders([
      { id: uuidv4(), key: 'Content-Type', value: 'application/json', enabled: true }
    ]);
    setDsBodyTemplate('');
    setDsFetchOnLoad(false);
    setDsTargetFrameId('');
    setDsTargetVariableId('');
    setDsResponsePath('');
    setTestResult(null);
    setShowAddDsModal(true);
  };

  const handleStartEditDataSource = (ds: DataSource) => {
    setEditingDsId(ds.id);
    setDsName(ds.name);
    setDsUrl(ds.url);
    setDsMethod(ds.method || 'GET');
    setDsHeaders(ds.headers && ds.headers.length > 0 ? ds.headers : [
      { id: uuidv4(), key: 'Content-Type', value: 'application/json', enabled: true }
    ]);
    setDsBodyTemplate(ds.bodyTemplate || '');
    setDsFetchOnLoad(!!ds.fetchOnLoad);
    setDsTargetFrameId(ds.targetFrameId || '');
    setDsTargetVariableId(ds.targetVariableId || '');
    setDsResponsePath(ds.responsePath || '');
    setTestResult(null);
    setShowAddDsModal(true);
  };

  const handleHeaderChange = (id: string, field: 'key' | 'value' | 'enabled', val: any) => {
    setDsHeaders(prev => prev.map(h => h.id === id ? { ...h, [field]: val } : h));
  };

  const handleAddHeader = () => {
    setDsHeaders(prev => [...prev, { id: uuidv4(), key: '', value: '', enabled: true }]);
  };

  const handleRemoveHeader = (id: string) => {
    setDsHeaders(prev => prev.filter(h => h.id !== id));
  };

  const handleTestDataSource = async () => {
    const cleanUrl = normalizeApiUrl(dsUrl);
    if (!cleanUrl) {
      alert('Please enter a valid URL to test');
      return;
    }
    if (cleanUrl !== dsUrl) {
      setDsUrl(cleanUrl);
    }

    setIsTestingDs(true);
    setTestResult(null);

    try {
      const headersObj: Record<string, string> = {};
      dsHeaders.filter(h => h.enabled && h.key.trim()).forEach(h => {
        headersObj[h.key.trim()] = h.value;
      });

      const res = await executeApiFetch(cleanUrl, {
        method: dsMethod,
        headers: headersObj,
        body: ['POST', 'PUT', 'PATCH'].includes(dsMethod) && dsBodyTemplate.trim() ? dsBodyTemplate.trim() : undefined,
      });

      let extracted: any = undefined;
      if (dsResponsePath.trim() && typeof res.data === 'object' && res.data !== null) {
        const parts = dsResponsePath.trim().split('.');
        extracted = parts.reduce((acc, part) => (acc ? acc[part] : undefined), res.data);
      }

      setTestResult({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        timeMs: res.timeMs,
        data: res.data,
        extracted,
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        timeMs: err.timeMs || 0,
        error: err.message || 'Failed to fetch',
      });
    } finally {
      setIsTestingDs(false);
    }
  };

  const handleApplyTestToVariable = () => {
    if (!testResult || !dsTargetVariableId) return;
    const targetVal = testResult.extracted !== undefined ? testResult.extracted : testResult.data;
    if (targetVal === undefined) return;

    updateStateVariable(dsTargetVariableId, {
      defaultValue: targetVal,
    });
    setToastMessage('✅ Variable default value updated with API response');
  };

  const handleSaveDataSource = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = normalizeApiUrl(dsUrl);
    if (!dsName.trim() || !cleanUrl) {
      alert('Please provide both a Name and URL for the Data Source.');
      return;
    }

    const payload = {
      name: dsName.trim().replace(/\s+/g, '_'),
      url: cleanUrl,
      method: dsMethod,
      headers: dsHeaders.filter(h => h.key.trim() !== ''),
      bodyTemplate: ['POST', 'PUT', 'PATCH'].includes(dsMethod) ? dsBodyTemplate : undefined,
      fetchOnLoad: dsFetchOnLoad,
      targetFrameId: dsTargetFrameId || undefined,
      targetVariableId: dsTargetVariableId || undefined,
      responsePath: dsResponsePath.trim() || undefined,
    };

    if (editingDsId) {
      updateDataSource(editingDsId, payload);
      setToastMessage(`Updated data source "${payload.name}"`);
    } else {
      addDataSource(payload);
      setToastMessage(`Created data source "${payload.name}"`);
    }

    setShowAddDsModal(false);
    setEditingDsId(null);
    setTestResult(null);
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
          <button 
            onClick={() => setActiveTab(activeTab === 'data' ? 'tools' : 'data')} 
            className={`p-3 rounded-xl transition-colors ${activeTab === 'data' ? 'bg-[#0284C7] text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'}`} 
            title="Data Sources (REST APIs)"
          >
            <Database size={20} />
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
          <button onClick={() => handleAdd('Image')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Add Image (URL / Placeholder / Upload)"><ImageIcon size={22} /></button>
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
                    onChange={(e) => {
                      const nextType = e.target.value as any;
                      setVarType(nextType);
                      if (nextType === 'number' && (varDefaultVal === '' || isNaN(Number(varDefaultVal)))) {
                        setVarDefaultVal('0');
                      } else if (nextType === 'boolean' && varDefaultVal !== 'true' && varDefaultVal !== 'false') {
                        setVarDefaultVal('false');
                      }
                    }}
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
                  {varType === 'boolean' ? (
                    <select
                      value={varDefaultVal === 'true' ? 'true' : 'false'}
                      onChange={(e) => setVarDefaultVal(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : varType === 'number' ? (
                    <input
                      type="number"
                      placeholder="0"
                      value={varDefaultVal}
                      onChange={(e) => setVarDefaultVal(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={varType === 'object' ? "{ name: 'John' }" : varType === 'array' ? '["item1", "item2"]' : 'Initial value'}
                      value={varDefaultVal}
                      onChange={(e) => setVarDefaultVal(e.target.value)}
                      className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  )}
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
                        Default: <span className="font-mono text-slate-600">
                          {v.type === 'string' && (v.defaultValue === '' || v.defaultValue === '""' || v.defaultValue === "''") ? '(empty string)' : JSON.stringify(v.defaultValue)}
                        </span>
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

      {/* Data Sources Drawer */}
      {activeTab === 'data' && (
        <div className="w-84 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 animate-in slide-in-from-left-4 duration-200">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-heading font-bold text-slate-800 flex items-center gap-2">
              <Database size={18} className="text-sky-600" /> Data Sources
            </h2>
            <button onClick={() => setActiveTab('tools')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto">
            <button
              onClick={handleStartAddDataSource}
              className="w-full mb-4 py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-colors border border-sky-200 cursor-pointer"
            >
              <Plus size={15} /> Add Data Source
            </button>

            {/* Create / Edit Data Source Form */}
            {showAddDsModal && (
              <form onSubmit={handleSaveDataSource} className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1 border-b border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Database size={14} className="text-sky-600" />
                    {editingDsId ? 'Edit Data Source' : 'New Data Source'}
                  </span>
                  <button type="button" onClick={() => setShowAddDsModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X size={14} />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Name</label>
                  <input
                    type="text"
                    placeholder="e.g. getUsers or fetchProducts"
                    value={dsName}
                    onChange={(e) => setDsName(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Method</label>
                    <select
                      value={dsMethod}
                      onChange={(e) => setDsMethod(e.target.value as any)}
                      className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Endpoint URL</label>
                    <input
                      type="url"
                      placeholder="https://api.example.com/items"
                      value={dsUrl}
                      onChange={(e) => setDsUrl(e.target.value)}
                      onBlur={() => {
                        if (dsUrl.trim()) {
                          setDsUrl(normalizeApiUrl(dsUrl));
                        }
                      }}
                      className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Headers Table */}
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Headers</label>
                    <button
                      type="button"
                      onClick={handleAddHeader}
                      className="text-[10px] text-sky-600 hover:text-sky-800 font-medium flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus size={11} /> Add Header
                    </button>
                  </div>

                  {dsHeaders.map((header) => (
                    <div key={header.id} className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={header.enabled}
                        onChange={(e) => handleHeaderChange(header.id, 'enabled', e.target.checked)}
                        className="rounded text-sky-600 focus:ring-0 cursor-pointer"
                        title="Enable/disable header"
                      />
                      <input
                        type="text"
                        placeholder="Header"
                        value={header.key}
                        onChange={(e) => handleHeaderChange(header.id, 'key', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => handleHeaderChange(header.id, 'value', e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveHeader(header.id)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 cursor-pointer"
                        title="Remove header"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Body Template for POST / PUT / PATCH */}
                {['POST', 'PUT', 'PATCH'].includes(dsMethod) && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Body Payload (JSON)</label>
                    <textarea
                      rows={3}
                      placeholder='{ "title": "New Item" }'
                      value={dsBodyTemplate}
                      onChange={(e) => setDsBodyTemplate(e.target.value)}
                      className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* Target State Variable */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Store In State Variable</label>
                  <select
                    value={dsTargetVariableId}
                    onChange={(e) => setDsTargetVariableId(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="">-- None (Do not store) --</option>
                    {stateVariables.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Response Path */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Response Path</label>
                    <span className="text-[9px] text-slate-400">e.g. data.items or products</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Leave empty for root response"
                    value={dsResponsePath}
                    onChange={(e) => setDsResponsePath(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Fetch on Page Load Option */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={dsFetchOnLoad}
                      onChange={(e) => setDsFetchOnLoad(e.target.checked)}
                      className="rounded text-sky-600 focus:ring-0 cursor-pointer"
                    />
                    <span>⚡ Fetch on Page/Frame Load</span>
                  </label>

                  {dsFetchOnLoad && (
                    <div className="pl-5 flex flex-col gap-1">
                      <label className="text-[9.5px] uppercase font-bold text-slate-400">Triggering Frame</label>
                      <select
                        value={dsTargetFrameId}
                        onChange={(e) => setDsTargetFrameId(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="">All Frames (Global Page Load)</option>
                        {nodes.filter(n => n.type === 'Frame' && !n.parentId).map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name || `Frame (${f.frameType || 'desktop'})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Test Request Panel */}
                <div className="pt-1 border-t border-slate-200 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleTestDataSource}
                    disabled={isTestingDs || !dsUrl.trim()}
                    className="w-full py-1.5 px-3 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isTestingDs ? (
                      <>
                        <RefreshCw size={13} className="animate-spin text-sky-600" />
                        Testing Endpoint...
                      </>
                    ) : (
                      <>
                        <Play size={12} className="fill-sky-700" />
                        Test Request
                      </>
                    )}
                  </button>

                  {testResult && (
                    <div className={`p-2 rounded-lg border text-xs flex flex-col gap-1.5 ${testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1">
                          {testResult.ok ? <Check size={13} className="text-emerald-600" /> : <AlertCircle size={13} className="text-rose-600" />}
                          Status: {testResult.status || (testResult.ok ? '200' : 'Error')} {testResult.statusText || ''}
                        </span>
                        <span className="text-[10px] opacity-75">{testResult.timeMs}ms</span>
                      </div>

                      {testResult.error && (
                        <p className="text-[11px] text-rose-700">{testResult.error}</p>
                      )}

                      {testResult.extracted !== undefined && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold text-emerald-800">
                            Extracted via "{dsResponsePath}": {Array.isArray(testResult.extracted) ? `(${testResult.extracted.length} items)` : typeof testResult.extracted}
                          </span>
                          <pre className="max-h-24 overflow-y-auto text-[9.5px] bg-slate-900 text-emerald-400 p-2 rounded font-mono">
                            {JSON.stringify(testResult.extracted, null, 2)}
                          </pre>
                        </div>
                      )}

                      {testResult.extracted === undefined && testResult.data !== undefined && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold text-slate-700">Response Payload:</span>
                          <pre className="max-h-24 overflow-y-auto text-[9.5px] bg-slate-900 text-slate-100 p-2 rounded font-mono">
                            {typeof testResult.data === 'object' ? JSON.stringify(testResult.data, null, 2) : String(testResult.data)}
                          </pre>
                        </div>
                      )}

                      {testResult.ok && dsTargetVariableId && (
                        <button
                          type="button"
                          onClick={handleApplyTestToVariable}
                          className="mt-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10.5px] font-medium transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check size={11} /> Save Sample Data into Target Variable
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-1 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => { setShowAddDsModal(false); setEditingDsId(null); setTestResult(null); }}
                    className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700 transition-colors cursor-pointer"
                  >
                    {editingDsId ? 'Update Data Source' : 'Save Data Source'}
                  </button>
                </div>
              </form>
            )}

            {/* Data Sources List */}
            {dataSources.length === 0 ? (
              <div className="text-sm text-slate-400 text-center mt-6">
                <Database size={28} className="mx-auto mb-2 opacity-30 text-sky-600" />
                <p className="text-xs font-medium text-slate-500">No data sources configured.</p>
                <p className="mt-1 text-[11px] text-slate-400">Connect REST APIs to fetch dynamic data for your UI components and state variables.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {dataSources.map((ds) => {
                  const targetVar = stateVariables.find(v => v.id === ds.targetVariableId);
                  const targetFrame = nodes.find(n => n.id === ds.targetFrameId);
                  const methodColor = 
                    ds.method === 'GET' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                    ds.method === 'POST' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                    ds.method === 'PUT' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                    ds.method === 'DELETE' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                    'bg-purple-100 text-purple-800 border-purple-300';

                  return (
                    <div key={ds.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1.5 group hover:border-sky-300 transition-colors">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${methodColor}`}>
                            {ds.method}
                          </span>
                          <span className="font-mono text-xs font-bold text-slate-800 truncate" title={ds.name}>
                            {ds.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => handleStartEditDataSource(ds)}
                            className="text-slate-400 hover:text-sky-600 p-1 rounded hover:bg-sky-50 cursor-pointer"
                            title="Edit Data Source"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete data source "${ds.name}"?`)) {
                                deleteDataSource(ds.id);
                                setToastMessage(`Deleted data source "${ds.name}"`);
                              }
                            }}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-rose-50 cursor-pointer"
                            title="Delete Data Source"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] font-mono text-slate-500 truncate" title={ds.url}>
                        {ds.url}
                      </p>

                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200/60">
                        {ds.fetchOnLoad && (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                            ⚡ On Load ({targetFrame ? (targetFrame.name || 'Frame') : 'Global'})
                          </span>
                        )}
                        {targetVar && (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium truncate max-w-[180px]">
                            📦 {targetVar.name}{ds.responsePath ? ` (${ds.responsePath})` : ''}
                          </span>
                        )}
                        {!ds.fetchOnLoad && !targetVar && (
                          <span className="text-[9.5px] text-slate-400 italic">
                            Manual action trigger
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowImageModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4A3AFF] flex items-center justify-center">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Add Image</h3>
                  <p className="text-[11px] text-slate-400">Insert from URL / Placeholder or upload from computer</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowImageModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Segmented Tab Switch */}
            <div className="px-5 pt-4">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setImageModalTab('url')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    imageModalTab === 'url'
                      ? 'bg-white text-[#4A3AFF] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Globe size={14} /> From URL / Placeholder
                </button>
                <button
                  type="button"
                  onClick={() => setImageModalTab('upload')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    imageModalTab === 'upload'
                      ? 'bg-white text-[#4A3AFF] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Upload size={14} /> Upload from Computer
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4">
              {imageModalTab === 'url' ? (
                <form onSubmit={handleInsertUrlImage} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Image URL <span className="text-slate-400 font-normal">(optional — leave blank for placeholder)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg (or leave empty for placeholder)"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono text-slate-800"
                      autoFocus
                    />
                  </div>

                  {/* Thumbnail Preview Box */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Thumbnail Preview
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {imageUrlInput.trim() ? 'Custom URL' : 'Placeholder Thumbnail'}
                      </span>
                    </div>

                    <div className="w-full h-36 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner p-1">
                      <img
                        src={imageUrlInput.trim() || DEFAULT_IMAGE_PLACEHOLDER}
                        alt="Image thumbnail preview"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_IMAGE_PLACEHOLDER;
                        }}
                      />
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10.5px] text-slate-400 font-medium">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setImageUrlInput('')}
                      className="text-[10.5px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                    >
                      Placeholder
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUrlInput('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400')}
                      className="text-[10.5px] px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-[#4A3AFF] font-medium transition-colors cursor-pointer"
                    >
                      Sample Product
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUrlInput('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400')}
                      className="text-[10.5px] px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-[#4A3AFF] font-medium transition-colors cursor-pointer"
                    >
                      Sample Avatar
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed bg-amber-50/70 border border-amber-200/60 p-2.5 rounded-lg text-amber-800">
                    💡 <strong>Dynamic Data Binding:</strong> You can bind this image to API variables like <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded">products.thumbnail</code> or <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded">item.image</code> in the Right Sidebar after inserting.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowImageModal(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#4A3AFF] hover:bg-indigo-600 text-white transition-colors cursor-pointer shadow-sm"
                    >
                      Insert Image
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-[#4A3AFF] bg-slate-50 hover:bg-indigo-50/30 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all group text-center"
                  >
                    <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-slate-400 group-hover:text-[#4A3AFF] group-hover:scale-110 transition-all mb-3 border border-slate-100">
                      <Upload size={22} />
                    </div>
                    <p className="text-xs font-bold text-slate-700 group-hover:text-[#4A3AFF] transition-colors">
                      Choose an image from your computer
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Supports PNG, JPG, WebP, SVG, and GIF
                    </p>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowImageModal(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
