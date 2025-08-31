import React, { useState, useRef, useEffect, useMemo } from 'react';
import { diffLines } from 'diff';
import type { ChatMessage as ChatMessageType, ProposedChange } from '../types';
import { ChatMessage } from './ChatMessage';
import { SendIcon, ExportIcon, StopIcon, ThoughtIcon, PaperclipIcon, FileIcon, CloseIcon } from './Icons';

interface ChatInterfaceProps {
  chatHistory: ChatMessageType[];
  isLoading: boolean;
  aiThought: string | null;
  onPromptSubmit: (prompt: string, stagedFiles: File[]) => void;
  onApplyChanges: (changes: ProposedChange[]) => void;
  onStopGeneration: () => void;
}

export const ChatInterface = ({ chatHistory, isLoading, aiThought, onPromptSubmit, onApplyChanges, onStopGeneration }: ChatInterfaceProps): React.ReactElement => {
  const [prompt, setPrompt] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  const { status, tooltip, percentage } = useMemo(() => {
    const totalChars = chatHistory.reduce((acc, msg) => acc + (msg.content?.length || 0), 0);
    const YELLOW_THRESHOLD = 15000;
    const RED_THRESHOLD = 25000;

    const percentage = Math.min(100, Math.round((totalChars / RED_THRESHOLD) * 100));

    if (totalChars > RED_THRESHOLD) {
      return {
        status: 'red',
        tooltip: `Context health: ${percentage}%. Warning: The conversation is very long, and the AI may have lost context from earlier messages. It's highly recommended to save a session summary to continue effectively.`,
        percentage,
      };
    }
    if (totalChars > YELLOW_THRESHOLD) {
      return {
        status: 'yellow',
        tooltip: `Context health: ${percentage}%. The conversation is getting long. The AI might start to lose context soon. Consider saving a session summary to keep it focused.`,
        percentage,
      };
    }
    return {
      status: 'green',
      tooltip: `Context health: ${percentage}%. Context is healthy.`,
      percentage,
    };
  }, [chatHistory]);

  const indicatorColor = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
    red: 'bg-red-500',
  }[status];

  const textColor = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-500',
  }[status];

  const indicatorPulse = status === 'yellow' || status === 'red' ? 'animate-pulse' : '';


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((prompt.trim() || stagedFiles.length > 0) && !isLoading) {
      onPromptSubmit(prompt.trim(), stagedFiles);
      setPrompt('');
      setStagedFiles([]);
    }
  };
  
  const handleExportChat = () => {
    const markdownContent = chatHistory.map(message => {
      let content = `## ${message.role === 'user' ? 'You' : 'Gemini'}\n\n`;
      if (message.error) {
        content += `**Error:**\n\n\`\`\`\n${message.error}\n\`\`\`\n`;
      } else {
        content += message.content;
      }
      
      if (message.attachments && message.attachments.length > 0) {
        content += '\n\n**Attachments:**\n';
        message.attachments.forEach(attachment => {
          content += `- ${attachment.name}\n`;
        });
      }

      if (message.proposedChanges && message.proposedChanges.length > 0) {
        content += '\n\n### Proposed File Changes\n\n';
        message.proposedChanges.forEach(change => {
          content += `**File: \`${change.filePath}\`**\n\n`;
          content += '```diff\n';
          const diffResult = diffLines(change.oldContent, change.newContent);
          diffResult.forEach(part => {
            const lines = part.value.split('\n').filter(Boolean);
            if (part.added) {
              lines.forEach(line => { content += `+ ${line}\n`; });
            } else if (part.removed) {
              lines.forEach(line => { content += `- ${line}\n`; });
            } else {
              lines.forEach(line => { content += `  ${line}\n`; });
            }
          });
          content += '```\n\n';
        });
      }
      return content;
    }).join('\n\n---\n\n');

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const filename = `gemini-chat-${timestamp}.md`;

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const currentFileNames = new Set(stagedFiles.map(f => f.name));
      const newFiles = Array.from(e.target.files).filter(f => !currentFileNames.has(f.name));
      setStagedFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = ''; // Allow re-selecting the same file if it was removed
  };
  
  const handleRemoveFile = (fileName: string) => {
    setStagedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-700/50 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-200">Chat</h2>
          <div
            className="flex items-center gap-2"
            title={tooltip}
            aria-label={`Context health: ${status}, ${percentage}% full`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${indicatorColor} ${indicatorPulse}`}
            ></span>
            <span className={`text-xs font-mono font-semibold ${textColor}`}>
              {percentage}%
            </span>
          </div>
        </div>
        <button
          onClick={handleExportChat}
          className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded-md transition-colors"
          title="Export Chat as Markdown"
          aria-label="Export Chat as Markdown"
        >
          <ExportIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {chatHistory.map((message, index) => {
          const isLastMessage = index === chatHistory.length - 1;
          const isStreaming = isLoading && isLastMessage && message.role === 'model';
          return (
            <ChatMessage
              key={index}
              message={message}
              isStreaming={isStreaming}
              onApplyChanges={onApplyChanges}
            />
          );
        })}
        {isLoading && chatHistory[chatHistory.length - 1]?.role === 'user' && (
          <ChatMessage
            message={{ role: 'model', content: '' }}
            isLoading={true}
            onApplyChanges={() => {}}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
      {isLoading && aiThought && (
        <div className="px-6 pb-2 text-sm text-gray-400 italic flex items-center justify-center animate-pulse">
            <ThoughtIcon className="w-4 h-4 mr-2" />
            {aiThought}
        </div>
      )}
      <div className="p-4 bg-gray-900/50 border-t border-gray-700/50">
        {isLoading ? (
          <button
            onClick={onStopGeneration}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center"
          >
            <StopIcon className="w-5 h-5 mr-2" />
            Stop Generating
          </button>
        ) : (
          <form onSubmit={handleSubmit}>
            {stagedFiles.length > 0 && (
              <div className="pb-2 flex flex-wrap gap-2">
                {stagedFiles.map(file => (
                  <div key={file.name} className="flex items-center bg-gray-700/80 text-gray-300 text-sm rounded-full pl-2 pr-1 py-0.5">
                    <FileIcon className="w-4 h-4 mr-1.5 text-gray-400" />
                    <span className="truncate max-w-xs" title={file.name}>{file.name}</span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveFile(file.name)} 
                      className="ml-1 p-0.5 rounded-full hover:bg-gray-600"
                      aria-label={`Remove ${file.name}`}
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                multiple 
                className="hidden"
                accept=".txt,.md,.js,.jsx,.ts,.tsx,.json,.html,.css,.py,.rb,.java,.c,.cpp,.h,.hpp,.cs,.go,.php,.sh,.yml,.yaml,.toml,.ini,.cfg,.env,text/plain,text/markdown"
              />
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask me anything, or upload a project to discuss your code..."
                className="w-full bg-gray-700 text-gray-200 rounded-lg p-3 pl-12 pr-12 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400"
                rows={1}
                disabled={isLoading}
                style={{ maxHeight: '200px', overflowY: 'auto' }}
              />
              <button
                type="button"
                onClick={handleAttachClick}
                disabled={isLoading}
                title="Attach files"
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-gray-400 hover:text-indigo-400 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <PaperclipIcon className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={isLoading || (!prompt.trim() && stagedFiles.length === 0)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-gray-300 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200"
              >
                <SendIcon className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};