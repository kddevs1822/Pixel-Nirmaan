import React, { useRef, useState } from 'react';
import { 
  Square, Circle, Type, Image as ImageIcon, Monitor, Tablet, Smartphone, Triangle, Minus, Spline, 
  MousePointer2, Link, Layers, Box, Edit2, Trash2, Edit3, CheckSquare, ToggleRight, ListFilter, 
  FormInput, Plus, X, Variable, FileText, Database, Play, Check, AlertCircle, RefreshCw, Upload, Globe,
  Home, Copy, Crosshair, Search, ChevronLeft, ChevronRight, Zap, Clock, AlertTriangle, Lightbulb
} from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { NodeType, DataSource, DataSourceHeader } from '../store/useCanvasStore';
import { normalizeApiUrl, executeApiFetch } from '../utils/urlUtils';
import { DEFAULT_IMAGE_PLACEHOLDER } from '../utils/nodeUtils';
import { v4 as uuidv4 } from 'uuid';

type TabType = 'tools' | 'components' | 'variables' | 'data' | 'pages';
type ElementCategory = 'all' | 'frames' | 'shapes' | 'content' | 'forms';

interface ElementToolItem {
  id: NodeType | 'Frame-Desktop' | 'Frame-Tablet' | 'Frame-Mobile' | 'Curve';
  name: string;
  category: 'frames' | 'shapes' | 'content' | 'forms';
  description: string;
  shortcut?: string;
  badge?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  accentBg: string;
}

const ELEMENT_TOOLS: ElementToolItem[] = [
  // Frames
  { id: 'Frame-Desktop', name: 'Desktop Canvas', category: 'frames', description: 'Standard 1440 × 900 desktop screen artboard', shortcut: 'F', badge: '1440px', icon: Monitor, accentColor: 'text-[#4A3AFF]', accentBg: 'bg-indigo-50' },
  { id: 'Frame-Tablet', name: 'Tablet Canvas', category: 'frames', description: '768 × 1024 tablet & iPad screen artboard', badge: '768px', icon: Tablet, accentColor: 'text-[#4A3AFF]', accentBg: 'bg-indigo-50' },
  { id: 'Frame-Mobile', name: 'Mobile Canvas', category: 'frames', description: '393 × 852 modern mobile smartphone artboard', badge: '393px', icon: Smartphone, accentColor: 'text-[#4A3AFF]', accentBg: 'bg-indigo-50' },
  // Shapes
  { id: 'Rect', name: 'Rectangle', category: 'shapes', description: 'Box container, card background, or visual block', shortcut: 'R', icon: Square, accentColor: 'text-[#C65D3B]', accentBg: 'bg-orange-50' },
  { id: 'Circle', name: 'Circle', category: 'shapes', description: 'Circular avatar, badge, or curved graphic', shortcut: 'O', icon: Circle, accentColor: 'text-[#4A3AFF]', accentBg: 'bg-indigo-50' },
  { id: 'Triangle', name: 'Triangle', category: 'shapes', description: 'Geometric triangle indicator or polygon shape', icon: Triangle, accentColor: 'text-[#F2A93B]', accentBg: 'bg-amber-50' },
  { id: 'Line', name: 'Straight Line', category: 'shapes', description: 'Horizontal, vertical, or angled divider rule', shortcut: 'L', icon: Minus, accentColor: 'text-slate-700', accentBg: 'bg-slate-100' },
  { id: 'Curve', name: 'Spline Curve', category: 'shapes', description: 'Smooth organic curved bezier connector path', icon: Spline, accentColor: 'text-teal-600', accentBg: 'bg-teal-50' },
  // Content & Media
  { id: 'Text', name: 'Text Heading / Body', category: 'content', description: 'Headings, paragraphs, and typography labels', shortcut: 'T', icon: Type, accentColor: 'text-slate-800', accentBg: 'bg-slate-100' },
  { id: 'Image', name: 'Image Media', category: 'content', description: 'Insert via URL, Unsplash preset, or file upload', icon: ImageIcon, accentColor: 'text-blue-600', accentBg: 'bg-blue-50' },
  // Forms & Interactive
  { id: 'TextInput', name: 'Text Input', category: 'forms', description: 'Single-line input field with placeholder & state binding', icon: Edit3, accentColor: 'text-emerald-600', accentBg: 'bg-emerald-50' },
  { id: 'TextArea', name: 'Text Area', category: 'forms', description: 'Multi-line message input for feedback & descriptions', icon: FileText, accentColor: 'text-emerald-600', accentBg: 'bg-emerald-50' },
  { id: 'Checkbox', name: 'Checkbox', category: 'forms', description: 'Interactive toggle checkbox with custom label', icon: CheckSquare, accentColor: 'text-emerald-600', accentBg: 'bg-emerald-50' },
  { id: 'Switch', name: 'Toggle Switch', category: 'forms', description: 'Modern on/off toggle switch for binary options', icon: ToggleRight, accentColor: 'text-emerald-600', accentBg: 'bg-emerald-50' },
  { id: 'SelectDropdown', name: 'Dropdown Select', category: 'forms', description: 'Expandable dropdown picker with custom options list', icon: ListFilter, accentColor: 'text-emerald-600', accentBg: 'bg-emerald-50' },
  { id: 'FormContainer', name: 'Form Container', category: 'forms', description: 'Grouped card container for assembling complex forms', icon: FormInput, accentColor: 'text-emerald-600', accentBg: 'bg-emerald-50' },
];

