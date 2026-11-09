import type { AuditEntry, Customer, Invoice, Subscription, WebhookEvent } from '../domain/types';
export class InMemoryBillingRepository {
  readonly customers = new Map<string, Customer>();
  readonly subscriptions = new Map<string, Subscription>();
  readonly invoices = new Map<string, Invoice>();
  readonly webhookEvents = new Map<string, WebhookEvent>();
  readonly audit: AuditEntry[] = [];
  seedCustomer(customer: Customer) { this.customers.set(customer.id, { ...customer }); }
  getCustomer(id: string) { const value = this.customers.get(id); return value ? { ...value } : undefined; }
  saveSubscription(value: Subscription) { this.subscriptions.set(value.id, { ...value }); return { ...value }; }
  getSubscription(id: string) { const value = this.subscriptions.get(id); return value ? { ...value } : undefined; }
  saveInvoice(value: Invoice) { this.invoices.set(value.id, { ...value }); return { ...value }; }
  listInvoices(subscriptionId: string) { return [...this.invoices.values()].filter(x => x.subscriptionId === subscriptionId).map(x => ({ ...x })); }
  hasWebhook(eventId: string) { return this.webhookEvents.has(eventId); }
  saveWebhook(value: WebhookEvent) { this.webhookEvents.set(value.eventId, { ...value }); }
  addAudit(value: AuditEntry) { this.audit.push({ ...value }); }
  reset() { this.subscriptions.clear(); this.invoices.clear(); this.webhookEvents.clear(); this.audit.length = 0; }
}
