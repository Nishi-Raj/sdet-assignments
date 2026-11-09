import type { PaymentEventType } from '../domain/types';
export class WebhookBuilder {
  private value = { event_id: 'evt_test_001', type: 'payment.succeeded' as PaymentEventType, subscription_id: 'sub_test_001', invoice_id: 'inv_test_001', amount: 4900, currency: 'USD' };
  withEventId(event_id: string) { this.value.event_id = event_id; return this; }
  withType(type: PaymentEventType) { this.value.type = type; return this; }
  forSubscription(subscription_id: string) { this.value.subscription_id = subscription_id; return this; }
  withAmount(amount: number) { this.value.amount = amount; return this; }
  build() { return { ...this.value }; }
}
