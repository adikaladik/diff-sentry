// Vercel serverless function — license key validation
// POST /api/validate { key, repo }

const MASTER_KEYS = process.env.MASTER_KEYS ? process.env.MASTER_KEYS.split(',') : [];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  const { key, repo } = req.body || {};

  if (!key) {
    return res.status(400).json({ valid: false, error: 'No license key provided' });
  }

  // Check against Vercel KV store
  try {
    const { kv } = await import('@vercel/kv');
    const licenseData = await kv.get(`license:${key}`);

    if (!licenseData) {
      return res.status(403).json({ valid: false, error: 'Invalid license key' });
    }

    // Log usage
    await kv.set(`license:${key}`, {
      ...licenseData,
      lastUsed: new Date().toISOString(),
      lastRepo: repo,
    });

    return res.status(200).json({ valid: true, plan: licenseData.plan });
  } catch (err) {
    // If KV not available, check master keys
    if (MASTER_KEYS.includes(key)) {
      return res.status(200).json({ valid: true, plan: 'unlimited' });
    }
    return res.status(500).json({ valid: false, error: 'Validation service unavailable' });
  }
}
