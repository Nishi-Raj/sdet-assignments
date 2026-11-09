# Kulu SDET Take-Home — Subscription & Billing Validation

A focused TypeScript test fixture and automation suite validating subscription APIs, lifecycle transitions, persistence side effects, webhook security/idempotency, and the mocked payment-provider boundary.

## Prerequisites
- Node.js 20+
- npm 10+

## Install and run
```bash
npm install
npm test
npm run typecheck
```

## What is covered
- Subscription create, retrieve and cancel API behavior.
- Invalid request and customer/plan/payment-method handling.
- Trialing → active / past_due, past_due → active, and cancellation transitions.
- Invalid transitions, canceled-state protection and out-of-order webhook delivery.
- HMAC webhook signature validation, malformed payload rejection and duplicate event idempotency.
- Subscription, invoice, webhook-event and audit persistence checks.
- Injected fake payment provider with recorded arguments and configurable success/decline/timeout outcomes.

## Architecture
See [`docs/TEST_STRATEGY.md`](docs/TEST_STRATEGY.md) for assumptions, coverage matrix, design patterns, invariants, mocked boundaries and limitations.

```text
src/
  app.ts                         Express HTTP routes
  clients/BillingService.ts      orchestration and webhook processing
  domain/SubscriptionStateMachine.ts
  builders/                      test-data builders
  providers/                      payment provider interface + fake
  repositories/                   in-memory persistence adapter
tests/
  fixture.ts                      isolated test composition
  api.spec.ts                     API contract and validation
  lifecycle.spec.ts               state-machine and workflow behavior
  webhooks.spec.ts                security and idempotency
  provider.spec.ts                 provider boundary
```

## Important scope note
The assignment does not include a running production service. This submission therefore builds a deliberately minimal service fixture to exercise the test architecture. It is not intended to be a production billing implementation. Persistence is in-memory, and the payment provider is always fake; no real charges or external requests are made.
