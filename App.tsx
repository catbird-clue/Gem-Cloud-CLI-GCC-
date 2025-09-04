import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { ChatInterface } from './components/ChatInterface';
import { FileViewer } from './components/FileViewer';
import { FileDiffViewer } from './components/FileDiffViewer';
import { MemoryEditor } from './components/MemoryEditor';
import type { UploadedFile, ChatMessage, ProposedChange, GeminiModel } from './types';
import { AVAILABLE_MODELS } from './types';
import { streamChatResponse, generateContextResponse } from './services/geminiService';

const MAX_HISTORY_LENGTH = 20; // Keep the last 20 file states
const CONTEXT_CHAR_LIMIT = 25000; // Character limit for chat history before pruning
const MEMORY_FILE_PATH = 'AI_Memory/long_term_memory.md';
const CODE_BLOCK_LINE_THRESHOLD = 10; // Lines allowed in chat before collapsing


/**
 * Prunes the chat history if it exceeds a character limit to prevent context overflow.
 * It always keeps the first message (initial welcome/context) and the most recent messages
 * that fit within the limit.
 * @param history The full chat history.
 * @returns A potentially pruned version of the chat history.
 */
const pruneChatHistory = (history: ChatMessage[]): ChatMessage[] => {
    const totalChars = history.reduce((acc, msg) => acc + (msg.content?.length || 0) + (msg.warning?.length || 0), 0);

    if (totalChars <= CONTEXT_CHAR_LIMIT) {
        return history; // No pruning needed
    }

    let runningChars = 0;
    const keptMessages: ChatMessage[] = [];

    // Iterate backwards from the end to keep the most recent messages.
    for (let i = history.length - 1; i >= 0; i--) {
        const message = history[i];
        const messageLength = (message.content?.length || 0) + (message.warning?.length || 0);
        
        // Stop if adding the next message would exceed the limit.
        if (runningChars + messageLength > CONTEXT_CHAR_LIMIT) {
            break;
        }
        
        runningChars += messageLength;
        keptMessages.unshift(message); // Add to the beginning to maintain order
    }
    
    // Ensure the very first message is always included if it's not already.
    const firstMessage = history[0];
    if (firstMessage && !keptMessages.includes(firstMessage)) {
        keptMessages.unshift(firstMessage);
    }
    
    return keptMessages;
};

/**
 * Parses an XML string from the AI for file changes.
 * This parser is intentionally lenient and avoids using a strict DOMParser
 * to handle potentially malformed or incomplete XML from the AI.
 * It looks for <change> blocks and extracts file paths and content,
 * with a fallback for unclosed CDATA sections.
 * @param xmlString The XML string part of the AI's response.
 * @param existingFiles The current list of files to determine old content for diffs.
 * @returns An array of proposed file changes.
 */
const parseFileChangesFromXml = (xmlString: string, existingFiles: UploadedFile[]): ProposedChange[] => {
    const changes: ProposedChange[] = [];
    
    // Using [\s\S]*? makes the match non-greedy.
    const changeBlocks = xmlString.match(/<change file=".*?">[\s\S]*?<\/change>/g);

    if (!changeBlocks) {
        return [];
    }

    for (const block of changeBlocks) {
        const filePathMatch = block.match(/<change file="(.*?)"/);
        if (!filePathMatch?.[1]) {
            console.warn("Skipping change block with no file path attribute.");
            continue;
        }
        const filePath = filePathMatch[1];

        const cdataStartTag = '<![CDATA[';
        const cdataEndTag = ']]>';
        const contentEndTag = '</content>';

        const cdataStartIndex = block.indexOf(cdataStartTag);

        if (cdataStartIndex === -1) {
            // If no CDATA, it's likely a file deletion.
            // Check for an empty content tag to be sure.
            if (block.includes('<content/>') || block.includes('<content></content>') || block.includes('<content><![CDATA[]]></content>')) {
                changes.push({
                    filePath,
                    oldContent: existingFiles.find(f => f.path === filePath)?.content ?? '',
                    newContent: '',
                });
            } else {
                console.warn(`No CDATA found in change for ${filePath}, and not a recognized empty tag. Skipping.`);
            }
            continue;
        }

        const contentStartIndex = cdataStartIndex + cdataStartTag.length;
        
        // Find where the content ends. First, look for a proper CDATA closing tag.
        let contentEndIndex = block.indexOf(cdataEndTag, contentStartIndex);

        // If the CDATA isn't closed properly, fall back to the end of the <content> tag.
        if (contentEndIndex === -1) {
            contentEndIndex = block.indexOf(contentEndTag, contentStartIndex);
        }

        if (contentEndIndex === -1) {
            // This is a severely malformed block, with no closing tags for content.
            console.warn(`Unrecoverable parse error for ${filePath}: No closing tag found for content. Skipping.`);
            continue;
        }

        const newContent = block.substring(contentStartIndex, contentEndIndex);
        const oldFile = existingFiles.find(f => f.path === filePath);

        changes.push({
            filePath,
            oldContent: oldFile?.content ?? '',
            newContent,
        });
    }

    return changes;
};

