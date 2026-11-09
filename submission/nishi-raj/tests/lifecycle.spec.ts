import { describe, it, expect } from 'vitest';
import { api, repo, createTrial, sendWebhook } from './fixture';
import { SubscriptionStateMachine } from '../src/domain/SubscriptionStateMachine';

describe('Subscription lifecycle and invariants', () => {
  it('moves trialing to active on successful payment and stores paid invoice', async () => {
    const sub = await createTrial();
    const response = await sendWebhook({ event_id: 'evt_success_1', type: 'payment.succeeded', subscription_id: sub.id, invoice_id: 'inv_success_1', amount: 4900, currency: 'USD' });
    expect(response.status).toBe(200); expect(repo.getSubscription(sub.id)?.status).toBe('active');
    expect(repo.listInvoices(sub.id)).toMatchObject([{ id: 'inv_success_1', amount: 4900, status: 'paid' }]);
    expect(repo.getSubscription(sub.id)?.status).toBe('active');
  });
  it('moves trialing to past_due on failed payment and persists failure', async () => {
    const sub = await createTrial();
    await sendWebhook({ event_id: 'evt_fail_1', type: 'payment.failed', subscription_id: sub.id, invoice_id: 'inv_fail_1', amount: 4900, currency: 'USD' });
    expect(repo.getSubscription(sub.id)?.status).toBe('past_due');
    expect(repo.listInvoices(sub.id)[0].status).toBe('failed');
  });
  it('recovers past_due to active after a successful retry', async () => {
    const sub = await createTrial();
    await sendWebhook({ event_id: 'evt_fail_2', type: 'payment.failed', subscription_id: sub.id, invoice_id: 'inv_fail_2', amount: 4900, currency: 'USD' });
    await sendWebhook({ event_id: 'evt_retry_2', type: 'payment.succeeded', subscription_id: sub.id, invoice_id: 'inv_paid_2', amount: 4900, currency: 'USD' });
    expect(repo.getSubscription(sub.id)?.status).toBe('active');
    expect(repo.listInvoices(sub.id).some(i => i.status === 'paid')).toBe(true);
  });
  it('does not reactivate a canceled subscription on a later success webhook', async () => {
    const sub = await createTrial(); await api.post(`/subscriptions/${sub.id}/cancel`);
    const response = await sendWebhook({ event_id: 'evt_after_cancel', type: 'payment.succeeded', subscription_id: sub.id, invoice_id: 'inv_after_cancel', amount: 4900, currency: 'USD' });
    expect(response.body.outcome).toBe('ignored'); expect(repo.getSubscription(sub.id)?.status).toBe('canceled');
    expect(repo.listInvoices(sub.id)).toHaveLength(0);
  });
  it('ignores a late failure after a successful payment', async () => {
    const sub = await createTrial();
    await sendWebhook({ event_id: 'evt_order_success', type: 'payment.succeeded', subscription_id: sub.id, invoice_id: 'inv_order', amount: 4900, currency: 'USD' });
    const late = await sendWebhook({ event_id: 'evt_order_late_fail', type: 'payment.failed', subscription_id: sub.id, invoice_id: 'inv_order', amount: 4900, currency: 'USD' });
    expect(late.body.outcome).toBe('ignored'); expect(repo.getSubscription(sub.id)?.status).toBe('active');
    expect(repo.listInvoices(sub.id)).toHaveLength(1);
  });
  it('records refund and moves active subscription to past_due', async () => {
    const sub = await createTrial();
    await sendWebhook({ event_id: 'evt_refund_success', type: 'payment.succeeded', subscription_id: sub.id, invoice_id: 'inv_refund', amount: 4900, currency: 'USD' });
    await sendWebhook({ event_id: 'evt_refund', type: 'payment.refunded', subscription_id: sub.id, invoice_id: 'inv_refund', amount: 4900, currency: 'USD' });
    expect(repo.getSubscription(sub.id)?.status).toBe('past_due'); expect(repo.listInvoices(sub.id)[0].status).toBe('refunded');
  });
  it('documents all allowed state transitions and rejects illegal ones', () => {
    const machine = new SubscriptionStateMachine();
    expect(machine.canTransition('trialing', 'payment.succeeded')).toBe(true);
    expect(machine.canTransition('trialing', 'payment.failed')).toBe(true);
    expect(machine.canTransition('active', 'payment.failed')).toBe(true);
    expect(machine.canTransition('past_due', 'payment.succeeded')).toBe(true);
    expect(machine.canTransition('active', 'cancel')).toBe(true);
    expect(machine.canTransition('trialing', 'cancel')).toBe(true);
    expect(machine.canTransition('canceled', 'payment.succeeded')).toBe(false);
    expect(machine.canTransition('active', 'payment.succeeded')).toBe(false);
  });
});
