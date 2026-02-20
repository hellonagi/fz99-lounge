---
description: Generate a one-line commit message from staged changes
allowed-tools: [Bash]
model: haiku
---

# Commit Message Generator

Generate a concise, one-line commit message in English based on the currently staged changes.

## Instructions

1. Run `git diff --cached` to get the staged changes
2. If there are no staged changes, inform the user that there is nothing staged and stop
3. Analyze the diff and generate a single-line commit message following these conventions:
   - Use imperative mood (e.g., "Add", "Fix", "Update", "Remove", "Refactor")
   - Keep it under 72 characters
   - Focus on **what** changed and **why**, not the mechanical details
   - Do not include a period at the end
   - Do not wrap in quotes
4. Output only the commit message, nothing else
