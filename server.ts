import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HMAC_SECRET = process.env.PAYMENT_HMAC_SECRET || 'youthgo-local-gateway-hmac-key';

const COUNTRY_CONFIG: Record<
  string,
  {
    currencyCode: string;
    gateways: string[];
    baseDeliveryFee: number;
    perKmFee: number;
    usdRate: number;
  }
> = {
  BD: { currencyCode: 'BDT', gateways: ['SSLCommerz', 'bKash', 'Nagad'], baseDeliveryFee: 60, perKmFee: 20, usdRate: 0.0084 },
  IN: { currencyCode: 'INR', gateways: ['Razorpay', 'UPI'], baseDeliveryFee: 40, perKmFee: 12, usdRate: 0.0119 },
  US: { currencyCode: 'USD', gateways: ['Stripe'], baseDeliveryFee: 3.5, perKmFee: 1.1, usdRate: 1.0 },
  GB: { currencyCode: 'GBP', gateways: ['Stripe UK', 'Faster Payments'], baseDeliveryFee: 2.9, perKmFee: 0.9, usdRate: 1.27 },
  SA: { currencyCode: 'SAR', gateways: ['Moyasar', 'Mada'], baseDeliveryFee: 12, perKmFee: 3.5, usdRate: 0.2666 },
};

const processedIntents = new Map<string, { paymentReference: string; gatewaySignature: string; amount: number; currencyCode: string }>();

function collectFilesRecursive(baseDir: string, prefix: string): Array<{ path: string; content: string }> {
  const results: Array<{ path: string; content: string }> = [];
  if (!fs.existsSync(baseDir)) return results;

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.gradle' || entry.name === 'lib') {
      continue;
    }
    const fullPath = path.join(baseDir, entry.name);
    const relPath = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(fullPath, relPath));
    } else if (entry.isFile()) {
      const content = fs.readFileSync(fullPath, 'utf8');
      results.push({ path: relPath, content });
    }
  }
  return results;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'youthgo-api' });
  });

  app.post('/api/delivery/calculate-sla', (req, res) => {
    const { countryCode, distanceKm } = req.body as { countryCode?: string; distanceKm?: number };
    const cfg = COUNTRY_CONFIG[countryCode || 'US'];
    if (!cfg) {
      res.status(400).json({ error: 'Unsupported countryCode' });
      return;
    }

    const safeDistance = Math.max(0.5, Number(distanceKm || 1.5));
    const isShortRange = safeDistance <= 2.0;
    const estimatedMinutes = isShortRange ? 60 : safeDistance <= 5.0 ? 90 : 120;
    const slaWindowLabel = isShortRange ? '1 hour (1-2 km)' : '1.5-2 hours (>2 km)';
    const deliveryFee = Number((cfg.baseDeliveryFee + safeDistance * cfg.perKmFee).toFixed(2));
    const riderPayout = Number((deliveryFee * 0.85).toFixed(2));

    res.json({
      countryCode,
      currencyCode: cfg.currencyCode,
      distanceKm: safeDistance,
      estimatedMinutes,
      slaWindowLabel,
      deliveryFee,
      riderPayout,
    });
  });

  app.post('/api/payments/create-intent', (req, res) => {
    const { countryCode, currencyCode, gateway, amount, orderId, idempotencyKey } = req.body as {
      countryCode?: string;
      currencyCode?: string;
      gateway?: string;
      amount?: number;
      orderId?: string;
      idempotencyKey?: string;
    };

    const cfg = COUNTRY_CONFIG[countryCode || ''];
    if (!cfg || cfg.currencyCode !== currencyCode) {
      res.status(400).json({ error: 'Country and currency mismatch' });
      return;
    }
    if (!gateway || !cfg.gateways.includes(gateway)) {
      res.status(400).json({ error: `Gateway ${gateway} is not authorized for ${countryCode}` });
      return;
    }
    if (!amount || amount <= 0 || !orderId || !idempotencyKey) {
      res.status(400).json({ error: 'Invalid amount, orderId, or idempotencyKey' });
      return;
    }

    const existing = processedIntents.get(idempotencyKey);
    if (existing) {
      res.json({ ...existing, deduplicated: true, status: 'verified' });
      return;
    }

    const paymentReference = `${gateway.toLowerCase().replace(/\s+/g, '_')}_${orderId}_${crypto.randomBytes(4).toString('hex')}`;
    const payload = `${idempotencyKey}:${orderId}:${amount}:${currencyCode}:${gateway}`;
    const gatewaySignature = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');

    const record = { paymentReference, gatewaySignature, amount, currencyCode };
    processedIntents.set(idempotencyKey, record);

    res.json({
      ...record,
      deduplicated: false,
      status: 'verified',
      amountUsd: Number((amount * cfg.usdRate).toFixed(2)),
    });
  });

  app.post('/api/payments/verify', (req, res) => {
    const { idempotencyKey, orderId, amount, currencyCode, gateway, gatewaySignature } = req.body as {
      idempotencyKey?: string;
      orderId?: string;
      amount?: number;
      currencyCode?: string;
      gateway?: string;
      gatewaySignature?: string;
    };

    if (!idempotencyKey || !orderId || !amount || !currencyCode || !gateway || !gatewaySignature) {
      res.status(400).json({ valid: false, error: 'Missing verification fields' });
      return;
    }

    const payload = `${idempotencyKey}:${orderId}:${amount}:${currencyCode}:${gateway}`;
    const expected = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
    const valid =
      gatewaySignature.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(gatewaySignature), Buffer.from(expected));

    if (!valid) {
      res.status(401).json({ valid: false, error: 'Invalid HMAC signature' });
      return;
    }

    res.json({ valid: true, orderId, idempotencyKey });
  });

  app.get('/api/android-bundle', (_req, res) => {
    const files = [
      ...collectFilesRecursive(path.join(__dirname, 'android-youthgo'), 'android-youthgo'),
      ...collectFilesRecursive(path.join(__dirname, 'functions'), 'functions'),
    ];
    for (const rootFile of ['firestore.rules', 'firebase-blueprint.json', 'security_spec.md', 'firestore.rules.test.ts']) {
      const fullPath = path.join(__dirname, rootFile);
      if (fs.existsSync(fullPath)) {
        files.push({ path: rootFile, content: fs.readFileSync(fullPath, 'utf8') });
      }
    }
    res.json({ files });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YouthGo server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
