// Vercel serverless function — Lemon Squeezy webhook
// POST /api/webhook

import crypto from 'crypto';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value)),
  });
}

function generateKey() {
  return 'DS-' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // Verify Lemon Squeezy signature
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers['x-signature'];
  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (signature !== hmac) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  const eventName = event.meta?.event_name;

  if (eventName !== 'order_created') {
    return res.status(200).json({ ok: true });
  }

  const order = event.data?.attributes;
  const email = order?.user_email;
  const variantId = String(order?.first_order_item?.variant_id);

  const planMap = {
    [process.env.VARIANT_SOLO]: 'solo',
    [process.env.VARIANT_TEAM]: 'team',
    [process.env.VARIANT_UNLIMITED]: 'unlimited',
  };
  const plan = planMap[variantId] || 'team';

  const key = generateKey();
  await kvSet(`license:${key}`, {
    email,
    plan,
    createdAt: new Date().toISOString(),
    orderId: event.data?.id,
  });

  console.log(`New license: ${key} for ${email} (${plan})`);

  return res.status(200).json({ ok: true, key });
}
