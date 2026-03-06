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

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers['x-signature'];
  const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  if (signature !== hmac) {
    return res.status(401).json({ error: 'Invalid signature', got: signature, expected: hmac });
  }

  const event = JSON.parse(rawBody);
  const eventName = event.meta?.event_name;
  if (eventName !== 'order_created') return res.status(200).json({ ok: true });

  const order = event.data?.attributes;
  const email = order?.user_email;

  // Use the LS license key directly as our key
  const licenseKey = event.data?.relationships?.license_keys?.data?.[0]?.id
    || event.meta?.custom_data?.license_key
    || `DS-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

  await kvSet(`license:${licenseKey}`, {
    email,
    plan: 'team',
    createdAt: new Date().toISOString(),
    orderId: event.data?.id,
  });

  console.log(`New license: ${licenseKey} for ${email}`);
  return res.status(200).json({ ok: true });
}
