import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from './Icons';

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
}

export const CodeBlock = ({ children, className }: CodeBlockProps): React.ReactElement => {
  const [copied, setCopied] = useState(false);

  const code = String(children).replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'code';

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-gray-900 rounded-lg my-2 relative">
      <div className="flex justify-between items-center px-4 py-1 text-xs text-gray-400 border-b border-gray-700">
        <span>{language}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 p-1 rounded-md hover:bg-gray-700 transition-colors">
          {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
};
