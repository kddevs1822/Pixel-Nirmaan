import React, { useState, useRef, useEffect } from 'react';
import { Undo, Redo, Play, Download, ZoomOut, ZoomIn, HelpCircle, FolderOutput, ChevronDown, FolderOpen, Check, X } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useCanvasStore } from '../store/useCanvasStore';

export const TopBar: React.FC = () => {
  const { undo, redo, zoom, setZoom, past, future, selectedIds, nodes, setMode, setPreviewFrameId } = useCanvasStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [outputPath, setOutputPath] = useState(() => localStorage.getItem('pixelnirmaan-output-path') || '');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePreview = () => {
    const selectedNode = selectedIds.length > 0 ? nodes.find(n => n.id === selectedIds[0]) : null;
    let targetFrameId: string | null = null;
    
    if (selectedNode) {
      if (selectedNode.type === 'Frame') {
        // Resolve variants to their primary frame
        targetFrameId = selectedNode.variantOf || selectedNode.id;
      } else if (selectedNode.parentId) {
        const parentFrame = nodes.find(n => n.id === selectedNode.parentId);
        if (parentFrame) {
          targetFrameId = parentFrame.variantOf || parentFrame.id;
        }
      }
    }
    
    if (!targetFrameId) {
      // Prefer root non-variant frames
      const rootFrame = nodes.find(n => n.type === 'Frame' && !n.parentId && !n.variantOf);
      if (rootFrame) {
        targetFrameId = rootFrame.id;
      } else {
        // Fallback: any frame, resolved to primary
        const anyFrame = nodes.find(n => n.type === 'Frame' && !n.parentId);
        if (anyFrame) targetFrameId = anyFrame.variantOf || anyFrame.id;
      }
    }
    
    if (targetFrameId) {
      setPreviewFrameId(targetFrameId);
      setMode('preview');
    } else {
      alert("Please add a Frame to the canvas before previewing.");
    }
  };

  const handleExportZip = async () => {
    setShowExportMenu(false);
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
        const contentStr = content as string;
        if (contentStr.startsWith('data:image/')) {
          const base64Data = contentStr.split(',')[1];
          zip.file(filepath, base64Data, { base64: true });
        } else {
          zip.file(filepath, contentStr);
        }
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'pixelnirmaan-export.zip');
    } catch (error: any) {
      console.error("Export error:", error);
      alert(`Export Error: ${error.message}`);
    }
  };

  const handleExportToFolder = async () => {
    if (!outputPath.trim()) {
      setShowExportMenu(false);
      setShowFolderModal(true);
      return;
    }

    setShowExportMenu(false);
    setExportStatus('exporting');
    setExportMessage('');

    try {
      const response = await fetch('http://localhost:5000/api/generate-to-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodes, outputPath: outputPath.trim() })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Export failed: ${response.statusText}`);
      }

      setExportStatus('success');
      setExportMessage(`${data.fileCount} files exported`);
      setTimeout(() => { setExportStatus('idle'); setExportMessage(''); }, 3000);
    } catch (error: any) {
      console.error("Export to folder error:", error);
      setExportStatus('error');
      setExportMessage(error.message);
      setTimeout(() => { setExportStatus('idle'); setExportMessage(''); }, 4000);
    }
  };

  const handleSaveOutputPath = () => {
    localStorage.setItem('pixelnirmaan-output-path', outputPath.trim());
    setShowFolderModal(false);
    if (outputPath.trim()) {
      handleExportToFolder();
    }
  };

  const handleChangeFolder = () => {
    setShowExportMenu(false);
    setShowFolderModal(true);
  };

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 shadow-sm relative shrink-0">
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

        {/* Export button with dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <div className="flex">
            <button 
              type="button"
              onClick={outputPath ? handleExportToFolder : handleExportZip} 
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-l-lg text-white text-sm font-medium transition-colors cursor-pointer" 
              style={{backgroundColor: '#4A3AFF'}} 
              onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'} 
              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              title={outputPath ? `Export to: ${outputPath}` : 'Download as ZIP'}
            >
              {outputPath ? <FolderOutput size={16} /> : <Download size={16} />}
              <span>{exportStatus === 'exporting' ? 'Exporting...' : outputPath ? 'Export Code' : 'Download ZIP'}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowExportMenu(prev => !prev);
              }}
              className="flex items-center px-2.5 py-1.5 rounded-r-lg text-white text-sm transition-colors border-l border-white/20 cursor-pointer hover:bg-white/10"
              style={{backgroundColor: '#4A3AFF'}}
              onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'} 
              onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              title="Export Options"
            >
              <ChevronDown size={16} className="pointer-events-none" />
            </button>
          </div>

          {/* Dropdown menu */}
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
              <button
                type="button"
                onClick={handleExportZip}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download size={16} className="text-slate-500 shrink-0" />
                <div>
                  <div className="font-medium text-slate-800">Download ZIP</div>
                  <div className="text-xs text-slate-500">Download as a zip file</div>
                </div>
              </button>
              <div className="h-px bg-slate-100" />
              <button
                type="button"
                onClick={outputPath ? handleExportToFolder : handleChangeFolder}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FolderOutput size={16} className="text-slate-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-800">Export to Folder</div>
                  {outputPath ? (
                    <div className="text-xs text-indigo-500 truncate">{outputPath}</div>
                  ) : (
                    <div className="text-xs text-slate-500">Set up output directory</div>
                  )}
                </div>
              </button>
              {outputPath && (
                <>
                  <div className="h-px bg-slate-100" />
                  <button
                    type="button"
                    onClick={handleChangeFolder}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <FolderOpen size={16} className="text-slate-400 shrink-0" />
                    <span className="text-slate-600">Change Folder...</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Export status toast */}
        {exportStatus !== 'idle' && (
          <div className={`fixed top-16 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all ${
            exportStatus === 'success' ? 'bg-emerald-500 text-white' : 
            exportStatus === 'error' ? 'bg-red-500 text-white' :
            'bg-slate-800 text-white'
          }`}>
            {exportStatus === 'success' && <Check size={16} />}
            {exportStatus === 'error' && <X size={16} />}
            {exportStatus === 'exporting' && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{exportMessage || 'Exporting...'}</span>
          </div>
        )}
      </div>

      {/* Folder path modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-[480px] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{backgroundColor: '#4A3AFF20'}}>
                <FolderOutput size={20} style={{color: '#4A3AFF'}} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-slate-800">Export to Folder</h3>
                <p className="text-xs text-slate-500">Set the output directory for your generated code</p>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Output Directory Path</label>
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="e.g., D:\Projects\my-website"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent font-mono"
                style={{ focusRingColor: '#4A3AFF' } as any}
                onFocus={(e) => e.target.style.borderColor = '#4A3AFF'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOutputPath(); }}
                autoFocus
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Files will be written directly to this folder. If a dev server is running, changes will hot-reload.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveOutputPath}
                disabled={!outputPath.trim()}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
                style={{backgroundColor: '#4A3AFF'}}
                onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
              >
                Save & Export
              </button>
            </div>
          </div>
        </div>
      )}

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
