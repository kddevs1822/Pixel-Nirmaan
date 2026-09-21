import React, { useState, useRef, useEffect } from 'react';
import { Undo, Redo, Play, Download, ZoomOut, ZoomIn, HelpCircle, FolderOutput, ChevronDown, FolderOpen, Check, X, LogOut } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useCanvasStore } from '../store/useCanvasStore';
import { useAuthStore } from '../store/useAuthStore';

export const TopBar: React.FC = () => {
  const { undo, redo, zoom, setZoom, past, future, selectedIds, nodes, setMode, setPreviewFrameId } = useCanvasStore();
  const { user, logout, openAuthModal } = useAuthStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [outputPath, setOutputPath] = useState(() => localStorage.getItem('pixelnirmaan-output-path') || '');
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePreview = () => {
    if (!user) {
      openAuthModal();
      return;
    }
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
    if (!user) {
      openAuthModal();
      return;
    }
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
    if (!user) {
      openAuthModal();
      return;
    }
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

  const [isSelectingFolder, setIsSelectingFolder] = useState(false);

  const handleBrowseFolder = async () => {
    setIsSelectingFolder(true);
    try {
      const response = await fetch('http://localhost:5000/api/select-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.path) {
          setOutputPath(data.path);
          setIsSelectingFolder(false);
          return;
        }
      }
    } catch (e) {
      console.warn("Backend folder picker unavailable, checking browser API...", e);
    }

    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        if (handle && handle.name) {
          setOutputPath(handle.name);
        }
      } catch (err) {
        // User cancelled
      }
    }
    setIsSelectingFolder(false);
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

        <div className="w-px h-6 bg-slate-200 mx-0.5" />

        {/* User Auth: Profile Avatar or Sign In button */}
        {user ? (
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-indigo-500/20 transition-all cursor-pointer focus:outline-none"
              title={`${user.name} (${user.email})`}
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-slate-800 truncate">{user.name}</div>
                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                  </div>
                </div>

                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors shadow-sm cursor-pointer shrink-0"
            title="Sign in with Google"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In</span>
          </button>
        )}

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
          <div className="bg-white rounded-2xl shadow-xl w-[520px] p-6">
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
              <div className="flex gap-2">
                <input
                  type="text"
                  value={outputPath}
                  onChange={(e) => setOutputPath(e.target.value)}
                  placeholder="e.g., C:\Users\DEV\Downloads\pixelnirmaan-export"
                  className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent font-mono"
                  style={{ focusRingColor: '#4A3AFF' } as any}
                  onFocus={(e) => e.target.style.borderColor = '#4A3AFF'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOutputPath(); }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleBrowseFolder}
                  disabled={isSelectingFolder}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors shrink-0 disabled:opacity-50 cursor-pointer shadow-sm"
                  title="Browse folder from your device"
                >
                  <FolderOpen size={16} className="text-slate-500" />
                  <span>{isSelectingFolder ? 'Selecting...' : 'Browse...'}</span>
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Click <strong>Browse...</strong> to pick a folder on your device, or paste a folder path above.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOutputPath}
                disabled={!outputPath.trim()}
                className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
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
