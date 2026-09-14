import React, { useState } from 'react';
import { Undo, Redo, Play, Download, ZoomOut, ZoomIn, HelpCircle } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useCanvasStore } from '../store/useCanvasStore';

export const TopBar: React.FC = () => {
  const { undo, redo, zoom, setZoom, past, future, selectedIds, nodes, setMode, setPreviewFrameId } = useCanvasStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handlePreview = () => {
    const selectedNode = selectedIds.length > 0 ? nodes.find(n => n.id === selectedIds[0]) : null;
    let targetFrameId = null;
    
    if (selectedNode) {
      if (selectedNode.type === 'Frame') targetFrameId = selectedNode.id;
      else if (selectedNode.parentId) targetFrameId = selectedNode.parentId;
    }
    
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

  const handleExportCode = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodes })
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.files) {
        throw new Error("No files returned from the server");
      }

      const zip = new JSZip();
      
      Object.entries(data.files).forEach(([filepath, content]) => {
        zip.file(filepath, content as string);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'pixelnirmaan-export.zip');
    } catch (error: any) {
      console.error("Export error:", error);
      alert(`Export Error: ${error.message}`);
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
        <button onClick={handleExportCode} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors" style={{backgroundColor: '#4A3AFF'}} onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'} onMouseOut={(e) => e.currentTarget.style.opacity = '1'}>
          <Download size={16} />
          <span>Export Code</span>
        </button>
      </div>

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[450px] p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold font-heading">Help & Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-slate-800 text-2xl leading-none">&times;</button>
            </div>
            
            <h3 className="font-semibold text-sm text-slate-800 mb-3 border-b border-slate-100 pb-2">Keyboard Shortcuts</h3>
            <div className="flex flex-col gap-3 text-sm mb-6">
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Copy</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + C</kbd></div>
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Paste</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + V</kbd></div>
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Duplicate</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + D</kbd></div>
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Undo</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + Z</kbd></div>
              <div className="flex justify-between border-b border-slate-100 pb-2"><span>Redo</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Ctrl + Shift + Z</kbd></div>
              <div className="flex justify-between pt-1"><span>Delete</span><kbd className="bg-slate-100 px-2 py-1 rounded font-mono text-xs font-semibold">Del / Backspace</kbd></div>
            </div>

            <h3 className="font-semibold text-sm text-slate-800 mb-3 border-b border-slate-100 pb-2">Components & Props</h3>
            <div className="text-sm text-slate-600 space-y-2 mb-6">
              <p>1. Select one or more elements and click <strong>Create Component</strong>.</p>
              <p>2. In the right sidebar, use <strong>Available Elements</strong> to auto-expose properties like Text or Fill Color.</p>
              <p>3. Drag the component from the <strong>Component Library</strong> to create reusable instances!</p>
            </div>

            <h3 className="font-semibold text-sm text-slate-800 mb-3 border-b border-slate-100 pb-2">Multi-Select</h3>
            <div className="text-sm text-slate-600 space-y-2 mb-6">
              <p>• <strong>Shift + Click</strong> on elements to select multiple items.</p>
              <p>• <strong>Drag on the background</strong> to draw a selection box.</p>
              <p>• Multi-selected items can be dragged, resized, and modified together!</p>
            </div>

            <h3 className="font-semibold text-sm text-slate-800 mb-3 border-b border-slate-100 pb-2">Connections (Prototyping)</h3>
            <div className="text-sm text-slate-600 space-y-2 mb-2">
              <p>1. Select the <strong>Connect Tool</strong> (Link icon) in the left sidebar.</p>
              <p>2. Click on a shape/button inside a Frame.</p>
              <p>3. Click anywhere on a <strong>matching Frame</strong> (e.g., Mobile to Mobile) to link them.</p>
              <p>4. Click the <strong>Preview</strong> button above to test your interactive prototype!</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
