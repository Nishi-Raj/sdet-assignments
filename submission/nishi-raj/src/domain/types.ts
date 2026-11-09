export type Plan = 'basic' | 'pro';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';
export type PaymentOutcome = 'success' | 'decline' | 'timeout';
export type PaymentEventType = 'payment.succeeded' | 'payment.failed' | 'payment.refunded';
export interface Customer { id: string; paymentMethodId: string }
export interface Subscription { id: string; customerId: string; plan: Plan; status: SubscriptionStatus; createdAt: string; updatedAt: string }
export interface Invoice { id: string; subscriptionId: string; amount: number; currency: 'USD'; status: 'paid' | 'failed' | 'refunded'; providerReference: string; createdAt: string }
export interface WebhookEvent { eventId: string; subscriptionId: string; type: PaymentEventType; processedAt: string; outcome: 'processed' | 'ignored' }
export interface AuditEntry { subscriptionId: string; from: SubscriptionStatus | null; to: SubscriptionStatus; reason: string; at: string }
export interface PlanConfig { price: number; trialDays: number; trialEnabled: boolean }
export const PLANS: Record<Plan, PlanConfig> = {
  basic: { price: 1900, trialDays: 7, trialEnabled: false },
  pro: { price: 4900, trialDays: 14, trialEnabled: true }
};
