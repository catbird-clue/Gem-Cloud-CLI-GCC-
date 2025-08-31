# Gemini Cloud CLI

Welcome to Gemini Cloud CLI, a web-based interface designed for collaborative software development with Google's Gemini AI. This tool allows you to upload your entire project folder and interact with your codebase using natural language, making it an powerful partner for coding, refactoring, and analysis.

---

## Core Features

*   **Project Upload:** Upload your entire project folder to provide the AI with full context of your codebase.
*   **Interactive Chat:** Communicate with Gemini to ask questions, request code changes, refactor components, or generate new features.
*   **File Management:** The AI can propose changes directly to your files. You can review these changes in a user-friendly diff format and apply them with a single click.
*   **Workspaces (Project Snapshots):** Save your entire set of uploaded files as a named "workspace". This allows you to quickly reload a complete project snapshot in a future session with a single click. Workspaces are stored securely and reliably in your browser's **IndexedDB**, a robust database designed for this purpose (it is **not** the less reliable Local Storage).
*   **Persistent Memory System:** The AI utilizes a two-part memory system stored as files within your project, ensuring context is never lost between sessions.

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

This file is the AI's short-term memory for the **current task**. As your conversation grows, the AI's context window can fill up. Saving a session summary helps the AI stay focused.

*   **Purpose:** To summarize the current task, goals, and recent progress, preventing the AI from losing track in long conversations.
*   **How to Use:** When the "Context Health" indicator in the chat turns yellow or red, or when you are switching tasks, click the "Save session summary" button. The AI will read the conversation and create a concise summary in this file.

---

## Getting Started: Typical Workflow

1.  **Prepare Your Project:** Create a folder named `AI_Memory` inside your project directory.
2.  **Upload:** Click the **"Upload Project Folder"** button and select your main project folder. Alternatively, if you have saved a workspace before, select it from the dropdown menu.
3.  **Start Chatting:** Begin a conversation with the AI. You can ask it to review your code, suggest improvements, or implement a new feature.
4.  **Manage Context:** As the conversation progresses, use the **"Save session summary"** button to keep the AI up-to-date on the current task.
5.  **Apply Changes:** When the AI proposes file modifications, review the diffs presented in the chat and click **"Apply Changes"** to integrate them into your project files.
6.  **Download:** Modified files will be highlighted in the File Explorer. Use the download icon to save them to your local machine.
7.  **Save Your Work:** If you plan to return to this project, click the save icon in the "Workspace" section to save your current file set as a named workspace. Next time you open the app, you can load it instantly from the dropdown menu.

---

## For Developers

This application is built with:

*   **React** & **TypeScript** for the frontend interface.
*   **TailwindCSS** for styling.
*   **@google/genai** SDK to communicate with the Gemini API.
*   **IndexedDB** for client-side storage of workspaces.

The application is a single-page app with no backend or build process. All code is contained within `index.html` and `index.tsx`.