import React, { useState } from 'react';
import { Undo, Redo, Play, Download, Search, ZoomOut, ZoomIn, HelpCircle } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';

export const TopBar: React.FC = () => {
  const { undo, redo, zoom, setZoom, past, future, selectedId, nodes, setMode, setPreviewFrameId } = useCanvasStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handlePreview = () => {
    const selectedNode = nodes.find(n => n.id === selectedId);
    let targetFrameId = null;
    
    if (selectedNode) {
      if (selectedNode.type === 'Frame') targetFrameId = selectedNode.id;
      else if (selectedNode.parentId) targetFrameId = selectedNode.parentId;
    }
    
    // Fallback to first frame if none selected
    if (!targetFrameId) {
      const firstFrame = nodes.find(n => n.type === 'Frame');
      if (firstFrame) targetFrameId = firstFrame.id;
    }
    
    if (targetFrameId) {
      setPreviewFrameId(targetFrameId);
      setMode('preview');
    } else {
      alert("Please add a Frame to the canvas before previewing.");
    }
  };

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10 shadow-sm relative shrink-0">
      <div className="flex items-center gap-2">
        <img src="/logo.jpg" alt="PixelNirmaan Logo" className="w-8 h-8 object-contain mr-2 rounded" />
        <h1 className="font-heading font-bold text-lg text-slate-800 tracking-tight">PixelNirmaan</h1>
      </div>
      
      <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
        <button 
          onClick={undo} 
          disabled={past.length === 0}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent text-slate-600 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo size={18} />
        </button>
        <button 
          onClick={redo} 
          disabled={future.length === 0}
          className="p-2 rounded hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent text-slate-600 transition-colors"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo size={18} />
        </button>
        <div className="w-px h-6 bg-slate-200 mx-2" />
        <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="p-2 rounded hover:bg-slate-100 text-slate-600">
          <ZoomOut size={18} />
        </button>
        <span className="text-xs font-mono font-medium text-slate-600 w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(Math.min(5, zoom + 0.1))} className="p-2 rounded hover:bg-slate-100 text-slate-600">
          <ZoomIn size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setShowShortcuts(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors" title="Help & Shortcuts">
          <HelpCircle size={16} />
        </button>
        <button onClick={handlePreview} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors">
          <Play size={16} />
          <span>Preview</span>
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors" style={{backgroundColor: '#4A3AFF'}} onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'}>
          <Download size={16} />
          <span>Export Code</span>
        </button>
      </div>

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[400px] p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold font-heading">Help & Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-slate-800 text-2xl leading-none">&times;</button>
            </div>
            
            <h3 className="font-semibold text-sm text-slate-800 mb-3 border-b border-slate-100 pb-2">Connections (Prototyping)</h3>
            <div className="text-sm text-slate-600 space-y-2 mb-6">
              <p>1. Select the <strong>Connect Tool</strong> (Link icon) in the left sidebar.</p>
              <p>2. Click on a shape/button inside a Frame.</p>
              <p>3. Click anywhere on a <strong>matching Frame</strong> (e.g., Mobile to Mobile) to link them.</p>
              <p>4. Click the <strong>Preview</strong> button above to test your interactive prototype!</p>
            </div>

            <h3 className="font-semibold text-sm text-slate-800 mb-3 border-b border-slate-100 pb-2">Keyboard Shortcuts</h3>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Copy</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + C</kbd></div>
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Paste</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + V</kbd></div>
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Duplicate</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + D</kbd></div>
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Undo</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + Z</kbd></div>
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Redo</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + Shift + Z</kbd></div>
              <div className="flex justify-between pt-1"><span>Delete</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Del / Backspace</kbd></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
