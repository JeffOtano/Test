# Contributing to Goodbye Shortcut

Thanks for contributing.

## Ground Rules

- Start from the latest `main`.
- Keep pull requests focused and small when possible.
- Include tests for new logic, especially security-sensitive code.
- Keep user-facing docs aligned with behavior changes.

## Local Setup

```bash
git clone https://github.com/YOUR_USERNAME/goodbye-shortcut.git
cd goodbye-shortcut
nvm use
npm install
npm run dev
```

## Required Checks

Before opening a PR, run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

CI runs these checks on every PR and push to `main`.

## Pull Request Process

1. Fork the repository and create a feature branch.
2. Implement your changes and tests.
3. Run all required checks locally.
4. Open a PR using the template and include validation output.
5. Address review comments and keep branch up to date.

## Issue Reporting

Use the issue templates:
- Bug Report
- Feature Request

For security vulnerabilities, do not open a public issue. See `SECURITY.md`.

## Commit Message Guidelines

Use concise, descriptive commit messages. Common prefixes:

- `feat:` new behavior
- `fix:` bug fix
- `refactor:` internal restructuring
- `test:` test additions/changes
- `docs:` documentation updates

## Community Standards

- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `SUPPORT.md`
