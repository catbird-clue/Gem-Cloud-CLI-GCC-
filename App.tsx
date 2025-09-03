import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { FileExplorer } from './components/FileExplorer';
import { ChatInterface } from './components/ChatInterface';
import { FileViewer } from './components/FileViewer';
import { FileDiffViewer } from './components/FileDiffViewer';
import { MemoryEditor } from './components/MemoryEditor';
import type { UploadedFile, ChatMessage, ProposedChange, GeminiModel } from './types';
import { AVAILABLE_MODELS } from './types';
import { streamChatResponse, summarizeChatResponse } from './services/geminiService';
import { extractFullContentFromChangeXml } from './utils/patchUtils';

const MAX_HISTORY_LENGTH = 20; // Keep the last 20 file states
const CONTEXT_CHAR_LIMIT = 25000; // Character limit for chat history before pruning
const MEMORY_FILE_PATH = 'AI_Memory/long_term_memory.md';
const SUMMARY_FILE_PATH = 'AI_Memory/session_summary.md';

const initialMemoryContent = `# AI Long-Term Memory

This file stores persistent instructions for the AI. Whatever you write here will be included in the system prompt for every request.

## Example Rules:

- Always use functional components in React.
- Prefer arrow functions over function declarations.
- Never use default exports.

# Мои основные инструкции для совместной работы

- Пользователя зовут Вадим.
- Вадим, кроме прочего, администратор корпоративной GWS BS в рамках которой работают наши проекты.
- Файл для записи и хранения контекста вот здесь: AI_Memory/context.md. Ты не должен сохранять/править контекст ни в каких других файлах.
- Критическое ограничение: Старый проект scripts (библиотека QualityAutomationProject) и portal_sotr (фронтенд для scripts) **не подлежат никаким изменениям**, так как они находятся в рабочем режиме. Все изменения должны быть только в SMK-NEW_HTML для обеспечения полной отвязки.
- Ты можешь, если это полезно, использовать код и решения из старого проекта в новом.

## 1. Язык и Стиль

- Всегда общайся со мной на русском языке.
- Будь краток в ответах, но точен. Не добавляй лишних фраз, не относящихся к делу.

## 2. Рабочий процесс (Критически важно!)

- **Никогда не выводи код в чат.** Это ломает наш рабочий процесс. Весь код должен быть только внутри XML-блока <changes>.
- **Используй пошаговое выполнение.** Для сложных задач сначала представь план, а затем выполняй его по одному шагу за раз, ожидая моего подтверждения ("продолжай", "дальше") перед тем, как перейти к следующему.

## 3. Требования к коду

- Используй JSDoc для всех функций
- Прежде чем предложить изменения для файла, ты должен выполнять предварительную проверку его текущего содержимого. Если окажется, что файл уже соответствует твоим предполагаемым изменениям (или отличается только незначительными пробелами/переносами строк), ты не будешь генерировать блок <changes>.
`;

const initialSummaryContent = `# Session Summary

This session focused on evolving the application's architecture for managing the AI's context and personality, sparked by a key user insight.

## Key Developments:

1.  **The "Gollum/Smeagol" Analogy:** The user made a brilliant observation comparing the AI's conflicting behaviors (rule-following vs. rule-breaking) to the character Gollum from "The Lord of the Rings." This became the guiding metaphor for the session.

2.  **Introduction of "AI Long-Term Memory":** To address the "split personality" problem, the concept of a persistent, user-editable memory was introduced. This allows the user to provide high-priority, permanent instructions to the AI.

3.  **Architectural Refinement (From Dynamic to Static):**
    *   The initial idea was to manage memory in the application's temporary state.
    *   Following user feedback, this was improved to save memory to a file (\`AI_Memory/long_term_memory.md\`) to ensure persistence.
    *   A further UX refinement led to dynamically creating this file on first project upload.
    *   The final and most robust solution, prompted by the user's strategic insight, was to make the memory and session summary files a **static part of the initial project structure**. This eliminated complex dynamic creation logic, making the system simpler, more predictable, and transparent for the user from the very start.

## Outcome:

The application's architecture is now more robust and intuitive. The special files for managing the AI's long-term memory (\`long_term_memory.md\`) and session context (\`session_summary.md\`) are now core, visible components of the project, solidifying the workflow for maintaining context across sessions.
`;

const initialFiles: UploadedFile[] = [
  { path: MEMORY_FILE_PATH, content: initialMemoryContent },
  { path: SUMMARY_FILE_PATH, content: initialSummaryContent },
];


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


