/**
 * Normalizes user-input API URLs by fixing common typos (e.g. missing 'h' in 'https://')
 * and ensuring an explicit protocol is present.
 */
export const normalizeApiUrl = (rawUrl: string): string => {
  let url = (rawUrl || '').trim();
  if (!url) return '';
  if (url.startsWith('/')) return url;

  // Fix common typo: ttps:// or ttp:// (user typed fast or missed leading 'h')
  if (/^ttps?:\/\//i.test(url)) {
    url = 'h' + url;
  } else if (/^\/\//.test(url)) {
    url = 'https:' + url;
  } else if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)) {
    // If no protocol at all (e.g. dummyjson.com/products or localhost:3000/api)
    if (url.startsWith('localhost') || url.startsWith('127.0.0.1')) {
      url = 'http://' + url;
    } else {
      url = 'https://' + url;
    }
  }

  return url;
};

export interface ApiFetchResult {
  status: number;
  statusText: string;
  ok: boolean;
  timeMs: number;
  data: any;
  normalizedUrl: string;
  error?: string;
}

/**
 * Safely extracts a nested property or array element from a JSON response.
 * Supports dot notation ('data.items') and array indexing ('items[0].title', 'items.0.title').
 * Returns undefined gracefully if the path does not exist.
 */
export const extractJsonPath = (data: any, pathStr?: string): any => {
  if (!pathStr || !pathStr.trim()) return data;
  if (data === null || data === undefined) return undefined;

  const clean = pathStr.trim();
  if (data && data[clean] !== undefined) return data[clean];

  // Normalize array notation e.g. "items[0].name" or "[0].title" -> "items.0.name"
  let normalizedPath = clean.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
  if (normalizedPath.startsWith('data.') && !(data && typeof data === 'object' && 'data' in data)) {
    normalizedPath = normalizedPath.slice(5);
  }
  const parts = normalizedPath.split('.').filter(Boolean);

  let current = data;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current !== undefined ? current : data[clean];
};

/**
 * Extracts a human-readable error message from an API response data payload or status.
 */
export const getApiErrorMessage = (res: { status?: number; statusText?: string; data?: any }, defaultMsg = 'Request failed'): string => {
  if (res?.data) {
    if (typeof res.data === 'string' && res.data.trim()) {
      return res.data.length > 200 ? res.data.slice(0, 197) + '...' : res.data;
    }
    if (typeof res.data === 'object') {
      if (res.data.message && typeof res.data.message === 'string') return res.data.message;
      if (res.data.error && typeof res.data.error === 'string') return res.data.error;
      if (res.data.title && typeof res.data.title === 'string') return res.data.title;
    }
  }
  if (res?.status) {
    return `HTTP ${res.status}: ${res.statusText || defaultMsg}`;
  }
  return defaultMsg;
};

/**
 * Executes an API fetch with automatic URL normalization.
 * If direct browser fetch fails (e.g. CORS block), attempts a proxy request through the backend.
 */
export const executeApiFetch = async (
  rawUrl: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {}
): Promise<ApiFetchResult> => {
  const url = normalizeApiUrl(rawUrl);
  if (!url) {
    throw new Error('URL cannot be empty');
  }

  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  let body = options.body;

  const fetchInit: RequestInit = {
    method,
    headers,
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && body !== undefined && body !== null && body !== '') {
    fetchInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const startTime = performance.now();

  try {
    const res = await fetch(url, fetchInit);
    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);

    let data: any;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    return {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      timeMs,
      data,
      normalizedUrl: url,
    };
  } catch (directErr: any) {
    // Fallback: try proxying through backend in case of CORS or direct fetch failure
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const proxyRes = await fetch(`${API_URL}/proxy-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          method,
          headers,
          body,
        }),
      });

      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        const endTime = performance.now();
        return {
          status: proxyData.status || 200,
          statusText: proxyData.statusText || 'OK (via Studio Proxy)',
          ok: proxyData.ok ?? true,
          timeMs: Math.round(endTime - startTime),
          data: proxyData.data,
          normalizedUrl: url,
        };
      }
    } catch {
      // Ignore proxy error and throw informative direct error
    }

    const endTime = performance.now();
    let msg = directErr?.message || 'Failed to fetch';
    if (msg === 'Failed to fetch') {
      msg = 'Failed to fetch. Check endpoint URL, network connection, or CORS policy.';
    }
    const err: any = new Error(msg);
    err.timeMs = Math.round(endTime - startTime);
    throw err;
  }
};
