# Release Process

## Versioning

- Use semantic version tags: `vMAJOR.MINOR.PATCH`
- Tag from `main` only after CI is green

## Pre-Release Checklist

Run locally:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Verify:
- `README.md`, `CHANGELOG.md`, and `PLAN.md` are current
- Security-sensitive changes include tests
- No uncommitted local changes

## Publish a Release

1. Update `CHANGELOG.md` under `Unreleased`.
2. Commit all release prep changes.
3. Create and push tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

4. GitHub release workflow will generate release notes automatically.
