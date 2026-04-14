---
paths:
  - packages/api/**
  - packages/relayer/**
---

# API & Relayer Rules

## Security
- All endpoints must have rate limiting, CORS restrictions, and input validation.
- Never leak secrets or stack traces in responses.
- Never hardcode private keys or secrets. Always use environment variables.

## Dependencies
- Pin versions. Run `pnpm audit` before adding new packages.
- Prefer well-maintained packages with small surface area.
