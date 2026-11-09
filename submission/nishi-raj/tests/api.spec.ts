import { describe, it, expect } from 'vitest';
import { api, repo, provider, createTrial } from './fixture';

describe('Subscription API contract', () => {
  it('creates a trial subscription and persists matching state', async () => {
    const created = await createTrial();
    expect(created.status).toBe('trialing');
    const fetched = await api.get(`/subscriptions/${created.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body).toMatchObject({ id: created.id, customerId: 'cust_test_001', plan: 'pro', status: 'trialing' });
    expect(repo.getSubscription(created.id)?.status).toBe(fetched.body.status);
    expect(provider.calls).toHaveLength(0);
  });

  it('charges immediately for the Basic plan and persists the paid invoice', async () => {
    const response = await api.post('/subscriptions').send({ customer_id: 'cust_test_001', plan: 'basic', payment_method_id: 'pm_test_visa_4242' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('active');
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0]).toMatchObject({ customerId: 'cust_test_001', paymentMethodId: 'pm_test_visa_4242', amount: 1900 });
    expect(repo.listInvoices(response.body.id)).toMatchObject([{ amount: 1900, status: 'paid' }]);
  });

  it('rejects unknown plans without persistence or provider calls', async () => {
    const response = await api.post('/subscriptions').send({ customer_id: 'cust_test_001', plan: 'enterprise', payment_method_id: 'pm_test_visa_4242' });
    expect(response.status).toBe(400); expect(repo.subscriptions.size).toBe(0); expect(provider.calls).toHaveLength(0);
  });
  it('rejects missing required fields', async () => {
    const response = await api.post('/subscriptions').send({ plan: 'pro' });
    expect(response.status).toBe(400); expect(repo.subscriptions.size).toBe(0);
  });
  it('rejects an unknown customer', async () => {
    const response = await api.post('/subscriptions').send({ customer_id: 'missing', plan: 'pro', payment_method_id: 'pm_test_visa_4242' });
    expect(response.status).toBe(404); expect(repo.subscriptions.size).toBe(0);
  });
  it('rejects an invalid payment method', async () => {
    const response = await api.post('/subscriptions').send({ customer_id: 'cust_test_001', plan: 'pro', payment_method_id: 'pm_wrong' });
    expect(response.status).toBe(400); expect(provider.calls).toHaveLength(0);
  });
  it('returns 404 for an unknown subscription', async () => { expect((await api.get('/subscriptions/not-found')).status).toBe(404); });
  it('cancels a trial and rejects a second cancellation', async () => {
    const sub = await createTrial();
    expect((await api.post(`/subscriptions/${sub.id}/cancel`)).body.status).toBe('canceled');
    expect((await api.post(`/subscriptions/${sub.id}/cancel`)).status).toBe(409);
    expect(repo.getSubscription(sub.id)?.status).toBe('canceled');
  });
});
