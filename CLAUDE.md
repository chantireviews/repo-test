# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. It allows users to describe React components in natural language, and generates them using Claude AI with a real-time preview. The application uses a virtual file system (no files written to disk during generation) and provides a live code editor with syntax highlighting.

## Common Commands

### Development
```bash
npm run dev              # Start dev server with Turbopack
npm run dev:daemon       # Start dev server in background, logs to logs.txt
```

### Database
```bash
npm run setup            # Install dependencies + generate Prisma client + run migrations
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma migrate dev   # Create and apply new migration
npm run db:reset         # Reset database (WARNING: deletes all data)
```

### Testing
```bash
npm test                 # Run all tests with Vitest
npm test -- --watch      # Run tests in watch mode
npm test -- path/to/file # Run specific test file
```

### Build & Linting
```bash
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

## Architecture

### Virtual File System (VFS)

The core of UIGen is a virtual file system (`src/lib/file-system.ts`) that exists entirely in memory. This allows the AI to create, modify, and delete files without writing to disk.

- **VirtualFileSystem class**: Tree-based in-memory file system with full CRUD operations
- Files are stored as `Map<string, FileNode>` where paths are keys
- The VFS is serialized to JSON and stored in the database (Prisma `Project.data` field)
- Context providers (`src/lib/contexts/file-system-context.tsx`) bridge VFS to React components

### AI Tool Integration

The AI (Claude) interacts with the VFS through two custom tools:

1. **str_replace_editor** (`src/lib/tools/str-replace.ts`): Text editor commands
   - `view`: View file contents with optional line range
   - `create`: Create new files with parent directories
   - `str_replace`: String replacement within files
   - `insert`: Insert text at specific line numbers

2. **file_manager** (`src/lib/tools/file-manager.ts`): File operations
   - `rename`: Rename/move files (creates directories as needed)
   - `delete`: Delete files or directories

### Component Preview System

The preview system (`src/lib/transform/jsx-transformer.ts`) transforms JSX/TSX code into executable browser code:

1. **Babel transformation**: Converts JSX/TSX to JavaScript using `@babel/standalone`
2. **Import map generation**: Creates ES module import maps with:
   - External packages from esm.sh (React, third-party libraries)
   - Internal files as blob URLs
   - `@/` alias support for root-relative imports
3. **HTML generation**: Generates iframe-embeddable HTML with:
   - Tailwind CDN for styling
   - Error boundaries for runtime errors
   - Syntax error display with formatted messages
4. **Preview rendering**: `PreviewFrame.tsx` displays the generated HTML in sandboxed iframe

Entry point detection priority: `/App.jsx` > `/App.tsx` > `/index.jsx` > `/index.tsx` > first .jsx/.tsx file

### Database Schema

The database schema is defined in the `prisma/schema.prisma` file. Reference it anytime you need to understand the structure of data stored in the database.

Prisma with SQLite:
- **User**: email, password (bcrypt hashed)
- **Project**: name, messages (JSON), data (JSON serialized VFS), userId (nullable for anonymous)

The Prisma client is generated to `src/generated/prisma` (non-standard location).

### AI Provider Architecture

`src/lib/provider.ts` implements a mock provider for development without API keys:
- Returns `MockLanguageModel` when `ANTHROPIC_API_KEY` is not set
- Mock provider generates static counter/form/card components in multiple steps
- Production uses `@ai-sdk/anthropic` with `claude-haiku-4-5` model

### Chat API Endpoint

`src/app/api/chat/route.ts` is the core AI interaction point:
- Accepts messages, files (serialized VFS), and projectId
- Reconstructs VFS from JSON
- Uses Vercel AI SDK's `streamText` with agentic loop (max 40 steps, or 4 for mock)
- Saves conversation and VFS state back to database on completion
- Returns streaming response with tool calls

### Authentication

JWT-based auth (`src/lib/auth.ts`):
- Uses `jose` library for JWT signing/verification
- Session tokens stored in httpOnly cookies
- Anonymous users can create projects without authentication
- Projects can be associated with users after signup/login

### System Prompt

The AI is guided by a system prompt (`src/lib/prompts/generation.tsx`) that instructs it to:
- Create `/App.jsx` as the root component with default export
- Use Tailwind CSS for styling (not hardcoded styles)
- Use `@/` import alias for local files
- Keep responses brief unless asked for details
- Operate on virtual FS root (`/`)

## Important Conventions

- **No HTML files**: The preview system generates HTML dynamically. Components should only be .jsx/.tsx files.
- **Import alias**: Always use `@/` for importing local files (e.g., `import Counter from '@/components/Counter'`)
- **Entry point**: Every project must have `/App.jsx` as the main entry point with a default export
- **Tailwind**: All styling should use Tailwind classes via CDN (v4), not inline styles
- **File paths**: All VFS paths are absolute starting with `/`
- **Comments**: Use comments sparingly. Only comment complex code.

## Testing

Tests use Vitest with jsdom environment:
- Component tests in `__tests__` directories alongside source files
- File system logic tested in `src/lib/__tests__/file-system.test.ts`
- React component tests use `@testing-library/react`

## Environment Variables

Only one environment variable is used:
- `ANTHROPIC_API_KEY` (optional): Anthropic API key for Claude. If not set, uses mock provider with static responses.
