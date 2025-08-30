import React from 'react';
import type { UploadedFile } from '../types';
import { CopyIcon, CheckIcon } from './Icons';

interface FileViewerProps {
  file: UploadedFile | null;
  onClose: () => void;
}

export function FileViewer({ file, onClose }: FileViewerProps): React.ReactElement | null {
  const [copied, setCopied] = React.useState(false);

  if (!file) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 id="file-viewer-title" className="text-lg font-semibold text-gray-100">View File</h2>
            <p className="text-sm text-gray-400 mt-1 font-mono">{file.path}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-700 transition-colors text-sm text-gray-300">
              {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Content'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors text-sm"
              aria-label="Close file viewer"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 p-4 overflow-y-auto" aria-labelledby="file-viewer-title">
          <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono">{file.content}</pre>
        </div>
      </div>
    </div>
  );
}
