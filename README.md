# Gemini Cloud CLI

Welcome to Gemini Cloud CLI, a web-based interface designed for collaborative software development with Google's Gemini AI. This tool allows you to upload your entire project folder and interact with your codebase using natural language, making it an powerful partner for coding, refactoring, and analysis.

---

## Core Features

*   **Project Upload:** Upload your entire project folder to provide the AI with full context of your codebase.
*   **Interactive Chat:** Communicate with Gemini to ask questions, request code changes, or generate new features. You can attach files directly to a prompt for one-off questions, stop generation at any time, and see the AI's real-time "thoughts" as it works.
*   **File Management:** The AI can propose creating new files or modifying existing ones. You can review these changes in a user-friendly diff format and apply them with a single click.
*   **Persistent Memory System:** The AI utilizes a two-part memory system stored as files within your project, ensuring context is never lost between sessions if you re-upload the same project.
*   **Chat Export:** Save your entire conversation, including code changes, to a local Markdown file for your records.

---

## Key Concepts: The Memory System

To maintain context and follow specific instructions, the AI relies on two key files that you should place within your project structure.

### 1. Long-Term Memory: `AI_Memory/Gemini.md`

This file acts as the AI's permanent brain. It's the place for global rules, preferences, and instructions that should apply to **all** your interactions.

*   **Purpose:** Store your core development principles.
*   **Examples:**
    *   "Always use TypeScript and functional components for React."
    *   "Follow the official Google Java Style Guide."
    *   "Generate comments in Russian."
*   **How to Use:** Edit this file directly or use the "Edit AI Memory" button in the UI. The AI can also update this file if you explicitly ask it to "remember" something.

### 2. Session Summary (Short-Term Context): `AI_Memory/context.md`

This file is the AI's short-term memory for the **current task**. As your conversation grows, the AI's context window can fill up. The "Context Health" indicator in the chat interface (🟢🟡🔴) shows you when it's time to save a summary. This helps the AI stay focused and prevents it from losing track of the current task.

*   **Purpose:** To summarize the current task, goals, and recent progress, preventing the AI from losing track in long conversations.
*   **How to Use:** When the "Context Health" indicator turns yellow or red, or when you are switching tasks, click the "Save session summary" button. The AI will read the conversation and create a concise summary in this file.

---

## Getting Started: The Step-by-Step Workflow

1.  **Prepare & Upload:** Create a folder named `AI_Memory` in your project. Click **"Upload Project Folder"** and select your project.
2.  **Assign a Task:** Give the AI a complex task, like "Implement a new login form" or "Refactor the user service to use async/await".
3.  **Review the Plan:** The AI will first respond with a numbered plan outlining the steps it will take. It will then execute **only the first step** and present the proposed file changes.
4.  **Apply and Continue (The Core Loop):** This is the most important part of the workflow.
    *   **a. Review:** Look at the proposed changes in the interactive panel below the AI's message.
    *   **b. Apply:** If you are happy with the changes, click the **"Apply Changes"** button. This updates the project's state for the AI's next step.
    *   **c. Confirm:** Reply to the AI with a confirmation like "continue", "next", "proceed", or "продолжай".
5.  **Repeat:** The AI will proceed to the next step in its plan. Repeat the "Apply and Continue" loop until the task is complete.
6.  **Manage Context:** For very long tasks, keep an eye on the "Context Health" indicator. Use the **"Save session summary"** button if it turns yellow or red to keep the AI focused.
7.  **Download Your Files:** Once finished, modified files are highlighted in green in the File Explorer. Hover over them to download the updated versions.
8.  **Export & Clear:** You can export the chat history using the export button or clear the session with the trash can icon to start fresh.

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