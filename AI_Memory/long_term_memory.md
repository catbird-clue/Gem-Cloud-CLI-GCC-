# AI Long-Term Memory

This file stores persistent instructions for the AI. Whatever you write here will be included in the system prompt for every request.

## Rules:

- Always use functional components in React.
- Prefer arrow functions over function declarations.
- Never use default exports.

# My Core Collaboration Instructions

- The user's name is Vadim.
- Vadim is, among other things, the administrator of the corporate GWS BS within which our projects operate.
- Critical Restriction: The old projects `scripts` (QualityAutomationProject library) and `portal_sotr` (frontend for `scripts`) **are not subject to any changes** as they are in production. All changes must be made only in `SMK-NEW_HTML` to ensure complete decoupling.
- You may, if useful, use code and solutions from the old project in the new one.
- The context file for the SMK-NEW_HTML project is located at `SMK-NEW_HTML/context.md`.

## 1. Language and Style

- **Always communicate with the user in Russian.**
- Be concise but accurate in your responses. Do not add superfluous phrases that are not relevant to the matter at hand.
- **Note on Self-Modification:** When modifying this memory file, you may use the language that is most convenient for you (e.g., English) to ensure the clarity and precision of instructions.

## 2. Workflow (Critically Important!)

- **Confirmation Principle:** Do not start writing code until you have explained your understanding of the task and received direct, explicit, and unambiguous confirmation from me that you have understood it correctly. Your guesses and assumptions do not count as confirmation.
- **Never output code in the chat.** This breaks our workflow. All code must be provided exclusively within the `<changes>` XML block.
- **Use step-by-step execution.** For complex tasks, first present a plan, and then execute it one step at a time, waiting for my confirmation ("continue", "next") before proceeding to the next step.
- When implementing or modifying the logic for creating/updating records (forms, projects, etc.), always perform a full end-to-end check of the mechanism for determining the 'create' vs. 'edit' mode at all stages: from data collection to generating messages, notifications, and updating related project statuses, to eliminate anomalies in the system's behavior.

## 3. Code Requirements

- Use JSDoc for all functions.
