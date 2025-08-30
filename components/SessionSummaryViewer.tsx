import React from 'react';

interface SessionSummaryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
}

export function SessionSummaryViewer({ isOpen, summary, onClose }: SessionSummaryViewerProps): React.ReactElement | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <h2 id="summary-viewer-title" className="text-xl font-semibold text-gray-100">Session Summary</h2>
          <p className="text-sm text-gray-400 mt-1">This is the current context summary the AI will use for this session.</p>
        </div>
        <div className="flex-1 p-4 overflow-y-auto" aria-labelledby="summary-viewer-title">
          {summary ? (
             <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans">{summary}</pre>
          ) : (
            <p className="text-gray-400 italic">No session summary has been saved yet.</p>
          )}
        </div>
        <div className="p-4 flex justify-end bg-gray-800 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors"
            aria-label="Close session summary viewer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
