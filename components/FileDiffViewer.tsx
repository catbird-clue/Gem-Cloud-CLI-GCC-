import React from 'react';
import { diffLines } from 'diff';
import type { UploadedFile } from '../types';
import { CopyIcon, CheckIcon, TrashIcon } from './Icons';

interface FileDiffViewerProps {
  diff: {
    oldFile: UploadedFile;
    newFile: UploadedFile;
  } | null;
  onClose: () => void;
  onRevert: (file: UploadedFile) => void;
}

export function FileDiffViewer({ diff, onClose, onRevert }: FileDiffViewerProps): React.ReactElement | null {
  const [copied, setCopied] = React.useState<'before' | 'after' | null>(null);

  if (!diff) {
    return null;
  }

  const { oldFile, newFile } = diff;
  const diffResult = diffLines(oldFile.content, newFile.content);

  const handleCopy = (version: 'before' | 'after') => {
    if (!diff) return;
    const contentToCopy = version === 'before' ? diff.oldFile.content : diff.newFile.content;
    navigator.clipboard.writeText(contentToCopy).then(() => {
      setCopied(version);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const renderDiff = () => {
    const elements: React.ReactNode[] = [];
    let leftLine = 1;
    let rightLine = 1;

    diffResult.forEach((part, index) => {
      const lines = part.value.endsWith('\n') ? part.value.slice(0, -1).split('\n') : part.value.split('\n');
      
      if (part.added) {
        elements.push(
          ...lines.map((line, i) => (
            <tr key={`diff-${index}-${i}`} className="bg-green-900/30">
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10 border-r border-gray-700 bg-gray-800 align-top"></td>
              <td className="w-1/2 pr-2 align-top"></td>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10 border-r border-gray-700 bg-gray-800 align-top">{rightLine++}</td>
              <td className="w-1/2 pl-2 align-top"><span className="text-green-400 mr-2 select-none">+</span><span className="whitespace-pre-wrap">{line}</span></td>
            </tr>
          ))
        );
      } else if (part.removed) {
         elements.push(
          ...lines.map((line, i) => (
             <tr key={`diff-${index}-${i}`} className="bg-red-900/30">
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10 border-r border-gray-700 bg-gray-800 align-top">{leftLine++}</td>
              <td className="w-1/2 pr-2 align-top"><span className="text-red-400 mr-2 select-none">-</span><span className="whitespace-pre-wrap">{line}</span></td>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10 border-r border-gray-700 bg-gray-800 align-top"></td>
              <td className="w-1/2 pl-2 align-top"></td>
            </tr>
          ))
        );
      } else {
        elements.push(
          ...lines.map((line, i) => (
             <tr key={`diff-${index}-${i}`}>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10 border-r border-gray-700 bg-gray-800 align-top">{leftLine++}</td>
              <td className="w-1/2 pr-2 align-top"><span className="text-gray-500 mr-2 select-none"> </span><span className="whitespace-pre-wrap">{line}</span></td>
              <td className="px-2 py-0.5 text-right text-gray-500 text-xs select-none w-10 border-r border-gray-700 bg-gray-800 align-top">{rightLine++}</td>
              <td className="w-1/2 pl-2 align-top"><span className="text-gray-500 mr-2 select-none"> </span><span className="whitespace-pre-wrap">{line}</span></td>
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
            <button onClick={() => handleCopy('before')} className="flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-700 transition-colors text-sm text-gray-300">
                {copied === 'before' ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                {copied === 'before' ? 'Copied' : 'Copy Before'}
            </button>
            <button onClick={() => handleCopy('after')} className="flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-700 transition-colors text-sm text-gray-300">
                {copied === 'after' ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
                {copied === 'after' ? 'Copied' : 'Copy After'}
            </button>
            <button
              onClick={() => onRevert(newFile)}
              className="flex items-center gap-1.5 p-2 rounded-md hover:bg-gray-700 transition-colors text-sm text-red-400 hover:text-red-300"
              title={`Revert changes for ${newFile.path}`}
              aria-label={`Revert changes for ${newFile.path}`}
            >
              <TrashIcon className="w-4 h-4" />
              Revert
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
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-700/50">
                <th colSpan={2} className="p-2 text-left font-semibold text-gray-300 border-r border-gray-700">
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