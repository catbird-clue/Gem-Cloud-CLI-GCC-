# Gemini Cloud CLI

Welcome to Gemini Cloud CLI, a web-based interface designed for collaborative software development with Google's Gemini AI. This tool allows you to upload your entire project folder and interact with your codebase using natural language, making it an powerful partner for coding, refactoring, and analysis.

**Important Note:** This is a session-only tool. All uploaded files and chat history are stored in memory and will be **permanently lost** if you refresh or close the browser tab.

---

## Core Features

*   **Project Upload:** Upload your entire project folder to provide the AI with full context of your codebase.
*   **Interactive Chat:** Communicate with Gemini to ask questions, request code changes, or generate new features. You can attach files directly to a prompt for one-off questions, stop generation at any time, and see the AI's real-time "thoughts" as it works.
*   **File Management:** The AI can propose creating new files or modifying existing ones. You can review these changes in a user-friendly diff format and apply them with a single click.
*   **Session Summary:** When your conversation gets long, you can use the **"Summarize Session"** button. The AI will generate a summary of the key points and propose it as a change to a file (`AI_Memory/session_summary.md`). Applying this change helps maintain context for long-running tasks.
*   **Chat Export:** Save your entire conversation, including code changes, to a local Markdown file for your records.

---

## Getting Started: The Step-by-Step Workflow

1.  **Upload Project:** Click **"Upload Project Folder"** and select your project. The AI will analyze all files to understand the context.
2.  **Assign a Task:** Give the AI a complex task, like "Implement a new login form" or "Refactor the user service to use async/await".
3.  **Review the Plan:** The AI will first respond with a numbered plan outlining the steps it will take. It will then execute **only the first step** and present the proposed file changes.
4.  **Apply and Continue (The Core Loop):** This is the most important part of the workflow.
    *   **a. Review:** Look at the proposed changes in the interactive panel below the AI's message.
    *   **b. Apply:** If you are happy with the changes, click the **"Apply Changes"** button. This updates the project's state for the AI's next step.
    *   **c. Confirm:** Reply to the AI with a confirmation like "continue", "next", "proceed", or "продолжай".
5.  **Repeat:** The AI will proceed to the next step in its plan. Repeat the "Apply and Continue" loop until the task is complete.
6.  **Download Your Files:** Once finished, modified files are highlighted in green in the File Explorer. Hover over them to download the updated versions.
7.  **Export & Clear:** You can export the chat history using the export button or clear the session with the trash can icon to start fresh. Remember, clearing the session cannot be undone.

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