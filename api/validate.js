// Vercel serverless function — license key validation
// POST /api/validate { key, repo }

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvGet(key) {
  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(key, value) {
  await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(JSON.stringify(value)),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  const { key, repo } = req.body || {};

  if (!key) {
    return res.status(400).json({ valid: false, error: 'No license key provided' });
  }

  try {
    const licenseData = await kvGet(`license:${key}`);

    if (!licenseData) {
      return res.status(403).json({ valid: false, error: 'Invalid license key' });
    }

    // Update last used
    await kvSet(`license:${key}`, {
      ...licenseData,
      lastUsed: new Date().toISOString(),
      lastRepo: repo,
    });

    return res.status(200).json({ valid: true, plan: licenseData.plan });
  } catch (err) {
    console.error('Validation error:', err);
    return res.status(500).json({ valid: false, error: 'Validation service unavailable' });
  }
}
