
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
  // Clean dates (remove dashes if present from DB) for robust comparison
  const cleanDate = (d: string) => d.replace(/-/g, '').substring(0, 8);
  
  const map2 = new Map(data2.map(d => [cleanDate(d.date), d.close]));
  const merged: MergedDataPoint[] = [];

  for (const d1 of data1) {
    const d1Clean = cleanDate(d1.date);
    if (map2.has(d1Clean)) {
      merged.push({
        date: d1Clean, // Use clean YYYYMMDD
        price1: d1.close,
        price2: map2.get(d1Clean)!
      });
    }
  }
  return merged;
};

/**
 * Calculates Pearson Correlation Coefficient
 */
export const calculatePearson = (x: number[], y: number[]): number => {
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
 * Converts YYYYMMDD string to Shamsi date string (YYYY/MM/DD)
 */
export const toShamsi = (gregorianDate: string): string => {
  try {
    // Handle both YYYY-MM-DD and YYYYMMDD
    const clean = gregorianDate.replace(/[^0-9]/g, '');
    if (clean.length !== 8) return gregorianDate;

    const year = parseInt(clean.substring(0, 4));
    const month = parseInt(clean.substring(4, 6)) - 1;
    const day = parseInt(clean.substring(6, 8));
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
 * Helper to calculate SMA for full history.
 * Returns a Map of Date -> SMA Value
 */
export const calculateFullHistorySMA = (data: TsetmcDataPoint[], window: number): Map<string, number> => {
    const map = new Map<string, number>();
    const prices = data.map(d => d.close);
    // Clean keys for consistency
    const cleanDate = (d: string) => d.replace(/-/g, '').substring(0, 8);
    
    for (let i = window - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < window; j++) {
            sum += prices[i - j];
        }
        map.set(cleanDate(data[i].date), sum / window);
    }
    return map;
};

/**
 * Generates Chart Data using Full History for accurate Indicators (MA)
 * and Aligned History for Correlation.
 */
export const generateAnalysisData = (
  d1: TsetmcDataPoint[], 
  d2: TsetmcDataPoint[], 
  windowSizes: number[]
): ChartDataPoint[] => {
  // 1. Calculate MAs on full history
  const ma100_1 = calculateFullHistorySMA(d1, 100);
  const ma200_1 = calculateFullHistorySMA(d1, 200);
  const ma100_2 = calculateFullHistorySMA(d2, 100);
  const ma200_2 = calculateFullHistorySMA(d2, 200);

  // 2. Align Data (Intersection)
  const merged = alignDataByDate(d1, d2);
  const results: ChartDataPoint[] = [];

  const mergedPrices1 = merged.map(d => d.price1);
  const mergedPrices2 = merged.map(d => d.price2);

  for (let i = 0; i < merged.length; i++) {
    const currentDay = merged[i];
    const rawDate = currentDay.date; // This is already cleaned YYYYMMDD from alignDataByDate

    // Helper for timestamp
    let timestamp = 0;
    if (rawDate.length === 8) {
        const gy = parseInt(rawDate.slice(0, 4));
        const gm = parseInt(rawDate.slice(4, 6)) - 1;
        const gd = parseInt(rawDate.slice(6, 8));
        timestamp = new Date(gy, gm, gd).getTime();
    } else {
        timestamp = i;
    }
    
    // Get Pre-calculated MAs
    const m1_100 = ma100_1.get(rawDate) ?? null;
    const m1_200 = ma200_1.get(rawDate) ?? null;
    const m2_100 = ma100_2.get(rawDate) ?? null;
    const m2_200 = ma200_2.get(rawDate) ?? null;

    // Calculate Distance %
    const dist_ma100_1 = m1_100 ? ((currentDay.price1 - m1_100) / m1_100) * 100 : null;
    const dist_ma100_2 = m2_100 ? ((currentDay.price2 - m2_100) / m2_100) * 100 : null;

    const point: ChartDataPoint = {
        date: toShamsi(rawDate),
        timestamp,
        price1: currentDay.price1,
        price2: currentDay.price2,
        ma100_price1: m1_100,
        ma200_price1: m1_200,
        ma100_price2: m2_100,
        ma200_price2: m2_200,
        dist_ma100_1: dist_ma100_1 !== null ? parseFloat(dist_ma100_1.toFixed(2)) : null,
        dist_ma100_2: dist_ma100_2 !== null ? parseFloat(dist_ma100_2.toFixed(2)) : null,
    };

    // Calculate Correlations
    windowSizes.forEach(w => {
        if (i >= w - 1) {
            const slice1 = mergedPrices1.slice(i - w + 1, i + 1);
            const slice2 = mergedPrices2.slice(i - w + 1, i + 1);
            const corr = calculatePearson(slice1, slice2);
            point[`corr_${w}`] = parseFloat(corr.toFixed(4));
        } else {
            point[`corr_${w}`] = null;
        }
    });

    results.push(point);
  }

  return results;
};

/**
 * Generates Data specifically for Ratio Analysis (Price1 / Price2)
 */
export const generateRatioAnalysisData = (
    d1: TsetmcDataPoint[], 
    d2: TsetmcDataPoint[], 
    windowSizes: number[]
  ): ChartDataPoint[] => {
    // 1. Align Data first to calculate Ratio Series
    const merged = alignDataByDate(d1, d2);
    
    if (merged.length === 0) return [];
  
    // 2. Create Ratio Series for MA calculation
    const ratioSeries: TsetmcDataPoint[] = merged.map(m => ({
      date: m.date,
      close: m.price2 !== 0 ? m.price1 / m.price2 : 0
    }));
  
    // 3. Calculate MAs on Ratio Series
    const ma100_ratio = calculateFullHistorySMA(ratioSeries, 100);
    const ma200_ratio = calculateFullHistorySMA(ratioSeries, 200);
  
    // 4. Prepare for Correlation (on raw prices)
    const mergedPrices1 = merged.map(d => d.price1);
    const mergedPrices2 = merged.map(d => d.price2);
  
    const results: ChartDataPoint[] = [];
  
    for (let i = 0; i < merged.length; i++) {
      const m = merged[i];
      const rawDate = m.date; // Already cleaned YYYYMMDD
      const ratio = ratioSeries[i].close;
  
      // Timestamp
      let timestamp = 0;
      if (rawDate.length === 8) {
          const gy = parseInt(rawDate.slice(0, 4));
          const gm = parseInt(rawDate.slice(4, 6)) - 1;
          const gd = parseInt(rawDate.slice(6, 8));
          timestamp = new Date(gy, gm, gd).getTime();
      } else {
          timestamp = i;
      }
  
      const m100 = ma100_ratio.get(rawDate) ?? null;
      const m200 = ma200_ratio.get(rawDate) ?? null;
  
      const dist_ma100 = m100 ? ((ratio - m100) / m100) * 100 : null;
  
      const point: ChartDataPoint = {
          date: toShamsi(rawDate),
          timestamp,
          price1: m.price1, 
          price2: m.price2,
          ratio: ratio, 
          ma100_ratio: m100,
          ma200_ratio: m200,
          dist_ma100_ratio: dist_ma100 !== null ? parseFloat(dist_ma100.toFixed(2)) : null,
          ma100_price1: null,
          ma100_price2: null,
          ma200_price1: null,
          ma200_price2: null
      };
  
      // Calculate Correlations
      windowSizes.forEach(w => {
          if (i >= w - 1) {
              const slice1 = mergedPrices1.slice(i - w + 1, i + 1);
              const slice2 = mergedPrices2.slice(i - w + 1, i + 1);
              const corr = calculatePearson(slice1, slice2);
              point[`corr_${w}`] = parseFloat(corr.toFixed(4));
          } else {
              point[`corr_${w}`] = null;
          }
      });
  
      results.push(point);
    }
  
    return results;
  }

/**
 * Converts Jalali date (Year, Month, Day) to Gregorian Date object parameters { gy, gm, gd }
 */
export const jalaliToGregorian = (j_y: number, j_m: number, j_d: number): { gy: number, gm: number, gd: number } => {
  j_y = parseInt(String(j_y));
  j_m = parseInt(String(j_m));
  j_d = parseInt(String(j_d));
  
  var jy = j_y - 979;
  var jm = j_m - 1;
  var jd = j_d - 1;

  var j_day_no = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor((jy % 33 + 3) / 4);
  for (var i = 0; i < jm; ++i) j_day_no += (i < 6) ? 31 : 30;
  j_day_no += jd;

  var g_day_no = j_day_no + 79;

  var gy = 1600 + 400 * Math.floor(g_day_no / 146097);
  g_day_no = g_day_no % 146097;

  var leap = true;
  if (g_day_no >= 36525) {
    g_day_no--;
    gy += 100 * Math.floor(g_day_no / 36524);
    g_day_no = g_day_no % 36524;

    if (g_day_no >= 365) g_day_no++;
    else leap = false;
  }

  gy += 4 * Math.floor(g_day_no / 1461);
  g_day_no %= 1461;

  if (g_day_no >= 366) {
    leap = false;

    g_day_no--;
    gy += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  }

  var gm: number;
  var gd: number;

  var g_days_in_month = [31, (leap ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  for (var i = 0; i < 12; ++i) {
      if (g_day_no < g_days_in_month[i]) {
          gm = i + 1;
          gd = g_day_no + 1;
          break;
      }
      g_day_no -= g_days_in_month[i];
  }

  return { gy: gy, gm: gm!, gd: gd! };
}

/**
 * Returns today's date in Shamsi (jy, jm, jd) using Intl API
 */
export const getTodayShamsi = (): { jy: number, jm: number, jd: number } => {
    const now = new Date();
    // Use en-US-u-ca-persian to get latin digits
    const fmt = new Intl.DateTimeFormat('en-US-u-ca-persian', {
        year: 'numeric', month: 'numeric', day: 'numeric'
    });
    const partsMap = new Map(fmt.formatToParts(now).map(p => [p.type, p.value]));
    
    return {
        jy: parseInt(partsMap.get('year') || '1400'),
        jm: parseInt(partsMap.get('month') || '1'),
        jd: parseInt(partsMap.get('day') || '1')
    };
}
