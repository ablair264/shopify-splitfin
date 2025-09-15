// Zoho Token Refresh API Endpoint
// This can be deployed as a serverless function or Express.js route

const ZOHO_CLIENT_ID = '1000.AV9M9OMELL7FB7UMDLDV4TXPPYM0CZ';
const ZOHO_CLIENT_SECRET = 'bcb3b1358539f7343a05023ab71ea5704706faaa2a';
const ZOHO_REFRESH_TOKEN = '1000.ebc8fd1267ba4edca22abcfd25263212.c45dadbd00483ad07d0d395e824c8e39';
const ZOHO_AUTH_URL = 'https://accounts.zoho.eu/oauth/v2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${ZOHO_AUTH_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: ZOHO_REFRESH_TOKEN,
        client_id: ZOHO_CLIENT_ID,
        client_secret: ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error(`Zoho API error: ${response.status}`);
    }

    const data = await response.json();
    
    res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in || 3600 // Default to 1 hour if not provided
    });

  } catch (error) {
    console.error('Error refreshing Zoho token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
}