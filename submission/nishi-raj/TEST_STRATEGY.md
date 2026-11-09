
# Subscription & Billing Service – Test Strategy

## 1. Objective

The objective of this assignment is to design and implement a maintainable, object-oriented automated validation framework for a Subscription & Billing Service.

The solution will validate subscription lifecycle behavior across API, business logic, persistence, and external payment provider integration.

The primary focus is correctness, data consistency, webhook idempotency, state transitions, and maintainable test architecture rather than building a large automation framework.

## 2. System Under Test – Assumptions

Since no existing service implementation is provided, I will follow Option 2 – Build a Minimal Service Fixture.

The fixture will simulate a backend subscription and billing service using TypeScript and Node.js.

The following assumptions will be applied:

- The service supports Basic and Pro subscription plans.
- Each plan has its own price and trial configuration.
- Subscription states are trialing, active, past_due, and canceled.
- Payment processing is delegated to an external payment provider interface.
- The payment provider will be mocked in automated tests.
- An in-memory persistence layer will be used to keep the setup lightweight and queryable.
- Webhook requests must contain a valid HMAC signature.
- Each webhook event has a unique event_id for idempotency.
- A canceled subscription cannot be reactivated by subsequent webhook events.
- Each billing attempt must have an auditable invoice/payment record.

## 3. Scope of Testing

### In Scope

1. Subscription creation and retrieval.
2. Subscription cancellation.
3. Plan validation and plan-specific pricing.
4. Subscription lifecycle and state transitions.
5. Payment success, decline, and timeout scenarios.
6. Webhook signature validation.
7. Duplicate webhook delivery and idempotency.
8. Out-of-order webhook events.
9. API response and database consistency.
10. Mock payment provider interaction validation.
11. Invoice, payment, and webhook event persistence.
12. Audit history validation.

### Out of Scope

- Real payment gateway integration.
- Frontend/UI automation.
- Production deployment.
- Load and performance testing.
- Tax calculations and complex billing proration.
- Real external notification services.

## 4. Technology Stack

| Component | Technology |
|---|---|
| Programming Language | TypeScript |
| Runtime | Node.js |
| Test Runner | Vitest |
| HTTP API Testing | Supertest |
| API Framework | Express |
| Mocking | Vitest Mock Functions |
| Persistence | In-memory repositories |
| Webhook Security | Node.js Crypto (HMAC SHA-256) |
| Assertions | Vitest |
| Package Management | npm |

## 5. Test Architecture

The automation solution will follow an object-oriented architecture with clear separation of responsibilities.

### 5.1 Test Fixtures / Environment Setup

Responsibilities:

- Initialize the application and test environment.
- Seed customers and subscription plans.
- Initialize in-memory repositories.
- Inject the mock payment provider.
- Reset test data before each test.
- Provide isolated test execution.

### 5.2 API Client Layer

A typed API client will encapsulate HTTP requests.

Responsibilities:

- Create subscriptions.
- Retrieve subscription details.
- Cancel subscriptions.
- Submit payment webhooks.
- Handle reusable request and response structures.

This keeps HTTP implementation details separate from test scenarios.

### 5.3 Mock Payment Provider

A mock payment provider will implement the payment provider interface.

Supported outcomes:

- Successful payment.
- Payment declined.
- Payment timeout.

The mock will record:

- Number of provider calls.
- Customer ID.
- Payment method ID.
- Amount and currency.
- Idempotency/reference key.

This will help verify that payment interactions are correct and happen only when expected.

### 5.4 Repository Layer

Repository classes will provide controlled access to persisted test data.

Repositories:

- SubscriptionRepository
- InvoiceRepository
- WebhookEventRepository
- AuditLogRepository

Tests will use these repositories instead of directly accessing storage throughout test cases.

### 5.5 Test Data Builders

Builder classes will construct reusable test data.

Examples:

- CustomerBuilder
- SubscriptionBuilder
- WebhookEventBuilder

This improves readability and reduces repetitive test setup.

## 6. Design Patterns

The following design patterns will be implemented:

### 6.1 State Pattern / State Machine

The subscription lifecycle will be represented through an explicit transition table or state machine.

Valid transitions:

| Current State | Event | Expected State |
|---|---|---|
| trialing | Payment Success | active |
| trialing | Payment Failure | past_due |
| active | Payment Failure | past_due |
| past_due | Payment Success | active |
| past_due | Retries Exhausted | canceled |
| active | Customer Cancellation | canceled |
| trialing | Customer Cancellation | canceled |

Invalid transitions must be rejected or safely ignored.

A canceled subscription must remain canceled regardless of subsequent webhook delivery.

### 6.2 Builder Pattern

Builders will construct customers, subscriptions, and webhook payloads with sensible defaults and configurable test data.

This keeps test scenarios readable and reduces duplication.

### 6.3 Strategy / Adapter Pattern

A payment provider interface will separate billing logic from the external payment implementation.

The test suite will inject a configurable mock implementation to simulate success, decline, and timeout without making real payment requests.

### 6.4 Repository Pattern

Repository classes will encapsulate persistence operations for subscriptions, invoices, webhook events, and audit logs.

This provides a consistent verification layer and avoids scattered storage access.

## 7. API Validation Strategy

The following endpoints will be covered:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /subscriptions | Create subscription |
| GET | /subscriptions/:id | Retrieve subscription |
| POST | /subscriptions/:id/cancel | Cancel subscription |
| POST | /webhooks/payment-provider | Process payment webhook |

Validation scenarios:

