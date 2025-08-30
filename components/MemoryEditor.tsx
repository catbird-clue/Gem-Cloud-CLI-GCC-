import React, { useState, useEffect } from 'react';

interface MemoryEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (memory: string) => void;
  memory: string;
}

export function MemoryEditor({ isOpen, onClose, onSave, memory }: MemoryEditorProps): React.ReactElement | null {
  const [editorContent, setEditorContent] = useState(memory);

  useEffect(() => {
    setEditorContent(memory);
  }, [memory, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave(editorContent);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100">AI Long-Term Memory</h2>
          <p className="text-sm text-gray-400 mt-1">Provide persistent instructions and context for the AI.</p>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <textarea
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            className="w-full h-full bg-gray-900 text-gray-200 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-500 resize-none font-mono text-sm"
            placeholder="e.g., Always respond in a formal tone. Prefer functional components in React."
            style={{minHeight: '300px'}}
          />
        </div>
        <div className="p-4 flex justify-end space-x-3 bg-gray-800 border-t border-gray-700">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}