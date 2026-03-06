// Vercel serverless function — license key validation
// POST /api/validate { key, repo }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  const { key, repo } = req.body || {};

  if (!key) {
    return res.status(400).json({ valid: false, error: 'No license key provided' });
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ valid: false, error: 'KV not configured', debug: { hasUrl: !!KV_URL, hasToken: !!KV_TOKEN } });
  }

  try {
    const response = await fetch(`${KV_URL}/get/${encodeURIComponent('license:' + key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });

    const data = await response.json();

    if (!data.result) {
      return res.status(403).json({ valid: false, error: 'Invalid license key' });
    }

    let licenseData;
    try { licenseData = JSON.parse(data.result); } catch { licenseData = data.result; }

    // Update last used
    await fetch(`${KV_URL}/set/${encodeURIComponent('license:' + key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify({ ...licenseData, lastUsed: new Date().toISOString(), lastRepo: repo })),
    });

    return res.status(200).json({ valid: true, plan: licenseData.plan || 'team' });
  } catch (err) {
    return res.status(500).json({ valid: false, error: 'Validation failed', detail: err.message });
  }
}
