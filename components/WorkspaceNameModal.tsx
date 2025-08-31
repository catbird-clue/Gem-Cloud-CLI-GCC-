import React, { useState, useEffect, useRef } from 'react';

interface WorkspaceNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  suggestedName: string;
}

export function WorkspaceNameModal({ isOpen, onClose, onSave, suggestedName }: WorkspaceNameModalProps): React.ReactElement | null {
  const [name, setName] = useState(suggestedName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(suggestedName);
      // Focus and select the input text when the modal opens
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100); // A small delay ensures the element is visible
    }
  }, [isOpen, suggestedName]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (isOpen) {
        window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };
  
  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={handleWrapperClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-modal-title"
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700">
          <h2 id="workspace-modal-title" className="text-xl font-semibold text-gray-100">Save Workspace</h2>
          <p className="text-sm text-gray-400 mt-1">Enter a name to save the current set of files for later.</p>
        </div>
        <div className="p-4">
          <label htmlFor="workspace-name" className="block text-sm font-medium text-gray-300 mb-2">Workspace Name</label>
          <input
            id="workspace-name"
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-900 text-gray-200 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-500"
            placeholder="e.g., My React Project"
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
            disabled={!name.trim()}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}