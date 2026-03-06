import crypto from 'crypto';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = Buffer.alloc(0);
    req.on('data', chunk => data = Buffer.concat([data, chunk]));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value)),
  });
}

function generateKey() {
  return 'DS-' + crypto.randomBytes(12).toString('hex').toUpperCase();
}

async function sendLicenseEmail(email, licenseKey) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Diff Sentry <hello@diffsentry.dev>',
      to: email,
      subject: '🛡️ Your Diff Sentry License Key',
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; font-weight: 700;">Thanks for purchasing Diff Sentry!</h1>
          <p style="color: #555;">Here's your license key:</p>
          <div style="background: #0d1117; color: #e6edf3; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 18px; letter-spacing: 1px; text-align: center; margin: 24px 0;">
            ${licenseKey}
          </div>
          <p style="color: #555;">Add it to your GitHub Actions workflow:</p>
          <pre style="background: #f6f8fa; padding: 16px; border-radius: 8px; font-size: 13px; overflow-x: auto;">- uses: adikaladik/diff-sentry@main
  with:
    github-token: \${{ secrets.GITHUB_TOKEN }}
    license-key: ${licenseKey}</pre>
          <p style="color: #555;">Or save it as a GitHub secret <code>DIFF_SENTRY_KEY</code> and use:</p>
          <pre style="background: #f6f8fa; padding: 16px; border-radius: 8px; font-size: 13px;">license-key: \${{ secrets.DIFF_SENTRY_KEY }}</pre>
          <p style="color: #888; font-size: 13px;">Questions? Reply to this email.</p>
          <p style="color: #888; font-size: 13px;">— Diff Sentry</p>
        </div>
      `,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  // Verify Stripe signature
  if (STRIPE_WEBHOOK_SECRET) {
    try {
      const parts = sig.split(',').reduce((acc, part) => {
        const [k, v] = part.split('=');
        acc[k] = v;
        return acc;
      }, {});
      const payload = `${parts.t}.${rawBody}`;
      const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(payload).digest('hex');
      if (expected !== parts.v1) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    } catch (e) {
      return res.status(401).json({ error: 'Signature error' });
    }
  }

  const event = JSON.parse(rawBody);

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ ok: true });
  }

  const session = event.data.object;
  const email = session.customer_details?.email || session.customer_email;

  if (!email) return res.status(200).json({ ok: true, note: 'no email' });

  const licenseKey = generateKey();

  await kvSet(`license:${licenseKey}`, {
    email,
    plan: 'team',
    createdAt: new Date().toISOString(),
    stripeSessionId: session.id,
  });

  await sendLicenseEmail(email, licenseKey);

  console.log(`License ${licenseKey} sent to ${email}`);
  return res.status(200).json({ ok: true });
}
