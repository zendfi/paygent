<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This repository uses a Next.js version with breaking changes. APIs, conventions, and file structure may differ from older patterns.

Before writing code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.

This file is the canonical instruction source for all AI coding agents (Gemini, Copilot, Claude, and others). Any tool-specific instruction file should reference this file instead of duplicating rules.

## Security Rules For Agents

- Never commit real secrets, API keys, tokens, or database URLs.
- Use `.env.local` or deployment environment variables for secrets.
- If a secret appears in chat, logs, or committed files, rotate it immediately.
<!-- END:nextjs-agent-rules -->
