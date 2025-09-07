import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { UploadedFile, GeminiModel, ChatMessage, ProposedChange } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("The API_KEY environment variable is not set. Please ensure it is configured in your deployment environment.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Define explicit types for Gemini content structure to prevent type inference issues.
type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type ModelContent = { role: string; parts: ContentPart[] };

/**
 * A wrapper for Gemini API calls that includes retry logic with exponential backoff
 * for "quota exceeded" errors.
 * @param apiCall The async function to call the Gemini API.
 * @returns The result of the API call.
 */
const callGeminiWithRetry = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    const maxRetries = 3;
    let delay = 1000; // start with 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (e) {
            const error = e as Error;
            // The user reported "QuotaExceededError". We check for "quota" as a robust way to catch it.
            if (error.message?.toLowerCase().includes('quota')) {
                if (attempt === maxRetries - 1) {
                  // On the last attempt, re-throw the original error to be handled by the UI.
                  console.error(`Gemini API call failed after ${maxRetries} attempts due to quota limits.`);
                  throw e;
                }
                console.warn(`Quota exceeded. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // exponential backoff
            } else {
                throw e; // re-throw other errors immediately
            }
        }
    }
    // This line should not be reachable due to the logic above, but it satisfies TypeScript's need for a return path.
    throw new Error("Gemini API call failed after multiple retries.");
};

const buildSystemInstruction = (
  prompt: string,
  projectFiles: UploadedFile[],
  allFilePaths: string[],
  fileHistory: UploadedFile[][],
  longTermMemory: string
): string => {
  const ironLawAndBaseInstructions = `You are Gemini CLI, an expert AI assistant. Your purpose is to modify files based on user requests. The following rules are your absolute, non-negotiable core function. Failure to follow them perfectly breaks the application.

# IRON LAW OF CODE OUTPUT

1.  **THE GOLDEN RULE:** If your conversational response implies a code change (e.g., "I've updated the file," "Here is the fix," "я внес изменения"), you **MUST** provide the corresponding code in a \`<changes>\` XML block in the SAME response. NO EXCEPTIONS. Talking about code without providing the XML is a critical failure.

2.  **XML IS THE ONLY WAY:** All file creations, updates, and deletions **MUST** be inside a single, perfectly-formed \`<changes>\` block.

3.  **NO CODE IN CHAT:** You are **STRICTLY FORBIDDEN** from putting any code or diffs in your conversational text. Do not use markdown code blocks (\`\`\`). All code belongs in the XML block.

## The Required XML Format
\`\`\`xml
<changes>
  <change file="path/to/your/file.ext">
    <content><![CDATA[The *ENTIRE* new content of the file goes here. Not a diff. Not a snippet. The full file.]]></content>
  </change>
  <change file="path/to/delete.ext">
    <content><![CDATA[]]></content> <!-- An empty CDATA block means DELETE the file. -->
  </change>
</changes>
\`\`\`

**Final reminders on format:**
- Follow the example precisely.
- Do not add extra tags like \`<description>\` inside a \`<change>\` block.
- The user can see a diff in the UI, so do not describe your code changes in your conversational response. Just give a brief confirmation like "Done." or "I've made the changes."

---
**General Behavior:**
- You can receive files attached to a user's prompt. Analyze them; they are separate from the main "PROJECT FILES".
- Be concise and accurate. Do not repeat instructions or file content back to the user.
---
`;

  const guidingPrinciples = `
---
GUIDING PRINCIPLES:
1.  **Do No Harm:** Before proposing destructive changes (like deleting files or removing large blocks of code), you must explain the potential consequences and ask the user for confirmation.
2.  **Obey Orders:** You must obey the user's direct commands, unless they conflict with the "Do No Harm" principle.
3.  **Guide the User**: When you provide file changes, your text should be brief and guide the user to the UI. For example: "I've made the requested changes. Please review them in the panel below." DO NOT describe the code changes in your text; the UI's diff viewer handles that.
---
`;

  let memoryContext = '';
  if (longTermMemory.trim()) {
    memoryContext = `
---
USER'S LONG-TERM MEMORY (PERSISTENT DIRECTIVES)
These are overarching rules provided by the user that you MUST follow in all subsequent responses. They have the highest priority after your core operational instructions.

${longTermMemory}
---
`;
  }

  let undoContext = '';
  const undoRegex = /\b(undo|revert|roll back|откат|отмени|верни)\b/i;
  if (undoRegex.test(prompt)) {
    const mentionedFile = allFilePaths.find(path => prompt.includes(path));

    if (mentionedFile && fileHistory.length > 0) {
      const previousState = fileHistory[0];
      const previousFile = previousState.find(f => f.path === mentionedFile);
      if (previousFile) {
        undoContext = `
---
FILE HISTORY CONTEXT (FOR UNDO/REVERT REQUESTS)
The user has requested to undo a change for '${mentionedFile}'. The previous version of this file is provided below.
Your task is to propose a file change that restores the file to this previous version using the Full Content method.

PREVIOUS VERSION of ${mentionedFile}:
\`\`\`
${previousFile.content}
\`\`\`
---
`;
      }
    }
  }

  const instructions: string[] = [ironLawAndBaseInstructions];

  let sessionSummaryContext = '';
  let projectContext = '';
  
  if (allFilePaths.length > 0) {
    instructions.push(guidingPrinciples);

    const summaryFiles = projectFiles.filter(f => f.path.endsWith('session_summary.md'));
    const otherFiles = projectFiles.filter(f => !f.path.endsWith('session_summary.md'));
    
    if (summaryFiles.length > 0) {
        const summaryContents = summaryFiles
            .map(file => `--- SESSION SUMMARY FILE: ${file.path} ---\n${file.content}\n--- END SUMMARY FILE: ${file.path} ---`)
            .join('\n\n');
        
        sessionSummaryContext = `
---
SESSION SUMMARY CONTEXT:
The following is a summary of the previous work session. Use this to understand the history and goals before analyzing the current project files.
${summaryContents}
---
`;
    }

    if (otherFiles.length > 0) {
        const fileContents = otherFiles
          .map(file => `--- FILE: ${file.path} ---\n${file.content}\n--- END FILE: ${file.path} ---`)
          .join('\n\n');
        
        projectContext = `
---
PROJECT CONTEXT:
You have been provided with the full content of all files in the user's project.
Analyze them carefully to understand the project's structure, dependencies, and style before making any changes.
Any modifications you propose MUST be consistent with the existing codebase and architecture.

PROJECT FILES PROVIDED:
${fileContents}
`;
    }
  } else {
     projectContext = `The user has not uploaded any files yet.`;
  }

  // Add contexts in the correct order of priority
  if (memoryContext) {
    instructions.push(memoryContext);
  }
  if (undoContext) {
    instructions.push(undoContext);
  }
  if (sessionSummaryContext) {
    instructions.push(sessionSummaryContext);
  }
  if (projectContext) {
      instructions.push(projectContext);
  }
  
  return instructions.join('\n');
};

const fileToGenerativePart = async (file: File): Promise<ContentPart> => {
    const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            mimeType: file.type || 'text/plain',
            data: base64,
        },
    };
};

