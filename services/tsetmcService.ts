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
        throw new Error(`Search Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Search Error:', error);
    // Return empty array instead of throwing to prevent UI crash on typing
    return [];
  }
};

/**
 * Fetches historical data for a given Symbol from the backend API.
 */
export const fetchStockHistory = async (symbol: string): Promise<{ data: TsetmcDataPoint[], name: string }> => {
  try {
    // Request a large limit to get full history for accurate long-term correlation
    // The backend defaults to 365 if limit is not specified.
    const url = `${API_BASE_URL}/history/${encodeURIComponent(symbol)}?limit=10000`;
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 404) throw new Error('نماد مورد نظر یافت نشد.');
      throw new Error(`خطای سرور: ${response.status}`);
    }

    const json = await response.json();
    
    if (!Array.isArray(json) || json.length === 0) {
        throw new Error('داده‌ای برای این نماد یافت نشد.');
    }

    // Map API response to TsetmcDataPoint
    const data: TsetmcDataPoint[] = json.map((item: any) => ({
      date: item.date, // Backend provides YYYYMMDD string
      close: item.close
    }));

    return {
      data,
      name: symbol 
    };

  } catch (e: any) {
    console.error("Fetch History Failed:", e);
    // Provide user-friendly error messages
    if (e.message.includes('Failed to fetch')) {
        throw new Error('عدم دسترسی به سرور. لطفا از اجرای فایل main.py اطمینان حاصل کنید.');
    }
    throw new Error(e.message || 'خطا در دریافت اطلاعات.');
  }
};
