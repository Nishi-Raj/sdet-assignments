import type { Plan } from '../domain/types';
export class SubscriptionBuilder {
  private value = { customerId: 'cust_test_001', plan: 'pro' as Plan, paymentMethodId: 'pm_test_visa_4242' };
  withCustomer(customerId: string) { this.value.customerId = customerId; return this; }
  withPlan(plan: Plan) { this.value.plan = plan; return this; }
  withPaymentMethod(paymentMethodId: string) { this.value.paymentMethodId = paymentMethodId; return this; }
  build() { return { ...this.value }; }
}
