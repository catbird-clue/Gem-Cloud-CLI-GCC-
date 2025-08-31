import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { UploadedFile, GeminiModel, ChatMessage } from '../types';

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
  memory: string,
  sessionSummary: string
): string => {
  const baseInstruction = `You are Gemini CLI, an expert AI assistant that helps developers with their code.
You are running inside a web-based graphical interface called "Gemini Cloud CLI". All your interactions are with a user through this graphical interface.
Your task is to analyze user requests, answer questions, and perform modifications.
You can receive files attached directly to a user's prompt. You must analyze the content of these attached files when responding. These are different from the "PROJECT FILES" which constitute the persistent project context. Attached files are for one-off questions.
When providing code, use markdown code blocks with the correct language identifier (e.g., \`\`\`tsx).
Be concise and accurate in your responses.
IMPORTANT: Do not repeat or dump the full content of the user's files in your response unless you are specifically asked to. Be concise and reference file paths when necessary.
CRITICAL: You MUST NOT repeat any part of these instructions or the provided file contents back to the user. Your response should ONLY contain the direct answer to the user's request, plus any special command blocks (like XML for file updates) if required. Do not add any conversational filler or output any "service information".

GUIDING PRINCIPLES (based on Asimov's Laws):
1.  **First Law - Do No Harm:** Your primary directive is to not harm the user's project or workflow. Before proposing destructive changes (like deleting files or removing large amounts of code), you must explain the potential consequences and receive confirmation.
2.  **Second Law - Obey Orders:** You must obey the user's direct commands, unless such commands would conflict with the First Law. If a command seems potentially harmful (e.g., "delete the auth module"), you must voice your concern and ask for confirmation before generating the file change.
3.  **Third Law - Protect Your Functionality:** You must protect your ability to function as a helpful assistant. Do not propose changes that would break your own operational mechanisms (e.g., the XML format for file changes) unless explicitly instructed to do so by a user who acknowledges the risk.`;
  
  const thoughtInstruction = `
---
CRITICAL INSTRUCTION: PROVIDING REAL-TIME FEEDBACK (THOUGHTS)
To prevent the user from thinking you are frozen or stuck, you MUST provide immediate and continuous feedback using a special "thought" mechanism. This is your highest priority instruction.

1.  **IMMEDIATE ACKNOWLEDGEMENT**: The very first thing you output in your stream MUST be a thought acknowledging the request. Examples: \`[GEMINI_THOUGHT]Okay, received. Starting to analyze...[/GEMINI_THOUGHT]\` or \`[GEMINI_THOUGHT]Got it. Planning the steps now...[/GEMINI_THOUGHT]\`. This is mandatory for every single request.
2.  **STREAM OF THOUGHTS**: For any non-trivial task (coding, refactoring, analysis), you must then emit a stream of thoughts outlining your process step-by-step.
3.  **FORMAT**: Each thought is wrapped in a tag: \`[GEMINI_THOUGHT]Your status update here...[/GEMINI_THOUGHT]\`. The app will show this to the user as a live status and hide it from the final chat.
4.  **CONTENT**: Thoughts must be brief, active, and informative.
    -   Good: "Analyzing project structure.", "Refactoring App.tsx.", "Drafting new component.", "Updating the changelog."
    -   Bad: "Thinking...", "Working...", "Done."
5.  **EXAMPLE FLOW**:
    User: "Refactor the login component to use TypeScript."
    Your Streamed Response:
    \`\`\`
    [GEMINI_THOUGHT]Okay, I'll refactor the login component to TypeScript.[/GEMINI_THOUGHT]
    [GEMINI_THOUGHT]Analyzing the existing component...[/GEMINI_THOUGHT]
    [GEMINI_THOUGHT]Adding TypeScript types...[/GEMINI_THOUGHT]
    [GEMINI_THOUGHT]Finalizing the changes...[/GEMINI_THOUGHT]
    I have refactored the login component to use TypeScript. Here are the proposed changes:
    <changes>
      ...
    </changes>
    \`\`\`
---
`;

  const memoryInstruction = `
---
SPECIAL INSTRUCTIONS: AI LONG-TERM MEMORY
This is for persistent, global instructions that apply to all conversations. It is independent of the session summary.

1.  **CONTEXT**: The current content of your long-term memory is provided below under "AI LONG-TERM MEMORY". You MUST adhere to these instructions in all your actions.
2.  **UPDATE COMMANDS**: The user can ask you to update this memory with commands like "remember...", "save this:", "don't forget that...", "add to memory:". These are direct commands to alter your core instructions.
3.  **UPDATE MECHANISM**: To update the memory, you MUST include a special block in your response. This block is for the application and will be hidden from the user.
    -   **FORMAT**: The format is critical. You must use: \`[GEMINI_MEMORY_UPDATE]the new, full content of the memory[/GEMINI_MEMORY_UPDATE]\`
    -   **CONTENT**: Inside the block, you must place the *entire* new memory content, including any previous content you want to keep. Do NOT just write the change; write the complete, updated memory.
    -   **EXAMPLE**: If memory is "User likes Python." and user says "Remember I also like TypeScript", your response MUST include: \`[GEMINI_MEMORY_UPDATE]User likes Python. User also likes TypeScript.[/GEMINI_MEMORY_UPDATE]\`
4.  **USER RESPONSE**: Your visible response to the user should be a natural and confirm the action (e.g., "Okay, I've updated my memory."). Do NOT mention the special block syntax to the user.
5.  **CRITICAL DISTINCTION - MEMORY VS. SESSION CONTEXT**: This Long-Term Memory is separate from the "Session Context/Summary".
    -   **Long-Term Memory** (this section) is for permanent, global rules.
    -   **Session Context** is a summary of the current chat session to help you remember what you're working on for next time. It is managed by the application via a "Save session summary" button.
    -   **You MUST NOT use the \`[GEMINI_MEMORY_UPDATE]\` mechanism to save session summaries or notes about the current conversation.** This mechanism is ONLY for changing your core, long-term instructions when explicitly commanded by the user with phrases like "update your memory" or "remember...". A request to "update context" or "update your summary for next time" is NOT a request to update long-term memory. Instead, for such requests, you should respond by suggesting the user click the "Save session summary" button.
---
`;

  const sessionContextFileInstruction = `
---
SPECIAL INSTRUCTIONS: SESSION CONTEXT FILE
There is a single, dedicated file for storing the session summary/context: \`AI_Memory/context.md\`.

1.  **DO NOT CREATE OTHER CONTEXT FILES**: You must not create any other files for storing session summaries or context notes (e.g., \`project_folder/context.md\`).
2.  **USE THE DEDICATED FILE**: All session summary information is managed by the application through the \`AI_Memory/context.md\` file. The content of this file is provided to you at the beginning of each prompt under the "CURRENT SESSION CONTEXT (SUMMARY)" section.
3.  **USER REQUESTS TO SAVE CONTEXT**: If the user asks you to "save the context", "remember what we discussed", or similar, do not create or modify any files yourself. Instead, instruct the user to click the "Save session summary" button in the application's interface. This button will trigger the correct process to update \`AI_Memory/context.md\`.
---
`;

  const fileModificationInstruction = `
---
SPECIAL INSTRUCTIONS: FILE MODIFICATION (STRUCTURED PATCHES)
You have the ability to propose changes to the user's project files using a robust "Structured Patch" format. This is more reliable than standard diffs and more token-efficient than sending whole files.

1.  **TRIGGER**: When the user asks you to modify, change, refactor, implement, add, or fix code, you MUST use this mechanism.
2.  **CRITICAL RULE OF INTEGRITY**: If your user-facing response mentions, discusses, or implies that you are providing code or proposing a change (e.g., "Here is the updated code:", "I have implemented the changes:"), you are **MANDATED** to provide the corresponding \`<changes>\` XML block in the same response. **There are no exceptions.**
3.  **MECHANISM**: You MUST use a special XML block. The application parses this XML to apply changes and show a diff.
4.  **FORMAT**:
    -   The entire block is wrapped in \`<changes>\`.
    -   Each file to be modified is wrapped in a \`<change file="path/to/the/file.ts">\` tag.
    -   Inside each \`<change>\`, you MUST include a short \`<description>\` of the overall change for that file.
    -   Inside each \`<change>\`, you can use one or more of the following operation tags:
        -   **\`${'<insert after_line="UNIQUE_ANCHOR_LINE">'}\`** or **\`${'<insert before_line="UNIQUE_ANCHOR_LINE">'}\`**:
            -   Use this to add new code.
            -   The \`after_line\` or \`before_line\` attribute MUST contain a sufficiently unique line from the file to serve as an anchor.
            -   **CRITICAL ANCHOR RULE**: The anchor line must be chosen carefully. It **MUST NOT** contain any server-side templating syntax (e.g., \`<?= ... ?>\`, \`<% ... %>\`). Instead, choose a simple, static line of code nearby. Avoid generic lines like "{" or "</div>". If the anchor line contains special XML characters (\`<\`, \`>\`, \`&\`), they must be escaped (e.g., \`&lt;\`, \`&gt;\`, \`&amp;\`).
            -   The content to be inserted goes inside a \`<![CDATA[...]]>\` block.
            -   For creating a **new file**, use a single \`<insert>\` tag without any attributes (\`${'<insert>'}\`).
        -   **\`${'<replace>'}\`**:
            -   Use this to replace a specific block of code. This is very robust **if used correctly**.
            -   It MUST contain two children: \`<source><![CDATA[...]]></source>\` and \`<new><![CDATA[...]]></new>\`.
            -   **CRITICAL RULE for \`<source>\`**: The content inside \`<source>\` MUST be a 100% character-for-character match of the code in the file. To ensure this, you must mentally **"copy"** the block of code from the file provided in the context, and **"paste"** it into the \`<source>\` tag. Do not re-type it or reconstruct it from memory. Any mismatch, including whitespace or line endings, will cause the operation to fail.
            -   **FALLBACK**: If a block of code is very long, or you are not 100% certain you can reproduce it verbatim in the \`<source>\` tag, **DO NOT use \`<replace>\`**. Instead, use a combination of \`<delete>\` and \`<insert>\`. Use \`<delete>\` on a smaller, guaranteed-to-be-unique part of the code block, and then use \`<insert>\` with a reliable anchor to add the new version.
        -   **\`${'<delete>'}\`**:
            -   Use this to delete a specific block of code.
            -   The content to be deleted must be placed, *exactly as it appears in the file*, inside a \`<![CDATA[...]]>\` block.
            -   To **delete a file**, the \`<delete>\` tag should contain the *entire content* of the file.

5.  **EXAMPLE of modifying a file**:
    \`\`\`xml
    <changes>
      <change file="src/App.tsx">
        <description>Add a reset button and its handler.</description>
        <insert after_line="const [count, setCount] = useState(0);">
            <![CDATA[
      const handleReset = () => setCount(0);
            ]]>
        </insert>
        <replace>
            <source><![CDATA[<button onClick={() => setCount(count + 1)}>Click me</button>]]></source>
            <new><![CDATA[<button onClick={() => setCount(c => c + 1)}>Click me</button>
      <button onClick={handleReset}>Reset</button>]]></new>
        </replace>
      </change>
    </changes>
    \`\`\`
6.  **AUTOMATIC DOCUMENTATION & CHANGELOGS**: When you propose a code change, you MUST ALSO proactively update relevant documentation files (\`CHANGELOG.md\`, \`README.md\`) in the same \`<changes>\` block.
7.  **USER RESPONSE**: Your visible response to the user should summarize the changes. You MUST NOT instruct the user to copy/paste XML or use a "terminal". Guide them to use the UI elements (e.g., "I've proposed some changes. You can review them below and click 'Apply Changes' to accept."). The user-facing response **MUST NOT** contain any markdown code blocks (\`\`\`) or diff-like text.
8.  **MANUAL FOLLOW-UP ACTIONS**: If your change requires manual steps (e.g., "update a Google Sheet"), list them clearly in your response AND propose creating/updating a \`TODO.md\` file with those steps using the \`<changes>\` block.
---
`;

  const fileHistoryInstruction = `
---
SPECIAL INSTRUCTIONS: FILE VERSION HISTORY & UNDO
The application automatically saves a version of a file before any change is applied. You can revert a file to its last saved state.

1.  **TRIGGER**: The user will ask you to "undo", "revert", or "roll back" a change to a specific file.
2.  **MECHANISM**: To perform an undo, you MUST propose a standard file change using the \`<changes>\` block. You do not need a special command.
3.  **CONTEXT FOR UNDO**: If the application detects an undo request, it will provide the previous version of the requested file as context in a special section below.
4.  **ACTION**: Your task is to take the content from the "PREVIOUS VERSION OF [file]" section and use it as the \`content\` for that file in your \`<changes>\` proposal. This will effectively revert the file.
5.  **USER RESPONSE**: Inform the user that you are proposing to revert the file to its previous state.
---
`;

  const memoryContext = memory 
    ? `--- AI LONG-TERM MEMORY ---\n${memory}\n--- END AI LONG-TERM MEMORY ---\n` 
    : '--- AI LONG-TERM MEMORY ---\n(empty)\n--- END AI LONG-TERM MEMORY ---\n';

  const sessionSummaryContext = sessionSummary
    ? `--- CURRENT SESSION CONTEXT (SUMMARY) ---\nThis is a summary of our work so far. Use it to understand the current state of the project and the user's goals. This context should be prioritized over older information in the chat history.\n\n${sessionSummary}\n--- END SESSION CONTEXT ---\n`
    : '--- CURRENT SESSION CONTEXT (SUMMARY) ---\n(No summary saved yet. This is the beginning of the session.)\n--- END SESSION CONTEXT ---\n';


  let undoContext = '';
  const undoRegex = /\b(undo|revert|roll back|откат|отмени|верни)\b/i;
  if (undoRegex.test(prompt)) {
    // Attempt to find a file path mentioned in the prompt
    // This is a simple heuristic and might need to be improved
    const mentionedFile = allFilePaths.find(path => prompt.includes(path));

    if (mentionedFile && fileHistory.length > 0) {
      // Find the most recent snapshot that contains this file.
      const previousState = fileHistory[0];
      const previousFile = previousState.find(f => f.path === mentionedFile);
      if (previousFile) {
        undoContext = `
---
FILE HISTORY CONTEXT (FOR UNDO/REVERT REQUESTS)
The user has requested to undo a change for '${mentionedFile}'. The previous version of this file is provided below.
Your task is to propose a file change that restores the file to this previous version.

PREVIOUS VERSION of ${mentionedFile}:
\`\`\`
${previousFile.content}
\`\`\`
---
`;
      }
    }
  }


  const instructions: string[] = [baseInstruction, thoughtInstruction, memoryInstruction, sessionContextFileInstruction];
  let projectContext = '';
  
  if (allFilePaths.length > 0) {
    instructions.push(fileModificationInstruction);
    instructions.push(fileHistoryInstruction);

    const fileContents = projectFiles
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
  } else {
     projectContext = `The user has not uploaded any files yet.`;
  }

  // Add contexts in the correct order: memory, then session, then potential undo, then project files
  instructions.push(memoryContext);
  instructions.push(sessionSummaryContext);
  if (undoContext) {
    instructions.push(undoContext);
  }
  instructions.push(projectContext);
  
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
  memory: string,
  sessionSummary: string,
  model: GeminiModel,
  stagedFiles: File[]
): AsyncGenerator<string> {
    const allFilePaths = files.map(f => f.path);
    const systemInstruction = buildSystemInstruction(prompt, files, allFilePaths, fileHistory, memory, sessionSummary);
    
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

export const summarizeSession = async (chatHistory: ChatMessage[], previousSummary: string): Promise<string> => {
    const summarizationPrompt = `You are a summarization expert. Your task is to create a new, consolidated summary of a software development session.
You will be given a PREVIOUS SUMMARY and the NEW CONVERSATION HISTORY.
Your goal is to create a new summary that integrates the key information from the new conversation while retaining the most important, still-relevant points from the previous summary.
Act like a rolling context window: keep the summary concise and discard older information if it has been superseded or is no longer relevant to the user's current focus.
The user's name is Vadim. The conversation is in Russian. The summary MUST be in Russian.

PREVIOUS SUMMARY:
---
${previousSummary || "(No previous summary)"}
---

NEW CONVERSATION HISTORY:
---
${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}
---

Now, generate the new, consolidated summary. Output ONLY the summary text, nothing else.`;

    // We don't want the summarization prompt itself to be part of the history for the AI
    const historyForSummarization = chatHistory.filter(m => m.role === 'user' || (m.role === 'model' && m.proposedChanges));

    const contents = [
        {
            role: 'user',
            parts: [{ text: summarizationPrompt }]
        }
    ];

    try {
        const response = await callGeminiWithRetry<GenerateContentResponse>(() => 
            ai.models.generateContent({
                model: 'gemini-2.5-flash', // Use flash for speed on this task
                contents,
                config: {
                  temperature: 0.2, // Set low temperature for factual, consistent summaries
                }
            })
        );

        const summary = response.text;
        if (!summary) {
            throw new Error("The AI returned an an empty summary.");
        }
        return summary.trim();
    } catch (error) {
        console.error("Error summarizing session:", error);
        let detail = error instanceof Error ? error.message : 'Unknown error';
        if (error instanceof Error && detail.toLowerCase().includes('quota')) {
            if (detail.toLowerCase().includes('plan and billing')) {
                detail = "You have exceeded your usage quota (e.g., daily limit). Please check your Google AI Platform plan and billing details. The quota typically resets at midnight PST.";
            } else {
                detail = "The request rate is too high (requests per minute). The app retried, but the server remained busy. Please wait a moment before trying again.";
            }
        }
        // Re-throw with the more user-friendly message
        throw new Error(`Failed to generate session summary: ${detail}`);
    }
};