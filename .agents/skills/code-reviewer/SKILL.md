---
name: code-reviewer
description: Expert code reviewer specializing in architectural integrity, readability, and maintainability. Use when code needs auditing for clean patterns, consistency, and alignment with engineering standards.
---

# Code Reviewer Skill

Guidance for performing deep architectural and quality audits.

## Focus Areas

### 1. Architectural Integrity
- **Decoupling**: Are engines (Recorder, Player) isolated from UI logic?
- **State Management**: Is state lifted too high? Are we using "God Components"?
- **Responsibility**: Does each component have a single, clear responsibility?

### 2. Clean Code & Readability
- **Naming**: Are variables and functions descriptive? (e.g., `handleSyncToDelay` vs `sync`).
- **DRY (Don't Repeat Yourself)**: Are there patterns that should be abstracted into hooks or utilities?
- **Comments**: Do comments explain *why*, not just *what*?

### 3. Maintainability
- **Type Safety**: Are TypeScript interfaces robust and exhaustive?
- **Error Handling**: Are there try/catch blocks for risky native/storage operations?
- **Consistency**: Does the code match the established style in `GEMINI.md`?

## Review Workflow
1. **Identify Patterns**: Look for repeated logic or oversized files (e.g., `App.tsx`).
2. **Assess Complexity**: Mark areas with deep nesting or complex conditional logic.
3. **Propose Refactors**: Suggest specific abstractions without modifying code yet.
4. **Final Verdict**: Provide a "Pass", "Pass with Changes", or "Request Refactor".
