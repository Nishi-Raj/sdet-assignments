# SDET Take-Home Submission — Nishi Raj

## 1. Test strategy
This solution validates the subscription workflow at API, state-machine, persistence, webhook-integration and end-to-end levels. In scope are creation/retrieval/cancellation, validation failures, payment success/failure/refund, duplicate and out-of-order webhooks, signature verification, persisted invoices/events/audit entries, and provider interaction. A frontend, real payment integration, production database, performance testing and concurrency testing are out of scope.

The service fixture and HTTP routes are real within this repository. The payment provider is injected as a fake, and persistence uses an isolated in-memory repository. Inbound provider webhooks are simulated by posting signed raw payloads.

## 2. OOP and design patterns
- State Machine: explicit transition table prevents illegal lifecycle changes.
- Builder: subscription and webhook builders keep scenario setup intention-revealing.
- Strategy/Adapter seam: `PaymentProvider` interface permits deterministic fake outcomes.
- Repository: persistence access is isolated behind `InMemoryBillingRepository`.
- Fixture composition: shared setup composes service dependencies and resets state for each test.

## 3. API validation
Supertest exercises create, retrieve, cancel and webhook endpoints. Assertions cover status codes, response payloads, invalid input, unknown resources, signature validation and malformed payloads.

## 4. Database validation
Tests inspect subscriptions, invoices, webhook events and audit history through the repository abstraction. Assertions verify API/database state agreement, invoice outcomes, event deduplication and absence of invalid side effects.

## 5. Mock provider and webhook validation
The provider fake records exact call arguments and supports success, decline and timeout outcomes. Webhook requests are signed over the raw JSON body with HMAC-SHA256. Duplicate event IDs are proven to produce one invoice and one transition; stale events are safely ignored.

## 6. Test architecture
Tests are grouped by API, lifecycle, webhooks and provider boundary. Shared setup is in `tests/fixture.ts`; builders remove repetitive literals; service and repository layers keep assertions focused on business behavior.

## 7. Responsible AI usage
AI assistance was used to help interpret the assignment, propose a test architecture, and draft implementation/documentation. I reviewed the requirements and the generated code and am responsible for validating the behavior, running the suite, and explaining the design decisions. Any unverified behavior or limitation is documented in `docs/TEST_STRATEGY.md`.

## How to run
```bash
npm install
npm test
npm run typecheck
```

## Assumptions and limitations
See `docs/TEST_STRATEGY.md`. In particular, the persistence adapter is in-memory and does not prove database transaction/concurrency guarantees.
