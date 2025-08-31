import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { ChatInterface } from './components/ChatInterface';
import { MemoryEditor } from './components/MemoryEditor';
import { FileViewer } from './components/FileViewer';
import { SessionSummaryViewer } from './components/SessionSummaryViewer';
import type { UploadedFile, ChatMessage, FileChange, ProposedChange, GeminiModel } from './types';
import { AVAILABLE_MODELS } from './types';
import { streamChatResponse, summarizeSession } from './services/geminiService';
import { saveWorkspace, getWorkspace, getAllWorkspaceNames, deleteWorkspace } from './services/dbService';

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
  const [aiThought, setAiThought] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('Current Session');
  const stopGenerationRef = useRef(false);
  
  // Effect to load workspaces on mount
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const names = await getAllWorkspaceNames();
        setWorkspaces(names.sort());
      } catch (error) {
        console.error("Failed to load workspaces:", error);
        setChatHistory(prev => [...prev, {
          role: 'model',
          content: '',
          error: 'Could not load saved workspaces from the browser database.'
        }]);
      }
    };
    loadWorkspaces();
  }, []);

  // Effect to load initial welcome message
  useEffect(() => {
    const welcomeMessage = `Welcome to Gemini Cloud CLI! Upload your project folder using the button on the left to get started. You can also save sets of files as a "workspace" for quick access later.`;
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


  const handleClearFiles = () => {
    if (files.length === 0 && currentWorkspace === 'Current Session') return;
    setFiles([]);
    setModifiedFiles({});
    setFileHistory([]);
    setSessionSummary('');
    setAiMemory('');
    setCurrentWorkspace('Current Session');
    setChatHistory([{
        role: 'model',
        content: `Project files have been cleared. You are now in a new, empty session.`
     }]);
  };
  
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
      
      setCurrentWorkspace('Current Session');

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
    
    setCurrentWorkspace('Current Session');

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
      
      setCurrentWorkspace('Current Session');

      setChatHistory(prev => [
        ...prev.slice(0, -1),
        { role: 'model', content: `✅ Session context has been saved to \`${summaryFilePath}\`.` }
      ]);
    } catch (err) {
      console.error("Failed to summarize session:", err);
      let detail = err instanceof Error ? err.message : 'Unknown error';
      if (err instanceof Error && detail.toLowerCase().includes('quota')) {
          detail = "The API is busy after several retries. Please wait a moment and try again.";
      }
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

  const handleApplyChanges = useCallback((changesToApply: ProposedChange[]) => {
    setFileHistory(prevHistory => [files, ...prevHistory].slice(0, MAX_HISTORY_LENGTH));
    setFiles(currentFiles => {
      const fileMap = new Map(currentFiles.map(f => [f.path, f]));
      changesToApply.forEach(change => {
        fileMap.set(change.filePath, { path: change.filePath, content: change.newContent });
      });
      return Array.from(fileMap.values()).sort((a, b) => a.path.localeCompare(b.path));
    });

    setModifiedFiles(currentModified => {
      const updatedModifiedFiles = { ...currentModified };
      changesToApply.forEach(change => {
        updatedModifiedFiles[change.filePath] = (updatedModifiedFiles[change.filePath] || 0) + 1;
      });
      return updatedModifiedFiles;
    });
    
    setCurrentWorkspace('Current Session');

    setChatHistory(prev => [...prev, {
      role: 'model',
      content: `Applied ${changesToApply.length} file change(s) to the project.`
    }]);
  }, [files]);

  const handleStopGeneration = useCallback(() => {
    stopGenerationRef.current = true;
  }, []);

  const handleViewFile = useCallback((file: UploadedFile) => {
    setViewingFile(file);
  }, []);
  
  const handleAddChatMessage = useCallback((content: string) => {
    setChatHistory(prev => [...prev, { role: 'model', content }]);
  }, []);

  const handleSaveWorkspace = useCallback(async () => {
    if (files.length === 0) {
      setChatHistory(prev => [...prev, {
        role: 'model',
        content: 'Cannot save an empty workspace. Please upload some files first.'
      }]);
      return;
    }

    const currentName = currentWorkspace !== 'Current Session' ? currentWorkspace : `Workspace ${new Date().toLocaleString()}`;
    const name = prompt("Enter a name for this workspace:", currentName);
    if (!name || !name.trim()) {
      return; // User cancelled
    }
    
    setIsLoading(true);
    try {
      await saveWorkspace(name.trim(), files);
      setWorkspaces(prev => [...new Set([...prev, name.trim()])].sort());
      setCurrentWorkspace(name.trim());
      setChatHistory(prev => [...prev, {
        role: 'model',
        content: `✅ Workspace "${name.trim()}" has been saved.`
      }]);
    } catch (error) {
      const errorMessage = `Failed to save workspace: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage, error);
      setChatHistory(prev => [...prev, {
        role: 'model', content: '', error: errorMessage
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [files, currentWorkspace]);

  const handleLoadWorkspace = useCallback(async (name: string) => {
    if (name === currentWorkspace) return;

    if (name === 'Current Session') {
        if (files.length > 0 && confirm('This will clear all files and start a new, empty session. Are you sure?')) {
            handleClearFiles();
        } else if (files.length === 0) {
            handleClearFiles();
        }
        return;
    }

    if (!confirm(`Loading workspace "${name}" will replace your current session. Unsaved changes will be lost. Continue?`)) {
      // Find the select element and reset its value visually
      const selectElement = document.querySelector('select[aria-label="Select a workspace"]') as HTMLSelectElement | null;
      if (selectElement) {
        selectElement.value = currentWorkspace;
      }
      return;
    }

    setIsLoading(true);
    try {
      const workspace = await getWorkspace(name);
      if (workspace) {
        setModifiedFiles({});
        setFileHistory([]);
        setSessionSummary('');
        setAiMemory('');
        setFiles(workspace.files);
        setCurrentWorkspace(name);
        setChatHistory([{
          role: 'model',
          content: `✅ Workspace "${name}" loaded successfully.`
        }]);
      } else {
        throw new Error("Workspace not found in the database. It may have been deleted.");
      }
    } catch (error) {
      const errorMessage = `Failed to load workspace "${name}": ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage, error);
      setChatHistory(prev => [...prev, {
        role: 'model', content: '', error: errorMessage
      }]);
      setCurrentWorkspace('Current Session');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace, files]);

  const handleDeleteWorkspace = useCallback(async (name: string) => {
    if (name === 'Current Session') return;

    if (!confirm(`Are you sure you want to permanently delete the workspace "${name}"? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteWorkspace(name);
      setWorkspaces(prev => prev.filter(w => w !== name));
      
      if (currentWorkspace === name) {
        handleClearFiles();
         setChatHistory([{
            role: 'model',
            content: `Workspace "${name}" has been deleted. Session cleared.`
         }]);
      } else {
         setChatHistory(prev => [...prev, {
            role: 'model',
            content: `✅ Workspace "${name}" has been deleted.`
         }]);
      }
    } catch (error) {
       const errorMessage = `Failed to delete workspace "${name}": ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage, error);
      setChatHistory(prev => [...prev, {
        role: 'model', content: '', error: errorMessage
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace]);

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
        
        setCurrentWorkspace('Current Session');
        finalResponse = finalResponse.replace(memoryUpdateRegex, '').trim();
      }
      
      const fileMatch = finalResponse.match(fileUpdateRegex);
      if (fileMatch && fileMatch[0]) {
        try {
          const xmlString = fileMatch[0];
          finalResponse = finalResponse.replace(fileUpdateRegex, '').trim();
          
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlString, "application/xml");
          const changeNodes = xmlDoc.getElementsByTagName('change');

          const changes: FileChange[] = Array.from(changeNodes).map(node => {
            const file = node.getElementsByTagName('file')[0]?.textContent || '';
            const content = node.getElementsByTagName('content')[0]?.textContent || '';
            return { filePath: file, newContent: content };
          });
          
          if (changes.length > 0) {
              proposedChanges = changes.map(change => {
                const oldFile = files.find(f => f.path === change.filePath);
                return {
                  ...change,
                  oldContent: oldFile ? oldFile.content : `// A new file will be created at: ${change.filePath}`
                };
              }).filter(Boolean) as ProposedChange[];
          }

        } catch (xmlError) {
          console.error("Failed to parse file update XML:", xmlError);
          const errorMessage = "The AI proposed an invalid file change format.";
           setChatHistory(prev => {
              const lastMessage = prev[prev.length - 1];
              if (lastMessage && lastMessage.role === 'model') {
                return [
                  ...prev.slice(0, -1),
                  { ...lastMessage, content: '', error: errorMessage }
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
      if (detail.toLowerCase().includes('quota')) {
        detail = "The request rate is too high, and the server is still busy after several retries. Please wait a moment and try your request again.";
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
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        onFileUpload={handleFileUpload} 
        onClearFiles={handleClearFiles}
        onOpenMemoryEditor={() => setIsMemoryEditorOpen(true)}
        onOpenSummaryViewer={() => setIsSummaryViewerOpen(true)}
        onSaveSessionSummary={handleSaveSessionSummary}
        onViewFile={handleViewFile}
        onAddChatMessage={handleAddChatMessage}
        onAcknowledgeFileChange={handleAcknowledgeFileChange}
        onSaveWorkspace={handleSaveWorkspace}
        onLoadWorkspace={handleLoadWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
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
      <SessionSummaryViewer
        isOpen={isSummaryViewerOpen}
        summary={sessionSummary}
        onClose={() => setIsSummaryViewerOpen(false)}
      />
    </main>
  );
}