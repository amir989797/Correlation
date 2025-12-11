import { parseTsetmcCsv } from '../utils/mathUtils';
import { TsetmcDataPoint } from '../types';

/**
 * Extracts the 'i' parameter (ID) from a TSETMC URL.
 * Supports Loader.aspx and other common patterns.
 */
export const extractIdFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    return params.get('i');
  } catch (e) {
    // Try regex if URL parsing fails (e.g. partial URL)
    const match = url.match(/[?&]i=(\d+)/);
    return match ? match[1] : null;
  }
};

/**
 * Generates the direct download link for a TSETMC ID.
 */
export const getDownloadLink = (id: string): string => {
  return `http://old.tsetmc.com/tsev2/data/Export-txt.aspx?t=i&a=1&b=0&i=${id}`;
};

/**
 * Fetches historical data for a given TSETMC ID.
 * Returns null if all automated attempts fail, allowing the UI to fallback to manual mode.
 */
export const fetchStockHistory = async (id: string): Promise<{ data: TsetmcDataPoint[], name: string }> => {
  const downloadLink = getDownloadLink(id);
  const targetUrl = downloadLink; 
  
  // Define strategies with different URL constructions
  const strategies = [
    // 1. CodeTabs: Very robust for text/csv
    { 
      name: 'CodeTabs',
      gen: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
    },
    // 2. AllOrigins Raw: Good backup
    { 
      name: 'AllOrigins',
      gen: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
    },
    // 3. CorsProxy: Fallback
    { 
      name: 'CorsProxy',
      gen: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`
    }
  ];

  let lastError: unknown;

  for (const strategy of strategies) {
    try {
      const proxyUrl = strategy.gen(targetUrl);
      console.log(`Attempting fetch via ${strategy.name}...`);
      
      const response = await fetchWithTimeout(proxyUrl, 10000);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      return validateAndParse(text);

    } catch (e: any) {
      console.warn(`${strategy.name} failed:`, e.message);
      lastError = e;
      // Continue to next strategy
    }
  }

  console.error("All fetch attempts failed. Switching to manual mode.");
  // Throw a specific error that the UI recognizes to trigger the "Browser Download" fallback
  throw new Error('FALLBACK_TO_BROWSER');
};

// Helper: Fetch with timeout
const fetchWithTimeout = async (url: string, timeout = 10000): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
};

// Helper: Validate content
const validateAndParse = (text: string): { data: TsetmcDataPoint[], name: string } => {
  if (!text || text.trim().length === 0) {
    throw new Error('Received empty response');
  }
  // Check for HTML error pages or JSON errors from proxies
  if (text.trim().startsWith('<') || text.includes('"contents":') || text.includes('Access Denied')) {
     // Some proxies return JSON with error or HTML on 200 OK
     // Try to see if it looks like CSV
     if (!text.includes(',')) {
        throw new Error('Response is not CSV');
     }
  }
  return parseTsetmcCsv(text);
};