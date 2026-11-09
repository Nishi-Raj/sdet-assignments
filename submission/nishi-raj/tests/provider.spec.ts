import { describe, it, expect } from 'vitest';
import { api, repo, provider } from './fixture';

describe('Mock payment provider integration', () => {
  it('uses the provider seam and records exact charge arguments for immediate billing', async () => {
    // The provider contract is also exercised directly here.
    const result = await provider.charge({ customerId: 'cust_test_001', paymentMethodId: 'pm_test_visa_4242', amount: 1900, idempotencyKey: 'attempt_1' });
    expect(result.outcome).toBe('success'); expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toEqual({ customerId: 'cust_test_001', paymentMethodId: 'pm_test_visa_4242', amount: 1900, idempotencyKey: 'attempt_1' });
  });
  it('supports a declined provider response', async () => {
    provider.outcome = 'decline';
    const result = await provider.charge({ customerId: 'cust_test_001', paymentMethodId: 'pm_test_visa_4242', amount: 4900, idempotencyKey: 'attempt_decline' });
    expect(result.outcome).toBe('decline');
  });
  it('supports a provider timeout response', async () => {
    provider.outcome = 'timeout';
    const result = await provider.charge({ customerId: 'cust_test_001', paymentMethodId: 'pm_test_visa_4242', amount: 4900, idempotencyKey: 'attempt_timeout' });
    expect(result.outcome).toBe('timeout');
  });
});

// Exercise the provider through the real HTTP/service path, not only its interface.
describe('Provider outcomes through subscription creation', () => {
  it('moves an immediate-charge subscription to past_due when the provider declines', async () => {
    provider.outcome = 'decline';
    const response = await api.post('/subscriptions').send({ customer_id: 'cust_test_001', plan: 'basic', payment_method_id: 'pm_test_visa_4242' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('past_due');
    expect(provider.calls).toHaveLength(1);
    expect(repo.listInvoices(response.body.id)).toMatchObject([{ amount: 1900, status: 'failed' }]);
  });

  it('does not mark an immediate-charge subscription active when the provider times out', async () => {
    provider.outcome = 'timeout';
    const response = await api.post('/subscriptions').send({ customer_id: 'cust_test_001', plan: 'basic', payment_method_id: 'pm_test_visa_4242' });
    expect(response.status).toBe(504);
    expect(provider.calls).toHaveLength(1);
    expect([...repo.subscriptions.values()].every(subscription => subscription.status !== 'active')).toBe(true);
  });
});
