import React from 'react';

interface MarkdownDiffBlockProps {
  code: string;
}

const CONTEXT_LINES = 2;

export const MarkdownDiffBlock = ({ code }: MarkdownDiffBlockProps): React.ReactElement => {
  const lines = code.split('\n');
  const changeIndices: number[] = [];
  lines.forEach((line, index) => {
    // Only consider lines that start with + or - and not ++ or -- which are part of diff headers
    if ((line.startsWith('+') && !line.startsWith('+++')) || (line.startsWith('-') && !line.startsWith('---'))) {
      changeIndices.push(index);
    }
  });

  if (changeIndices.length === 0) {
    // If no actual changes, just render as a simple code block
    return (
      <div className="bg-gray-900 rounded-lg my-2 border border-gray-700">
        <div className="flex justify-between items-center px-4 py-1 text-xs text-gray-400 border-b border-gray-700">
          <span>diff</span>
        </div>
        <pre className="p-4 text-sm overflow-x-auto"><code>{code}</code></pre>
      </div>
    );
  }

  const indicesToRender = new Set<number>();
  changeIndices.forEach(index => {
    for (let i = Math.max(0, index - CONTEXT_LINES); i <= Math.min(lines.length - 1, index + CONTEXT_LINES); i++) {
      indicesToRender.add(i);
    }
  });

  const renderedElements: React.ReactNode[] = [];
  let lastRenderedIndex = -1;

  Array.from(indicesToRender).sort((a, b) => a - b).forEach(index => {
    if (lastRenderedIndex !== -1 && index > lastRenderedIndex + 1) {
      renderedElements.push(
        <div key={`gap-${index}`} className="text-gray-500 text-center select-none bg-gray-800/50 py-1 font-mono">...</div>
      );
    }
    
    const line = lines[index];
    const prefix = line.charAt(0);
    const lineClass = 
      (prefix === '+' && !line.startsWith('+++')) ? 'bg-green-900/40 text-green-300' :
      (prefix === '-' && !line.startsWith('---')) ? 'bg-red-900/40 text-red-400' :
      'text-gray-400';

    renderedElements.push(
      <div key={index} className={lineClass}>
        <span className="inline-block w-5 text-center mr-2 select-none opacity-60">{['+', '-'].includes(prefix) ? prefix : ' '}</span>
        <span>{['+', '-'].includes(prefix) ? line.substring(1) : line}</span>
      </div>
    );
    lastRenderedIndex = index;
  });

  return (
    <div className="bg-gray-900/70 rounded-lg border border-gray-700 overflow-hidden my-2">
      <div className="px-4 py-2 bg-gray-700/50 text-xs font-semibold text-gray-300 border-b border-gray-700">
        Suggested changes (diff format)
      </div>
      <pre className="text-xs overflow-x-auto font-mono leading-relaxed">
        {renderedElements}
      </pre>
    </div>
  );
};
