# Gemini Cloud CLI

Welcome to Gemini Cloud CLI, a web-based, AI-powered development environment. This tool allows you to upload your entire project folder and interact with your codebase using natural language, making Gemini an intelligent partner for coding, refactoring, debugging, and analysis.

**Important Note:** This is a session-only tool. All uploaded files and chat history are stored in browser memory and will be **permanently lost** if you refresh or close the tab. Use the "Generate Context" and "Export Chat" features to save your work.

---

## Core Features

This application is more than just a chatbot; it's an integrated environment with a range of features designed for professional developers:

*   **Full Project Context:** Upload your entire project folder. The AI analyzes all your files to understand the architecture, dependencies, and coding style before making any suggestions.

*   **Advanced Chat Interaction:**
    *   **Natural Language Prompting:** Request new features, ask for refactors, or debug issues conversationally.
    *   **File Attachments:** Attach files directly to a prompt for one-off questions or to provide specific context.
    *   **Stoppable Generation:** Interrupt the AI at any time with a "Stop" button.
    *   **Command History:** Navigate through your past prompts using the arrow keys.

*   **AI-Powered File Modifications:**
    *   **Interactive Diffs:** The AI proposes all file creations, updates, and deletions as rich, interactive diff previews directly in the chat.
    *   **One-Click Actions:** Instantly **Apply** or **Reject** an entire set of proposed changes with a single click.
    *   **Proposal Saving:** Save any AI proposal (including your prompt, the AI's response, and the code diff) to a local Markdown file for archiving, sharing, or external review.

*   **State Management & Version Control:**
    *   **File History:** The application automatically tracks changes to your files within the session.
    *   **Visual Diff Viewer:** Open a full-screen, side-by-side diff view for any modified file to compare it with its previous version.
    *   **Revert Changes:** Made a mistake or applied a change you didn't like? Easily revert any file to its previous state directly from the diff viewer.

*   **Persistent AI Memory & Session Context:**
    *   **Long-Term Memory:** Edit a dedicated `AI_Memory/GEMINI.md` file to provide the AI with persistent instructions, rules, and context that apply to *every* prompt.
    *   **Context Summarization:** At the end of a session, use the "Generate Context" feature to have the AI create a `session_summary.md` file. This summary captures the key decisions and outcomes of your conversation.

*   **Safety & Stability:**
    *   **Context Health Indicator:** A visual gauge tracks conversation length and warns you when the context window is nearing its limit, preventing unexpected behavior from the AI.
    *   **AI Self-Correction:** The application includes a robust safety layer that detects when the AI violates its core instructions (e.g., providing malformed code, forgetting to provide code after promising it) and automatically forces it to correct its own mistake.

---

## The Workflow: Maintaining Context Between Sessions

This is a session-only tool, but you can easily carry your work across multiple sessions using the built-in context management features.

1.  **Configure Memory:** (Optional) Before starting, open the **Memory Editor** (brain icon) and add any high-level, persistent instructions for the AI in the `AI_Memory/GEMINI.md` file.
2.  **Work in a Session:** Upload your project and work with the AI as usual.
3.  **Generate Context:** At the end of a session, click the **"Generate Context"** button (document icon) in the File Explorer.
4.  **Review and Save:** The AI will generate a summary of your conversation. This will appear as a proposed change to a `session_summary.md` file. Review the proposal and click **"Apply Changes"** to save it.
5.  **Download Your Work:** Use the download buttons in the File Explorer to save any modified files, including the `session_summary.md` and your `AI_Memory/GEMINI.md` file.
6.  **Continue Later:** To continue your work in a new session, simply upload your project folder again, making sure it includes the `session_summary.md` and `AI_Memory/GEMINI.md` files. The AI will read them and be fully up-to-date on your project's history and your custom rules.

---

## Important: Browser Configuration

To ensure the application runs smoothly and reliably, please consider the following configurations for your browser extensions.

### Ad-Blockers (e.g., uBlock Origin)

Aggressive ad-blockers can sometimes interfere with the application's core functionality by blocking requests to necessary services. For uninterrupted operation, it is highly recommended to "whitelist" this application or add the following domains to your ad-blocker's allowlist:

*   `generativelenanguage.googleapis.com`: **(CRITICAL)** This is the domain for the Gemini API. If this is blocked, the AI will not be able to respond to your prompts.
*   `esm.sh`: This is a Content Delivery Network (CDN) used to load essential application libraries like React. If blocked, the application may not load at all.
*   `cdn.tailwindcss.com`: This CDN provides the styling for the user interface. If blocked, the application will work but appear unstyled.

---

## For Developers

This application is built with:

*   **React** & **TypeScript** for the frontend interface.
*   **TailwindCSS** for styling.
*   **@google/genai** SDK to communicate with the Gemini API.

The application is a single-page app with no backend or build process. All code is contained within `index.html` and `index.tsx`. The AI's instructions, which dictate its behavior (including the file modification format), are located in `services/geminiService.ts`.

### File Modification Mechanism: Full Content Replacement

To ensure maximum reliability, the AI proposes file changes using a simple and robust "Full Content" XML format. This is more reliable than a standard `diff` patch because it eliminates any ambiguity about where a change should be applied.

-   **Wrapper:** All changes are contained within a `<changes>` block. Each individual file modification is wrapped in a `<change file="...">` block, where `file` specifies the path.
-   **Operation:** To modify a file or create a new one, the AI provides a single `<content>` tag inside the `<change>` block.
    -   **`<content>`**: This tag MUST contain the **ENTIRE, NEW, FINAL CONTENT** of the file, wrapped in a `<![CDATA[...]]>` block.
-   **File Creation:** To create a new file, the AI provides the new path in the `file` attribute and includes the complete content of the new file inside the `<content>` tag.
-   **File Deletion:** To delete a file, the AI provides the file's path and an **empty** `<content>` tag (i.e., `<content><![CDATA[]]></content>`).

-   **Example of creating/modifying a file**:
    ```xml
    <changes>
      <change file="src/NewComponent.tsx">
        <content><![CDATA[import React from 'react';

    const NewComponent = () => {
      return <div>Hello, World!</div>;
    };

    export default NewComponent;]]></content>
      </change>
      <change file="src/api.js">
        <content><![CDATA[// New API endpoint
    const API_ENDPOINT = 'https://api.example.com/v2';

    export { API_ENDPOINT };]]></content>
      </change>
    </changes>
    ```