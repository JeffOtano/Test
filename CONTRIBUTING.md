# Contributing to Goodbye Shortcut

First off, thanks for taking the time to contribute! 🎉

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When you create a bug report, include as many details as possible:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs what actually happened
- **Screenshots** if applicable
- **Environment** (browser, OS, Node version)

### Suggesting Features

Feature requests are welcome! Please:

- **Check existing issues** first
- **Describe the problem** you're trying to solve
- **Propose a solution** if you have one

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Install dependencies**: `npm install`
3. **Make your changes**
4. **Test your changes**: `npm run build`
5. **Commit with a clear message**
6. **Open a PR** with a description of your changes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/goodbye-shortcut.git
cd goodbye-shortcut

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
goodbye-shortcut/
├── src/
│   ├── app/                 # Next.js pages
│   │   ├── page.tsx         # Landing page
│   │   └── (app)/           # App routes
│   │       ├── setup/       # Token setup
│   │       └── migrate/     # Migration wizard
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   └── layout/          # Layout components
│   ├── lib/                 # Utilities
│   │   ├── db.ts            # localStorage wrapper
│   │   ├── shortcut/        # Shortcut API client
│   │   └── linear/          # Linear API client
│   └── types/               # TypeScript types
├── public/                  # Static assets
└── docs/                    # Documentation
```

## Code Style

- **TypeScript** for all new code
- **Functional components** with hooks
- **Tailwind CSS** for styling
- Keep components small and focused

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add team-by-team migration mode
fix: handle rate limiting in Shortcut API
docs: update README with new features
refactor: simplify migration wizard steps
```

## Questions?

Open an issue with the `question` label.

---

Thanks for contributing! 🙏
