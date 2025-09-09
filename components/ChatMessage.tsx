import React, { useState, memo } from 'react';
import { GeminiIcon, WarningIcon, FileIcon, SaveIcon, CheckIcon } from './Icons';
import type { ChatMessage as ChatMessageType, ProposedChange } from '../types';
import { FileChangePreview } from './FileChangePreview';

interface ChatMessageProps {
  message: ChatMessageType;
  index: number;
  isLoading?: boolean;
  onApplyChanges: (changes: ProposedChange[]) => void;
  onSaveProposal: (messageIndex: number) => void;
}

export const ChatMessage = memo(({ message, index, isLoading = false, onApplyChanges, onSaveProposal }: ChatMessageProps): React.ReactElement => {
  const isModel = message.role === 'model';
  const [isHandled, setIsHandled] = useState(false);
  const [action, setAction] = useState<'applied' | 'rejected' | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  
  const hasProposedChanges = message.proposedChanges && message.proposedChanges.length > 0;

  const handleApply = () => {
    if (hasProposedChanges) {
      onApplyChanges(message.proposedChanges!);
      setIsHandled(true);
      setAction('applied');
    }
  };

  const handleReject = () => {
    setIsHandled(true);
    setAction('rejected');
  };

  const handleSave = () => {
    if (hasProposedChanges) {
      onSaveProposal(index);
      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000); // Revert button state after 2 seconds
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
        </div>
      );
    }
    
    // Use a <pre> tag to respect whitespace and newlines without complex markdown parsing
    return <pre className="text-gray-300 whitespace-pre-wrap font-sans">{message.content}</pre>;
  };

  if (message.warning) {
    return (
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-yellow-800">
          <WarningIcon className="w-5 h-5 text-yellow-200" />
        </div>
        <div className="w-full max-w-3xl p-4 rounded-lg bg-yellow-900/30 border border-yellow-500/30">
           {/* Use a div to render simple markdown like bolding for emphasis */}
           <div 
             className="text-yellow-200 whitespace-pre-wrap font-sans" 
             dangerouslySetInnerHTML={{ __html: message.warning.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} 
           />
        </div>
      </div>
    );
  }

  if (message.error) {
    return (
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-red-800">
          <WarningIcon className="w-5 h-5 text-red-200" />
        </div>
        <div className="w-full max-w-3xl p-4 rounded-lg bg-red-900/30 border border-red-500/30">
           <pre className="text-red-200 whitespace-pre-wrap font-sans">{message.error}</pre>
        </div>
      </div>
    );
  }

  const contentDisplay = () => {
    // Model-specific logic for proposed changes
    if (isModel && hasProposedChanges && !isLoading) {
      const saveProposalButton = (
        <button
          onClick={handleSave}
          disabled={saveStatus === 'success'}
          className={`text-white font-bold py-1 px-3 rounded text-sm transition-colors flex items-center gap-1.5 disabled:opacity-75 ${
            saveStatus === 'success'
              ? 'bg-green-600'
              : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
          title="Save the user prompt, AI response, and this diff to a markdown file for review"
        >
          {saveStatus === 'success' ? (
            <>
              <CheckIcon className="w-4 h-4" />
              Saved!
            </>
          ) : (
            <>
              <SaveIcon className="w-4 h-4" />
              Save Proposal
            </>
          )}
        </button>
      );
      
      return (
        <div className="space-y-4">
          <div>{renderContent()}</div>
          {message.proposedChanges!.map((change, idx) => (
            <FileChangePreview key={idx} change={change} />
          ))}
          <div className="mt-4 pt-3 border-t border-gray-600/50">
             {isHandled ? (
                <div className="flex justify-between items-center">
                    <p className={`text-sm font-semibold ${
                        action === 'applied' ? 'text-green-400' : 'text-red-400'
                    }`}>
                    { action === 'applied' ? 'Changes applied.' : 'Changes rejected.' }
                    </p>
                    {saveProposalButton}
                </div>
              ) : (
                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <button
                            onClick={handleApply}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded text-sm transition-colors"
                        >
                            Apply Changes
                        </button>
                        <button
                            onClick={handleReject}
                            className="bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded text-sm transition-colors"
                        >
                            Reject
                        </button>
                    </div>
                    {saveProposalButton}
                </div>
              )}
          </div>
        </div>
      );
    }

    // User-specific logic for attachments
    if (!isModel && message.attachments && message.attachments.length > 0) {
      return (
        <>
          {message.content && renderContent()}
          <div className={`mt-3 space-y-2 ${message.content ? 'border-t border-indigo-800/50 pt-3' : ''}`}>
            {message.attachments.map(file => (
              <div key={file.name} className="flex items-center text-sm text-indigo-300 bg-indigo-900/70 px-3 py-1.5 rounded-md">
                <FileIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate" title={file.name}>{file.name}</span>
              </div>
            ))}
          </div>
        </>
      );
    }
    
    // Default rendering for model messages without changes, or user messages without attachments
    return renderContent();
  };

  return (
    <div className={`flex items-start gap-4 ${!isModel && 'flex-row-reverse'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isModel ? 'bg-indigo-500' : 'bg-gray-600'}`}>
        {isModel ? <GeminiIcon className="w-5 h-5 text-white" /> : <span className="text-sm font-bold">U</span>}
      </div>
      <div className={`w-full max-w-3xl p-4 rounded-lg ${isModel ? 'bg-gray-700/50' : 'bg-indigo-900/50'}`}>
        {contentDisplay()}
      </div>
    </div>
  );
});