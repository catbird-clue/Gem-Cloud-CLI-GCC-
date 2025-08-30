import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { ChatInterface } from './components/ChatInterface';
import { MemoryEditor } from './components/MemoryEditor';
import { FileViewer } from './components/FileViewer';
import { SessionSummaryViewer } from './components/SessionSummaryViewer';
import type { UploadedFile, ChatMessage, FileChange, ProposedChange, GeminiModel } from './types';
import { AVAILABLE_MODELS } from './types';
import { streamChatResponse, summarizeSession } from './services/geminiService';

const FILES_KEY = 'gemini-cloud-cli-files';
const MODIFIED_FILES_KEY = 'gemini-cloud-cli-modified-files';
const MEMORY_KEY = 'gemini-cloud-cli-memory';
const SESSION_SUMMARY_KEY = 'gemini-cloud-cli-session-summary'; // New key for session summary
const FILE_HISTORY_KEY = 'gemini-cloud-cli-file-history';
const MODEL_KEY = 'gemini-cloud-cli-model';
const MAX_HISTORY_LENGTH = 20; // Keep the last 20 file states


export default function App(): React.ReactElement {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [modifiedFiles, setModifiedFiles] = useState<Record<string, number>>({});
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [fileHistory, setFileHistory] = useState<UploadedFile[][]>([]); // Holds previous states of the 'files' array
  const [isLoading, setIsLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiMemory, setAiMemory] = useState<string>('');
  const [sessionSummary, setSessionSummary] = useState<string>(''); // New state for session summary
  const [model, setModel] = useState<GeminiModel>(AVAILABLE_MODELS[0]);
  const [isMemoryEditorOpen, setIsMemoryEditorOpen] = useState(false);
  const [isSummaryViewerOpen, setIsSummaryViewerOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null);
  const [aiThought, setAiThought] = useState<string | null>(null); // New state for AI thoughts/status
  const stopGenerationRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false); // Flag to prevent saving on initial load

  // Effect to load all data from localStorage on initial mount
  useEffect(() => {
    try {
      const savedFilesRaw = localStorage.getItem(FILES_KEY);
      const savedFiles = savedFilesRaw ? JSON.parse(savedFilesRaw) : [];
      setFiles(savedFiles);

      const savedModifiedFilesRaw = localStorage.getItem(MODIFIED_FILES_KEY);
      const savedModifiedFiles = savedModifiedFilesRaw ? JSON.parse(savedModifiedFilesRaw) : {};
      setModifiedFiles(savedModifiedFiles);
      
      const savedHistoryRaw = localStorage.getItem(FILE_HISTORY_KEY);
      const savedHistory = savedHistoryRaw ? JSON.parse(savedHistoryRaw) : [];
      setFileHistory(savedHistory);
      
      const savedModel = localStorage.getItem(MODEL_KEY) as GeminiModel;
      if (savedModel && AVAILABLE_MODELS.includes(savedModel)) {
        setModel(savedModel);
      }

      if (savedFiles.length > 0) {
        setChatHistory([{
          role: 'model',
          content: `Restored your project files from the previous session.`
        }]);
      } else {
         const welcomeMessage = `Welcome to Gemini Cloud CLI! Upload your project folder using the button on the left to get started. You can then ask me to help you with your code.`;

         setChatHistory([{
            role: 'model',
            content: welcomeMessage
          }]);
      }
    } catch (e) {
      console.error("Failed to load files from localStorage", e);
    }
    
    try {
      const savedMemory = localStorage.getItem(MEMORY_KEY);
      if (savedMemory) {
        setAiMemory(savedMemory);
      }
      const savedSummary = localStorage.getItem(SESSION_SUMMARY_KEY); // Load session summary
      if (savedSummary) {
        setSessionSummary(savedSummary);
      }
    } catch (e) {
      console.error("Failed to load AI memory/summary from localStorage", e);
    }
    
    setIsLoaded(true);
  }, []);

  // Effect to PERSIST files state to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(FILES_KEY, JSON.stringify(files));
      localStorage.setItem(MODIFIED_FILES_KEY, JSON.stringify(modifiedFiles));
    }
  }, [files, modifiedFiles, isLoaded]);

  // Effect to PERSIST file history to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(FILE_HISTORY_KEY, JSON.stringify(fileHistory));
    }
  }, [fileHistory, isLoaded]);

  // Effect to PERSIST AI memory to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(MEMORY_KEY, aiMemory);
    }
  }, [aiMemory, isLoaded]);

  // Effect to PERSIST session summary to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(SESSION_SUMMARY_KEY, sessionSummary);
    }
  }, [sessionSummary, isLoaded]);
  
  // Effect to PERSIST model selection to localStorage
  useEffect(() => {
    if (isLoaded) {
        localStorage.setItem(MODEL_KEY, model);
    }
  }, [model, isLoaded]);

  const handleClearFiles = () => {
    if (files.length === 0) return;

    // 1. Clear React state to give immediate UI feedback
    setFiles([]);
    setModifiedFiles({});
    setFileHistory([]);
    setSessionSummary('');
    
    // 2. Clear localStorage
    try {
      localStorage.removeItem(FILES_KEY);
      localStorage.removeItem(MODIFIED_FILES_KEY);
      localStorage.removeItem(FILE_HISTORY_KEY);
      localStorage.removeItem(SESSION_SUMMARY_KEY);
      // Note: AI memory (MEMORY_KEY) is intentionally not cleared as it's global.
    } catch (e) {
      console.error("Error clearing project files from localStorage:", e);
      // If clearing storage fails, we should notify the user.
      const errorMessage = "Failed to clear project files from your browser's storage. Please try clearing your site data manually.";
       setChatHistory(prev => [...prev, {role: 'model', content: '', error: errorMessage}]);
       return; // Stop here if storage clearing fails
    }

    // 3. Update chat history to confirm the action and offer next steps.
     setChatHistory([{
        role: 'model',
        content: `Project files have been cleared. You can now upload a new project folder.`
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

      // When uploading, save the current state to history before overwriting
      if (files.length > 0) {
        setFileHistory(prev => [files, ...prev].slice(0, MAX_HISTORY_LENGTH));
      }

      // Merge with existing files, overwriting duplicates
      setFiles(currentFiles => {
        const fileMap = new Map(currentFiles.map(f => [f.path, f]));
        newFiles.forEach(file => fileMap.set(file.path, file));
        return Array.from(fileMap.values());
      });

      // When new files are added or updated, remove their "modified" status
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
    setAiMemory(newMemory);
    setIsMemoryEditorOpen(false);
    setChatHistory(prev => [...prev, {
      role: 'model',
      content: 'AI long-term memory has been updated.'
    }]);
  }, []);
  
  const handleSaveSessionSummary = useCallback(async () => {
    if (isSummarizing || chatHistory.length < 2) {
      return;
    }

    setIsSummarizing(true);
    setChatHistory(prev => [...prev, { role: 'model', content: 'Generating session summary...' }]);

    try {
      const summary = await summarizeSession(chatHistory, sessionSummary);
      setSessionSummary(summary); // Update the session summary state

      setChatHistory(prev => [
        ...prev.slice(0, -1),
        { role: 'model', content: '✅ Session context has been saved for next time.' }
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
  }, [chatHistory, sessionSummary, isSummarizing]);

  const handleAcknowledgeFileChange = useCallback((filePath: string) => {
    setModifiedFiles(currentModified => {
      const updatedModified = { ...currentModified };
      delete updatedModified[filePath];
      return updatedModified;
    });
  }, []);

  const handleApplyChanges = useCallback((changesToApply: ProposedChange[]) => {
    // Before applying changes, save the current file state to history
    setFileHistory(prevHistory => [files, ...prevHistory].slice(0, MAX_HISTORY_LENGTH));

    setFiles(currentFiles => {
      let updatedFiles = [...currentFiles];
      
      changesToApply.forEach(change => {
        const fileIndex = updatedFiles.findIndex(f => f.path === change.filePath);
        if (fileIndex !== -1) {
          updatedFiles[fileIndex] = { path: change.filePath, content: change.newContent };
        } else {
          updatedFiles.push({ path: change.filePath, content: change.newContent });
        }
      });
      
      return updatedFiles;
    });

    setModifiedFiles(currentModified => {
      const updatedModifiedFiles = { ...currentModified };
      changesToApply.forEach(change => {
        updatedModifiedFiles[change.filePath] = (updatedModifiedFiles[change.filePath] || 0) + 1;
      });
      return updatedModifiedFiles;
    });

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

  const handlePromptSubmit = useCallback(async (prompt: string, stagedFiles: File[]) => {
    if (isLoading) return;

    setIsLoading(true);
    setAiThought(null); // Reset thought on new prompt
    stopGenerationRef.current = false;
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: prompt,
      attachments: stagedFiles.map(f => ({ name: f.name })) 
    };
    
    // Create the history to be sent to the API, including the new prompt.
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

        // Extract the latest "thought" from the response stream for live feedback
        const thoughts = [...fullModelResponse.matchAll(thoughtRegex)].map(match => match[1]);
        if (thoughts.length > 0) {
          setAiThought(thoughts[thoughts.length - 1]);
        }
        
        // Hide special command blocks from the streaming display.
        let displayContent = fullModelResponse
            .replace(thoughtRegex, '')
            .replace(memoryUpdateRegex, '')
            .replace(/<changes>[\s\S]*$/, ''); // Hide file changes until fully formed

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
      
      // Strip all thoughts from the final response before processing other blocks
      finalResponse = finalResponse.replace(thoughtRegex, '').trim();

      const memoryMatch = finalResponse.match(memoryUpdateRegex);
      if (memoryMatch && memoryMatch[0]) {
        const newMemoryContent = memoryMatch[0].replace(/\[\/?GEMINI_MEMORY_UPDATE\]/g, '').trim();
        setAiMemory(newMemoryContent);
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
      setAiThought(null); // Clear thought when generation finishes
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
      <SessionSummaryViewer
        isOpen={isSummaryViewerOpen}
        summary={sessionSummary}
        onClose={() => setIsSummaryViewerOpen(false)}
      />
    </main>
  );
}
