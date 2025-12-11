
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
 */
export const fetchStockHistory = async (id: string): Promise<{ data: TsetmcDataPoint[], name: string }> => {
  const downloadLink = getDownloadLink(id);
  const targetUrl = downloadLink; 
  
  // Define strategies with different URL constructions
  // Prioritize CorsProxy as it is currently the most stable for TSETMC
  const strategies = [
    // 1. CorsProxy: High availability, usually fast
    { 
      name: 'CorsProxy',
      gen: (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`
    },
    // 2. AllOrigins: Reliable but sometimes caches responses
    { 
      name: 'AllOrigins',
      gen: (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
    },
    // 3. CodeTabs: Strict rate limits but good fallback
    { 
      name: 'CodeTabs',
      gen: (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
    }
  ];

  let lastError: unknown;

  for (const strategy of strategies) {
    try {
      const proxyUrl = strategy.gen(targetUrl);
      console.log(`Attempting fetch via ${strategy.name}...`);
      
      // Increased timeout to 20s because old.tsetmc is slow
      const response = await fetchWithTimeout(proxyUrl, 20000);
      
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

  console.error("All fetch attempts failed.");
  throw new Error('عدم موفقیت در دریافت اطلاعات. لطفا از روش آپلود فایل دستی استفاده کنید یا بعدا تلاش کنید.');
};

// Helper: Fetch with timeout
const fetchWithTimeout = async (url: string, timeout = 20000): Promise<Response> => {
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
  // TSETMC sometimes returns a generic ASP.NET error page starting with <
  if (text.trim().startsWith('<') || text.includes('"contents":') || text.includes('Access Denied')) {
     // Check if it's really not CSV (sometimes CSVs have some HTML garbage at the end, but header should be CSV)
     // A valid TSETMC CSV starts with a header row like <TICKER>,<DTYYYYMMDD>,...
     if (!text.includes('<TICKER>') && !text.includes('<DTYYYYMMDD>')) {
        throw new Error('Response is not valid TSETMC CSV');
     }
  }
  return parseTsetmcCsv(text);
};
