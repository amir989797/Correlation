
export interface TsetmcDataPoint {
  date: string; // YYYYMMDD
  close: number;
}

export interface MergedDataPoint {
  date: string;
  price1: number;
  price2: number;
}

export interface ChartDataPoint {
  date: string; // Formatted for display
  timestamp: number; // For sorting/axis
  price1: number; // Price of first symbol on this date
  price2: number; // Price of second symbol on this date
  ma100_price1: number | null;
  ma100_price2: number | null;
  ma200_price1: number | null;
  ma200_price2: number | null;
  dist_ma100_1?: number | null; // % Distance from MA100 for symbol 1
  dist_ma100_2?: number | null; // % Distance from MA100 for symbol 2
  
  // Ratio specific fields
  ratio?: number;
  ma100_ratio?: number | null;
  ma200_ratio?: number | null;
  dist_ma100_ratio?: number | null;

  [key: string]: any; // Dynamic keys for correlations e.g. 'corr_7', 'corr_30'
}

export interface SearchResult {
  symbol: string;
  name: string;
}

export interface AssetGroup {
  symbol: string;
  type: 'equity' | 'leveraged' | 'gold' | 'fixed';
  url?: string;
  is_default?: boolean;
  last_return?: number;
}

export enum FetchStatus {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR
}
