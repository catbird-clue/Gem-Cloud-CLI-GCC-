import React from 'react';
import { diffLines } from 'diff';
import type { ProposedChange } from '../types';

interface FileChangePreviewProps {
  change: ProposedChange;
}

const CONTEXT_LINES = 2; // Show 2 lines of context before and after a change, as requested.

export function FileChangePreview({ change }: FileChangePreviewProps): React.ReactElement {
  const diffResult = diffLines(change.oldContent, change.newContent);

  // 1. Flatten the diff parts into a single array of line objects.
  const allLines: { text: string; type: 'added' | 'removed' | 'common'; prefix: string }[] = [];
  diffResult.forEach(part => {
    const type = part.added ? 'added' : part.removed ? 'removed' : 'common';
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    // Split into lines, handling the case of no trailing newline correctly.
    const lines = part.value.endsWith('\n') ? part.value.slice(0, -1).split('\n') : part.value.split('\n');
    lines.forEach(line => {
      allLines.push({ text: line, type, prefix });
    });
  });

  // 2. Find the indices of all lines that have changed.
  const changeIndices: number[] = [];
  allLines.forEach((line, index) => {
    if (line.type === 'added' || line.type === 'removed') {
      changeIndices.push(index);
    }
  });

  // If there are no additions or removals, it's a whitespace or identical change.
  if (changeIndices.length === 0) {
      return (
         <div className="bg-gray-900/70 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-2 bg-gray-700/50 text-sm font-semibold text-gray-300 border-b border-gray-700">
              {change.filePath}
            </div>
            <pre className="text-xs overflow-x-auto font-mono leading-relaxed p-2 text-gray-500">
              No significant line changes to display (content is identical or only whitespace differs).
            </pre>
        </div>
      );
  }

  // 3. Determine the full set of line indices to render, including context lines.
  const lineIndicesToRender = new Set<number>();
  changeIndices.forEach(index => {
    for (let i = Math.max(0, index - CONTEXT_LINES); i <= Math.min(allLines.length - 1, index + CONTEXT_LINES); i++) {
      lineIndicesToRender.add(i);
    }
  });

  // 4. Build the rendered elements, inserting "..." for collapsed sections.
  const renderedElements: React.ReactNode[] = [];
  let lastRenderedIndex = -1;

  const sortedIndices = Array.from(lineIndicesToRender).sort((a, b) => a - b);

  sortedIndices.forEach(index => {
    // If there's a gap between the last rendered line and this one, add a separator.
    if (lastRenderedIndex !== -1 && index > lastRenderedIndex + 1) {
      renderedElements.push(
        <div key={`gap-${index}`} className="text-gray-500 text-center select-none bg-gray-800/50 py-1 font-mono">
          ...
        </div>
      );
    }

    const line = allLines[index];
    const lineClass = line.type === 'added' ? 'bg-green-900/40 text-green-300' :
                      line.type === 'removed' ? 'bg-red-900/40 text-red-400' :
                      'text-gray-400';

    renderedElements.push(
      <div key={index} className={lineClass}>
        <span className="inline-block w-5 text-center mr-2 select-none opacity-60">{line.prefix}</span>
        {/* Use a span with whitespace-pre to ensure empty lines are rendered with correct height */}
        <span className="whitespace-pre">{line.text || ' '}</span>
      </div>
    );

    lastRenderedIndex = index;
  });

  return (
    <div className="bg-gray-900/70 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-2 bg-gray-700/50 text-sm font-semibold text-gray-300 border-b border-gray-700">
        {change.filePath}
      </div>
      <pre className="text-xs overflow-x-auto font-mono leading-relaxed">
        {renderedElements}
      </pre>
    </div>
  );
}
