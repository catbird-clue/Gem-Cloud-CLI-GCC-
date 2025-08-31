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

## Getting Started: Typical Workflow

1.  **Prepare Your Project:** Create a folder named `AI_Memory` inside your project directory.
2.  **Upload:** Click the **"Upload Project Folder"** button and select your main project folder.
3.  **Start Chatting:** Begin a conversation with the AI. You can ask it to review your code, suggest improvements, or implement a new feature. For questions about specific files not in the main project, use the paperclip icon to attach them to your prompt.
4.  **Manage Context:** As the conversation progresses, use the **"Save session summary"** button to keep the AI up-to-date on the current task, especially when the Context Health indicator changes color.
5.  **Apply Changes:** When the AI proposes file modifications, review the diffs presented in the chat and click **"Apply Changes"** to integrate them into your project files.
6.  **Download:** Modified files will be highlighted in the File Explorer. Use the download icon that appears on hover to save them to your local machine.
7.  **Export History:** When you're done, you can export the entire chat conversation as a Markdown file using the export button at the top of the chat panel.
8.  **Clear Session:** To start over, click the trash can icon in the File Explorer header to clear all files and reset the application.

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
        <description>A new React component.</description>
        <content><![CDATA[import React from 'react';

    const NewComponent = () => {
      return <div>Hello, World!</div>;
    };

    export default NewComponent;]]></content>
      </change>
      <change file="src/api.js">
        <description>Update the API endpoint.</description>
        <content><![CDATA[// New API endpoint
    const API_ENDPOINT = 'https://api.example.com/v2';

    export { API_ENDPOINT };]]></content>
      </change>
    </changes>
    ```