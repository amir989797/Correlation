
import { TsetmcDataPoint, SearchResult } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Searches for symbols via the backend API.
 */
export const searchSymbols = async (query: string): Promise<SearchResult[]> => {
  if (!query || query.length < 2) return [];
  
  try {
    const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Search failed');
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
};

/**
 * Fetches historical data for a given Symbol from the backend API.
 */
export const fetchStockHistory = async (symbol: string): Promise<{ data: TsetmcDataPoint[], name: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/history/${encodeURIComponent(symbol)}`);
    
    if (!response.ok) {
      if (response.status === 404) throw new Error('نماد پیدا نشد.');
      throw new Error('خطا در دریافت اطلاعات از سرور.');
    }

    const json = await response.json();
    
    // Map API response (YYYY-MM-DD) to TsetmcDataPoint (YYYYMMDD)
    const data: TsetmcDataPoint[] = json.map((item: any) => ({
      date: item.date.replace(/-/g, ''), // Convert 2023-01-01 to 20230101
      close: item.close
    }));

    return {
      data,
      name: symbol // The backend returns just data, so we use the requested symbol as name
    };

  } catch (e: any) {
    console.error("Fetch failed:", e.message);
    throw new Error('عدم موفقیت در برقراری ارتباط با سرور.');
  }
};
