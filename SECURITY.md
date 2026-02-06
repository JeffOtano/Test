# Security Policy

## Supported Versions

This repository currently supports security fixes on:

| Version | Supported |
|---------|-----------|
| `main`  | Yes |

## Reporting a Vulnerability

Do not open public GitHub issues for security vulnerabilities.

Please report vulnerabilities through GitHub private vulnerability reporting:
- `https://github.com/JeffOtano/goodbye-shortcut/security/advisories/new`

Include:
- A clear description of the issue
- Impact assessment (what could be exploited)
- Steps to reproduce
- Any proof-of-concept details

Response targets:
- Initial acknowledgment: within 72 hours
- Triage decision: within 7 days
- Fix or mitigation plan: as fast as possible based on severity

## Security Principles for This Project

- No provider tokens are persisted on the app server by default.
- Signed webhook verification is supported and recommended in production.
- Replay protection and rate limiting are enabled on webhook routes.
- CI runs static analysis, linting, type checks, tests, and builds on every PR.
