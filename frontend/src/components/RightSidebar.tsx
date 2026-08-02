import React from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { ChevronsUp, ChevronUp, ChevronDown, ChevronsDown } from 'lucide-react';

export const RightSidebar: React.FC = () => {
  const selectedId = useCanvasStore((state) => state.selectedId);
  const nodes = useCanvasStore((state) => state.nodes);
  const updateNode = useCanvasStore((state) => state.updateNode);
  const reorderNode = useCanvasStore((state) => state.reorderNode);

  const selectedNode = nodes.find((n) => n.id === selectedId);

  const parentFrame = selectedNode?.parentId ? nodes.find(n => n.id === selectedNode.parentId) : null;
  const isConnectable = !!parentFrame && parentFrame.type === 'Frame';
  const compatibleFrames = isConnectable 
    ? nodes.filter(n => n.type === 'Frame' && n.frameType === parentFrame.frameType && n.id !== parentFrame.id) 
    : [];

  if (!selectedNode) {
    return (
      <div className="w-72 bg-white border-l border-slate-200 p-6 flex flex-col gap-4 z-10 shadow-sm text-slate-400 text-sm text-center pt-20 shrink-0">
        Select an element to edit its properties
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: string, isNumber: boolean) => {
    let value: any = e.target.value;
    if (isNumber) {
      value = parseFloat(value);
      if (isNaN(value)) return;
    }
    updateNode(selectedNode.id, { [field]: value }, true);
  };

  return (
    <div className="w-72 bg-white border-l border-slate-200 p-6 flex flex-col gap-6 z-10 shadow-sm overflow-y-auto shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-lg text-slate-800">Properties</h3>
        <span className="text-xs font-mono font-medium px-2 py-1 bg-slate-100 text-slate-500 rounded">{selectedNode.type}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">X</label>
          <input 
            type="number" 
            value={Math.round(selectedNode.x)} 
            onChange={(e) => handleChange(e, 'x', true)}
            className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Y</label>
          <input 
            type="number" 
            value={Math.round(selectedNode.y)} 
            onChange={(e) => handleChange(e, 'y', true)}
            className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
          />
        </div>
      </div>

      {(selectedNode.type === 'Rect' || selectedNode.type === 'Image' || selectedNode.type === 'Frame') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">W</label>
            <input 
              type="number" 
              value={Math.round(selectedNode.width || 0)} 
              onChange={(e) => handleChange(e, 'width', true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">H</label>
            <input 
              type="number" 
              value={Math.round(selectedNode.height || 0)} 
              onChange={(e) => handleChange(e, 'height', true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
            />
          </div>
        </div>
      )}

      {(selectedNode.type === 'Circle' || selectedNode.type === 'Triangle') && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Radius</label>
          <input 
            type="number" 
            value={Math.round(selectedNode.radius || 0)} 
            onChange={(e) => handleChange(e, 'radius', true)}
            className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
          />
        </div>
      )}

      {selectedNode.type === 'Line' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stroke Width</label>
          <input 
            type="number" 
            value={selectedNode.strokeWidth || 1} 
            onChange={(e) => handleChange(e, 'strokeWidth', true)}
            className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
          />
        </div>
      )}

      {selectedNode.type !== 'Image' && selectedNode.type !== 'Line' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {selectedNode.type === 'Frame' ? 'Background Color' : 'Fill Color'}
          </label>
          <div className="flex gap-2 items-center">
            <input 
              type="color" 
              value={selectedNode.fill || '#ffffff'} 
              onChange={(e) => handleChange(e, 'fill', false)}
              onBlur={(e) => handleChange(e, 'fill', true)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            />
            <input 
              type="text"
              value={selectedNode.fill || ''}
              onChange={(e) => handleChange(e, 'fill', false)}
              onBlur={(e) => handleChange(e, 'fill', true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono flex-1 uppercase"
            />
          </div>
        </div>
      )}

      {selectedNode.type === 'Line' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stroke Color</label>
          <div className="flex gap-2 items-center">
            <input 
              type="color" 
              value={selectedNode.stroke || '#000000'} 
              onChange={(e) => handleChange(e, 'stroke', false)}
              onBlur={(e) => handleChange(e, 'stroke', true)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            />
            <input 
              type="text"
              value={selectedNode.stroke || ''}
              onChange={(e) => handleChange(e, 'stroke', false)}
              onBlur={(e) => handleChange(e, 'stroke', true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono flex-1 uppercase"
            />
          </div>
        </div>
      )}

      {selectedNode.type === 'Text' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Text</label>
            <input 
              type="text" 
              value={selectedNode.text || ''} 
              onChange={(e) => handleChange(e, 'text', false)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Font Size</label>
            <input 
              type="number" 
              value={selectedNode.fontSize || 16} 
              onChange={(e) => handleChange(e, 'fontSize', true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Font Family</label>
            <select 
              value={selectedNode.fontFamily || 'Inter'}
              onChange={(e) => updateNode(selectedNode.id, { fontFamily: e.target.value }, true)}
              className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50"
            >
              <option value="Inter">Inter</option>
              <option value="Space Grotesk">Space Grotesk</option>
              <option value="JetBrains Mono">JetBrains Mono</option>
            </select>
          </div>
        </>
      )}

      {selectedNode.type === 'Rect' && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Border Radius</label>
          <input 
            type="number" 
            value={selectedNode.cornerRadius || 0} 
            onChange={(e) => handleChange(e, 'cornerRadius', true)}
            className="border border-slate-200 rounded px-2 py-1 text-sm bg-slate-50 font-mono"
          />
        </div>
      )}

      <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Layering</label>
        <div className="flex gap-2">
          <button onClick={() => reorderNode(selectedNode.id, 'front')} className="flex-1 p-2 flex justify-center items-center rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors" title="Bring to Front">
            <ChevronsUp size={16} />
          </button>
          <button onClick={() => reorderNode(selectedNode.id, 'forward')} className="flex-1 p-2 flex justify-center items-center rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors" title="Bring Forward">
            <ChevronUp size={16} />
          </button>
          <button onClick={() => reorderNode(selectedNode.id, 'backward')} className="flex-1 p-2 flex justify-center items-center rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors" title="Send Backward">
            <ChevronDown size={16} />
          </button>
          <button onClick={() => reorderNode(selectedNode.id, 'back')} className="flex-1 p-2 flex justify-center items-center rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors" title="Send to Back">
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
              value={selectedNode.linkTo || ''}
              onChange={(e) => updateNode(selectedNode.id, { linkTo: e.target.value || undefined }, true)}
              className="border border-slate-200 rounded px-2 py-1.5 text-sm bg-slate-50 w-full"
            >
              <option value="">None</option>
              {compatibleFrames.map((frame, i) => (
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
