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
  [key: string]: any; // Dynamic keys for correlations e.g. 'corr_7', 'corr_30'
}

export enum FetchStatus {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR
}