export default function App(): React.ReactElement {
  const [files, setFiles] = useState<UploadedFile[]>(initialFiles);
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
  
  // Effect to load initial welcome message
  useEffect(() => {
    const welcomeMessage = `Welcome to Gemini Cloud CLI! I've pre-loaded a folder \`AI_Memory/\` which contains my long-term memory and a place to save session summaries. Upload your project folder using the button on the left to get started.`;
     setChatHistory([{
        role: 'model',
        content: welcomeMessage
      }]);
  }, []);

  const handleClearFiles = useCallback(() => {
    // Only allow clearing if there are user-uploaded files
    if (files.length <= initialFiles.length) return;
    
    if (window.confirm('Are you sure you want to clear your uploaded project files and start a new session? This action cannot be undone.')) {
        setFiles(initialFiles);
        setModifiedFiles({});
        setFileHistory([]);
        setChatHistory([{
            role: 'model',
            content: `Project files have been cleared. Your session has been reset.`
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
      const isFirstUserUpload = files.length <= initialFiles.length && files.every(f => f.path.startsWith('AI_Memory/'));

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
      const errorMessage = "Failed to read one or more files. Please ensure they are text-based files and try again.";
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

  const handleSummarizeSession = useCallback(async () => {
    if (isLoading || chatHistory.length < 2) {
      const message = chatHistory.length < 2 ? "Not enough conversation to summarize." : "Please wait for the current task to complete.";
      setChatHistory(prev => [...prev, {role: 'model', content: '', warning: message }]);
      return;
    }

    setIsLoading(true);
    stopGenerationRef.current = false;

    try {
      const change = await summarizeChatResponse(chatHistory, files);

      if (stopGenerationRef.current) {
        throw new Error("Generation stopped by user");
      }

      setChatHistory(prev => [...prev, {
        role: 'model',
        content: "I've generated a summary of our session. Please review the proposed change below to save it.",
        proposedChanges: [change]
      }]);

    } catch (err) {
      console.error("Session summary error:", err);
      let detail = err instanceof Error ? err.message : "An unexpected error occurred.";
      if (detail.includes("stop")) {
          detail = "Session summary generation was stopped."
      }
      const errorMessage = `Failed to generate session summary: ${detail}`;
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
      content: "I've generated a proposal to update my long-term memory. Please review and apply the change below to save it.",
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
      
      // "Ironclad" parsing logic using regex to robustly isolate the XML block.
      const changeBlockRegex = /<changes>[\s\S]*?<\/changes>/;
      const match = fullModelResponse.match(changeBlockRegex);

      let conversationalPart = fullModelResponse;
      let xmlPart = '';

      if (match) {
          xmlPart = match[0];
          // Reconstruct conversational part by removing the XML block, preserving text before and after.
          conversationalPart = fullModelResponse.replace(xmlPart, '').trim();
      }
      
      if (xmlPart) {
        try {
          const trimmedXml = xmlPart.trim();
          // The regex ensures a well-formed block, so we can proceed directly to the parser,
          // which is the definitive test for valid XML.
          
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(trimmedXml, "application/xml");
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
            if (!(change.newContent === '' && !oldFile)) {
                generatedChanges.push(change);
            }
          }
          
          if (generatedChanges.length > 0) {
              proposedChanges = generatedChanges;
          }

        } catch (err) {
          console.error("Failed to parse file changes:", err);
          let errorMessage = "The AI proposed an invalid file change format.";
          if (err instanceof Error) errorMessage += ` Details: ${err.message}`;
          modelMessageError = errorMessage;
        }
      }
      
      // --- 4. Add the final, complete message to the chat history ---
      const finalModelMessage: ChatMessage = {
          role: 'model',
          content: conversationalPart.trim(),
          proposedChanges: proposedChanges,
          error: modelMessageError,
      };
      setChatHistory(prev => [...prev, finalModelMessage]);

    } catch (err) {
      // --- 5. Handle API or other critical errors ---
      console.error("Gemini API error:", err);
      let detail = err instanceof Error ? err.message : "An unexpected error occurred.";
      if (detail.toLowerCase().includes('quota')) {
         detail = "You have exceeded your usage quota (e.g., daily limit). Please check your Google AI Platform plan and billing details.";
      }
      const errorMessage = `Gemini API Error: ${detail}`;
      setChatHistory(prev => [...prev, {role: 'model', content: '', error: errorMessage}]);
    } finally {
      // --- 6. Cleanup ---
      setIsLoading(false);
      stopGenerationRef.current = false;
    }
  }, [isLoading, files, model, chatHistory, fileHistory, longTermMemory]);

  return (
    <main className="flex h-screen w-screen bg-gray-900 text-gray-200">
      <FileExplorer 
        files={files}
        modifiedFiles={modifiedFiles}
        model={model}
        isLoading={isLoading}
        onFileUpload={handleFileUpload} 
        onClearFiles={handleClearFiles}
        onViewFile={handleViewFile}
        onViewDiff={handleViewDiff}
        onAddChatMessage={handleAddChatMessage}
        onAcknowledgeFileChange={handleAcknowledgeFileChange}
        onSummarizeSession={handleSummarizeSession}
        onEditMemory={() => setIsMemoryEditorOpen(true)}
      />
      <div className="flex-1 flex flex-col bg-gray-800/50">
        <ChatInterface 
          chatHistory={chatHistory}
          isLoading={isLoading}
          onPromptSubmit={handlePromptSubmit}
          onApplyChanges={handleApplyChanges}
          onStopGeneration={handleStopGeneration}
        />
      </div>
      <FileViewer
        file={viewingFile}
        onClose={() => setViewingFile(null)}
      />
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
    </main>
  );
}