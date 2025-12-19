
import React, { useState, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { calculateFullHistorySMA, toShamsi, jalaliToGregorian, getTodayShamsi, alignDataByDate, calculatePearson } from '../utils/mathUtils';
import { SearchResult, TsetmcDataPoint, FetchStatus } from '../types';
import { Search, Loader2, PieChart, Info, X, Calendar, Clock, ChevronDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Banknote, Activity, ShieldAlert, Zap } from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// CONSTANTS
const GOLD_SYMBOL = 'عیار'; 

type MarketState = 'Ceiling' | 'Floor' | 'Normal';

interface AssetMetrics {
  symbol: string;
  price: number;
  dev: number;
  state: MarketState;
}

interface StrategyResult {
  allocation: { name: string; value: number; fill: string }[];
  scenario: string;
  description: string;
}

// --- Reusable Search Input ---
const SearchInput = ({ label, value, onSelect }: { label: string; value: SearchResult | null; onSelect: (val: SearchResult | null) => void; }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        const res = await searchSymbols(query);
        setResults(res);
        setLoading(false);
        setIsOpen(true);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  if (value) {
    return (
      <div className="space-y-2 w-full">
        <label className="block text-sm font-medium text-slate-400">{label}</label>
        <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-600 rounded-lg text-cyan-400">
           <span className="font-bold text-sm truncate">{value.symbol}</span>
           <button onClick={() => { onSelect(null); setQuery(''); }} className="p-1 hover:bg-black rounded text-slate-400 hover:text-red-400 transition-colors">
             <X className="w-5 h-5" />
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full" ref={wrapperRef}>
      <label className="block text-sm font-medium text-slate-400">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی نماد..." 
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-10 py-3 focus:ring-1 focus:ring-cyan-500 outline-none text-sm text-right text-white placeholder-slate-500 transition-all" 
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-cyan-500" /> : <Search className="w-5 h-5" />}
        </div>
        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
             {results.map((item, idx) => (
               <button key={idx} type="button" onClick={() => { onSelect(item); setIsOpen(false); }} className="w-full text-right px-4 py-3 hover:bg-slate-800 border-b border-slate-800 last:border-0 flex justify-between items-center group transition-colors">
                 <span className="font-bold text-white group-hover:text-cyan-400">{item.symbol}</span>
                 <span className="text-xs text-slate-400">{item.name}</span>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ShamsiDatePicker = ({ value, onChange }: { value: { jy: number; jm: number; jd: number }; onChange: (d: any) => void; }) => {
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  return (
    <div className="flex gap-2 items-center" dir="rtl">
        <div className="relative w-20">
            <select value={value.jd} onChange={(e) => onChange({...value, jd: parseInt(e.target.value)})} className="w-full appearance-none bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500 cursor-pointer text-center">
                {Array.from({length: 31}, (_, i) => i + 1).map(d => (<option key={d} value={d}>{d}</option>))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
        <div className="relative flex-1">
            <select value={value.jm} onChange={(e) => onChange({...value, jm: parseInt(e.target.value)})} className="w-full appearance-none bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500 cursor-pointer text-right pr-8">
                {months.map((m, idx) => (<option key={idx} value={idx + 1}>{m}</option>))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>
        <div className="relative w-24">
            <input type="number" min={1300} max={1500} value={value.jy} onChange={(e) => onChange({...value, jy: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500 text-center" />
        </div>
    </div>
  );
};

export function PortfolioPage() {
  const [symbol, setSymbol] = useState<SearchResult | null>(null);
  const [dateMode, setDateMode] = useState<'current' | 'custom'>('current');
  const [shamsiDate, setShamsiDate] = useState(getTodayShamsi());
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<StrategyResult | null>(null);
  const [marketMetrics, setMarketMetrics] = useState<{ gold: AssetMetrics, index: AssetMetrics, anomaly: boolean, highCorr: boolean, safeCorr: boolean, ratioAboveMA: boolean } | null>(null);

  // --- Core Strategy Logic ---
  const calculateStateHysteresis = (data: TsetmcDataPoint[], maMap: Map<string, number>, targetIndex: number): MarketState => {
    let currentState: MarketState = 'Normal';
    
    // We walk forward from the start of data (or a lookback) to maintain the state correctly
    for (let i = 100; i <= targetIndex; i++) {
      const point = data[i];
      const ma = maMap.get(point.date);
      if (!ma) continue;

      const dev = ((point.close - ma) / ma) * 100;

      // 1. Check Entry Ceiling (> 10% for 3 days)
      if (currentState !== 'Ceiling' && dev > 10) {
        let count = 0;
        for (let j = 0; j < 3; j++) {
          const p = data[i - j];
          const m = maMap.get(p.date);
          if (m && ((p.close - m) / m) * 100 > 10) count++;
        }
        if (count === 3) currentState = 'Ceiling';
      }

      // 2. Check Entry Floor (< -10% for 3 days)
      if (currentState !== 'Floor' && dev < -10) {
        let count = 0;
        for (let j = 0; j < 3; j++) {
          const p = data[i - j];
          const m = maMap.get(p.date);
          if (m && ((p.close - m) / m) * 100 < -10) count++;
        }
        if (count === 3) currentState = 'Floor';
      }

      // 3. Check Exit Ceiling (< 7% for 3 days)
      if (currentState === 'Ceiling' && dev < 7) {
        let count = 0;
        for (let j = 0; j < 3; j++) {
          const p = data[i - j];
          const m = maMap.get(p.date);
          if (m && ((p.close - m) / m) * 100 < 7) count++;
        }
        if (count === 3) currentState = 'Normal';
      }

      // 4. Check Exit Floor (> -7% for 3 days)
      if (currentState === 'Floor' && dev > -7) {
        let count = 0;
        for (let j = 0; j < 3; j++) {
          const p = data[i - j];
          const m = maMap.get(p.date);
          if (m && ((p.close - m) / m) * 100 > -7) count++;
        }
        if (count === 3) currentState = 'Normal';
      }
    }
    return currentState;
  };

  const runStrategy = async () => {
    if (!symbol) return setError('لطفا نماد را انتخاب کنید.');
    setStatus(FetchStatus.LOADING);
    setError(null);

    try {
      const [stockRes, goldRes] = await Promise.all([fetchStockHistory(symbol.symbol), fetchStockHistory(GOLD_SYMBOL)]);
      const stockData = stockRes.data;
      const goldData = goldRes.data;

      if (stockData.length < 400 || goldData.length < 400) throw new Error('سابقه معاملاتی برای محاسبات پیشرفته کافی نیست.');

      const targetDateStr = dateMode === 'current' ? stockData[stockData.length - 1].date : (() => {
        const { gy, gm, gd } = jalaliToGregorian(shamsiDate.jy, shamsiDate.jm, shamsiDate.jd);
        return `${gy}${gm < 10 ? '0'+gm : gm}${gd < 10 ? '0'+gd : gd}`;
      })();

      const stockIdx = stockData.findIndex(d => d.date === targetDateStr);
      const goldIdx = goldData.findIndex(d => d.date === targetDateStr);
      if (stockIdx === -1 || goldIdx === -1) throw new Error('داده‌ای برای تاریخ انتخاب شده یافت نشد.');

      // 1. Inputs
      const stockMA100 = calculateFullHistorySMA(stockData, 100);
      const goldMA100 = calculateFullHistorySMA(goldData, 100);
      
      const goldPoint = goldData[goldIdx];
      const stockPoint = stockData[stockIdx];
      const goldMA = goldMA100.get(targetDateStr)!;
      const stockMA = stockMA100.get(targetDateStr)!;

      const goldDev = ((goldPoint.close - goldMA) / goldMA) * 100;
      const stockDev = ((stockPoint.close - stockMA) / stockMA) * 100;

      // 2. State Logic (Hysteresis)
      const goldState = calculateStateHysteresis(goldData, goldMA100, goldIdx);
      const stockState = calculateStateHysteresis(stockData, stockMA100, stockIdx);

      // 3. Ratio & Trends
      const merged = alignDataByDate(stockData, goldData);
      const ratioSeries = merged.map(m => ({ date: m.date, close: m.price2 / m.price1 })); // Gold / Index
      const ratioMA100 = calculateFullHistorySMA(ratioSeries, 100);
      const currentRatio = goldPoint.close / stockPoint.close;
      const ratioMA = ratioMA100.get(targetDateStr)!;
      const ratioTrendAbove = currentRatio > ratioMA;

      // 4. Filters (Anomaly, Risk)
      const mergedTargetIdx = merged.findIndex(m => m.date === targetDateStr);
      const slice2M = merged.slice(mergedTargetIdx - 60, mergedTargetIdx + 1);
      const slice1Y = merged.slice(mergedTargetIdx - 365, mergedTargetIdx + 1);
      const corr2M = calculatePearson(slice2M.map(s => s.price2), slice2M.map(s => s.price1));
      const corr1Y = calculatePearson(slice1Y.map(s => s.price2), slice1Y.map(s => s.price1));

      const isAnomaly = (corr1Y > 0 && corr2M < 0) || (corr1Y < 0 && corr2M > 0);
      const isHighCorrRisk = corr2M > 0.5;
      const isSafeCorr = corr2M < -0.5;

      setMarketMetrics({
        gold: { symbol: 'طلا (عیار)', price: goldPoint.close, dev: goldDev, state: goldState },
        index: { symbol: symbol.symbol, price: stockPoint.close, dev: stockDev, state: stockState },
        anomaly: isAnomaly,
        highCorr: isHighCorrRisk,
        safeCorr: isSafeCorr,
        ratioAboveMA: ratioTrendAbove
      });

      // 5. Decision Matrix
      let scenario = "صلح (وضعیت نرمال)";
      let description = "بازار در شرایط پایدار است. وزن‌دهی متعادل اعمال شد.";
      let alloc = [ { name: GOLD_SYMBOL, value: 45, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];

      // SCENARIO 1: Combat (Ceiling vs Floor)
      if ((goldState === 'Ceiling' && stockState === 'Floor') || (goldState === 'Floor' && stockState === 'Ceiling')) {
          scenario = "تقابل اکستریم (جنگی)";
          const cheap = goldState === 'Floor' ? 'gold' : 'index';
          if (isAnomaly) {
              description = "ناهنجاری شناسایی شد! حمله سنگین به سمت دارایی ارزان (Floor).";
              alloc = cheap === 'gold' 
                ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
          } else {
              // Check Ratio Trend confirm
              const ratioConfirmsCheap = (cheap === 'gold' && ratioTrendAbove) || (cheap === 'index' && !ratioTrendAbove);
              if (ratioConfirmsCheap) {
                description = "روند نسبت (Ratio) خرید دارایی ارزان را تایید می‌کند. حمله حداکثری.";
                alloc = cheap === 'gold' 
                    ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                    : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              } else {
                description = "تضاد بین Ratio و دارایی ارزان. تخصیص احتیاطی.";
                alloc = [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
              }
          }
      } 
      // SCENARIO 2: Bubble / Double Opp
      else if (goldState === 'Ceiling' && stockState === 'Ceiling') {
          scenario = "حباب دوطرفه (اشباع)";
          description = "هر دو دارایی در سقف هستند. افزایش سهم نقدینگی (اوراق).";
          alloc = ratioTrendAbove 
            ? [ { name: GOLD_SYMBOL, value: 30, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ]
            : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 30, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ];
      }
      else if (goldState === 'Floor' && stockState === 'Floor') {
          scenario = "فرصت دوطرفه (کف‌خوری)";
          description = "هر دو دارایی زیر قیمت تعادلی هستند. خرید پله‌ای بر اساس قدرت نسبی.";
          alloc = ratioTrendAbove 
            ? [ { name: GOLD_SYMBOL, value: 45, fill: '#fbbf24' }, { name: symbol.symbol, value: 25, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ]
            : [ { name: GOLD_SYMBOL, value: 25, fill: '#fbbf24' }, { name: symbol.symbol, value: 45, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
      }
      // SCENARIO 3: One Extreme, One Normal
      else if (goldState === 'Ceiling' || stockState === 'Ceiling') {
          scenario = "تک‌سقف (توزیع)";
          const highAsset = goldState === 'Ceiling' ? 'gold' : 'index';
          const normalAsset = goldState === 'Ceiling' ? 'index' : 'gold';
          // Check Ratio Confirming high asset drop
          const ratioConfirmsHighDrop = (highAsset === 'gold' && !ratioTrendAbove) || (highAsset === 'index' && ratioTrendAbove);
          if (ratioConfirmsHighDrop) {
              description = "نسبت (Ratio) تاییدکننده ریزش دارایی گران است. خروج سنگین از سقف.";
              alloc = highAsset === 'gold'
                ? [ { name: GOLD_SYMBOL, value: 15, fill: '#fbbf24' }, { name: symbol.symbol, value: 50, fill: '#10b981' }, { name: 'اوراق', value: 35, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 50, fill: '#fbbf24' }, { name: symbol.symbol, value: 15, fill: '#10b981' }, { name: 'اوراق', value: 35, fill: '#3b82f6' } ];
          } else {
              description = "تضاد در روند نسبت. توازن وزنی بین سقف و نرمال.";
              alloc = [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
          }
      }
      else if (goldState === 'Floor' || stockState === 'Floor') {
          scenario = "تک‌کف (فرصت خرید)";
          const cheapAsset = goldState === 'Floor' ? 'gold' : 'index';
          if (isHighCorrRisk) {
              description = "ریسک همبستگی بالاست. خرید با احتیاط از دارایی ارزان.";
              alloc = cheapAsset === 'gold'
                ? [ { name: GOLD_SYMBOL, value: 40, fill: '#fbbf24' }, { name: symbol.symbol, value: 30, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 30, fill: '#fbbf24' }, { name: symbol.symbol, value: 40, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
          } else {
              const ratioConfirmsCheapRise = (cheapAsset === 'gold' && ratioTrendAbove) || (cheapAsset === 'index' && !ratioTrendAbove);
              if (ratioConfirmsCheapRise) {
                  description = "روند نسبت صعود دارایی ارزان را تایید می‌کند. حمله وزنی.";
                  alloc = cheapAsset === 'gold'
                    ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                    : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              } else {
                  description = "روند نسبت خرید را تایید نمی‌کنید. وزن متعادل در کف.";
                  alloc = [ { name: GOLD_SYMBOL, value: 40, fill: '#fbbf24' }, { name: symbol.symbol, value: 40, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              }
          }
      } 
      // SCENARIO 4: Peace (Normal)
      else {
          if (isHighCorrRisk) {
              description = "همبستگی شدید مثبت. حالت تدافعی فعال شد.";
              alloc = [ { name: GOLD_SYMBOL, value: 25, fill: '#fbbf24' }, { name: symbol.symbol, value: 25, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ];
          } else if (isSafeCorr) {
              description = "همبستگی معکوس امن. وزن‌دهی به نفع روند برتر نسبت.";
              alloc = ratioTrendAbove
                ? [ { name: GOLD_SYMBOL, value: 55, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 10, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 55, fill: '#10b981' }, { name: 'اوراق', value: 10, fill: '#3b82f6' } ];
          } else {
              description = "روند بازار عادی (صلح). وزن‌دهی بر اساس روند نسبت.";
              alloc = ratioTrendAbove
                ? [ { name: GOLD_SYMBOL, value: 45, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 45, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
          }
      }

      setStrategy({ allocation: alloc, scenario, description });
      setStatus(FetchStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message);
      setStatus(FetchStatus.ERROR);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-12 animate-fade-in">
       <header className="mb-4">
          <h2 className="text-3xl font-bold text-white mb-2">مدیریت پرتفوی استراتژیک</h2>
          <p className="text-slate-400">سیستم تصمیم‌گیر هوشمند بر اساس قفل ۳/۳ و ماتریس سناریوهای بازار</p>
       </header>

       {/* SECTION 1: Inputs */}
       <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-700 pb-4">
             <Info className="w-5 h-5 text-cyan-400" />
             تنظیمات تحلیل
          </h3>
          <div className="grid md:grid-cols-3 gap-6 mb-6">
              <SearchInput label="نماد مورد تحلیل" value={symbol} onSelect={setSymbol} />
              <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-400">مبنای زمانی</label>
                  <div className="flex gap-2">
                    <button onClick={() => setDateMode('current')} className={`flex-1 p-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${dateMode === 'current' ? 'bg-slate-700 border-white text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}><Clock className="w-4 h-4" /> آخرین قیمت</button>
                    <button onClick={() => setDateMode('custom')} className={`flex-1 p-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${dateMode === 'custom' ? 'bg-slate-700 border-white text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}><Calendar className="w-4 h-4" /> تاریخ خاص</button>
                  </div>
              </div>
              <div className={dateMode === 'custom' ? '' : 'opacity-30 pointer-events-none'}>
                  <label className="block text-sm font-medium text-slate-400 mb-2">انتخاب تاریخ</label>
                  <ShamsiDatePicker value={shamsiDate} onChange={setShamsiDate} />
              </div>
          </div>
          <button onClick={runStrategy} disabled={status === FetchStatus.LOADING} className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all border-none">
            {status === FetchStatus.LOADING ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'محاسبه استراتژی وزنی'}
          </button>
       </div>

       {status === FetchStatus.SUCCESS && marketMetrics && strategy && (
         <div className="grid md:grid-cols-12 gap-6 items-stretch animate-fade-in">
            
            {/* Logic State Panel */}
            <div className="md:col-span-4 space-y-6">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg h-full">
                    <h4 className="font-bold text-white mb-6 border-b border-slate-700 pb-2 flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-400" /> منطق تشخیص وضعیت (State Logic)</h4>
                    <div className="space-y-4">
                        {[marketMetrics.gold, marketMetrics.index].map((m, idx) => (
                           <div key={idx} className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                               <div className="flex justify-between items-center mb-3">
                                   <span className="text-white font-bold">{m.symbol}</span>
                                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${m.state === 'Ceiling' ? 'bg-red-500 text-white' : m.state === 'Floor' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                       {m.state === 'Ceiling' ? 'سقف' : m.state === 'Floor' ? 'کف' : 'نرمال'}
                                   </span>
                               </div>
                               <div className="flex justify-between text-xs text-slate-500 mb-1">
                                   <span>فاصله از MA100:</span>
                                   <span className={m.dev > 0 ? 'text-red-400' : 'text-emerald-400'} dir="ltr">{m.dev.toFixed(1)}%</span>
                               </div>
                               <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                   <div className={`h-full transition-all ${m.dev > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(Math.abs(m.dev) * 4, 100)}%`}}></div>
                               </div>
                           </div>
                        ))}

                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <div className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${marketMetrics.anomaly ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                <ShieldAlert className="w-4 h-4" />
                                <span className="text-[10px] font-bold">ناهنجاری</span>
                            </div>
                            <div className={`p-3 rounded-lg border flex flex-col items-center gap-1 ${marketMetrics.highCorr ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                <Zap className="w-4 h-4" />
                                <span className="text-[10px] font-bold">ریسک همبستگی</span>
                            </div>
                        </div>

                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center text-xs">
                            <span className="text-slate-400">روند نسبت (Ratio):</span>
                            <span className={`font-bold ${marketMetrics.ratioAboveMA ? 'text-amber-400' : 'text-cyan-400'}`}>
                                {marketMetrics.ratioAboveMA ? 'طلا قوی‌تر (صعودی)' : 'شاخص قوی‌تر (نزولی)'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Panel */}
            <div className="md:col-span-8 space-y-6">
                <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                        <div>
                            <span className="text-xs text-slate-500 block mb-1">سناریوی شناسایی شده</span>
                            <h3 className="text-xl font-black text-white">{strategy.scenario}</h3>
                        </div>
                        <div className="bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 text-center">
                            <span className="text-[10px] text-slate-500 block">آخرین تاریخ دیتا</span>
                            <span className="text-sm font-bold text-cyan-400" dir="ltr">{toShamsi(marketMetrics.gold.state === 'Ceiling' ? '20230101' : '20230101')}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row p-6 items-center">
                        <div className="flex-1 h-[300px] w-full relative">
                            <ResponsiveContainer>
                                <RechartsPieChart>
                                    <Pie data={strategy.allocation} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" stroke="none">
                                        {strategy.allocation.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                <div className="text-center">
                                    <span className="block text-2xl font-black text-white">پرتفوی</span>
                                    <span className="text-[10px] text-slate-500">وزن‌های پیشنهادی</span>
                                </div>
                            </div>
                        </div>
                        <div className="lg:w-1/3 mt-6 lg:mt-0 p-4 bg-slate-900/50 rounded-2xl border border-slate-700/50">
                            <h5 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> اقدام استراتژیک</h5>
                            <p className="text-sm text-slate-300 leading-7 text-justify">{strategy.description}</p>
                            <div className="mt-4 space-y-2">
                                {strategy.allocation.map((a, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">{a.name}:</span>
                                        <span className="font-bold text-white">{a.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
         </div>
       )}

       {status === FetchStatus.IDLE && (
         <div className="flex flex-col items-center justify-center p-20 bg-slate-800 rounded-3xl border border-slate-700 border-dashed opacity-50">
            <PieChart className="w-16 h-16 text-slate-600 mb-4" />
            <p className="text-slate-500">برای مشاهده استراتژی و وضعیت بازار، نماد را انتخاب و دکمه محاسبه را بزنید.</p>
         </div>
       )}

       {error && (
         <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-400 text-sm flex items-center gap-3">
             <AlertTriangle className="w-5 h-5" />
             {error}
         </div>
       )}
    </div>
  );
}
