import React, { useRef, useState } from 'react';
import { Square, Circle, Type, Image as ImageIcon, Monitor, Tablet, Smartphone, Triangle, Minus, Spline, MousePointer2, Link, Layers, Box, Edit2, Trash2 } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import type { NodeType } from '../store/useCanvasStore';

export const LeftSidebar: React.FC = () => {
  const { addNode, nodes, pan, zoom, mode, setMode, spawnInstance, selectNodes, deleteComponent, setPan } = useCanvasStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'tools' | 'components'>('tools');

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
    else if (type === 'Frame-Desktop') addNode({ type: 'Frame', x: x - 720 + 50, y: y - 450 + 50, width: 1440, height: 900, fill: '#ffffff', frameType: 'desktop' });
    else if (type === 'Frame-Tablet') addNode({ type: 'Frame', x: x - 384 + 50, y: y - 512 + 50, width: 768, height: 1024, fill: '#ffffff', frameType: 'tablet' });
    else if (type === 'Frame-Mobile') addNode({ type: 'Frame', x: x - 196 + 50, y: y - 426 + 50, width: 393, height: 852, fill: '#ffffff', frameType: 'mobile' });
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
        </div>

        <div className="flex flex-col items-center gap-1 w-full pt-2 pb-4 border-b border-slate-100">
          <button onClick={() => handleAdd('Frame-Desktop')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Desktop Frame"><Monitor size={20} /></button>
          <button onClick={() => handleAdd('Frame-Tablet')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Tablet Frame"><Tablet size={20} /></button>
          <button onClick={() => handleAdd('Frame-Mobile')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Mobile Frame"><Smartphone size={20} /></button>
        </div>

        <div className="flex flex-col items-center gap-1 w-full pt-2 pb-4 border-b border-slate-100">
          <button onClick={() => handleAdd('Rect')} className="p-3 rounded-xl hover:bg-orange-50 text-slate-500 hover:text-[#C65D3B] transition-colors" title="Rectangle"><Square size={24} /></button>
          <button onClick={() => handleAdd('Circle')} className="p-3 rounded-xl hover:bg-indigo-50 text-slate-500 hover:text-[#4A3AFF] transition-colors" title="Circle"><Circle size={24} /></button>
          <button onClick={() => handleAdd('Triangle')} className="p-3 rounded-xl hover:bg-yellow-50 text-slate-500 hover:text-yellow-600 transition-colors" title="Triangle"><Triangle size={24} /></button>
          <button onClick={() => handleAdd('Line')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Line"><Minus size={24} /></button>
          <button onClick={() => handleAdd('Curve')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Curve"><Spline size={24} /></button>
        </div>

        <div className="flex flex-col items-center gap-1 w-full pt-2">
          <button onClick={() => handleAdd('Text')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Text"><Type size={24} /></button>
          <button onClick={() => handleAdd('Image')} className="p-3 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors" title="Upload Image"><ImageIcon size={24} /></button>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
        </div>
      </div>

      {/* Component Library Drawer */}
      {activeTab === 'components' && (
        <div className="w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col z-10 animate-in slide-in-from-left-4 duration-200">
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-heading font-bold text-slate-800 flex items-center gap-2">
              <Layers size={18} className="text-[#C65D3B]" /> Component Library
            </h2>
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
                          // Calculate center of screen in unscaled coordinates
                          const cx = window.innerWidth / 2;
                          const cy = window.innerHeight / 2;
                          // Set pan to center the component
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
    </div>
  );
};