export const LeftSidebar: React.FC = () => {
  const { 
    addNode, nodes, pan, zoom, mode, setMode, spawnInstance, selectNodes, deleteComponent, setPan,
    stateVariables, addStateVariable, deleteStateVariable, updateStateVariable,
    dataSources, addDataSource, updateDataSource, deleteDataSource, setToastMessage,
    addPage, duplicatePage, deletePage, setHomePage, panToNode, updateNode, selectedIds
  } = useCanvasStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Navigation & Drawer Visibility
  const [activeTab, setActiveTab] = useState<TabType>('tools');
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // Search & Filter State
  const [elementSearch, setElementSearch] = useState('');
  const [elementCategory, setElementCategory] = useState<ElementCategory>('all');
  const [pageSearch, setPageSearch] = useState('');
  const [compSearch, setCompSearch] = useState('');
  const [varSearch, setVarSearch] = useState('');
  const [dsSearch, setDsSearch] = useState('');

  // Pages State
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState('');
  const [newPagePath, setNewPagePath] = useState('');
  const [newPageSizePreset, setNewPageSizePreset] = useState<'match' | '1440x900' | 'window' | '1280x800' | 'custom'>('match');
  const [newPageCustomW, setNewPageCustomW] = useState(1440);
  const [newPageCustomH, setNewPageCustomH] = useState(900);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState('');
  const [editingPageRoute, setEditingPageRoute] = useState('');

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
  const [dsFetchOnLoad, setDsFetchOnLoad] = useState(true);
  const [dsTargetFrameId, setDsTargetFrameId] = useState('');
  const [dsTargetVariableId, setDsTargetVariableId] = useState('');
  const [dsLoadingVariableId, setDsLoadingVariableId] = useState('');
  const [dsErrorVariableId, setDsErrorVariableId] = useState('');
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
  const rootPages = nodes.filter(n => n.type === 'Frame' && !n.parentId && !n.variantOf && !n.isMasterComponent);

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
    setToastMessage('Added Image to canvas');
  };

  const handleAdd = (type: NodeType | 'Frame-Desktop' | 'Frame-Tablet' | 'Frame-Mobile' | 'Curve') => {
    const { localX, localY, parentId, x, y } = getContainerPlacement();
    const frames = nodes.filter(n => n.type === 'Frame');
    
    if (type === 'Rect') {
      addNode({ type: 'Rect', x: localX, y: localY, width: 100, height: 100, fill: '#C65D3B', cornerRadius: 0, parentId });
      setToastMessage('Added Rectangle (R)');
    }
    else if (type === 'Circle') {
      addNode({ type: 'Circle', x: localX + 50, y: localY + 50, radius: 50, fill: '#4A3AFF', parentId });
      setToastMessage('Added Circle (O)');
    }
    else if (type === 'Triangle') {
      addNode({ type: 'Triangle', x: localX + 50, y: localY + 50, radius: 50, fill: '#F2A93B', parentId });
      setToastMessage('Added Triangle');
    }
    else if (type === 'Line') {
      addNode({ type: 'Line', x: localX, y: localY, points: [0, 0, 100, 100], stroke: '#1A1A1D', strokeWidth: 4, parentId });
      setToastMessage('Added Line (L)');
    }
    else if (type === 'Curve') {
      addNode({ type: 'Line', x: localX, y: localY, points: [0, 0, 50, 0, 100, 0], tension: 0.5, stroke: '#1A1A1D', strokeWidth: 4, parentId });
      setToastMessage('Added Spline Curve');
    }
    else if (type === 'Text') {
      addNode({ type: 'Text', x: localX, y: localY, text: 'Pixel Nirmaan', fontSize: 32, fontFamily: 'Space Grotesk', fill: '#1A1A1D', parentId });
      setToastMessage('Added Text (T)');
    }
    else if (type === 'Image') {
      setImageModalTab('url');
      setImageUrlInput('');
      setShowImageModal(true);
    }
    else if (type === 'Frame-Desktop') {
      addNode({ type: 'Frame', x: x - (window.innerWidth / 2) + 50, y: y - (window.innerHeight / 2) + 50, width: window.innerWidth, height: window.innerHeight, fill: '#ffffff', frameType: 'desktop', name: `Desktop ${frames.length + 1}` });
      setToastMessage('Added Desktop Frame (F)');
    }
    else if (type === 'Frame-Tablet') {
      addNode({ type: 'Frame', x: x - 384 + 50, y: y - 512 + 50, width: 768, height: 1024, fill: '#ffffff', frameType: 'tablet', name: `Tablet ${frames.length + 1}` });
      setToastMessage('Added Tablet Frame');
    }
    else if (type === 'Frame-Mobile') {
      addNode({ type: 'Frame', x: x - 196 + 50, y: y - 426 + 50, width: 393, height: 852, fill: '#ffffff', frameType: 'mobile', name: `Mobile ${frames.length + 1}` });
      setToastMessage('Added Mobile Frame');
    }
    else if (type === 'TextInput') {
      addNode({ type: 'TextInput', x: localX, y: localY, width: 220, height: 40, fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 1.5, placeholder: 'Enter text...', inputType: 'text', parentId });
      setToastMessage('Added Text Input');
    }
    else if (type === 'TextArea') {
      addNode({ type: 'TextArea', x: localX, y: localY, width: 260, height: 90, fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 1.5, placeholder: 'Enter text area content...', parentId });
      setToastMessage('Added Text Area');
    }
    else if (type === 'Checkbox') {
      addNode({ type: 'Checkbox', x: localX, y: localY, width: 140, height: 24, text: 'Checkbox Label', defaultChecked: false, parentId });
      setToastMessage('Added Checkbox');
    }
    else if (type === 'Switch') {
      addNode({ type: 'Switch', x: localX, y: localY, width: 110, height: 26, text: 'Toggle Option', defaultChecked: false, parentId });
      setToastMessage('Added Switch');
    }
    else if (type === 'SelectDropdown') {
      addNode({ type: 'SelectDropdown', x: localX, y: localY, width: 200, height: 40, fill: '#FFFFFF', stroke: '#CBD5E1', strokeWidth: 1.5, placeholder: 'Select option...', options: ['Option 1', 'Option 2', 'Option 3'], parentId });
      setToastMessage('Added Dropdown Select');
    }
    else if (type === 'FormContainer') {
      addNode({ type: 'FormContainer', x: localX, y: localY, width: 340, height: 260, fill: '#F8FAFC', stroke: '#64748B', name: 'Contact Form', parentId });
      setToastMessage('Added Form Container');
    }
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
    setToastMessage('Created Component Instance on canvas');
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
      setToastMessage(`Updated variable "${cleanName}"`);
    } else {
      addStateVariable({
        name: cleanName,
        type: varType,
        defaultValue: parsedVal,
      });
      setToastMessage(`Created variable "${cleanName}"`);
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
    setDsFetchOnLoad(true);
    setDsTargetFrameId('');
    setDsTargetVariableId('');
    setDsLoadingVariableId('');
    setDsErrorVariableId('');
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
    setDsLoadingVariableId(ds.loadingVariableId || '');
    setDsErrorVariableId(ds.errorVariableId || '');
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
    setToastMessage('Variable default value updated with API response');
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
      loadingVariableId: dsLoadingVariableId || undefined,
      errorVariableId: dsErrorVariableId || undefined,
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

  // Switch tab or toggle open/close when clicking the already-active tab
  const handleTabClick = (tab: TabType) => {
    if (activeTab === tab) {
      setIsDrawerOpen(!isDrawerOpen);
    } else {
      setActiveTab(tab);
      setIsDrawerOpen(true);
    }
  };

  // Filtered lists
  const filteredElements = ELEMENT_TOOLS.filter(item => {
    const matchesCategory = elementCategory === 'all' || item.category === elementCategory;
    const matchesSearch = !elementSearch.trim() || 
      item.name.toLowerCase().includes(elementSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(elementSearch.toLowerCase()) ||
      (item.shortcut && item.shortcut.toLowerCase().includes(elementSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const filteredPages = rootPages.filter(p => {
    if (!pageSearch.trim()) return true;
    const q = pageSearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.routePath || '').toLowerCase().includes(q);
  });

  const filteredComponents = masterComponents.filter(c => {
    if (!compSearch.trim()) return true;
    const q = compSearch.toLowerCase();
    return (c.componentName || '').toLowerCase().includes(q) || (c.type || '').toLowerCase().includes(q);
  });

  const filteredVariables = stateVariables.filter(v => {
    if (!varSearch.trim()) return true;
    const q = varSearch.toLowerCase();
    return v.name.toLowerCase().includes(q) || v.type.toLowerCase().includes(q);
  });

  const filteredDataSources = dataSources.filter(ds => {
    if (!dsSearch.trim()) return true;
    const q = dsSearch.toLowerCase();
    return ds.name.toLowerCase().includes(q) || ds.url.toLowerCase().includes(q) || ds.method.toLowerCase().includes(q);
  });

  return (
    <div className="relative flex h-full shrink-0 z-20 select-none">
      {/* Hidden file input for direct image upload */}
      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />

      {/* Primary Rail Navigation (w-16) */}
      <aside 
        className="w-16 bg-white border-r border-slate-200/90 flex flex-col items-center justify-between py-3 shadow-[1px_0_4px_rgba(0,0,0,0.02)] shrink-0 z-30"
        aria-label="Primary Navigation Sidebar"
      >
        {/* Top Section: Canvas Interaction Modes */}
        <div className="flex flex-col items-center gap-1.5 w-full px-2">
          {/* Select / Pointer Tool */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={() => { setMode('select'); }}
              aria-label="Pointer Tool (V)"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                mode === 'select'
                  ? 'bg-[#4A3AFF] text-white shadow-sm ring-2 ring-[#4A3AFF]/30'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/90'
              }`}
            >
              <MousePointer2 size={19} />
              {mode === 'select' && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 bg-[#4A3AFF] rounded-r-full" />
              )}
            </button>
            {/* Tooltip */}
            <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
              <span className="font-medium">Pointer Tool</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">V</kbd>
            </div>
          </div>

          {/* Connect / Interactivity Tool */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={() => { setMode('connect'); }}
              aria-label="Connect Tool (C)"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                mode === 'connect'
                  ? 'bg-[#4A3AFF] text-white shadow-sm ring-2 ring-[#4A3AFF]/30'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/90'
              }`}
            >
              <Link size={19} />
              {mode === 'connect' && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 bg-[#4A3AFF] rounded-r-full" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
              <span className="font-medium">Connect Interactions</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">C</kbd>
            </div>
          </div>

          <div className="w-8 h-px bg-slate-200/90 my-1 mx-auto" />

          {/* Navigation Feature Tabs */}
          {/* 1. Insert & Elements */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={() => handleTabClick('tools')}
              aria-label="Insert Elements & Shapes"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                activeTab === 'tools' && isDrawerOpen
                  ? 'bg-indigo-50 text-[#4A3AFF] font-bold shadow-xs ring-1 ring-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
              }`}
            >
              <Plus size={21} className={activeTab === 'tools' && isDrawerOpen ? 'text-[#4A3AFF] stroke-[2.5]' : ''} />
              {activeTab === 'tools' && isDrawerOpen && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 bg-[#4A3AFF] rounded-r-full" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
              <span className="font-medium">Insert Elements & Shapes</span>
            </div>
          </div>

          {/* 2. Pages & Routing */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={() => handleTabClick('pages')}
              aria-label="Website Pages"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                activeTab === 'pages' && isDrawerOpen
                  ? 'bg-indigo-50 text-[#4A3AFF] font-bold shadow-xs ring-1 ring-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
              }`}
            >
              <Globe size={19} className={activeTab === 'pages' && isDrawerOpen ? 'text-[#4A3AFF]' : ''} />
              {rootPages.length > 0 && (
                <span className="absolute top-1 right-1 px-1.5 min-w-[16px] h-4 rounded-full bg-[#4A3AFF] text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs">
                  {rootPages.length}
                </span>
              )}
              {activeTab === 'pages' && isDrawerOpen && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 bg-[#4A3AFF] rounded-r-full" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
              <span className="font-medium">Pages & Routing</span>
              <span className="text-[10px] text-slate-400">({rootPages.length} pages)</span>
            </div>
          </div>

          {/* 3. Component Library */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={() => handleTabClick('components')}
              aria-label="Component Library"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                activeTab === 'components' && isDrawerOpen
                  ? 'bg-orange-50 text-[#C65D3B] font-bold shadow-xs ring-1 ring-orange-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
              }`}
            >
              <Layers size={19} className={activeTab === 'components' && isDrawerOpen ? 'text-[#C65D3B]' : ''} />
              {masterComponents.length > 0 && (
                <span className="absolute top-1 right-1 px-1.5 min-w-[16px] h-4 rounded-full bg-[#C65D3B] text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs">
                  {masterComponents.length}
                </span>
              )}
              {activeTab === 'components' && isDrawerOpen && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 bg-[#C65D3B] rounded-r-full" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
              <span className="font-medium">Master Components</span>
              <span className="text-[10px] text-slate-400">({masterComponents.length})</span>
            </div>
          </div>

          {/* 4. State Variables */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={() => handleTabClick('variables')}
              aria-label="State Variables"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                activeTab === 'variables' && isDrawerOpen
                  ? 'bg-emerald-50 text-emerald-600 font-bold shadow-xs ring-1 ring-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
              }`}
            >
              <Variable size={19} className={activeTab === 'variables' && isDrawerOpen ? 'text-emerald-600' : ''} />
              {stateVariables.length > 0 && (
                <span className="absolute top-1 right-1 px-1.5 min-w-[16px] h-4 rounded-full bg-emerald-600 text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs">
                  {stateVariables.length}
                </span>
              )}
              {activeTab === 'variables' && isDrawerOpen && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 bg-emerald-600 rounded-r-full" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
              <span className="font-medium">State Variables</span>
              <span className="text-[10px] text-slate-400">({stateVariables.length})</span>
            </div>
          </div>

          {/* 5. Data Sources */}
          <div className="relative group w-full flex justify-center">
            <button
              onClick={() => handleTabClick('data')}
              aria-label="Data Sources (REST APIs)"
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                activeTab === 'data' && isDrawerOpen
                  ? 'bg-sky-50 text-sky-600 font-bold shadow-xs ring-1 ring-sky-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90'
              }`}
            >
              <Database size={19} className={activeTab === 'data' && isDrawerOpen ? 'text-sky-600' : ''} />
              {dataSources.length > 0 && (
                <span className="absolute top-1 right-1 px-1.5 min-w-[16px] h-4 rounded-full bg-sky-600 text-white text-[9.5px] font-bold flex items-center justify-center shadow-xs">
                  {dataSources.length}
                </span>
              )}
              {activeTab === 'data' && isDrawerOpen && (
                <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 bg-sky-600 rounded-r-full" />
              )}
            </button>
            <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2">
              <span className="font-medium">Data Sources (REST APIs)</span>
              <span className="text-[10px] text-slate-400">({dataSources.length})</span>
            </div>
          </div>
        </div>

        {/* Bottom Section: Panel Expand / Collapse Toggle */}
        <div className="flex flex-col items-center gap-2 w-full px-2 pt-2 border-t border-slate-100">
          <div className="relative group w-full flex justify-center">
            <button
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              aria-label={isDrawerOpen ? "Collapse sidebar drawer" : "Expand sidebar drawer"}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isDrawerOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
              <span>{isDrawerOpen ? "Collapse sidebar (reclaim canvas)" : "Expand sidebar drawer"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Drawer Panel Container (w-80, 320px) */}
      {isDrawerOpen && (
        <div 
          className="w-80 bg-white border-r border-slate-200/90 shadow-[4px_0_12px_rgba(0,0,0,0.02)] flex flex-col z-20 h-full overflow-hidden shrink-0 animate-in slide-in-from-left-2 duration-150"
        >
          {/* TAB 1: ELEMENTS & INSERT PALETTE */}
          {activeTab === 'tools' && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#4A3AFF] flex items-center justify-center shadow-2xs font-bold">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-sm text-slate-900 leading-tight">Insert Elements</h2>
                    <p className="text-[11px] text-slate-400">Click to add shapes, frames, and inputs to canvas</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search & Category Tabs */}
              <div className="p-3 pb-2 border-b border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50/50">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search elements or shortcuts (e.g. 'F', 'Input')..."
                    value={elementSearch}
                    onChange={(e) => setElementSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF]"
                  />
                  {elementSearch && (
                    <button
                      onClick={() => setElementSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {(['all', 'frames', 'shapes', 'content', 'forms'] as ElementCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setElementCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize whitespace-nowrap transition-all cursor-pointer ${
                        elementCategory === cat
                          ? 'bg-[#4A3AFF] text-white shadow-2xs'
                          : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                      }`}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Elements List */}
              <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-4">
                {filteredElements.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <Search size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold text-slate-600">No matching elements found</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try searching with a different keyword</p>
                    <button
                      onClick={() => { setElementSearch(''); setElementCategory('all'); }}
                      className="mt-3 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Frames Section */}
                    {filteredElements.some(e => e.category === 'frames') && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                          <span>Frames & Artboards</span>
                          <span>{filteredElements.filter(e => e.category === 'frames').length}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {filteredElements.filter(e => e.category === 'frames').map((item) => {
                            const IconComponent = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleAdd(item.id)}
                                className="group w-full p-2.5 rounded-xl border border-slate-200/80 hover:border-[#4A3AFF]/60 hover:bg-indigo-50/30 hover:shadow-2xs transition-all flex items-center justify-between text-left cursor-pointer bg-white"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-9 h-9 rounded-lg ${item.accentBg} ${item.accentColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                                    <IconComponent size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-xs text-slate-800 group-hover:text-[#4A3AFF] transition-colors">
                                        {item.name}
                                      </span>
                                      {item.badge && (
                                        <span className="text-[9.5px] px-1.5 py-0.2 bg-slate-100 text-slate-500 font-mono rounded">
                                          {item.badge}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
                                {item.shortcut && (
                                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-50 group-hover:bg-indigo-100/60 group-hover:text-[#4A3AFF] rounded border border-slate-200 group-hover:border-indigo-200 shrink-0 transition-colors">
                                    {item.shortcut}
                                  </kbd>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Shapes Section */}
                    {filteredElements.some(e => e.category === 'shapes') && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                          <span>Visual Shapes & Lines</span>
                          <span>{filteredElements.filter(e => e.category === 'shapes').length}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {filteredElements.filter(e => e.category === 'shapes').map((item) => {
                            const IconComponent = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleAdd(item.id)}
                                className="group p-2 rounded-xl border border-slate-200/80 hover:border-[#4A3AFF]/60 hover:bg-indigo-50/30 hover:shadow-2xs transition-all flex items-center gap-2.5 text-left cursor-pointer bg-white"
                              >
                                <div className={`w-8 h-8 rounded-lg ${item.accentBg} ${item.accentColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                                  <IconComponent size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs text-slate-800 truncate group-hover:text-[#4A3AFF] transition-colors">
                                      {item.name}
                                    </span>
                                    {item.shortcut && (
                                      <kbd className="px-1 py-0.2 text-[9px] font-mono text-slate-400 bg-slate-50 group-hover:text-[#4A3AFF] rounded border border-slate-200">
                                        {item.shortcut}
                                      </kbd>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Content & Media Section */}
                    {filteredElements.some(e => e.category === 'content') && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                          <span>Typography & Media</span>
                          <span>{filteredElements.filter(e => e.category === 'content').length}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {filteredElements.filter(e => e.category === 'content').map((item) => {
                            const IconComponent = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleAdd(item.id)}
                                className="group w-full p-2.5 rounded-xl border border-slate-200/80 hover:border-[#4A3AFF]/60 hover:bg-indigo-50/30 hover:shadow-2xs transition-all flex items-center justify-between text-left cursor-pointer bg-white"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-9 h-9 rounded-lg ${item.accentBg} ${item.accentColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                                    <IconComponent size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-semibold text-xs text-slate-800 group-hover:text-[#4A3AFF] transition-colors block">
                                      {item.name}
                                    </span>
                                    <p className="text-[11px] text-slate-400 truncate max-w-[190px]">
                                      {item.description}
                                    </p>
                                  </div>
                                </div>
                                {item.shortcut && (
                                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-50 group-hover:bg-indigo-100/60 group-hover:text-[#4A3AFF] rounded border border-slate-200 group-hover:border-indigo-200 shrink-0 transition-colors">
                                    {item.shortcut}
                                  </kbd>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Forms & Interactive Section */}
                    {filteredElements.some(e => e.category === 'forms') && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                          <span>Interactive Form Controls</span>
                          <span>{filteredElements.filter(e => e.category === 'forms').length}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {filteredElements.filter(e => e.category === 'forms').map((item) => {
                            const IconComponent = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleAdd(item.id)}
                                className="group p-2.5 rounded-xl border border-slate-200/80 hover:border-emerald-500/60 hover:bg-emerald-50/30 hover:shadow-2xs transition-all flex items-center gap-2.5 text-left cursor-pointer bg-white"
                              >
                                <div className={`w-8 h-8 rounded-lg ${item.accentBg} ${item.accentColor} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                                  <IconComponent size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="font-semibold text-xs text-slate-800 truncate block group-hover:text-emerald-700 transition-colors">
                                    {item.name}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PAGES & ROUTING DRAWER */}
          {activeTab === 'pages' && (() => {
            const referencePage = rootPages.find(p => p.isHomePage) || rootPages[0];
            const refW = referencePage?.width ? Math.round(referencePage.width) : (typeof window !== 'undefined' ? window.innerWidth : 1440);
            const refH = referencePage?.height ? Math.round(referencePage.height) : (typeof window !== 'undefined' ? window.innerHeight : 900);

            const handleCreatePage = (e: React.FormEvent) => {
              e.preventDefault();
              const cleanName = newPageName.trim() || `Page ${rootPages.length + 1}`;
              let cleanRoute = newPagePath.trim();
              if (cleanRoute && !cleanRoute.startsWith('/')) {
                cleanRoute = `/${cleanRoute}`;
              }

              let chosenW: number | undefined = undefined;
              let chosenH: number | undefined = undefined;

              if (newPageSizePreset === '1440x900') {
                chosenW = 1440;
                chosenH = 900;
              } else if (newPageSizePreset === 'window') {
                chosenW = typeof window !== 'undefined' ? window.innerWidth : 1440;
                chosenH = typeof window !== 'undefined' ? window.innerHeight : 900;
              } else if (newPageSizePreset === '1280x800') {
                chosenW = 1280;
                chosenH = 800;
              } else if (newPageSizePreset === 'custom') {
                chosenW = Math.max(320, newPageCustomW || 1440);
                chosenH = Math.max(320, newPageCustomH || 900);
              }

              addPage(cleanName, cleanRoute, chosenW, chosenH);
              setNewPageName('');
              setNewPagePath('');
              setNewPageSizePreset('match');
              setShowAddPageModal(false);
            };

            const handleSaveEditPage = (pageId: string) => {
              if (!editingPageName.trim()) return;
              let cleanRoute = editingPageRoute.trim();
              if (cleanRoute && !cleanRoute.startsWith('/')) {
                cleanRoute = `/${cleanRoute}`;
              }
              updateNode(pageId, {
                name: editingPageName.trim(),
                ...(cleanRoute ? { routePath: cleanRoute } : {}),
              }, true);
              setEditingPageId(null);
              setEditingPageName('');
              setEditingPageRoute('');
              setToastMessage(`Updated page "${editingPageName.trim()}"`);
            };

            return (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#4A3AFF] flex items-center justify-center shadow-2xs font-bold">
                      <Globe size={18} />
                    </div>
                    <div>
                      <h2 className="font-heading font-bold text-sm text-slate-900 leading-tight">Pages & Routing</h2>
                      <p className="text-[11px] text-slate-400">{rootPages.length} {rootPages.length === 1 ? 'Page' : 'Pages'} in website</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Action & Search Bar */}
                <div className="p-3 pb-2 border-b border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50/50">
                  <button
                    onClick={() => {
                      setNewPageName('');
                      setNewPagePath('');
                      setNewPageSizePreset('match');
                      setShowAddPageModal(true);
                    }}
                    className="w-full py-2 px-3 bg-[#4A3AFF] hover:bg-[#3D2FE6] text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus size={15} /> Add New Page
                  </button>

                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter pages or route slugs..."
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF]"
                    />
                    {pageSearch && (
                      <button
                        onClick={() => setPageSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3">
                  {/* Create Page Modal Form */}
                  {showAddPageModal && (
                    <form onSubmit={handleCreatePage} className="p-3.5 bg-white rounded-xl border border-indigo-200 shadow-sm flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1 border-b border-slate-100">
                        <span className="flex items-center gap-1.5 text-[#4A3AFF]">
                          <Plus size={14} /> New Website Page
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setShowAddPageModal(false)} 
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Page Name</label>
                        <input
                          type="text"
                          placeholder="e.g. About Us, Pricing, Contact"
                          value={newPageName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewPageName(val);
                            if (!newPagePath || newPagePath.startsWith('/')) {
                              const slug = val.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
                              setNewPagePath(slug ? `/${slug}` : '');
                            }
                          }}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF] focus:outline-none"
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Route Path (Slug)</label>
                        <input
                          type="text"
                          placeholder="e.g. /about, /pricing, /"
                          value={newPagePath}
                          onChange={(e) => setNewPagePath(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF] focus:outline-none"
                        />
                      </div>

                      {/* Canvas Size Preset Picker */}
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Canvas Size</label>
                        <select
                          value={newPageSizePreset}
                          onChange={(e) => setNewPageSizePreset(e.target.value as any)}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF] focus:outline-none cursor-pointer"
                        >
                          <option value="match">
                            {referencePage ? `Match Existing Page (${refW} × ${refH})` : 'Match Canvas Default'}
                          </option>
                          <option value="1440x900">Desktop Standard (1440 × 900)</option>
                          <option value="window">
                            Window Fullscreen ({typeof window !== 'undefined' ? window.innerWidth : 1440} × {typeof window !== 'undefined' ? window.innerHeight : 900})
                          </option>
                          <option value="1280x800">Laptop Screen (1280 × 800)</option>
                          <option value="custom">Custom Dimensions...</option>
                        </select>
                      </div>

                      {newPageSizePreset === 'custom' && (
                        <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                          <div>
                            <label className="text-[9.5px] font-semibold text-slate-400 uppercase">Width (px)</label>
                            <input
                              type="number"
                              value={newPageCustomW}
                              onChange={(e) => setNewPageCustomW(Number(e.target.value) || 0)}
                              className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF] focus:outline-none"
                              min={320}
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] font-semibold text-slate-400 uppercase">Height (px)</label>
                            <input
                              type="number"
                              value={newPageCustomH}
                              onChange={(e) => setNewPageCustomH(Number(e.target.value) || 0)}
                              className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-mono focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF] focus:outline-none"
                              min={320}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2 mt-1 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setShowAddPageModal(false)}
                          className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 text-xs bg-[#4A3AFF] hover:bg-[#3D2FE6] text-white font-semibold rounded-lg transition-colors cursor-pointer shadow-xs"
                        >
                          Create Page
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Pages List */}
                  {filteredPages.length === 0 ? (
                    <div className="text-center py-8 px-3 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[#4A3AFF] mb-2.5">
                        <Globe size={20} />
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 mb-1">
                        {pageSearch ? 'No matching pages' : 'No pages created yet'}
                      </h4>
                      <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed mb-3">
                        {pageSearch ? 'Try a different search query' : 'Create frames representing each page of your website or web application.'}
                      </p>
                      {!pageSearch && (
                        <button
                          onClick={() => addPage('Home', '/')}
                          className="px-3.5 py-1.5 bg-[#4A3AFF] hover:bg-[#3D2FE6] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          Create Home Page
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {filteredPages.map((page, index) => {
                        const isSelected = selectedIds.includes(page.id) || nodes.some(n => selectedIds.includes(n.id) && (n.parentId === page.id || n.id === page.id));
                        const isHome = !!page.isHomePage || (index === 0 && !rootPages.some(p => p.isHomePage));
                        const currentRoute = page.routePath || (isHome ? '/' : `/${(page.name || 'page').toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`);

                        const hasTablet = nodes.some(n => n.variantOf === page.id && n.frameType === 'tablet');
                        const hasMobile = nodes.some(n => n.variantOf === page.id && n.frameType === 'mobile');
                        const isEditingThis = editingPageId === page.id;

                        return (
                          <div
                            key={page.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col gap-2 group overflow-hidden ${
                              isSelected
                                ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200 shadow-xs'
                                : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-2xs'
                            }`}
                          >
                            {isEditingThis ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9.5px] font-bold uppercase text-slate-400">Page Name</label>
                                  <input
                                    type="text"
                                    value={editingPageName}
                                    onChange={(e) => setEditingPageName(e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF] focus:outline-none"
                                    autoFocus
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[9.5px] font-bold uppercase text-slate-400">Route Slug</label>
                                  <input
                                    type="text"
                                    value={editingPageRoute}
                                    onChange={(e) => setEditingPageRoute(e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#4A3AFF]/20 focus:border-[#4A3AFF] focus:outline-none"
                                  />
                                </div>
                                <div className="flex justify-end gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPageId(null)}
                                    className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditPage(page.id)}
                                    className="px-3 py-1 text-xs bg-[#4A3AFF] hover:bg-[#3D2FE6] text-white font-semibold rounded-lg"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Page header row */}
                                <div 
                                  className="flex items-center justify-between gap-1 cursor-pointer"
                                  onClick={() => {
                                    panToNode(page.id);
                                  }}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                      isHome ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                      {isHome ? <Home size={16} /> : <Monitor size={16} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <h4 className="font-semibold text-xs text-slate-800 truncate" title={page.name}>
                                          {page.name || `Page ${index + 1}`}
                                        </h4>
                                        {isHome && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                                            Home
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-mono text-[10px] text-slate-400 block truncate" title={currentRoute}>
                                        {currentRoute}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Hover actions & Focus */}
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {!isHome && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setHomePage(page.id);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                                          title="Set as Home Page (/)"
                                        >
                                          <Home size={13} />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          duplicatePage(page.id);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-[#4A3AFF] hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                                        title="Duplicate Page"
                                      >
                                        <Copy size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingPageId(page.id);
                                          setEditingPageName(page.name || `Page ${index + 1}`);
                                          setEditingPageRoute(currentRoute);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                                        title="Rename Page"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm(`Are you sure you want to delete page "${page.name || 'Page'}" and all its contents?`)) {
                                            deletePage(page.id);
                                          }
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                        title="Delete Page"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        panToNode(page.id);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-[#4A3AFF] hover:bg-indigo-50 rounded-md transition-colors shrink-0"
                                      title="Focus page on canvas"
                                    >
                                      <Crosshair size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Responsive variants badge bar */}
                                <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-200/60 text-[10px]">
                                  <span className="text-slate-400 text-[10px]">Variants:</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-medium flex items-center gap-1 text-[9.5px]" title="Desktop frame">
                                    <Monitor size={10} /> Desk
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 text-[9.5px] ${
                                    hasTablet ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-400'
                                  }`} title={hasTablet ? 'Tablet variant generated' : 'No tablet variant'}>
                                    <Tablet size={10} /> Tab
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 text-[9.5px] ${
                                    hasMobile ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-400'
                                  }`} title={hasMobile ? 'Mobile variant generated' : 'No mobile variant'}>
                                    <Smartphone size={10} /> Mob
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 3: COMPONENT LIBRARY DRAWER */}
          {activeTab === 'components' && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#C65D3B] flex items-center justify-center shadow-2xs font-bold">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-sm text-slate-900 leading-tight">Component Library</h2>
                    <p className="text-[11px] text-slate-400">Reusable master components & instances</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search */}
              <div className="p-3 pb-2 border-b border-slate-100 shrink-0 bg-slate-50/50">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search master components..."
                    value={compSearch}
                    onChange={(e) => setCompSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C65D3B]/20 focus:border-[#C65D3B]"
                  />
                  {compSearch && (
                    <button
                      onClick={() => setCompSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="p-3 flex-1 overflow-y-auto">
                {filteredComponents.length === 0 ? (
                  <div className="text-center py-10 px-3 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-[#C65D3B] mb-2.5">
                      <Box size={24} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">
                      {compSearch ? 'No components match search' : 'No components created yet'}
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed">
                      Select any element on the canvas and click <span className="font-semibold text-slate-600">"Create Component"</span> in the Right Inspector to turn it into a reusable master.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {filteredComponents.map(comp => (
                      <div 
                        key={comp.id} 
                        className="group relative p-3 rounded-xl border border-slate-200/90 hover:border-[#4A3AFF] hover:bg-indigo-50/30 transition-all flex items-center gap-3 bg-white shadow-2xs"
                      >
                        <div 
                          className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-[#4A3AFF] cursor-pointer group-hover:scale-105 transition-transform" 
                          onClick={() => handleSpawnInstance(comp.id)}
                          title="Click to spawn instance on canvas"
                        >
                          <Box size={20} />
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSpawnInstance(comp.id)}>
                          <h4 className="font-semibold text-xs text-slate-800 truncate group-hover:text-[#4A3AFF] transition-colors">
                            {comp.componentName || 'Unnamed Component'}
                          </h4>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono mt-0.5">
                            {comp.type}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-xs rounded-lg p-1 border border-slate-100 shadow-2xs">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              selectNodes([comp.id]);
                              const cx = window.innerWidth / 2;
                              const cy = window.innerHeight / 2;
                              setPan({ x: cx - (comp.x * zoom), y: cy - (comp.y * zoom) });
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#4A3AFF] hover:bg-indigo-50 rounded-md transition-colors"
                            title="Edit Master Component"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Are you sure you want to delete this component and all its instances?')) {
                                deleteComponent(comp.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete Component"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STATE VARIABLES DRAWER */}
          {activeTab === 'variables' && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs font-bold">
                    <Variable size={18} />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-sm text-slate-900 leading-tight">State Variables</h2>
                    <p className="text-[11px] text-slate-400">Dynamic UI state & data binding store</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Action & Search */}
              <div className="p-3 pb-2 border-b border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50/50">
                <button
                  onClick={handleStartAddVariable}
                  className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus size={15} /> Add Variable
                </button>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search variables by name or type..."
                    value={varSearch}
                    onChange={(e) => setVarSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {varSearch && (
                    <button
                      onClick={() => setVarSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3">
                {/* Create / Edit Inline Form */}
                {showAddVarModal && (
                  <form onSubmit={handleCreateOrUpdateVariable} className="p-3.5 bg-white rounded-xl border border-emerald-300 shadow-sm flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <Variable size={14} />
                        {editingVarId ? 'Edit State Variable' : 'New State Variable'}
                      </span>
                      <button type="button" onClick={() => setShowAddVarModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Variable Name</label>
                      <input
                        type="text"
                        placeholder="e.g. isModalOpen, cartTotal, user"
                        value={varName}
                        onChange={(e) => setVarName(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Data Type</label>
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
                        className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none cursor-pointer"
                      >
                        <option value="string">String (Text)</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean (true / false)</option>
                        <option value="array">Array (JSON list)</option>
                        <option value="object">Object (JSON key-value)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Default Value</label>
                      {varType === 'boolean' ? (
                        <select
                          value={varDefaultVal === 'true' ? 'true' : 'false'}
                          onChange={(e) => setVarDefaultVal(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
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
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                        />
                      ) : (
                        <input
                          type="text"
                          placeholder={varType === 'object' ? "{ name: 'John' }" : varType === 'array' ? '["item1", "item2"]' : 'Initial value'}
                          value={varDefaultVal}
                          onChange={(e) => setVarDefaultVal(e.target.value)}
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
                        />
                      )}
                    </div>

                    <div className="flex justify-end gap-2 mt-1 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowAddVarModal(false)}
                        className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                      >
                        {editingVarId ? 'Update Variable' : 'Save Variable'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Variable List */}
                {filteredVariables.length === 0 ? (
                  <div className="text-center py-8 px-3 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2.5">
                      <Variable size={20} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">
                      {varSearch ? 'No variables match search' : 'No state variables declared'}
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed mb-3">
                      Add variables to bind dynamic inputs, conditionals, and API data across canvas nodes.
                    </p>
                    {!varSearch && (
                      <button
                        onClick={handleStartAddVariable}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        Add First Variable
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredVariables.map((v) => (
                      <div key={v.id} className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between group hover:border-emerald-400/80 hover:shadow-2xs transition-all shadow-2xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900 truncate">{v.name}</span>
                            <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold uppercase tracking-wider">
                              {v.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-1">
                            Default: <span className="font-mono text-slate-700 font-medium">
                              {v.type === 'string' && (v.defaultValue === '' || v.defaultValue === '""' || v.defaultValue === "''") ? '(empty string)' : JSON.stringify(v.defaultValue)}
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleStartEditVariable(v)}
                            className="text-slate-400 hover:text-emerald-600 p-1.5 rounded-md hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Edit Variable"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => deleteStateVariable(v.id)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Variable"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: DATA SOURCES DRAWER */}
          {activeTab === 'data' && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-4 pb-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs font-bold">
                    <Database size={18} />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-sm text-slate-900 leading-tight">Data Sources</h2>
                    <p className="text-[11px] text-slate-400">Connect REST APIs to live UI elements</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Action & Search */}
              <div className="p-3 pb-2 border-b border-slate-100 flex flex-col gap-2 shrink-0 bg-slate-50/50">
                <button
                  onClick={handleStartAddDataSource}
                  className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus size={15} /> Add Data Source
                </button>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search endpoints or names..."
                    value={dsSearch}
                    onChange={(e) => setDsSearch(e.target.value)}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                  {dsSearch && (
                    <button
                      onClick={() => setDsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3">
                {/* Create / Edit Form */}
                {showAddDsModal && (
                  <form onSubmit={handleSaveDataSource} className="p-3.5 bg-white rounded-xl border border-sky-300 shadow-sm flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-1 border-b border-slate-100">
                      <span className="flex items-center gap-1.5 text-sky-700">
                        <Database size={14} />
                        {editingDsId ? 'Edit Data Source' : 'New Data Source'}
                      </span>
                      <button type="button" onClick={() => setShowAddDsModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Name</label>
                      <input
                        type="text"
                        placeholder="e.g. getUsers, fetchProducts"
                        value={dsName}
                        onChange={(e) => setDsName(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Method</label>
                        <select
                          value={dsMethod}
                          onChange={(e) => setDsMethod(e.target.value as any)}
                          className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
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
                          className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    {/* Headers Table */}
                    <div className="flex flex-col gap-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Headers</label>
                        <button
                          type="button"
                          onClick={handleAddHeader}
                          className="text-[10px] text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-0.5 cursor-pointer"
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
                            className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                          />
                          <input
                            type="text"
                            placeholder="Value"
                            value={header.value}
                            onChange={(e) => handleHeaderChange(header.id, 'value', e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                          className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {/* Target State Variable */}
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Store In State Variable (Data)</label>
                      <select
                        value={dsTargetVariableId}
                        onChange={(e) => setDsTargetVariableId(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="">-- None (Do not store) --</option>
                        {stateVariables.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Loading and Error Lifecycle Variables */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Loading Variable</label>
                        <select
                          value={dsLoadingVariableId}
                          onChange={(e) => setDsLoadingVariableId(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                        >
                          <option value="">-- None --</option>
                          {stateVariables.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.type})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Error Variable</label>
                        <select
                          value={dsErrorVariableId}
                          onChange={(e) => setDsErrorVariableId(e.target.value)}
                          className="w-full mt-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none"
                        >
                          <option value="">-- None --</option>
                          {stateVariables.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Response Path */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Response Path</label>
                        <span className="text-[9px] text-slate-400">e.g. data.items</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Leave empty for root response"
                        value={dsResponsePath}
                        onChange={(e) => setDsResponsePath(e.target.value)}
                        className="w-full mt-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none font-mono"
                      />
                    </div>

                    {/* Fetch on Page Load Option */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={dsFetchOnLoad}
                          onChange={(e) => setDsFetchOnLoad(e.target.checked)}
                          className="rounded text-sky-600 focus:ring-0 cursor-pointer"
                        />
                        <span className="flex items-center gap-1.5">
                          <Zap size={13} className="text-amber-600" />
                          <span>Fetch on Page/Frame Load</span>
                        </span>
                      </label>

                      {dsFetchOnLoad && (
                        <div className="pl-5 flex flex-col gap-1">
                          <label className="text-[9.5px] uppercase font-bold text-slate-400">Triggering Frame</label>
                          <select
                            value={dsTargetFrameId}
                            onChange={(e) => setDsTargetFrameId(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                        className="w-full py-2 px-3 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isTestingDs ? (
                          <>
                            <RefreshCw size={13} className="animate-spin text-sky-600" />
                            Testing Endpoint...
                          </>
                        ) : (
                          <>
                            <Play size={12} className="fill-sky-700" />
                            Test API Request
                          </>
                        )}
                      </button>

                      {testResult && (
                        <div className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1.5 ${testResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1">
                              {testResult.ok ? <Check size={14} className="text-emerald-600" /> : <AlertCircle size={14} className="text-rose-600" />}
                              Status: {testResult.status || (testResult.ok ? '200' : 'Error')} {testResult.statusText || ''}
                            </span>
                            <span className="text-[10px] opacity-75 font-mono">{testResult.timeMs}ms</span>
                          </div>

                          {testResult.error && (
                            <p className="text-[11px] text-rose-700">{testResult.error}</p>
                          )}

                          {testResult.extracted !== undefined && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold text-emerald-800">
                                Extracted via "{dsResponsePath}": {Array.isArray(testResult.extracted) ? `(${testResult.extracted.length} items)` : typeof testResult.extracted}
                              </span>
                              <pre className="max-h-24 overflow-y-auto text-[9.5px] bg-slate-900 text-emerald-400 p-2 rounded-lg font-mono">
                                {JSON.stringify(testResult.extracted, null, 2)}
                              </pre>
                            </div>
                          )}

                          {testResult.extracted === undefined && testResult.data !== undefined && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold text-slate-700">Response Payload:</span>
                              <pre className="max-h-24 overflow-y-auto text-[9.5px] bg-slate-900 text-slate-100 p-2 rounded-lg font-mono">
                                {typeof testResult.data === 'object' ? JSON.stringify(testResult.data, null, 2) : String(testResult.data)}
                              </pre>
                            </div>
                          )}

                          {testResult.ok && dsTargetVariableId && (
                            <button
                              type="button"
                              onClick={handleApplyTestToVariable}
                              className="mt-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <Check size={12} /> Save Sample Data into Target Variable
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 mt-1 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => { setShowAddDsModal(false); setEditingDsId(null); setTestResult(null); }}
                        className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        {editingDsId ? 'Update Data Source' : 'Save Data Source'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Data Sources List */}
                {filteredDataSources.length === 0 ? (
                  <div className="text-center py-8 px-3 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 mb-2.5">
                      <Database size={20} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800 mb-1">
                      {dsSearch ? 'No data sources match search' : 'No data sources configured'}
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-[210px] leading-relaxed mb-3">
                      Connect REST APIs to fetch dynamic data for your UI components and state variables.
                    </p>
                    {!dsSearch && (
                      <button
                        onClick={handleStartAddDataSource}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        Add First Data Source
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredDataSources.map((ds) => {
                      const targetVar = stateVariables.find(v => v.id === ds.targetVariableId);
                      const targetFrame = nodes.find(n => n.id === ds.targetFrameId);
                      const methodColor = 
                        ds.method === 'GET' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        ds.method === 'POST' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                        ds.method === 'PUT' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        ds.method === 'DELETE' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                        'bg-purple-100 text-purple-800 border-purple-300';

                      return (
                        <div key={ds.id} className="p-3 bg-white border border-slate-200/90 rounded-xl flex flex-col gap-2 group hover:border-sky-400/80 hover:shadow-2xs transition-all shadow-2xs">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${methodColor}`}>
                                {ds.method}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-900 truncate" title={ds.name}>
                                {ds.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => handleStartEditDataSource(ds)}
                                className="text-slate-400 hover:text-sky-600 p-1.5 rounded-md hover:bg-sky-50 transition-colors cursor-pointer"
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
                                className="text-slate-400 hover:text-rose-500 p-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Data Source"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] font-mono text-slate-500 truncate bg-slate-50 px-2 py-1 rounded border border-slate-100" title={ds.url}>
                            {ds.url}
                          </p>

                          <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-100">
                            {ds.fetchOnLoad && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold flex items-center gap-1">
                                <Zap size={11} className="text-amber-600 shrink-0" />
                                <span>On Load ({targetFrame ? (targetFrame.name || 'Frame') : 'Global'})</span>
                              </span>
                            )}
                            {targetVar && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold truncate max-w-[180px] flex items-center gap-1">
                                <Box size={11} className="text-indigo-600 shrink-0" />
                                <span className="truncate">{targetVar.name}{ds.responsePath ? ` (${ds.responsePath})` : ''}</span>
                              </span>
                            )}
                            {ds.loadingVariableId && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-semibold truncate max-w-[140px] flex items-center gap-1" title="Loading state variable">
                                <Clock size={11} className="text-blue-600 shrink-0" />
                                <span className="truncate">{stateVariables.find(v => v.id === ds.loadingVariableId)?.name || ds.loadingVariableId}</span>
                              </span>
                            )}
                            {ds.errorVariableId && (
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-semibold truncate max-w-[140px] flex items-center gap-1" title="Error state variable">
                                <AlertTriangle size={11} className="text-rose-600 shrink-0" />
                                <span className="truncate">{stateVariables.find(v => v.id === ds.errorVariableId)?.name || ds.errorVariableId}</span>
                              </span>
                            )}
                            {!ds.fetchOnLoad && !targetVar && (
                              <span className="text-[9.5px] text-slate-400 italic">
                                Trigger via component interaction
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
        </div>
      )}

      {/* Add Image Modal Dialog */}
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
                  <Globe size={14} /> From URL / Preset
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
                  <Upload size={14} /> Upload File
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
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#4A3AFF] focus:outline-none font-mono text-slate-800"
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

                  <p className="text-[11px] text-slate-500 leading-relaxed bg-amber-50/70 border border-amber-200/60 p-2.5 rounded-lg text-amber-800 flex items-start gap-2">
                    <Lightbulb size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>Dynamic Data Binding:</strong> You can bind this image to API variables like <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded">products.thumbnail</code> or <code className="font-mono text-[10px] bg-white px-1 py-0.5 rounded">item.image</code> in the Right Sidebar after inserting.
                    </span>
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
