# Gemini Cloud CLI

Welcome to Gemini Cloud CLI, a web-based interface designed for collaborative software development with Google's Gemini AI. This tool allows you to upload your entire project folder and interact with your codebase using natural language, making it an powerful partner for coding, refactoring, and analysis.

---

## Core Features

*   **Project Upload:** Upload your entire project folder to provide the AI with full context of your codebase.
*   **Interactive Chat:** Communicate with Gemini to ask questions, request code changes, or generate new features. You can attach files directly to a prompt for one-off questions, stop generation at any time, and see the AI's real-time "thoughts" as it works.
*   **File Management:** The AI can propose creating new files or modifying existing ones. You can review these changes in a user-friendly diff format and apply them with a single click.
*   **Workspaces (Project Snapshots):** Save your entire set of uploaded files as a named "workspace". This allows you to quickly reload a complete project snapshot in a future session. Workspaces are stored securely and reliably in your browser's **IndexedDB**.
*   **Persistent Memory System:** The AI utilizes a two-part memory system stored as files within your project, ensuring context is never lost between sessions.
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
2.  **Upload:** Click the **"Upload Project Folder"** button and select your main project folder. Alternatively, if you have saved a workspace before, select it from the dropdown menu.
3.  **Start Chatting:** Begin a conversation with the AI. You can ask it to review your code, suggest improvements, or implement a new feature. For questions about specific files not in the main project, use the paperclip icon to attach them to your prompt.
4.  **Manage Context:** As the conversation progresses, use the **"Save session summary"** button to keep the AI up-to-date on the current task, especially when the Context Health indicator changes color.
5.  **Apply Changes:** When the AI proposes file modifications, review the diffs presented in the chat and click **"Apply Changes"** to integrate them into your project files.
6.  **Download:** Modified files will be highlighted in the File Explorer. Use the download icon that appears on hover to save them to your local machine.
7.  **Save Your Work:** If you plan to return to this project, click the save icon in the "Workspace" section to save your current file set as a named workspace. Next time you open the app, you can load it instantly from the dropdown menu.
8.  **Export History:** When you're done, you can export the entire chat conversation as a Markdown file using the export button at the top of the chat panel.

---

## Important: Browser Configuration

To ensure the application runs smoothly and reliably, please consider the following configurations for your browser extensions.

### Ad-Blockers (e.g., uBlock Origin)

Aggressive ad-blockers can sometimes interfere with the application's core functionality by blocking requests to necessary services. For uninterrupted operation, it is highly recommended to "whitelist" this application or add the following domains to your ad-blocker's allowlist:

*   `generativelenanguage.googleapis.com`: **(CRITICAL)** This is the domain for the Gemini API. If this is blocked, the AI will not be able to respond to your prompts.
*   `esm.sh`: This is a Content Delivery Network (CDN) used to load essential application libraries like React. If blocked, the application may not load at all.
*   `cdn.tailwindcss.com`: This CDN provides the styling for the user interface. If blocked, the application will work but appear unstyled.

### Browser Storage and URL Consistency

**CRITICAL:** The "Workspaces" feature saves your files in your browser's IndexedDB storage. Due to a browser security feature called the **"Same-Origin Policy"**, this storage is tied to the **exact URL** in your address bar.

*   **Symptom:** If you save a workspace and it seems to have "disappeared" the next time you open the app, it is because you have opened the app using a slightly different URL. For example, navigating through different links within AI Studio (`aistudio.google.com/apps`, `aistudio.google.com/apps?source=user...`) can change the final URL.
*   **Solution:** To ensure your workspaces are always accessible, **you must always use the same, consistent URL to open this application.** We recommend bookmarking the direct link to the application after you open it for the first time and using that bookmark exclusively.

### Container Extensions (e.g., Firefox Multi-Account Containers)

These extensions are excellent for privacy but they work by isolating website data (including saved workspaces in IndexedDB) into separate "containers".

*   **Symptom:** Similar to the URL issue, if you save a workspace in one container and then open the app in a different container (or no container), your workspaces will not be visible.
*   **Solution:** To ensure your workspaces are always available, **always open the application in the same, consistent container**. We recommend creating a dedicated container (e.g., "Development") and configuring it to always open this application's URL.

---

## For Developers

This application is built with:

*   **React** & **TypeScript** for the frontend interface.
*   **TailwindCSS** for styling.
*   **@google/genai** SDK to communicate with the Gemini API.
*   **IndexedDB** for client-side storage of workspaces.

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