/**
 * Sanitizes AI responses to prevent large code blocks from being displayed in the chat.
 * Replaces any markdown code block longer than a threshold with a placeholder message.
 * @param text The conversational part of the AI's response.
 * @returns An object containing the sanitized text and a flag indicating if sanitization occurred.
 */
const sanitizeCodeBlocks = (text: string): { sanitizedText: string; wasSanitized: boolean } => {
    let wasSanitized = false;
    const codeBlockRegex = /```[\s\S]*?```/g;

    const sanitizedText = text.replace(codeBlockRegex, (match) => {
        const lines = match.split('\n');
        // Subtract 2 for the ``` fences
        const lineCount = lines.length > 2 ? lines.length - 2 : lines.length;

        if (lineCount > CODE_BLOCK_LINE_THRESHOLD) {
            wasSanitized = true;
            return `[AI outputted a code block with ${lineCount} lines, which has been automatically collapsed to preserve context window. Please see the file changes panel for the full code.]`;
        }
        return match; // Keep the block if it's under the threshold
    });

    return { sanitizedText, wasSanitized };
};


export default function App(): React.ReactElement {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [modifiedFiles, setModifiedFiles] = useState<Record<string, number>>({});
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [fileHistory, setFileHistory] = useState<UploadedFile[][]>([]); // Holds previous states of the 'files' array
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState<GeminiModel>(AVAILABLE_MODELS[0]);
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null);
  const [viewingDiff, setViewingDiff] = useState<{ oldFile: UploadedFile; newFile: UploadedFile } | null>(null);
  const [isMemoryEditorOpen, setIsMemoryEditorOpen] = useState(false);
  
  const stopGenerationRef = useRef(false);

  // Derive long-term memory directly from the project file content.
  // This ensures that the memory is always in sync with the project state.
  const longTermMemory = useMemo(() => {
    return files.find(f => f.path === MEMORY_FILE_PATH)?.content ?? '';
  }, [files]);
  
  // Effect to load initial memory files and set a welcome message.
  useEffect(() => {
    const loadInitialFiles = async () => {
      setIsLoading(true);
      try {
        const memoryFilePaths = [
          'AI_Memory/long_term_memory.md',
          'AI_Memory/session_summary.md'
        ];

        const filePromises = memoryFilePaths.map(async (path) => {
          const response = await fetch(path);
          if (!response.ok) {
            // It's okay if files don't exist, we'll just start without them.
            if (response.status === 404) {
              return null;
            }
            throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
          }
          const content = await response.text();
          return { path, content };
        });

        const initialMemoryFiles = (await Promise.all(filePromises)).filter((file): file is UploadedFile => file !== null);
        
        setFiles(initialMemoryFiles);

        const loadedFilesCount = initialMemoryFiles.length;
        let welcomeMessage = '';

        if(loadedFilesCount > 0) {
            welcomeMessage = `Welcome to Gemini Cloud CLI! I have loaded ${loadedFilesCount} file(s) from your project (Memory and/or Context). You can now upload your project folder to begin.`;
        } else {
            welcomeMessage = `Welcome to Gemini Cloud CLI! No Memory or Context files were found. Upload your project folder using the button on the left to get started.`;
        }

        setChatHistory([{
          role: 'model',
          content: welcomeMessage
        }]);

      } catch (error) {
        console.error("Failed to load initial files:", error);
        setChatHistory([{
          role: 'model',
          error: `Failed to load initial Memory/Context files. Please ensure they exist and the application has permission to access them. You can still upload your project folder to begin.`,
          content: ''
        }]);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialFiles();
  }, []); // Empty dependency array ensures this runs only once on mount
  
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
        reader.onerror = () => reject(reader.error || new Error(`Unknown error reading ${file.name}`));
        reader.readAsText(file);
      });
    });

    try {
      const newFiles = await Promise.all(filePromises);
      const isFirstUserUpload = files.length === 0;

      if (files.length > 0) {
        setFileHistory(prev => [files, ...prev].slice(0, MAX_HISTORY_LENGTH));
      }
      
      let finalMessage = '';

      setFiles(currentFiles => {
        const fileMap = new Map(currentFiles.map(f => [f.path, f]));
        newFiles.forEach(file => fileMap.set(file.path, file));
        
        if (isFirstUserUpload) {
            finalMessage = `Successfully uploaded ${newFiles.length} files. You can now ask me questions about your code.`;
        } else {
             finalMessage = `Successfully added or updated ${newFiles.length} files.`;
        }
        
        return Array.from(fileMap.values()).sort((a, b) => a.path.localeCompare(b.path));
      });

      setModifiedFiles(currentModified => {
        const updatedModified = { ...currentModified };
        newFiles.forEach(file => {
          delete updatedModified[file.path];
        });
        return updatedModified;
      });
        
      setChatHistory(prev => [...prev, {
        role: 'model',
        content: finalMessage
      }]);
      
    } catch (err) {
      console.error("File reading error:", err);
      const detail = err instanceof Error ? err.message : String(err);
      const errorMessage = `Failed to read one or more files. Details: ${detail}. Please ensure they are text-based and try again.`;
       setChatHistory(prev => [...prev, {role: 'model', content: '', error: errorMessage}]);
    } finally {
      setIsLoading(false);
    }
  }, [files]);
  
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
  
  const handleAddChatMessage = useCallback((content: string) => {
    setChatHistory(prev => [...prev, { role: 'model', content }]);
  }, []);

  const handleRevertFile = useCallback((fileToRevert: UploadedFile) => {
    if (fileHistory.length === 0) {
        setChatHistory(prev => [...prev, {
            role: 'model',
            content: `Cannot revert "${fileToRevert.path}" as no file history exists.`
        }]);
        return;
    }

    const previousState = fileHistory[0];
    const oldFile = previousState.find(f => f.path === fileToRevert.path);
    
    // If oldFile is undefined, it means the file was created in the current state. Reverting means deleting it.
    const oldContent = oldFile ? oldFile.content : '';

    if (oldFile && oldContent === fileToRevert.content) {
      setChatHistory(prev => [...prev, {
        role: 'model',
        content: `No changes to revert for "${fileToRevert.path}".`
      }]);
      return;
    }

    const change: ProposedChange = {
      filePath: fileToRevert.path,
      oldContent: fileToRevert.content, // Current content is the "old" for the diff
      newContent: oldContent,          // Previous content is the "new" for the revert
    };

    setChatHistory(prev => [...prev, {
      role: 'model',
      content: `I've created a proposal to revert the changes for "${fileToRevert.path}". Please review and apply the change below to restore the previous version.`,
      proposedChanges: [change]
    }]);

    // Close the diff viewer after initiating revert
    setViewingDiff(null);
  }, [fileHistory]);

  const handleGenerateContext = useCallback(async () => {
    if (isLoading || chatHistory.length < 2) {
      const message = chatHistory.length < 2 ? "Not enough conversation to summarize." : "Please wait for the current task to complete.";
      setChatHistory(prev => [...prev, {role: 'model', content: '', warning: message }]);
      return;
    }

    setIsLoading(true);
    stopGenerationRef.current = false;

    try {
      const change = await generateContextResponse(chatHistory, files);

      if (stopGenerationRef.current) {
        throw new Error("Generation stopped by user");
      }

      setChatHistory(prev => [...prev, {
        role: 'model',
        content: "I've generated a summary of our session. Please review the proposed change below to save it to the Context file.",
        proposedChanges: [change]
      }]);

    } catch (err) {
      console.error("Context summary error:", err);
      let detail = err instanceof Error ? err.message : "An unexpected error occurred.";
      if (detail.includes("stop")) {
          detail = "Context summary generation was stopped."
      }
      const errorMessage = `Failed to generate session Context: ${detail}`;
      setChatHistory(prev => [...prev, {role: 'model', content: '', error: errorMessage}]);
    } finally {
      setIsLoading(false);
      stopGenerationRef.current = false;
    }
  }, [isLoading, chatHistory, files]);

  const handleSaveMemory = useCallback((memory: string) => {
    setIsMemoryEditorOpen(false);
    
    const oldFile = files.find(f => f.path === MEMORY_FILE_PATH);
    const oldContent = oldFile?.content ?? '';
    
    // Don't propose a change if the content is identical.
    if (memory === oldContent) {
      return;
    }
    
    const change: ProposedChange = {
      filePath: MEMORY_FILE_PATH,
      oldContent,
      newContent: memory,
    };
    
    setChatHistory(prev => [...prev, {
      role: 'model',
      content: "I've generated a proposal to update my Memory. Please review and apply the change below to save it.",
      proposedChanges: [change]
    }]);
  }, [files]);

  const handlePromptSubmit = useCallback(async (prompt: string, stagedFiles: File[]) => {
    if (isLoading) return;

    setIsLoading(true);
    stopGenerationRef.current = false;
    
    // --- 1. Prepare history and user message ---
    const prunedHistory = pruneChatHistory(chatHistory);
    let newMessages: ChatMessage[] = [];

    if (prunedHistory.length < chatHistory.length) {
      const warningMessage = "To make room for a response, older messages were not sent to the AI. For better long-term context, you can ask the AI to summarize the conversation into a file.";
      newMessages.push({ role: 'model', content: '', warning: warningMessage });
    }
    
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: prompt,
      attachments: stagedFiles.map(f => ({ name: f.name })) 
    };
    newMessages.push(userMessage);
    
    const historyForApi = [...prunedHistory, userMessage];
    setChatHistory(prev => [...prev, ...newMessages]);
    
    try {
      // --- 2. Accumulate full response in the background ---
      const responseStream = streamChatResponse(prompt, historyForApi, files, fileHistory, model, stagedFiles, longTermMemory);
      let fullModelResponse = '';
      for await (const chunk of responseStream) {
        if (stopGenerationRef.current) {
          fullModelResponse += '\n\n*(Generation stopped by user)*';
          break;
        }
        fullModelResponse += chunk;
      }

      // --- 3. Process the complete response ---
      let proposedChanges: ProposedChange[] | undefined = undefined;
      let modelMessageError: string | undefined = undefined;
      let modelMessageWarning: string | undefined = undefined;
      
      const changeBlockRegex = /<changes.*?>[\s\S]*?<\/changes>/;
      const match = fullModelResponse.match(changeBlockRegex);

      let conversationalPart = fullModelResponse;
      let xmlPart = '';

      if (match) {
          xmlPart = match[0];
          conversationalPart = fullModelResponse.replace(xmlPart, '').trim();
      }

      // --- Sanitize conversational part to remove large code blocks ---
      const { sanitizedText, wasSanitized } = sanitizeCodeBlocks(conversationalPart);
      conversationalPart = sanitizedText;
      if (wasSanitized) {
        modelMessageWarning = "The AI's response contained a large code block which was automatically collapsed. This is a violation of its instructions. This action was taken to protect the conversation's context."
      }
      
      if (xmlPart) {
        try {
            const parsedChanges = parseFileChangesFromXml(xmlPart, files);
            if (parsedChanges.length > 0) {
                proposedChanges = parsedChanges;
            }
        } catch (err) {
            console.error("Failed to parse file changes:", err);
            modelMessageError = `The AI proposed an invalid file change format. Details: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      // --- 4. Update state with the final message ---
      const modelMessage: ChatMessage = {
        role: 'model',
        content: conversationalPart,
        proposedChanges,
        error: modelMessageError,
        warning: modelMessageWarning,
      };
      setChatHistory(prev => [...prev, modelMessage]);

    } catch (err) {
      console.error("Chat generation error:", err);
      let detail: string;

      if (err instanceof Error) {
        detail = err.message;
      } else if (typeof err === 'object' && err !== null) {
        // Handle specific Google AI error structure like: { error: { message: '...' } }
        const errorObject = err as Record<string, any>;
        if (errorObject.error && typeof errorObject.error === 'object' && errorObject.error.message) {
            detail = String(errorObject.error.message);
        } 
        // Handle other common error structures like: { message: '...' }
        else if (errorObject.message) {
            detail = String(errorObject.message);
        } 
        // Fallback to stringifying the object
        else {
            try {
                detail = JSON.stringify(err);
            } catch {
                detail = "An unknown error object was received.";
            }
        }
      } else {
        detail = String(err);
      }
    
      if (detail.includes("stop")) {
        detail = "Generation was stopped."
      }
      // Network errors often manifest with status 0 or a "Failed to fetch" message.
      else if (detail.includes('http status code: 0') || detail.toLowerCase().includes('failed to fetch')) {
        detail = `A network error occurred. This could be due to a lost connection, a firewall, or a browser extension (like an ad-blocker) interfering with the request. Please check your network and browser settings.\n\nOriginal error: ${detail}`;
      }
      
      const errorMessage = `An error occurred while generating a response: ${detail}`;
      setChatHistory(prev => [...prev, {role: 'model', content: '', error: errorMessage}]);
    } finally {
      setIsLoading(false);
      stopGenerationRef.current = false;
    }
  }, [isLoading, chatHistory, files, fileHistory, model, longTermMemory]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex flex-1 overflow-hidden">
        <FileExplorer 
          files={files} 
          modifiedFiles={modifiedFiles}
          model={model}
          isLoading={isLoading}
          onFileUpload={handleFileUpload}
          onViewFile={handleViewFile}
          onViewDiff={handleViewDiff}
          onAddChatMessage={handleAddChatMessage}
          onAcknowledgeFileChange={handleAcknowledgeFileChange}
          onGenerateContext={handleGenerateContext}
          onEditMemory={() => setIsMemoryEditorOpen(true)}
        />
        <main className="flex-1 flex flex-col">
          <ChatInterface 
            chatHistory={chatHistory} 
            isLoading={isLoading}
            onPromptSubmit={handlePromptSubmit}
            onApplyChanges={handleApplyChanges}
            onStopGeneration={handleStopGeneration}
          />
        </main>
      </div>

      <FileViewer file={viewingFile} onClose={() => setViewingFile(null)} />
      <FileDiffViewer 
        diff={viewingDiff} 
        onClose={() => setViewingDiff(null)} 
        onRevert={handleRevertFile}
      />
      <MemoryEditor
        isOpen={isMemoryEditorOpen}
        onClose={() => setIsMemoryEditorOpen(false)}
        onSave={handleSaveMemory}
        memory={longTermMemory}
      />
    </div>
  );
}