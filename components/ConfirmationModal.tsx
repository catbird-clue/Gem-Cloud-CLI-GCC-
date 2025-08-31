import React, { useEffect } from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}

export function ConfirmationModal({ isOpen, title, onConfirm, onCancel, children }: ConfirmationModalProps): React.ReactElement | null {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }
  
  const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={handleWrapperClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700">
          <h2 id="confirmation-modal-title" className="text-xl font-semibold text-gray-100">{title}</h2>
        </div>
        <div className="p-4 text-gray-300">
          {children}
        </div>
        <div className="p-4 flex justify-end space-x-3 bg-gray-800 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}