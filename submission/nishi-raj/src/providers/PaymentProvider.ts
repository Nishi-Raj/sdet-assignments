import type { PaymentOutcome } from '../domain/types';
export interface ChargeRequest { customerId: string; paymentMethodId: string; amount: number; idempotencyKey: string }
export interface ChargeResult { outcome: PaymentOutcome; reference: string }
export interface PaymentProvider { charge(request: ChargeRequest): Promise<ChargeResult> }
export class FakePaymentProvider implements PaymentProvider {
  readonly calls: ChargeRequest[] = [];
  outcome: PaymentOutcome = 'success';
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    this.calls.push({ ...request });
    return { outcome: this.outcome, reference: `pay_${request.idempotencyKey}` };
  }
}
