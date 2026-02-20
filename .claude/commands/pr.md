---
description: Generate PR title and description from dev branch changes
allowed-tools: [Bash]
---

# Pull Request Description Generator

Generate a PR title and description in English based on the diff between `origin/main` and the current `dev` branch.

## Instructions

1. Run `git fetch origin main` to ensure the latest main is available
2. Run `git log origin/main..dev --oneline` to see all commits
3. Run `git diff origin/main..dev --stat` to see changed files summary
4. Run `git diff origin/main..dev` to see the full diff (if too large, use `--stat` and commit messages to infer changes)
5. Analyze all changes and generate:

### Title
- Keep under 70 characters
- Use imperative mood (e.g., "Add", "Fix", "Update")
- Summarize the overall theme of the changes

### Description
- 3-7 bullet points summarizing the key changes
- Each bullet should be concise and descriptive
- No headers, sections, or test plans — just the bullet list

6. Output the title and description clearly separated, ready to copy-paste into GitHub PR creation
