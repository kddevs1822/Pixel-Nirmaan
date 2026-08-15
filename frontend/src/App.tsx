import React from 'react';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { CanvasArea } from './components/CanvasArea';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCanvasStore } from './store/useCanvasStore';
import { CheckCircle2 } from 'lucide-react';

function App() {
  useKeyboardShortcuts();
  const toastMessage = useCanvasStore(state => state.toastMessage);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden text-slate-900 bg-[#FAF6F0]">
      <TopBar />
      <div className="flex-1 flex flex-row overflow-hidden relative">
        <LeftSidebar />
        <CanvasArea />
        <RightSidebar />
      </div>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 border border-slate-700 font-medium">
            <CheckCircle2 size={18} className="text-[#6B8F71]" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
