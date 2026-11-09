import type { SubscriptionStatus, PaymentEventType } from './types';

const transitions: Record<SubscriptionStatus, Partial<Record<PaymentEventType | 'cancel' | 'payment.retry.succeeded' | 'trial.charge.failed', SubscriptionStatus>>> = {
  trialing: { 'payment.succeeded': 'active', 'payment.failed': 'past_due', cancel: 'canceled', 'trial.charge.failed': 'past_due' },
  active: { 'payment.failed': 'past_due', 'payment.refunded': 'past_due', cancel: 'canceled' },
  past_due: { 'payment.succeeded': 'active', 'payment.retry.succeeded': 'active', cancel: 'canceled' },
  canceled: {}
};

export class InvalidTransitionError extends Error {
  constructor(from: SubscriptionStatus, event: string) { super(`Invalid transition: ${from} via ${event}`); this.name = 'InvalidTransitionError'; (this as Error & { status?: number }).status = 409; }
}
export class SubscriptionStateMachine {
  transition(from: SubscriptionStatus, event: PaymentEventType | 'cancel' | 'payment.retry.succeeded' | 'trial.charge.failed'): SubscriptionStatus {
    const next = transitions[from][event];
    if (!next) throw new InvalidTransitionError(from, event);
    return next;
  }
  canTransition(from: SubscriptionStatus, event: PaymentEventType | 'cancel' | 'payment.retry.succeeded' | 'trial.charge.failed'): boolean {
    return Boolean(transitions[from][event]);
  }
}
