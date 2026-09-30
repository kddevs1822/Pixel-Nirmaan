import { Request, Response } from 'express';

export const proxyRequest = async (req: Request, res: Response) => {
  try {
    const { url, method = 'GET', headers = {}, body } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid URL is required' });
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
      options.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';

    let data: any;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return res.status(200).json({
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      data,
    });
  } catch (error: any) {
    console.error('Proxy request failed:', error);
    return res.status(500).json({
      error: error.message || 'Proxy request failed',
      status: 500,
      ok: false,
    });
  }
};
