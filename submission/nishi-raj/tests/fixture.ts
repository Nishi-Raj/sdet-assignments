import { beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { BillingService } from '../src/clients/BillingService';
import { FakePaymentProvider } from '../src/providers/PaymentProvider';
import { InMemoryBillingRepository } from '../src/repositories/InMemoryBillingRepository';
export const repo = new InMemoryBillingRepository();
export const provider = new FakePaymentProvider();
export const service = new BillingService(repo, provider);
export const app = createApp(service);
export const api = request(app);
beforeEach(() => { repo.reset(); repo.seedCustomer({ id: 'cust_test_001', paymentMethodId: 'pm_test_visa_4242' }); provider.calls.length = 0; provider.outcome = 'success'; });
export async function createTrial(plan = 'pro') {
  const response = await api.post('/subscriptions').send({ customer_id: 'cust_test_001', plan, payment_method_id: 'pm_test_visa_4242' });
  return response.body as { id: string; status: string; plan: string };
}
export async function sendWebhook(payload: object) {
  const raw = JSON.stringify(payload); return api.post('/webhooks/payment-provider').set('Content-Type', 'application/json').set('X-Provider-Signature', service.signWebhook(raw)).send(raw);
}
