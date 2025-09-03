# Gemini Cloud CLI

Welcome to Gemini Cloud CLI, a web-based interface designed for collaborative software development with Google's Gemini AI. This tool allows you to upload your entire project folder and interact with your codebase using natural language, making it an powerful partner for coding, refactoring, and analysis.

**Important Note:** This is a session-only tool. All uploaded files and chat history are stored in memory and will be **permanently lost** if you refresh or close the browser tab.

---

## Core Features

*   **Project Upload:** Upload your entire project folder to provide the AI with full context of your codebase.
*   **Interactive Chat:** Communicate with Gemini to ask questions, request code changes, or generate new features. You can attach files directly to a prompt for one-off questions and stop generation at any time.
*   **File Management:** The AI can propose creating new files or modifying existing ones. You can review these changes in a user-friendly diff format and apply them with a single click.
*   **Chat Export:** Save your entire conversation, including code changes, to a local Markdown file for your records.

---

## The Workflow: Maintaining Context Between Sessions

This is a session-only tool, but you can easily carry your work across multiple sessions using the summary feature.

1.  **Work in a Session:** Upload your project and work with the AI as usual.
2.  **Generate Summary:** At the end of a session, click the **"Summarize Session"** button (the document icon in the File Explorer).
3.  **Review and Save:** The AI will generate a summary of your conversation and propose saving it to a file (usually `AI_Memory/session_summary.md`). This will appear as a new message in the chat. Review the proposed change and click **"Apply Changes"** to save it to your project.
4.  **Download Your Work:** Download the new summary file and any other modified files from the File Explorer.
5.  **Continue Later:** To continue your work in a new session, simply upload your project folder again, making sure it includes the `AI_Memory/session_summary.md` file. The AI will read the summary and be fully up-to-date on your project's history and goals.

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