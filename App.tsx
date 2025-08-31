import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { ChatInterface } from './components/ChatInterface';
import { MemoryEditor } from './components/MemoryEditor';
import { FileViewer } from './components/FileViewer';
import { FileDiffViewer } from './components/FileDiffViewer';
import { SessionSummaryViewer } from './components/SessionSummaryViewer';
import { WorkspaceNameModal } from './components/WorkspaceNameModal';
import { ConfirmationModal } from './components/ConfirmationModal';
import type { UploadedFile, ChatMessage, ProposedChange, GeminiModel } from './types';
import { AVAILABLE_MODELS } from './types';
import { streamChatResponse, summarizeSession } from './services/geminiService';
import { saveWorkspace, getWorkspace, getAllWorkspaceNames, deleteWorkspace, checkStoragePersistence } from './services/dbService';

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
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<string>('Current Session');
  const [isSaveWorkspaceModalOpen, setIsSaveWorkspaceModalOpen] = useState(false);
  const [suggestedWorkspaceName, setSuggestedWorkspaceName] = useState('');
  const [persistenceWarningShown, setPersistenceWarningShown] = useState(false);
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: null,
    onConfirm: () => {},
  });

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
  
  // Effect to check storage persistence and warn the user
  useEffect(() => {
    if (persistenceWarningShown) return;

    const persistenceCheck = async () => {
      const status = await checkStoragePersistence();
      if (status !== 'persistent') {
        const warningMessage = `**Warning:** Your browser has indicated it will not save data permanently for this site. This means workspaces can be cleared automatically. This usually happens in **Private/Incognito mode** or with settings that **"Clear cookies and site data when you quit"**. For workspaces to persist, please use a standard browser window and ensure this site's data is not set to be cleared automatically.`;
        
        setChatHistory(prev => [...prev, {
          role: 'model',
          content: '',
          warning: warningMessage,
        }]);
        setPersistenceWarningShown(true);
      }
    };

    const timerId = setTimeout(persistenceCheck, 2000);
    return () => clearTimeout(timerId);
  }, [persistenceWarningShown]);

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

  const handleClearFiles = useCallback(() => {
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
  }, [files.length, currentWorkspace]);
  
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

  const applyFullFileChanges = useCallback((changesToApply: ProposedChange[]) => {
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
  }, []);
  
  const applyStructuredChanges = useCallback((xmlString: string): { success: boolean; error?: string } => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const errorNode = xmlDoc.querySelector('parsererror');
        if (errorNode) {
            throw new Error(`XML parsing error: ${errorNode.textContent}`);
        }
        
        const changeNodes = xmlDoc.getElementsByTagName('change');
        if (changeNodes.length === 0) return { success: true }; // Nothing to apply

        let updatedFiles = [...files];
        const changedPaths: string[] = [];

        for (const changeNode of Array.from(changeNodes)) {
            const filePath = changeNode.getAttribute('file');
            if (!filePath) throw new Error("A <change> tag is missing a 'file' attribute.");

            let fileToUpdate = updatedFiles.find(f => f.path === filePath);
            let currentContent = fileToUpdate ? fileToUpdate.content : '';
            
            // File creation is handled by the first operation on an empty content string.
            if (!fileToUpdate) {
                fileToUpdate = { path: filePath, content: '' };
                updatedFiles.push(fileToUpdate);
            }
            
            changedPaths.push(filePath);

            for (const opNode of Array.from(changeNode.children)) {
                const cdataContent = opNode.textContent || '';

                switch (opNode.tagName) {
                    case 'insert': {
                        const afterLine = opNode.getAttribute('after_line');
                        const beforeLine = opNode.getAttribute('before_line');
                        if (afterLine) {
                            const index = currentContent.indexOf(afterLine);
                            if (index === -1) throw new Error(`Could not find anchor line for insert: "${afterLine}" in file ${filePath}.`);
                            const insertPos = index + afterLine.length;
                            currentContent = currentContent.slice(0, insertPos) + '\n' + cdataContent + currentContent.slice(insertPos);
                        } else if (beforeLine) {
                            const index = currentContent.indexOf(beforeLine);
                            if (index === -1) throw new Error(`Could not find anchor line for insert: "${beforeLine}" in file ${filePath}.`);
                            currentContent = currentContent.slice(0, index) + cdataContent + '\n' + currentContent.slice(index);
                        } else { // No anchor means new file content or prepend
                           currentContent = cdataContent + currentContent;
                        }
                        break;
                    }
                    case 'replace': {
                        const sourceNode = opNode.querySelector('source');
                        const newNode = opNode.querySelector('new');
                        if (!sourceNode || !newNode) throw new Error(`Invalid <replace> tag in ${filePath}. Missing <source> or <new>.`);
                        const sourceContent = sourceNode.textContent || '';
                        const newContent = newNode.textContent || '';
                        if (!currentContent.includes(sourceContent)) throw new Error(`Could not find <source> content to replace in ${filePath}. The file might have been modified.`);
                        currentContent = currentContent.replace(sourceContent, newContent);
                        break;
                    }
                    case 'delete': {
                        if (!currentContent.includes(cdataContent)) throw new Error(`Could not find content to <delete> in ${filePath}. The file might have been modified.`);
                        currentContent = currentContent.replace(cdataContent, '');
                        break;
                    }
                    case 'description':
                        // Ignore description tag, it's for the user.
                        break;
                    default:
                        throw new Error(`Unknown operation tag: <${opNode.tagName}> in ${filePath}.`);
                }
            }
            fileToUpdate.content = currentContent;
        }

        setFiles(updatedFiles.sort((a, b) => a.path.localeCompare(b.path)));
        setModifiedFiles(currentModified => {
            const updatedModifiedFiles = { ...currentModified };
            changedPaths.forEach(path => {
                updatedModifiedFiles[path] = (updatedModifiedFiles[path] || 0) + 1;
            });
            return updatedModifiedFiles;
        });
        
        return { success: true };
    } catch (e) {
        // Log the detailed error for debugging, but return a simple failure signal.
        console.error("Failed to apply structured changes:", e);
        return { success: false, error: e instanceof Error ? e.message : "An unknown error occurred." };
    }
}, [files]);


  const handleApplyChanges = useCallback((changesToApply: ProposedChange[], rawXml?: string) => {
    setFileHistory(prevHistory => [files, ...prevHistory].slice(0, MAX_HISTORY_LENGTH));
    
    let appliedSuccessfully = false;
    
    // Prioritize the new structured patch format if available
    if (rawXml) {
      const result = applyStructuredChanges(rawXml);
      if (result.success) {
        appliedSuccessfully = true;
      } else {
        // Fallback to full file changes if structured application fails, without notifying the user.
        console.warn("Structured patch failed, falling back to full file content replacement. Details:", result.error);
        try {
          applyFullFileChanges(changesToApply);
          appliedSuccessfully = true;
        } catch(fallbackError) {
          console.error("Full file content fallback also failed:", fallbackError);
          // If even the fallback fails, we show an error.
          setChatHistory(prev => [...prev, {
            role: 'model',
            content: '',
            error: `Failed to apply changes, even after a fallback attempt. Error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
          }]);
        }
      }
    } else {
      // Legacy path for old format (without structured patches)
      applyFullFileChanges(changesToApply);
      appliedSuccessfully = true;
    }
    
    if (appliedSuccessfully) {
        setCurrentWorkspace('Current Session');
        setChatHistory(prev => [...prev, {
          role: 'model',
          content: `Applied ${changesToApply.length} file change(s) to the project.`
        }]);
    }
  }, [files, applyFullFileChanges, applyStructuredChanges]);

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

  const handleOpenSaveWorkspaceModal = useCallback(() => {
    if (files.length === 0) {
      setChatHistory(prev => [...prev, {
        role: 'model',
        content: 'Cannot save an empty workspace. Please upload some files first.'
      }]);
      return;
    }

    const suggestedName = currentWorkspace !== 'Current Session' 
      ? currentWorkspace 
      : `Workspace ${new Date().toLocaleString()}`;
      
    setSuggestedWorkspaceName(suggestedName);
    setIsSaveWorkspaceModalOpen(true);
  }, [files, currentWorkspace]);

  const handleSaveWorkspace = useCallback(async (name: string) => {
    setIsSaveWorkspaceModalOpen(false);
    
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
  }, [files]);

  const handleLoadWorkspace = useCallback(async (name: string) => {
    if (name === currentWorkspace) return;

    const performLoad = async () => {
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
        } finally {
            setIsLoading(false);
        }
    };

    if (name === 'Current Session') {
        const hasUnsavedChanges = (currentWorkspace !== 'Current Session' && Object.keys(modifiedFiles).length > 0) || (currentWorkspace === 'Current Session' && files.length > 0);
        if (hasUnsavedChanges) {
            setConfirmModalState({
                isOpen: true,
                title: 'Start New Session',
                message: <p>This will clear all files and start a new, empty session. Are you sure?</p>,
                onConfirm: () => {
                    handleClearFiles();
                    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
                }
            });
        } else {
            handleClearFiles();
        }
        return;
    }

    const hasUnsavedChanges = (currentWorkspace === 'Current Session' && files.length > 0) || Object.keys(modifiedFiles).length > 0;
    if (hasUnsavedChanges) {
        setConfirmModalState({
            isOpen: true,
            title: 'Load Workspace',
            message: (
                <p>
                    Loading workspace <strong className="font-bold text-indigo-400">{name}</strong> will replace your current session. Unsaved changes will be lost. Continue?
                </p>
            ),
            onConfirm: () => {
                performLoad();
                setConfirmModalState(prev => ({ ...prev, isOpen: false }));
            }
        });
    } else {
        await performLoad();
    }
  }, [currentWorkspace, files, modifiedFiles, handleClearFiles]);

  const handleDeleteWorkspace = useCallback(() => {
    const name = currentWorkspace;
    if (name === 'Current Session' || !name) {
      return;
    }

    const performDelete = async () => {
      console.log(`Attempting to delete workspace: "${name}"`);
      setIsLoading(true);
      try {
        await deleteWorkspace(name);
        console.log(`Successfully deleted "${name}" from IndexedDB.`);

        setWorkspaces(prev => prev.filter(w => w !== name));
        console.log('Removed workspace from UI list.');

        setFiles([]);
        setModifiedFiles({});
        setFileHistory([]);
        setSessionSummary('');
        setAiMemory('');
        setCurrentWorkspace('Current Session');
        console.log('Session has been cleared and reset to "Current Session".');
        
        setChatHistory([{
          role: 'model',
          content: `Workspace "${name}" has been deleted. Your session has been cleared.`
        }]);
        console.log('Posted confirmation message to chat.');

      } catch (error) {
        const errorMessage = `Failed to delete workspace "${name}": ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMessage, error);
        setChatHistory(prev => [...prev, {
          role: 'model', content: '', error: errorMessage
        }]);
      } finally {
        setIsLoading(false);
        console.log('Delete process finished.');
      }
    };

    setConfirmModalState({
      isOpen: true,
      title: 'Delete Workspace',
      message: (
        <p>
          Are you sure you want to permanently delete the workspace{' '}
          <strong className="font-bold text-red-400">{name}</strong>? This action cannot be undone.
        </p>
      ),
      onConfirm: () => {
        performDelete();
        setConfirmModalState(prev => ({ ...prev, isOpen: false }));
      },
    });

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
      let rawXmlForChanges: string | undefined = undefined;
      
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
          rawXmlForChanges = xmlString; // Store raw XML for the new structured patch handler
          finalResponse = finalResponse.replace(fileUpdateRegex, '').trim();
          
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlString, "application/xml");
          const errorNode = xmlDoc.querySelector('parsererror');
          if (errorNode) {
            throw new Error(`XML parsing error: ${errorNode.textContent}`);
          }
          
          // This part is now primarily for generating the visual diff.
          // The actual application of changes will use the raw XML string.
          const changeNodes = xmlDoc.getElementsByTagName('change');
          const fileChanges: { filePath: string; newContent: string }[] = [];
          
          // We need to determine the new content for diffing purposes.
          // This is a simplified simulation, the real logic is in applyStructuredChanges.
          for (const changeNode of Array.from(changeNodes)) {
              const filePathAttr = changeNode.getAttribute('file');
              const filePath = filePathAttr || (changeNode.getElementsByTagName('file')[0]?.textContent || '');

              const oldFile = files.find(f => f.path === filePath);
              let tempContent = oldFile ? oldFile.content : '';

              // Heuristic for full file content replacement (legacy format)
              const contentNode = changeNode.querySelector('content');
              if(contentNode) {
                  fileChanges.push({ filePath, newContent: contentNode.textContent || '' });
                  continue; // Skip structured processing for this node
              }

              // Simulate structured changes to generate newContent for diff
              for(const opNode of Array.from(changeNode.children)) {
                   const cdataContent = opNode.textContent || '';
                   switch (opNode.tagName) {
                       case 'insert': {
                           // Simplified for diffing, actual logic is more complex
                           tempContent += '\n' + cdataContent;
                           break;
                       }
                       case 'replace': {
                           const sourceContent = opNode.querySelector('source')?.textContent || '';
                           const newContent = opNode.querySelector('new')?.textContent || '';
                           tempContent = tempContent.replace(sourceContent, newContent);
                           break;
                       }
                       case 'delete': {
                           tempContent = tempContent.replace(cdataContent, '');
                           break;
                       }
                   }
              }
              fileChanges.push({ filePath, newContent: tempContent });
          }
          
          if (fileChanges.length > 0) {
              const generatedChanges: ProposedChange[] = fileChanges.map(item => {
                  const oldFile = files.find(f => f.path === item.filePath);
                  const oldContentForDiff = oldFile ? oldFile.content : `// A new file will be created at: ${item.filePath}`;
                  return {
                      filePath: item.filePath,
                      oldContent: oldContentForDiff,
                      newContent: item.newContent
                  };
              }).filter(c => !(c.newContent === '' && !files.some(f => f.path === c.filePath))); // Don't propose creating empty new files
              
              if(generatedChanges.length > 0) {
                 proposedChanges = generatedChanges;
              }
          }

        } catch (xmlError) {
          console.error("Failed to parse or apply file changes:", xmlError);
          let errorMessage = "The AI proposed an invalid file change format.";
          if (xmlError instanceof Error) {
            errorMessage += ` Details: ${xmlError.message}`;
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
            { ...lastMessage, content: finalResponse, proposedChanges, rawXml: rawXmlForChanges }
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
  }, [isLoading, files, aiMemory, sessionSummary, model, chatHistory, fileHistory, applyStructuredChanges]);

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
        onViewDiff={handleViewDiff}
        onAddChatMessage={handleAddChatMessage}
        onAcknowledgeFileChange={handleAcknowledgeFileChange}
        onSaveWorkspace={handleOpenSaveWorkspaceModal}
        onLoadWorkspace={handleLoadWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
      />
      <div className="flex-1 flex flex-col bg-gray-800/50">
        <ChatInterface 
          chatHistory={chatHistory}
          isLoading={isLoading}
          aiThought={aiThought}
          onPromptSubmit={handlePromptSubmit}
          onApplyChanges={(changes, xml) => handleApplyChanges(changes, xml)}
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
      <WorkspaceNameModal
        isOpen={isSaveWorkspaceModalOpen}
        suggestedName={suggestedWorkspaceName}
        onSave={handleSaveWorkspace}
        onClose={() => setIsSaveWorkspaceModalOpen(false)}
      />
      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
      >
        {confirmModalState.message}
      </ConfirmationModal>
    </main>
  );
}
