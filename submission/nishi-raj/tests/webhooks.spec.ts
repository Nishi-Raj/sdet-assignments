import { describe, it, expect } from 'vitest';
import { api, repo, provider, createTrial, sendWebhook, service } from './fixture';

describe('Webhook security and idempotency', () => {
  it('processes the same event id only once', async () => {
    const sub = await createTrial(); const event = { event_id: 'evt_duplicate', type: 'payment.succeeded', subscription_id: sub.id, invoice_id: 'inv_duplicate', amount: 4900, currency: 'USD' };
    expect((await sendWebhook(event)).body.duplicate).toBe(false);
    expect((await sendWebhook(event)).body.duplicate).toBe(true);
    expect(repo.listInvoices(sub.id)).toHaveLength(1); expect(repo.webhookEvents.size).toBe(1);
    expect(repo.audit.filter(x => x.reason === 'payment.succeeded')).toHaveLength(1); expect(provider.calls).toHaveLength(0);
  });
  it('rejects an invalid signature without changing state', async () => {
    const sub = await createTrial(); const raw = JSON.stringify({ event_id: 'evt_bad_sig', type: 'payment.succeeded', subscription_id: sub.id, invoice_id: 'inv_bad', amount: 4900, currency: 'USD' });
    const response = await api.post('/webhooks/payment-provider').set('Content-Type', 'application/json').set('X-Provider-Signature', 'forged').send(raw);
    expect(response.status).toBe(401); expect(repo.getSubscription(sub.id)?.status).toBe('trialing'); expect(repo.webhookEvents.size).toBe(0);
  });
  it('rejects malformed JSON with a valid signature', async () => {
    const raw = '{bad json'; const response = await api.post('/webhooks/payment-provider').set('Content-Type', 'application/json').set('X-Provider-Signature', service.signWebhook(raw)).send(raw);
    expect(response.status).toBe(400);
  });
  it('rejects invalid event payload', async () => {
    const raw = JSON.stringify({ event_id: '', type: 'payment.succeeded' });
    const response = await api.post('/webhooks/payment-provider').set('Content-Type', 'application/json').set('X-Provider-Signature', service.signWebhook(raw)).send(raw);
    expect(response.status).toBe(400);
  });
  it('does not call provider when a webhook is replayed', async () => {
    const sub = await createTrial(); const event = { event_id: 'evt_no_charge', type: 'payment.succeeded', subscription_id: sub.id, invoice_id: 'inv_no_charge', amount: 4900, currency: 'USD' };
    await sendWebhook(event); await sendWebhook(event); expect(provider.calls).toHaveLength(0);
  });
});
