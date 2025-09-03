import React from 'react';
import { diffLines } from 'diff';
import type { ProposedChange } from '../types';
import { ChevronDownIcon } from './Icons';

interface FileChangePreviewProps {
  change: ProposedChange;
}

const CONTEXT_LINES = 3; // Show 3 lines of context before and after a change.

export function FileChangePreview({ change }: FileChangePreviewProps): React.ReactElement {
  const diffResult = diffLines(change.oldContent, change.newContent);

  // Case for no significant changes (e.g., only whitespace)
  if (diffResult.length === 1 && !diffResult[0].added && !diffResult[0].removed) {
      return (
         <div className="bg-gray-800/60 rounded-lg border border-gray-700/80 px-4 py-2 flex justify-between items-center">
            <p className="text-sm font-mono text-gray-400">{change.filePath}</p>
            <p className="text-xs text-gray-500 italic">No significant changes</p>
        </div>
      );
  }

  const renderedRows: React.ReactNode[] = [];
  let leftLineNum = 1;
  let rightLineNum = 1;

  diffResult.forEach((part, partIndex) => {
    // Split into lines, handling the case of no trailing newline correctly.
    const lines = part.value.endsWith('\n') ? part.value.slice(0, -1).split('\n') : part.value.split('\n');

    if (part.added) {
      lines.forEach((line, lineIndex) => {
        // The diff library sometimes adds an empty string part which we can ignore.
        if (line === '' && lines.length === 1) return;
        renderedRows.push(
            <tr key={`p${partIndex}-l${lineIndex}`}>
                <td className="px-2 py-0.5 text-right text-xs text-gray-600 select-none w-10 bg-gray-800/50 border-r border-gray-700"></td>
                <td className="w-1/2 pr-2 bg-gray-800/50"></td>
                <td className="px-2 py-0.5 text-right text-xs text-gray-500 select-none w-10 bg-green-900/30 border-r border-gray-700">{rightLineNum++}</td>
                <td className="w-1/2 pl-2 bg-green-900/40">
                    <span className="text-green-400 mr-2 select-none">+</span>
                    <span className="whitespace-pre-wrap">{line}</span>
                </td>
            </tr>
        );
      });
    } else if (part.removed) {
      lines.forEach((line, lineIndex) => {
        if (line === '' && lines.length === 1) return;
        renderedRows.push(
            <tr key={`p${partIndex}-l${lineIndex}`}>
                <td className="px-2 py-0.5 text-right text-xs text-gray-500 select-none w-10 bg-red-900/30 border-r border-gray-700">{leftLineNum++}</td>
                <td className="w-1/2 pr-2 bg-red-900/40">
                    <span className="text-red-400 mr-2 select-none">-</span>
                    <span className="whitespace-pre-wrap">{line}</span>
                </td>
                <td className="px-2 py-0.5 text-right text-xs text-gray-600 select-none w-10 bg-gray-800/50 border-r border-gray-700"></td>
                <td className="w-1/2 pl-2 bg-gray-800/50"></td>
            </tr>
        );
      });
    } else { // This is a common part, shared between both files.
      const isFirstPart = partIndex === 0;
      const isLastPart = partIndex === diffResult.length - 1;
      // Truncate long common sections that are not at the very beginning or end of the file.
      const needsTruncation = lines.length > (CONTEXT_LINES * 2) + 1 && !isFirstPart && !isLastPart;

      if (needsTruncation) {
        // Render first CONTEXT_LINES
        for (let i = 0; i < CONTEXT_LINES; i++) {
            const line = lines[i];
            renderedRows.push(
                <tr key={`p${partIndex}-s${i}`}>
                    <td className="px-2 py-0.5 text-right text-xs text-gray-500 select-none w-10 bg-gray-800/50 border-r border-gray-700">{leftLineNum++}</td>
                    <td className="w-1/2 pr-2"><span className="text-gray-500 mr-2 select-none"> </span><span className="whitespace-pre-wrap">{line}</span></td>
                    <td className="px-2 py-0.5 text-right text-xs text-gray-500 select-none w-10 bg-gray-800/50 border-r border-gray-700">{rightLineNum++}</td>
                    <td className="w-1/2 pl-2"><span className="text-gray-500 mr-2 select-none"> </span><span className="whitespace-pre-wrap">{line}</span></td>
                </tr>
            );
        }

        // Render separator for the collapsed section
        renderedRows.push(
            <tr key={`p${partIndex}-sep`}>
                <td colSpan={4} className="text-gray-600 text-center select-none bg-gray-800 py-1 font-mono text-xs">...</td>
            </tr>
        );

        // Skip the line numbers for the collapsed part
        const linesSkipped = lines.length - (CONTEXT_LINES * 2);
        leftLineNum += linesSkipped;
        rightLineNum += linesSkipped;

        // Render last CONTEXT_LINES
        for (let i = lines.length - CONTEXT_LINES; i < lines.length; i++) {
            const line = lines[i];
             renderedRows.push(
                <tr key={`p${partIndex}-e${i}`}>
                    <td className="px-2 py-0.5 text-right text-xs text-gray-500 select-none w-10 bg-gray-800/50 border-r border-gray-700">{leftLineNum++}</td>
                    <td className="w-1/2 pr-2"><span className="text-gray-500 mr-2 select-none"> </span><span className="whitespace-pre-wrap">{line}</span></td>
                    <td className="px-2 py-0.5 text-right text-xs text-gray-500 select-none w-10 bg-gray-800/50 border-r border-gray-700">{rightLineNum++}</td>
                    <td className="w-1/2 pl-2"><span className="text-gray-500 mr-2 select-none"> </span><span className="whitespace-pre-wrap">{line}</span></td>
                </tr>
            );
        }
      } else { // No truncation needed, render all common lines.
        lines.forEach((line, lineIndex) => {
            // An empty common part can be ignored.
            if (line === '' && lines.length === 1) return;
            renderedRows.push(
                <tr key={`p${partIndex}-l${lineIndex}`}>
                    <td className="px-2 py-0.5 text-right text-xs text-gray-500 select-none w-10 bg-gray-800/50 border-r border-gray-700">{leftLineNum++}</td>
                    <td className="w-1/2 pr-2"><span className="text-gray-500 mr-2 select-none"> </span><span className="whitespace-pre-wrap">{line}</span></td>
                    <td className="px-2 py-0.5 text-right text-xs text-gray-500 select-none w-10 bg-gray-800/50 border-r border-gray-700">{rightLineNum++}</td>
                    <td className="w-1/2 pl-2"><span className="text-gray-500 mr-2 select-none"> </span><span className="whitespace-pre-wrap">{line}</span></td>
                </tr>
            );
        });
      }
    }
  });

  return (
    <details className="bg-gray-900/70 rounded-lg border border-gray-700 overflow-hidden group">
      <summary className="px-4 py-2 bg-gray-700/50 text-sm text-gray-300 cursor-pointer flex justify-between items-center list-none hover:bg-gray-700 transition-colors group-open:border-b group-open:border-gray-700">
        <span className="font-mono font-semibold">{change.filePath}</span>
        <ChevronDownIcon className="w-5 h-5 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="overflow-x-auto text-gray-300">
        <table className="w-full border-collapse">
          <tbody>
              {renderedRows}
          </tbody>
        </table>
      </div>
    </details>
  );
}