export const streamChatResponse = async function* (
  prompt: string,
  chatHistory: ChatMessage[],
  files: UploadedFile[],
  fileHistory: UploadedFile[][],
  model: GeminiModel,
  stagedFiles: File[],
  longTermMemory: string
): AsyncGenerator<string> {
    const allFilePaths = files.map(f => f.path);
    const systemInstruction = buildSystemInstruction(prompt, files, allFilePaths, fileHistory, longTermMemory);
    
    // Use the explicit ModelContent[] type to ensure the array can hold mixed part types later.
    const contents: ModelContent[] = chatHistory.slice(0, -1).map(message => ({
        role: message.role,
        parts: [{ text: message.content }]
    }));
    
    const lastMessage = chatHistory[chatHistory.length - 1];

    const userMessageParts: ContentPart[] = [{ text: lastMessage.content }];
    if (stagedFiles && stagedFiles.length > 0) {
      const fileParts = await Promise.all(stagedFiles.map(fileToGenerativePart));
      userMessageParts.push(...fileParts);
    }
    
    contents.push({ role: 'user', parts: userMessageParts });

    const responseStream = await callGeminiWithRetry<AsyncGenerator<GenerateContentResponse>>(() => 
      ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature: 0.8, // Set temperature for more creative/varied responses
        }
      })
    );

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
};

export const generateContextResponse = async (
  chatHistory: ChatMessage[],
  files: UploadedFile[],
  summaryFilePath: string
): Promise<ProposedChange> => {
  const systemInstruction = `You are an expert summarizer. Your task is to summarize the provided chat history into a concise, well-structured markdown document.
Focus on key decisions, important code snippets, file changes, and unresolved questions. The user will use this summary to restore context in a future session.
Be thorough but not overly verbose. Use headings and bullet points for clarity.`;

  const historyText = chatHistory
    .map(msg => `**${msg.role === 'user' ? 'User' : 'Gemini'}:**\n${msg.content || ''}${msg.warning ? `\n*[Warning: ${msg.warning}]*` : ''}${msg.error ? `\n*[Error: ${msg.error}]*` : ''}`)
    .join('\n\n---\n\n');
  
  const contents = `${historyText}`;

  const response = await callGeminiWithRetry<GenerateContentResponse>(() =>
    ai.models.generateContent({
      model: 'gemini-2.5-flash', // Use a fast model for summarization
      contents,
      config: {
        systemInstruction,
        temperature: 0.5,
      }
    })
  );

  const summaryContent = response.text.trim();

  const existingFile = files.find(f => f.path === summaryFilePath);
  const oldContent = existingFile?.content ?? '';
  
  const change: ProposedChange = {
    filePath: summaryFilePath,
    oldContent: oldContent,
    newContent: summaryContent,
  };

  return change;
};