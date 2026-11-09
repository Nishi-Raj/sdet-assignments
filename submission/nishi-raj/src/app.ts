import express from 'express';
import { BillingService } from './clients/BillingService';
export function createApp(service: BillingService) {
  const app = express();
  app.use(express.raw({ type: 'application/json' }));
  app.post('/subscriptions', async (req, res) => {
    try { const body = JSON.parse((req.body as Buffer).toString('utf8')); const result = await service.createSubscription(body); res.status(201).json(result); }
    catch (error) { const e = error as Error & { status?: number }; res.status(e.status ?? 500).json({ error: e.message }); }
  });
  app.get('/subscriptions/:id', (req, res) => {
    try { res.json(service.getSubscription(req.params.id)); }
    catch (error) { const e = error as Error & { status?: number }; res.status(e.status ?? 500).json({ error: e.message }); }
  });
  app.post('/subscriptions/:id/cancel', async (req, res) => {
    try { res.json(await service.cancel(req.params.id)); }
    catch (error) { const e = error as Error & { status?: number }; res.status(e.status ?? 500).json({ error: e.message }); }
  });
  app.post('/webhooks/payment-provider', async (req, res) => {
    try { const raw = (req.body as Buffer).toString('utf8'); const signature = req.header('X-Provider-Signature') ?? ''; res.json(await service.processWebhook(raw, signature)); }
    catch (error) { const e = error as Error & { status?: number }; res.status(e.status ?? 500).json({ error: e.message }); }
  });
  return app;
}
