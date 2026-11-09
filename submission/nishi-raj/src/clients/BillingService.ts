import { createHmac, timingSafeEqual } from 'node:crypto';
import { PLANS, type PaymentEventType, type Plan, type Subscription } from '../domain/types';
import { SubscriptionStateMachine } from '../domain/SubscriptionStateMachine';
import type { PaymentProvider } from '../providers/PaymentProvider';
import { InMemoryBillingRepository } from '../repositories/InMemoryBillingRepository';

const now = () => new Date().toISOString();
export class BillingService {
  private sequence = 0;
  constructor(private repo: InMemoryBillingRepository, private provider: PaymentProvider, private machine = new SubscriptionStateMachine(), private webhookSecret = 'test-webhook-secret') {}
  private id(prefix: string) { this.sequence += 1; return `${prefix}_${String(this.sequence).padStart(4, '0')}`; }
  async createSubscription(input: { customer_id: string; plan: string; payment_method_id: string }) {
    if (!input.customer_id || !input.payment_method_id) throw Object.assign(new Error('customer_id and payment_method_id are required'), { status: 400 });
    if (!(input.plan in PLANS)) throw Object.assign(new Error('Unknown plan'), { status: 400 });
    const plan = input.plan as Plan;
    const customer = this.repo.getCustomer(input.customer_id);
    if (!customer) throw Object.assign(new Error('Unknown customer'), { status: 404 });
    if (customer.paymentMethodId !== input.payment_method_id) throw Object.assign(new Error('Invalid payment method'), { status: 400 });
    const id = this.id('sub');
    const config = PLANS[plan];
    // Start in trialing until an immediate first charge is confirmed.
    const status = 'trialing' as const;
    const subscription: Subscription = { id, customerId: customer.id, plan, status, createdAt: now(), updatedAt: now() };
    this.repo.saveSubscription(subscription);
    this.repo.addAudit({ subscriptionId: id, from: null, to: status, reason: 'created', at: now() });
    if (!config.trialEnabled) await this.charge(subscription, input.payment_method_id, config.price);
    return this.repo.getSubscription(id)!;
  }
  getSubscription(id: string) { const value = this.repo.getSubscription(id); if (!value) throw Object.assign(new Error('Subscription not found'), { status: 404 }); return value; }
  async cancel(id: string) {
    const sub = this.getSubscription(id);
    const next = this.machine.transition(sub.status, 'cancel');
    this.changeStatus(sub, next, 'customer_cancel');
    return this.getSubscription(id);
  }
  private changeStatus(sub: Subscription, next: Subscription['status'], reason: string) {
    const previous = sub.status; sub.status = next; sub.updatedAt = now(); this.repo.saveSubscription(sub);
    this.repo.addAudit({ subscriptionId: sub.id, from: previous, to: next, reason, at: now() });
  }
  private async charge(sub: Subscription, paymentMethodId: string, amount: number) {
    const result = await this.provider.charge({ customerId: sub.customerId, paymentMethodId, amount, idempotencyKey: `initial_${sub.id}` });
    if (result.outcome === 'timeout') throw Object.assign(new Error('Payment provider timeout'), { status: 504 });
    const success = result.outcome === 'success';
    this.repo.saveInvoice({ id: this.id('inv'), subscriptionId: sub.id, amount, currency: 'USD', status: success ? 'paid' : 'failed', providerReference: result.reference, createdAt: now() });
    const next = this.machine.transition(sub.status, success ? 'payment.succeeded' : 'payment.failed');
    this.changeStatus(sub, next, success ? 'payment_succeeded' : 'payment_failed');
  }
  signWebhook(rawBody: string) { return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex'); }
  private isValidSignature(rawBody: string, signature: string) {
    const expected = Buffer.from(this.signWebhook(rawBody)); const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  async processWebhook(rawBody: string, signature: string) {
    if (!this.isValidSignature(rawBody, signature)) throw Object.assign(new Error('Invalid webhook signature'), { status: 401 });
    let event: { event_id: string; type: PaymentEventType; subscription_id: string; invoice_id: string; amount: number; currency: string };
    try { event = JSON.parse(rawBody); } catch { throw Object.assign(new Error('Malformed JSON payload'), { status: 400 }); }
    if (!event.event_id || !event.subscription_id || !event.invoice_id || !['payment.succeeded', 'payment.failed', 'payment.refunded'].includes(event.type) || !Number.isFinite(event.amount) || event.amount < 0) throw Object.assign(new Error('Invalid webhook payload'), { status: 400 });
    if (this.repo.hasWebhook(event.event_id)) return { accepted: true, duplicate: true };
    const sub = this.getSubscription(event.subscription_id);
    let outcome: 'processed' | 'ignored' = 'processed';
    try {
      const next = this.machine.transition(sub.status, event.type);
      if (event.type === 'payment.succeeded' && !this.repo.listInvoices(sub.id).some(i => i.status === 'paid')) {
        this.repo.saveInvoice({ id: event.invoice_id, subscriptionId: sub.id, amount: event.amount, currency: 'USD', status: 'paid', providerReference: event.event_id, createdAt: now() });
      } else if (event.type === 'payment.failed') {
        const existingInvoice = this.repo.listInvoices(sub.id).find(i => i.id === event.invoice_id);
        // A late failure for an invoice already confirmed paid must never regress it.
        if (existingInvoice?.status === 'paid') {
          outcome = 'ignored';
          this.repo.saveWebhook({ eventId: event.event_id, subscriptionId: sub.id, type: event.type, processedAt: now(), outcome });
          return { accepted: true, duplicate: false, outcome };
        }
        this.repo.saveInvoice({ id: event.invoice_id, subscriptionId: sub.id, amount: event.amount, currency: 'USD', status: 'failed', providerReference: event.event_id, createdAt: now() });
      } else if (event.type === 'payment.refunded') {
        const paid = this.repo.listInvoices(sub.id).find(i => i.status === 'paid');
        if (paid) this.repo.saveInvoice({ ...paid, status: 'refunded' });
      }
      this.changeStatus(sub, next, event.type);
    } catch {
      outcome = 'ignored';
    }
    this.repo.saveWebhook({ eventId: event.event_id, subscriptionId: sub.id, type: event.type, processedAt: now(), outcome });
    return { accepted: true, duplicate: false, outcome };
  }
}
