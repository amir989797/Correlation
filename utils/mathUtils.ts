import { TsetmcDataPoint, MergedDataPoint, ChartDataPoint } from '../types';

/**
 * Parses raw CSV content from TSETMC.
 * Expected columns often include: <DTYYYYMMDD> and <CLOSE>
 * Also attempts to extract <TICKER>
 */
export const parseTsetmcCsv = (csvText: string): { data: TsetmcDataPoint[], name: string } => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { data: [], name: '' };

  const headers = lines[0].split(',');
  
  // Find column indices
  const dateIndex = headers.findIndex(h => h.includes('<DTYYYYMMDD>'));
  const closeIndex = headers.findIndex(h => h.includes('<CLOSE>'));
  const tickerIndex = headers.findIndex(h => h.includes('<TICKER>'));

  if (dateIndex === -1 || closeIndex === -1) {
    throw new Error('فرمت فایل CSV نامعتبر است. ستون‌های تاریخ یا قیمت پایانی یافت نشدند.');
  }

  const data: TsetmcDataPoint[] = [];
  let name = '';

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length <= Math.max(dateIndex, closeIndex)) continue;

    const date = row[dateIndex].trim();
    const close = parseFloat(row[closeIndex]);
    
    // Try to grab name from the first valid row
    if (!name && tickerIndex !== -1 && row[tickerIndex]) {
      name = row[tickerIndex].trim();
    }

    if (date && !isNaN(close)) {
      data.push({ date, close });
    }
  }

  // Sort by date ascending
  return { 
    data: data.sort((a, b) => a.date.localeCompare(b.date)),
    name: name || 'نامشخص'
  };
};

/**
 * Aligns two datasets by date (Inner Join)
 */
export const alignDataByDate = (data1: TsetmcDataPoint[], data2: TsetmcDataPoint[]): MergedDataPoint[] => {
  const map2 = new Map(data2.map(d => [d.date, d.close]));
  const merged: MergedDataPoint[] = [];

  for (const d1 of data1) {
    if (map2.has(d1.date)) {
      merged.push({
        date: d1.date,
        price1: d1.close,
        price2: map2.get(d1.date)!
      });
    }
  }
  return merged;
};

/**
 * Calculates Pearson Correlation Coefficient for a set of pairs
 */
const calculatePearson = (x: number[], y: number[]): number => {
  const n = x.length;
  if (n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  if (denominator === 0) return 0;
  return numerator / denominator;
};

/**
 * Helper to calculate SMA for a specific index and window
 */
const calculateSMA = (data: number[], index: number, window: number): number | null => {
  if (index < window - 1) return null;
  let sum = 0;
  for (let i = 0; i < window; i++) {
    sum += data[index - i];
  }
  return sum / window;
};

/**
 * Converts YYYYMMDD string to Shamsi date string (YYYY/MM/DD)
 */
const toShamsi = (gregorianDate: string): string => {
  try {
    const year = parseInt(gregorianDate.substring(0, 4));
    const month = parseInt(gregorianDate.substring(4, 6)) - 1;
    const day = parseInt(gregorianDate.substring(6, 8));
    const date = new Date(year, month, day);
    
    // Use Intl to convert to Persian Calendar
    return new Intl.DateTimeFormat('fa-IR', {
      calendar: 'persian',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    } as any).format(date);
  } catch (e) {
    return gregorianDate; // Fallback
  }
};

/**
 * Calculates rolling correlations for multiple window sizes and MAs (MA100, MA200)
 */
export const calculateRollingCorrelations = (mergedData: MergedDataPoint[], windowSizes: number[]): ChartDataPoint[] => {
  const results: ChartDataPoint[] = [];

  // Extract full price arrays for easier SMA calculation
  const prices1 = mergedData.map(d => d.price1);
  const prices2 = mergedData.map(d => d.price2);

  for (let i = 0; i < mergedData.length; i++) {
    const currentDayData = mergedData[i];
    const rawDate = currentDayData.date;
    
    // Calculate correct timestamp from Gregorian date
    const gy = parseInt(rawDate.slice(0, 4));
    const gm = parseInt(rawDate.slice(4, 6)) - 1;
    const gd = parseInt(rawDate.slice(6, 8));
    const timestamp = new Date(gy, gm, gd).getTime();

    const formattedDate = toShamsi(rawDate);

    // Calculate MA100
    const ma100_1 = calculateSMA(prices1, i, 100);
    const ma100_2 = calculateSMA(prices2, i, 100);

    // Calculate MA200
    const ma200_1 = calculateSMA(prices1, i, 200);
    const ma200_2 = calculateSMA(prices2, i, 200);

    const point: ChartDataPoint = {
      date: formattedDate,
      timestamp: timestamp,
      price1: currentDayData.price1,
      price2: currentDayData.price2,
      ma100_price1: ma100_1,
      ma100_price2: ma100_2,
      ma200_price1: ma200_1,
      ma200_price2: ma200_2
    };

    // Calculate correlation for each window size
    windowSizes.forEach(w => {
      // We need at least 'w' data points ending at 'i'
      if (i >= w - 1) {
        const slice = mergedData.slice(i - w + 1, i + 1);
        const x = slice.map(d => d.price1);
        const y = slice.map(d => d.price2);
        const correlation = calculatePearson(x, y);
        point[`corr_${w}`] = parseFloat(correlation.toFixed(4));
      } else {
        point[`corr_${w}`] = null;
      }
    });

    results.push(point);
  }

  return results;
};