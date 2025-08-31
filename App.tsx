


import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { ChatInterface } from './components/ChatInterface';
import { MemoryEditor } from './components/MemoryEditor';
import { FileViewer } from './components/FileViewer';
import { FileDiffViewer } from './components/FileDiffViewer';
import { SessionSummaryViewer } from './components/SessionSummaryViewer';
import type { UploadedFile, ChatMessage, ProposedChange, GeminiModel } from './types';
import { AVAILABLE_MODELS } from './types';
import { streamChatResponse, summarizeSession } from './services/geminiService';
import { extractFullContentFromChangeXml } from './utils/patchUtils';

const MAX_HISTORY_LENGTH = 20; // Keep the last 20 file states

export default function App(): React.ReactElement {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [modifiedFiles, setModifiedFiles] = useState<Record<string, number>>({});
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [fileHistory, setFileHistory] = useState<UploadedFile[][]>([]); // Holds previous states of the 'files' array
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiMemory, setAiMemory] = useState<string>('');
  const [sessionSummary, setSessionSummary] = useState<string>('');
  const [model, setModel] = useState<GeminiModel>(AVAILABLE_MODELS[0]);
  const [isMemoryEditorOpen, setIsMemoryEditorOpen] = useState(false);
  const [isSummaryViewerOpen, setIsSummaryViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null);
  const [viewingDiff, setViewingDiff] = useState<{ oldFile: UploadedFile; newFile: UploadedFile } | null>(null);
  const [aiThought, setAiThought] = useState<string | null>(null);

  const stopGenerationRef = useRef(false);
  
  // Effect to load initial welcome message
  useEffect(() => {
    const welcomeMessage = `Welcome to Gemini Cloud CLI! Upload your project folder using the button on the left to get started.`;
     setChatHistory([{
        role: 'model',
        content: welcomeMessage
      }]);
  }, []);

  // Effect to derive AI memory and session summary from the project files
  useEffect(() => {
    const memoryFilePath = 'AI_Memory/Gemini.md';
    const memoryFile = files.find(f => f.path === memoryFilePath);
    setAiMemory(memoryFile?.content || '');

    const summaryFilePath = 'AI_Memory/context.md';
    const summaryFile = files.find(f => f.path === summaryFilePath);
    setSessionSummary(summaryFile?.content || '');
  }, [files]);

  const handleClearFiles = useCallback(() => {
    if (files.length === 0) return;
    
    if (window.confirm('Are you sure you want to clear all files and start a new session? This action cannot be undone.')) {
        setFiles([]);
        setModifiedFiles({});
        setFileHistory([]);
        setSessionSummary('');
        setAiMemory('');
        setChatHistory([{
            role: 'model',
            content: `Project files have been cleared. You are now in a new, empty session.`
        }]);
    }
  }, [files.length]);
  
  const handleFileUpload = useCallback(async (uploadedFiles: FileList | null) => {
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsLoading(true);

    const filePromises: Promise<UploadedFile>[] = Array.from(uploadedFiles).map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve({ path: file.webkitRelativePath || file.name, content });
        };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
      });
    });

    try {
      const newFiles = await Promise.all(filePromises);
      const isFirstUpload = files.length === 0;

      if (files.length > 0) {
        setFileHistory(prev => [files, ...prev].slice(0, MAX_HISTORY_LENGTH));
      }
      
      setFiles(currentFiles => {
        const fileMap = new Map(currentFiles.map(f => [f.path, f]));
        newFiles.forEach(file => fileMap.set(file.path, file));
        return Array.from(fileMap.values());
      });

      setModifiedFiles(currentModified => {
        const updatedModified = { ...currentModified };
        newFiles.forEach(file => {
          delete updatedModified[file.path];
        });
        return updatedModified;
      });
      
      const message = isFirstUpload
        ? `Successfully uploaded ${newFiles.length} files. You can now ask me questions about your code.`
        : `Successfully added or updated ${newFiles.length} files.`;
        
      setChatHistory(prev => [...prev, {
        role: 'model',
        content: message
      }]);
      
    } catch (err) {
      console.error("File reading error:", err);
      const errorMessage = "Failed to read one or more files. Please ensure they are text-based files and try again.";
       setChatHistory(prev => [...prev, {role: 'model', content: '', error: errorMessage}]);
    } finally {
      setIsLoading(false);
    }
  }, [files]);

  const handleSaveMemory = useCallback((newMemory: string) => {
    const memoryFilePath = 'AI_Memory/Gemini.md';

    setFileHistory(prev => [files, ...prev].slice(0, MAX_HISTORY_LENGTH));
    
    setFiles(currentFiles => {
      const updatedFiles = [...currentFiles];
      const fileIndex = updatedFiles.findIndex(f => f.path === memoryFilePath);
      if (fileIndex !== -1) {
        updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], content: newMemory };
      } else {
        updatedFiles.push({ path: memoryFilePath, content: newMemory });
      }
      return updatedFiles.sort((a, b) => a.path.localeCompare(b.path));
    });
    
    setModifiedFiles(currentModified => ({
      ...currentModified,
      [memoryFilePath]: (currentModified[memoryFilePath] || 0) + 1,
    }));
    
    setIsMemoryEditorOpen(false);
    setChatHistory(prev => [...prev, {
      role: 'model',
      content: `AI long-term memory has been saved to \`${memoryFilePath}\`.`
    }]);
  }, [files]);
  
  const handleSaveSessionSummary = useCallback(async () => {
    if (isSummarizing || chatHistory.length < 2) {
      return;
    }

    const summaryFilePath = 'AI_Memory/context.md';

    setIsSummarizing(true);
    setChatHistory(prev => [...prev, { role: 'model', content: 'Generating session summary...' }]);

    try {
      const summary = await summarizeSession(chatHistory, sessionSummary);
      
      setFileHistory(prev => [files, ...prev].slice(0, MAX_HISTORY_LENGTH));
          
      setFiles(currentFiles => {
          const updatedFiles = [...currentFiles];
          const fileIndex = updatedFiles.findIndex(f => f.path === summaryFilePath);
          if (fileIndex !== -1) {
              updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], content: summary };
          } else {
              updatedFiles.push({ path: summaryFilePath, content: summary });
          }
          return updatedFiles.sort((a, b) => a.path.localeCompare(b.path));
      });

      setModifiedFiles(currentModified => ({
          ...currentModified,
          [summaryFilePath]: (currentModified[summaryFilePath] || 0) + 1
      }));
      
      setChatHistory(prev => [
        ...prev.slice(0, -1),
        { role: 'model', content: `✅ Session context has been saved to \`${summaryFilePath}\`.` }
      ]);
    } catch (err) {
      console.error("Failed to summarize session:", err);
      // The service layer now provides a more user-friendly message for quota errors.
      const detail = err instanceof Error ? err.message : 'Unknown error';
      const errorMessage = `Failed to generate summary: ${detail}`;
      setChatHistory(prev => [
        ...prev.slice(0, -1),
        { role: 'model', content: '', error: errorMessage }
      ]);
    } finally {
      setIsSummarizing(false);
    }
  }, [chatHistory, sessionSummary, isSummarizing, files]);

  const handleAcknowledgeFileChange = useCallback((filePath: string) => {
    setModifiedFiles(currentModified => {
      const updatedModified = { ...currentModified };
      delete updatedModified[filePath];
      return updatedModified;
    });
  }, []);

  const handleApplyChanges = useCallback(async (changesToApply: ProposedChange[]) => {
    setFileHistory(prevHistory => [files, ...prevHistory].slice(0, MAX_HISTORY_LENGTH));
  
    const fileMap = new Map(files.map(f => [f.path, f]));
  
    changesToApply.forEach(change => {
      const { filePath, newContent } = change;
      // If newContent is empty, it signifies a file deletion.
      if (newContent === '' && fileMap.has(filePath)) {
        fileMap.delete(filePath);
      } else if (newContent !== '') {
        // This handles both creation of new files and updates to existing ones.
        fileMap.set(filePath, { path: filePath, content: newContent });
      }
    });
  
    setFiles(Array.from(fileMap.values()).sort((a, b) => a.path.localeCompare(b.path)));
  
    setModifiedFiles(currentModified => {
      const updatedModifiedFiles = { ...currentModified };
      changesToApply.forEach(change => {
        const finalFile = fileMap.get(change.filePath);
        if (!finalFile) {
            // File was deleted, remove from modified list.
            delete updatedModifiedFiles[change.filePath]; 
        } else {
            // File was added or updated, mark as modified.
            updatedModifiedFiles[change.filePath] = (updatedModifiedFiles[change.filePath] || 0) + 1;
        }
      });
      return updatedModifiedFiles;
    });
  
    if (changesToApply.length > 0) {
        setChatHistory(prev => [...prev, {
            role: 'model',
            content: `Applied ${changesToApply.length} file change(s) to the project.`
        }]);
    }
  }, [files]);


  const handleStopGeneration = useCallback(() => {
    stopGenerationRef.current = true;
  }, []);

  const handleViewFile = useCallback((file: UploadedFile) => {
    setViewingFile(file);
  }, []);
  
  const handleViewDiff = useCallback((file: UploadedFile) => {
    if (fileHistory.length === 0) {
        // If there's no history, just view the current file.
        setViewingFile(file);
        return;
    }
    const previousVersion = fileHistory[0].find(f => f.path === file.path);
    if (previousVersion) {
        setViewingDiff({ oldFile: previousVersion, newFile: file });
    } else {
        // If no previous version is found (e.g., a new file), just view it.
        setViewingFile(file);
    }
  }, [fileHistory]);
  
  const handleRevertFile = useCallback((filePath: string) => {
    const fileToRevert = viewingDiff?.oldFile;
    if (!fileToRevert) return;
    
    setFileHistory(prev => [files, ...prev].slice(0, MAX_HISTORY_LENGTH));

    setFiles(currentFiles => {
        const fileIndex = currentFiles.findIndex(f => f.path === filePath);
        if (fileIndex !== -1) {
            const updatedFiles = [...currentFiles];
            updatedFiles[fileIndex] = fileToRevert;
            return updatedFiles;
        }
        return currentFiles; // Should not happen if we are reverting
    });

    // We don't increment the modified counter on revert, we can just remove it or leave it.
    // Let's remove it to signify it's back to a "saved" state from history.
    setModifiedFiles(currentModified => {
        const updatedModified = { ...currentModified };
        delete updatedModified[filePath];
        return updatedModified;
    });

    setViewingDiff(null);
    setChatHistory(prev => [...prev, {
        role: 'model',
        content: `Reverted changes for \`${filePath}\`.`
    }]);
  }, [files, viewingDiff]);

  const handleAddChatMessage = useCallback((content: string) => {
    setChatHistory(prev => [...prev, { role: 'model', content }]);
  }, []);

  const handlePromptSubmit = useCallback(async (prompt: string, stagedFiles: File[]) => {
    if (isLoading) return;

    setIsLoading(true);
    setAiThought(null);
    stopGenerationRef.current = false;
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: prompt,
      attachments: stagedFiles.map(f => ({ name: f.name })) 
    };
    
    const historyForApi = [...chatHistory, userMessage];
    const modelMessage: ChatMessage = { role: 'model', content: '' };
    setChatHistory(prev => [...prev, userMessage, modelMessage]);
    
    let fullModelResponse = '';
    let generationStopped = false;

    const thoughtRegex = /\[GEMINI_THOUGHT\](.*?)\[\/GEMINI_THOUGHT\]/g;
    const memoryUpdateRegex = /\[GEMINI_MEMORY_UPDATE\]([\s\S]*?)\[\/GEMINI_MEMORY_UPDATE\]/g;
    const fileUpdateRegex = /<changes>([\s\S]*?)<\/changes>/g;
    
    try {
      const responseStream = streamChatResponse(prompt, historyForApi, files, fileHistory, aiMemory, sessionSummary, model, stagedFiles);
      
      for await (const chunk of responseStream) {
        if (stopGenerationRef.current) {
          generationStopped = true;
          break;
        }
        fullModelResponse += chunk;

        const thoughts = [...fullModelResponse.matchAll(thoughtRegex)].map(match => match[1]);
        if (thoughts.length > 0) {
          setAiThought(thoughts[thoughts.length - 1]);
        }
        
        let displayContent = fullModelResponse
            .replace(thoughtRegex, '')
            .replace(memoryUpdateRegex, '')
            .replace(/<changes>[\s\S]*$/, '');

        setChatHistory(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'model') {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, content: displayContent.trim() }
            ];
          }
          return prev;
        });
      }

      if (generationStopped) {
        fullModelResponse += '\n\n*(Generation stopped by user)*';
      }
      
      let finalResponse = fullModelResponse;
      let proposedChanges: ProposedChange[] | undefined = undefined;
      
      finalResponse = finalResponse.replace(thoughtRegex, '').trim();

      const memoryMatch = finalResponse.match(memoryUpdateRegex);
      if (memoryMatch && memoryMatch[0]) {
        const newMemoryContent = memoryMatch[0].replace(/\[\/?GEMINI_MEMORY_UPDATE\]/g, '').trim();
        const memoryFilePath = 'AI_Memory/Gemini.md';
        
        setFileHistory(prev => [files, ...prev].slice(0, MAX_HISTORY_LENGTH));
        setFiles(currentFiles => {
            const updatedFiles = [...currentFiles];
            const fileIndex = updatedFiles.findIndex(f => f.path === memoryFilePath);
            if (fileIndex !== -1) {
                updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], content: newMemoryContent };
            } else {
                updatedFiles.push({ path: memoryFilePath, content: newMemoryContent });
            }
            return updatedFiles.sort((a, b) => a.path.localeCompare(b.path));
        });
        setModifiedFiles(currentModified => ({
            ...currentModified,
            [memoryFilePath]: (currentModified[memoryFilePath] || 0) + 1,
        }));
        
        finalResponse = finalResponse.replace(memoryUpdateRegex, '').trim();
      }
      
      const fileMatch = finalResponse.match(fileUpdateRegex);
      if (fileMatch && fileMatch[0]) {
        try {
          const xmlString = fileMatch[0];
          finalResponse = finalResponse.replace(fileUpdateRegex, '').trim();
          
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlString, "application/xml");
          const errorNode = xmlDoc.querySelector('parsererror');
          if (errorNode) {
            throw new Error(`XML parsing error: ${errorNode.textContent}`);
          }
          
          const changeNodes = xmlDoc.getElementsByTagName('change');
          const generatedChanges: ProposedChange[] = [];
          
          for (const changeNode of Array.from(changeNodes)) {
            const filePath = changeNode.getAttribute('file');
            if (!filePath) continue;
            
            const oldFile = files.find(f => f.path === filePath);
            const oldContent = oldFile?.content ?? '';
            
            const newContent = extractFullContentFromChangeXml(changeNode.outerHTML);
            
            const change: ProposedChange = {
                filePath,
                oldContent,
                newContent,
            };

            // Don't propose creating empty new files
            if (!(change.newContent === '' && !oldFile)) {
                generatedChanges.push(change);
            }
          }
          
          if (generatedChanges.length > 0) {
              proposedChanges = generatedChanges;
          }

        } catch (err) {
          console.error("Failed to parse or apply file changes:", err);
          let errorMessage = "The AI proposed an invalid file change format.";
          if (err instanceof Error) {
            errorMessage += ` Details: ${err.message}`;
          }
           setChatHistory(prev => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.role === 'model') {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, content: finalResponse, error: errorMessage, proposedChanges: undefined }
                ];
              }
              return prev;
            });
        }
      }
      
      setChatHistory(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'model') {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: finalResponse, proposedChanges }
          ];
        }
        return prev;
      });

    } catch (err) {
      console.error("Gemini API error:", err);
      let detail = err instanceof Error ? err.message : "An unexpected error occurred. Please check the console for details.";
      
      // Improved quota error handling
      if (detail.toLowerCase().includes('quota')) {
        if (detail.toLowerCase().includes('plan and billing')) {
          detail = "You have exceeded your usage quota (e.g., daily limit). Please check your Google AI Platform plan and billing details. The quota typically resets at midnight PST.";
        } else {
          detail = "The request rate is too high (requests per minute). The app retried, but the server remained busy. Please wait a moment before trying again.";
        }
      }
      
      const errorMessage = `Gemini API Error: ${detail}`;
      
       setChatHistory(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'model') {
            return [
              ...prev.slice(0, -1),
              { ...lastMessage, content: '', error: errorMessage }
            ];
          }
          return [...prev, {role: 'model', content: '', error: errorMessage}];
        });
    } finally {
      setIsLoading(false);
      stopGenerationRef.current = false;
      setAiThought(null);
    }
  }, [isLoading, files, aiMemory, sessionSummary, model, chatHistory, fileHistory]);

  return (
    <main className="flex h-screen w-screen bg-gray-900 text-gray-200">
      <FileExplorer 
        files={files}
        modifiedFiles={modifiedFiles}
        model={model}
        isSummarizing={isSummarizing}
        sessionSummary={sessionSummary}
        onFileUpload={handleFileUpload} 
        onClearFiles={handleClearFiles}
        onOpenMemoryEditor={() => setIsMemoryEditorOpen(true)}
        onOpenSummaryViewer={() => setIsSummaryViewerOpen(true)}
        onSaveSessionSummary={handleSaveSessionSummary}
        onViewFile={handleViewFile}
        onViewDiff={handleViewDiff}
        onAddChatMessage={handleAddChatMessage}
        onAcknowledgeFileChange={handleAcknowledgeFileChange}
      />
      <div className="flex-1 flex flex-col bg-gray-800/50">
        <ChatInterface 
          chatHistory={chatHistory}
          isLoading={isLoading}
          aiThought={aiThought}
          onPromptSubmit={handlePromptSubmit}
          onApplyChanges={handleApplyChanges}
          onStopGeneration={handleStopGeneration}
        />
      </div>
      <MemoryEditor
        isOpen={isMemoryEditorOpen}
        memory={aiMemory}
        onSave={handleSaveMemory}
        onClose={() => setIsMemoryEditorOpen(false)}
      />
      <FileViewer
        file={viewingFile}
        onClose={() => setViewingFile(null)}
      />
      <FileDiffViewer
        diff={viewingDiff}
        onClose={() => setViewingDiff(null)}
        onRevert={handleRevertFile}
      />
      <SessionSummaryViewer
        isOpen={isSummaryViewerOpen}
        summary={sessionSummary}
        onClose={() => setIsSummaryViewerOpen(false)}
      />
    </main>
  );
}