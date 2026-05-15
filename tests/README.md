# Tests

Smoke tests for prompt templating and plan schema validation.

```bash
npm test          # one-shot
npm run test:watch  # watch mode
```

**What's tested:** `fillTemplate` helper (prompt rendering) and the plan block Zod schema (type safety for LLM output).

**What's not tested:** API routes, Telegram integration, LLM calls. These were validated manually during development (see `docs/dev-log.md`).
