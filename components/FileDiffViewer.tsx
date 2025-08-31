import React from 'react';
import { diffLines, type Change } from 'diff';
import type { UploadedFile } from '../types';
import { TrashIcon } from './Icons';

interface FileDiffViewerProps {
  diff: {
    oldFile: UploadedFile;
    newFile: UploadedFile;
  } | null;
  onClose: () => void;
  onRevert: (filePath: string) => void;
}

export function FileDiffViewer({ diff, onClose, onRevert }: FileDiffViewerProps): React.ReactElement | null {
  if (!diff) {
    return null;
  }

  const { oldFile, newFile } = diff;
  const diffResult = diffLines(oldFile.content, newFile.content);

  const renderDiff = () => {
    const elements: React.ReactNode[] = [];
    let leftLine = 1;
    let rightLine = 1;

    diffResult.forEach((part, index) => {
      const lines = part.value.split('\n').filter((line, i) => line || i < part.value.split('\n').length - 1);
      
      if (part.added) {
        elements.push(
          ...lines.map((line, i) => (
            <tr key={`diff-${index}-${i}`}>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10"></td>
              <td className="w-1/2 pr-2"></td>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10">{rightLine++}</td>
              <td className="w-1/2 pl-2 bg-green-900/40"><span className="text-green-400 mr-2">+</span><span className="whitespace-pre-wrap">{line}</span></td>
            </tr>
          ))
        );
      } else if (part.removed) {
         elements.push(
          ...lines.map((line, i) => (
             <tr key={`diff-${index}-${i}`}>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10">{leftLine++}</td>
              <td className="w-1/2 pr-2 bg-red-900/40"><span className="text-red-400 mr-2">-</span><span className="whitespace-pre-wrap">{line}</span></td>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10"></td>
              <td className="w-1/2 pl-2"></td>
            </tr>
          ))
        );
      } else {
        elements.push(
          ...lines.map((line, i) => (
             <tr key={`diff-${index}-${i}`}>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10">{leftLine++}</td>
              <td className="w-1/2 pr-2"><span className="text-gray-500 mr-2"> </span><span className="whitespace-pre-wrap">{line}</span></td>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10">{rightLine++}</td>
              <td className="w-1/2 pl-2"><span className="text-gray-500 mr-2"> </span><span className="whitespace-pre-wrap">{line}</span></td>
            </tr>
          ))
        );
      }
    });
    return elements;
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 id="file-diff-viewer-title" className="text-lg font-semibold text-gray-100">Review Changes</h2>
            <p className="text-sm text-gray-400 mt-1 font-mono">{newFile.path}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => onRevert(newFile.path)}
              className="flex items-center gap-1.5 p-2 rounded-md hover:bg-red-800/50 transition-colors text-sm text-red-300 border border-red-500/50"
            >
              <TrashIcon className="w-4 h-4" /> Revert
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-gray-600 hover:bg-gray-500 text-white font-semibold transition-colors text-sm"
              aria-label="Close diff viewer"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-sm" aria-labelledby="file-diff-viewer-title">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-700/50 sticky top-0">
                <th colSpan={2} className="p-2 text-left font-semibold text-gray-300 border-r border-gray-600">
                  Previous Version (Before)
                </th>
                <th colSpan={2} className="p-2 text-left font-semibold text-gray-300">
                  Current Version (After)
                </th>
              </tr>
            </thead>
            <tbody>
              {renderDiff()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}