- Successful subscription creation.
- Creation with an invalid plan.
- Creation with missing customer information.
- Creation with an invalid payment method.
- Retrieval of an existing subscription.
- Retrieval of an unknown subscription.
- Successful cancellation.
- Cancellation of an already-canceled subscription.
- Valid webhook signature.
- Invalid webhook signature.
- Malformed webhook payload.

Both response status codes and response payloads will be verified.

## 8. Database / Persistence Validation

The following entities will be maintained and validated:

### subscriptions

Fields include:

- id
- customer_id
- plan
- status
- amount
- currency
- created_at
- updated_at

### invoices / payments

Fields include:

- id
- subscription_id
- amount
- currency
- status
- provider_reference
- created_at

### webhook_events

Fields include:

- event_id
- subscription_id
- event_type
- processing_status
- received_at

### audit_logs

Fields include:

- id
- subscription_id
- previous_status
- new_status
- event_type
- created_at

Persistence verification will ensure that API-visible subscription state matches the stored subscription state.

It will also verify that duplicate webhook delivery does not create duplicate invoices, payments, or business side effects.

Test data will be reset between scenarios to avoid stale-data-related false positives.

## 9. Webhook Idempotency and Ordering Strategy

Webhook processing will be validated for:

1. First delivery of a valid payment event.
2. Duplicate delivery using the same event_id.
3. Duplicate delivery must not trigger another state transition.
4. Duplicate delivery must not create another invoice or payment.
5. Invalid webhook signatures must be rejected.
6. A payment failure arriving after a successful payment for the same invoice must not regress an active subscription.
7. A successful payment webhook for a canceled subscription must not reactivate it.
8. Unknown or malformed events must be handled safely.

Processed event IDs will be stored in the webhook event repository to support idempotency.

For events referring to the same invoice, business rules will prevent an older or contradictory event from overwriting a terminal payment outcome.

## 10. State Machine Invariants

The following business invariants will be validated:

- A subscription cannot become active without a successfully persisted payment record.
- A canceled subscription cannot transition to another state.
- Duplicate webhook delivery must not create duplicate payment records.
- A rejected API request must not create invalid persistence records.
- The payment provider must not be called for rejected requests.
- Provider calls must happen only for genuine billing attempts.
- Subscription state in persistence must match the API response.
- Plan-specific price and trial rules must be applied consistently.
- Each accepted lifecycle transition must be recorded in the audit history.

## 11. End-to-End Test Scenarios

The following end-to-end workflows will be covered:

### Scenario 1: Successful Subscription Creation

- Create a subscription using a valid customer and plan.
- Verify the initial subscription state.
- Verify the mock provider interaction if immediate charging is required.
- Verify the API response.
- Verify subscription and invoice persistence.

### Scenario 2: Payment Failure

- Configure the mock provider to return a decline.
- Trigger a billing attempt.
- Verify transition to past_due.
- Verify failed payment/invoice persistence.
- Verify no successful payment record is created.

### Scenario 3: Payment Recovery

- Start with a past_due subscription.
- Deliver a successful retry payment webhook.
- Verify transition to active.
- Verify successful payment persistence.
- Verify audit history.

### Scenario 4: Duplicate Webhook Delivery

- Deliver a valid payment.succeeded event.
- Deliver the same event again using the same event_id.
- Verify that processing occurs only once.
- Verify there are no duplicate invoices or payments.
- Verify no additional provider charge occurs.

### Scenario 5: Out-of-Order Webhook Delivery

- Deliver payment.succeeded for an invoice.
- Deliver payment.failed for the same invoice afterward.
- Verify that the subscription remains active.
- Verify that the successful payment outcome is preserved.

### Scenario 6: Cancellation Protection

- Cancel an active subscription.
- Deliver a subsequent payment.succeeded webhook.
- Verify that the subscription remains canceled.
- Verify that no invalid state transition occurs.

### Scenario 7: Provider Timeout

- Configure the mock provider to simulate a timeout.
- Trigger a billing attempt.
- Verify the expected failure/unknown outcome handling.
- Verify persistence and audit records.
- Verify that retries do not create unintended duplicate charges.

## 12. Test Execution and Data Isolation

- Each test will use an isolated fixture.
- Repositories will be reset before every test.
- Customers and plans will be seeded using reusable builders.
- Mock provider behavior will be configurable per scenario.
- Assertions will validate API responses, persisted records, and provider interactions together.

## 13. Red, Blue, Green Approach

The implementation will follow the requested Red, Blue, Green discipline.

- Red: Write a failing test for a business requirement or invariant.
- Blue: Implement the minimum fixture or application logic required to pass the test.
- Green: Refactor the implementation for readability and maintainability while keeping the tests passing.

## 14. Known Limitations and Trade-offs

- The service is a minimal test fixture, not a production billing platform.
- In-memory persistence does not demonstrate real database transaction isolation or crash recovery.
- Payment provider behavior is simulated through a mock interface.
- HMAC verification will be tested locally using generated signatures.
- Concurrent webhook processing is considered a bonus and will be attempted only after mandatory scenarios are covered.
- Complex billing features such as taxes, multi-currency conversion, and proration are excluded.

These limitations are intentional to keep the solution focused on test engineering and subscription lifecycle correctness.

## 15. Success Criteria

The assignment will be considered successful when:

- All mandatory automated tests pass.
- Valid and invalid subscription transitions are verified.
- API responses and persisted records remain consistent.
- Duplicate webhook events do not cause duplicate side effects.
- Mock provider interactions are verified for call count and arguments.
- The framework demonstrates practical object-oriented design and maintainable patterns.
- Setup and execution instructions are documented clearly.

The primary goal is to provide confidence in the correctness, reliability, and auditability of a stateful subscription billing workflow.
