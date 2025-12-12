
import { TsetmcDataPoint, SearchResult } from '../types';

// Updated API URL to point to the server IP
const API_BASE_URL = 'http://109.94.164.70:8000/api';

/**
 * Searches for symbols via the backend API.
 */
export const searchSymbols = async (query: string): Promise<SearchResult[]> => {
  if (!query || query.length < 2) return [];
  
  try {
    const url = `${API_BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        // Try to read the error body if available
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        throw new Error(`Server Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Search Request Failed:', error);
    return [];
  }
};

/**
 * Fetches historical data for a given Symbol from the backend API.
 */
export const fetchStockHistory = async (symbol: string): Promise<{ data: TsetmcDataPoint[], name: string }> => {
  try {
    const url = `${API_BASE_URL}/history/${encodeURIComponent(symbol)}?limit=10000`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`History Fetch Error (${response.status}):`, errorText);

      if (response.status === 404) throw new Error('نماد مورد نظر یافت نشد.');
      if (response.status === 500) throw new Error('خطای پایگاه داده.');
      throw new Error(`خطای سرور: ${response.status}`);
    }

    const json = await response.json();
    
    if (!Array.isArray(json) || json.length === 0) {
        throw new Error('داده‌ای برای این نماد یافت نشد.');
    }

    const data: TsetmcDataPoint[] = json.map((item: any) => ({
      date: item.date,
      close: item.close
    }));

    return {
      data,
      name: symbol 
    };

  } catch (e: any) {
    console.error("Fetch History Failed:", e);
    if (e.message.includes('Failed to fetch')) {
        throw new Error('عدم دسترسی به سرور. لطفا بررسی کنید که بک‌اند Node.js اجرا باشد.');
    }
    throw new Error(e.message || 'خطا در دریافت اطلاعات.');
  }
};
