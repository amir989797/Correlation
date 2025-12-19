
import React, { useState, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { calculateFullHistorySMA, toShamsi, jalaliToGregorian, getTodayShamsi, alignDataByDate, calculatePearson } from '../utils/mathUtils';
import { SearchResult, TsetmcDataPoint, FetchStatus } from '../types';
import { Search, Loader2, PieChart, Info, X, Calendar, Clock, ChevronDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Banknote, Activity, ShieldAlert, Zap, InfoIcon, History } from 'lucide-react';
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
  devHistory: number[]; // Last 3 days of deviation
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
  const [marketMetrics, setMarketMetrics] = useState<{ 
    gold: AssetMetrics, 
    index: AssetMetrics, 
    anomaly: boolean, 
    highCorr: boolean, 
    safeCorr: boolean, 
    ratioAboveMA: boolean,
    corr2M: number,
    corr1Y: number
  } | null>(null);

  // --- Core Strategy Logic ---
  const calculateStateHysteresis = (data: TsetmcDataPoint[], maMap: Map<string, number>, targetIndex: number): MarketState => {
    let currentState: MarketState = 'Normal';
    
    for (let i = 100; i <= targetIndex; i++) {
      const point = data[i];
      const ma = maMap.get(point.date);
      if (!ma) continue;

      const dev = ((point.close - ma) / ma) * 100;

      // Entry Logic (Lock 3/3)
      if (currentState !== 'Ceiling' && dev > 10) {
        let count = 0;
        for (let j = 0; j < 3; j++) {
          const p = data[i - j];
          const m = maMap.get(p.date);
          if (m && ((p.close - m) / m) * 100 > 10) count++;
        }
        if (count === 3) currentState = 'Ceiling';
      }

      if (currentState !== 'Floor' && dev < -10) {
        let count = 0;
        for (let j = 0; j < 3; j++) {
          const p = data[i - j];
          const m = maMap.get(p.date);
          if (m && ((p.close - m) / m) * 100 < -10) count++;
        }
        if (count === 3) currentState = 'Floor';
      }

      // Exit Logic (Lock 3/3)
      if (currentState === 'Ceiling' && dev < 7) {
        let count = 0;
        for (let j = 0; j < 3; j++) {
          const p = data[i - j];
          const m = maMap.get(p.date);
          if (m && ((p.close - m) / m) * 100 < 7) count++;
        }
        if (count === 3) currentState = 'Normal';
      }

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

  const getDevHistory = (data: TsetmcDataPoint[], maMap: Map<string, number>, targetIndex: number): number[] => {
    const history: number[] = [];
    for (let i = 0; i < 3; i++) {
        const idx = targetIndex - i;
        if (idx < 0) { history.push(0); continue; }
        const p = data[idx];
        const ma = maMap.get(p.date);
        if (ma) history.push(((p.close - ma) / ma) * 100);
        else history.push(0);
    }
    return history;
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

      const stockMA100 = calculateFullHistorySMA(stockData, 100);
      const goldMA100 = calculateFullHistorySMA(goldData, 100);
      
      const goldPoint = goldData[goldIdx];
      const stockPoint = stockData[stockIdx];
      const goldMA = goldMA100.get(targetDateStr)!;
      const stockMA = stockMA100.get(targetDateStr)!;

      const goldDev = ((goldPoint.close - goldMA) / goldMA) * 100;
      const stockDev = ((stockPoint.close - stockMA) / stockMA) * 100;

      const goldState = calculateStateHysteresis(goldData, goldMA100, goldIdx);
      const stockState = calculateStateHysteresis(stockData, stockMA100, stockIdx);

      const goldHistory = getDevHistory(goldData, goldMA100, goldIdx);
      const stockHistory = getDevHistory(stockData, stockMA100, stockIdx);

      const merged = alignDataByDate(stockData, goldData);
      const ratioSeries = merged.map(m => ({ date: m.date, close: m.price2 / m.price1 })); 
      const ratioMA100 = calculateFullHistorySMA(ratioSeries, 100);
      const currentRatio = goldPoint.close / stockPoint.close;
      const ratioMA = ratioMA100.get(targetDateStr)!;
      const ratioTrendAbove = currentRatio > ratioMA;

      const mergedTargetIdx = merged.findIndex(m => m.date === targetDateStr);
      const slice2M = merged.slice(mergedTargetIdx - 60, mergedTargetIdx + 1);
      const slice1Y = merged.slice(mergedTargetIdx - 365, mergedTargetIdx + 1);
      const corr2M = calculatePearson(slice2M.map(s => s.price2), slice2M.map(s => s.price1));
      const corr1Y = calculatePearson(slice1Y.map(s => s.price2), slice1Y.map(s => s.price1));

      const isAnomaly = (corr1Y > 0 && corr2M < 0) || (corr1Y < 0 && corr2M > 0);
      const isHighCorrRisk = corr2M > 0.5;
      const isSafeCorr = corr2M < -0.5;

      setMarketMetrics({
        gold: { symbol: 'طلا (عیار)', price: goldPoint.close, dev: goldDev, state: goldState, devHistory: goldHistory },
        index: { symbol: symbol.symbol, price: stockPoint.close, dev: stockDev, state: stockState, devHistory: stockHistory },
        anomaly: isAnomaly,
        highCorr: isHighCorrRisk,
        safeCorr: isSafeCorr,
        ratioAboveMA: ratioTrendAbove,
        corr2M,
        corr1Y
      });

      // Decision Matrix
      let scenario = "صلح (وضعیت نرمال)";
      let description = "بازار در شرایط پایدار است. وزن‌دهی متعادل اعمال شد.";
      let alloc = [ { name: GOLD_SYMBOL, value: 45, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];

      if ((goldState === 'Ceiling' && stockState === 'Floor') || (goldState === 'Floor' && stockState === 'Ceiling')) {
          scenario = "تقابل اکستریم (جنگی)";
          const cheap = goldState === 'Floor' ? 'gold' : 'index';
          if (isAnomaly) {
              description = "ناهنجاری شناسایی شد! تضاد شدید بین همبستگی کوتاه‌مدت و بلندمدت نشان‌دهنده تغییر فاز احتمالی بازار است. حمله سنگین به سمت دارایی ارزان (Floor).";
              alloc = cheap === 'gold' 
                ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
          } else {
              const ratioConfirmsCheap = (cheap === 'gold' && ratioTrendAbove) || (cheap === 'index' && !ratioTrendAbove);
              if (ratioConfirmsCheap) {
                description = "روند نسبت (Ratio) خرید دارایی ارزان را تایید می‌کند. حمله حداکثری به دارایی در کف.";
                alloc = cheap === 'gold' 
                    ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                    : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              } else {
                description = "تضاد بین Ratio و دارایی ارزان. با وجود قرارگیری در کف، قدرت نسبی هنوز چرخش نکرده است. تخصیص احتیاطی.";
                alloc = [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
              }
          }
      } 
      else if (goldState === 'Ceiling' && stockState === 'Ceiling') {
          scenario = "حباب دوطرفه (اشباع)";
          description = "هر دو دارایی در سقف هستند. ریسک سیستماتیک بازار بالاست. افزایش سهم نقدینگی (اوراق) به ۵۰٪ برای آمادگی در اصلاح احتمالی.";
          alloc = ratioTrendAbove 
            ? [ { name: GOLD_SYMBOL, value: 30, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ]
            : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 30, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ];
      }
      else if (goldState === 'Floor' && stockState === 'Floor') {
          scenario = "فرصت دوطرفه (کف‌خوری)";
          description = "هر دو دارایی زیر قیمت تعادلی هستند. فرصت عالی برای ورود پله‌ای. اولویت با دارایی است که روند نسبت (Ratio) تاییدش می‌کند.";
          alloc = ratioTrendAbove 
            ? [ { name: GOLD_SYMBOL, value: 45, fill: '#fbbf24' }, { name: symbol.symbol, value: 25, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ]
            : [ { name: GOLD_SYMBOL, value: 25, fill: '#fbbf24' }, { name: symbol.symbol, value: 45, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
      }
      else if (goldState === 'Ceiling' || stockState === 'Ceiling') {
          scenario = "تک‌سقف (توزیع)";
          const highAsset = goldState === 'Ceiling' ? 'gold' : 'index';
          const ratioConfirmsHighDrop = (highAsset === 'gold' && !ratioTrendAbove) || (highAsset === 'index' && ratioTrendAbove);
          if (ratioConfirmsHighDrop) {
              description = "نسبت (Ratio) تاییدکننده تضعیف دارایی گران است. خروج سنگین از سقف و انتقال به دارایی نرمال.";
              alloc = highAsset === 'gold'
                ? [ { name: GOLD_SYMBOL, value: 15, fill: '#fbbf24' }, { name: symbol.symbol, value: 50, fill: '#10b981' }, { name: 'اوراق', value: 35, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 50, fill: '#fbbf24' }, { name: symbol.symbol, value: 15, fill: '#10b981' }, { name: 'اوراق', value: 35, fill: '#3b82f6' } ];
          } else {
              description = "تضاد در روند نسبت. با وجود اشباع قیمتی، هنوز قدرت نسبی بالاست. توازن وزنی بین سقف و نرمال.";
              alloc = [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
          }
      }
      else if (goldState === 'Floor' || stockState === 'Floor') {
          scenario = "تک‌کف (فرصت خرید)";
          const cheapAsset = goldState === 'Floor' ? 'gold' : 'index';
          if (isHighCorrRisk) {
              description = "ریسک همبستگی بالاست (هر دو دارایی هم‌جهت می‌روند). خرید با احتیاط از دارایی ارزان برای جلوگیری از ریسک جفتی.";
              alloc = cheapAsset === 'gold'
                ? [ { name: GOLD_SYMBOL, value: 40, fill: '#fbbf24' }, { name: symbol.symbol, value: 30, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 30, fill: '#fbbf24' }, { name: symbol.symbol, value: 40, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
          } else {
              const ratioConfirmsCheapRise = (cheapAsset === 'gold' && ratioTrendAbove) || (cheapAsset === 'index' && !ratioTrendAbove);
              if (ratioConfirmsCheapRise) {
                  description = "روند نسبت صعود دارایی ارزان را تایید می‌کند. حمله وزنی به کف شناسایی شده.";
                  alloc = cheapAsset === 'gold'
                    ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                    : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              } else {
                  description = "روند نسبت خرید را قطعی نمی‌داند. وزن متعادل در کف با سهم ۲۰٪ اوراق.";
                  alloc = [ { name: GOLD_SYMBOL, value: 40, fill: '#fbbf24' }, { name: symbol.symbol, value: 40, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              }
          }
      } 
      else {
          if (isHighCorrRisk) {
              description = "همبستگی شدید مثبت (>0.5). دارایی‌ها هم‌حرکت هستند و تنوع‌بخشی پرتفوی کم است. حالت تدافعی با ۵۰٪ اوراق فعال شد.";
              alloc = [ { name: GOLD_SYMBOL, value: 25, fill: '#fbbf24' }, { name: symbol.symbol, value: 25, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ];
          } else if (isSafeCorr) {
              description = "همبستگی معکوس امن (<-0.5). تنوع‌بخشی در بهترین حالت است. وزن‌دهی به نفع روند برتر نسبت (Ratio).";
              alloc = ratioTrendAbove
                ? [ { name: GOLD_SYMBOL, value: 55, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 10, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 55, fill: '#10b981' }, { name: 'اوراق', value: 10, fill: '#3b82f6' } ];
          } else {
              description = "روند بازار عادی (صلح). دارایی‌ها در ناحیه تعادلی هستند. وزن‌دهی متعادل بر اساس روند نسبت انجام شد.";
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
                    <div className="space-y-6">
                        {[marketMetrics.gold, marketMetrics.index].map((m, idx) => (
                           <div key={idx} className="bg-slate-900 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group">
                               <div className={`absolute top-0 right-0 w-1 h-full ${m.state === 'Ceiling' ? 'bg-red-500' : m.state === 'Floor' ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                               <div className="flex justify-between items-center mb-4">
                                   <span className="text-white font-black text-sm">{m.symbol}</span>
                                   <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm ${m.state === 'Ceiling' ? 'bg-red-500 text-white' : m.state === 'Floor' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                       {m.state === 'Ceiling' ? 'سقف' : m.state === 'Floor' ? 'کف' : 'نرمال'}
                                   </span>
                               </div>
                               
                               {/* Deviation Bar */}
                               <div className="space-y-2 mb-5">
                                   <div className="flex justify-between text-[10px] text-slate-500">
                                       <span>انحراف از میانگین</span>
                                       <span className={m.dev > 0 ? 'text-red-400' : 'text-emerald-400'} dir="ltr">{m.dev.toFixed(2)}%</span>
                                   </div>
                                   <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                                       <div className={`h-full transition-all duration-700 ${m.dev > 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${Math.min(Math.abs(m.dev) * 4, 100)}%`}}></div>
                                   </div>
                               </div>

                               {/* Lock 3/3 Visualization */}
                               <div className="pt-4 border-t border-slate-800/50">
                                   <div className="flex items-center gap-2 mb-3">
                                       <History className="w-3 h-3 text-slate-500" />
                                       <span className="text-[10px] text-slate-400 font-bold">وضعیت پایداری (Lock 3/3)</span>
                                   </div>
                                   <div className="flex justify-between items-center px-2">
                                       {m.devHistory.slice().reverse().map((d, i) => {
                                           const isCeil = d > 10;
                                           const isFloor = d < -10;
                                           return (
                                               <div key={i} className="flex flex-col items-center gap-1.5">
                                                   <div className={`w-3 h-3 rounded-full border ${isCeil ? 'bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : isFloor ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800 border-slate-700'}`}></div>
                                                   <span className="text-[8px] font-mono text-slate-500" dir="ltr">{d.toFixed(1)}%</span>
                                                   <span className="text-[7px] text-slate-600 font-bold">{i === 2 ? 'امروز' : `${2-i} روز قبل`}</span>
                                               </div>
                                           );
                                       })}
                                   </div>
                               </div>
                           </div>
                        ))}

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className={`p-4 rounded-2xl border transition-all ${marketMetrics.anomaly ? 'bg-red-500/10 border-red-500/40 shadow-inner' : 'bg-slate-900 border-slate-700 opacity-60'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <ShieldAlert className={`w-4 h-4 ${marketMetrics.anomaly ? 'text-red-500' : 'text-slate-500'}`} />
                                    <span className={`text-[10px] font-black ${marketMetrics.anomaly ? 'text-white' : 'text-slate-500'}`}>ناهنجاری</span>
                                </div>
                                <div className="text-[9px] text-slate-500 font-mono flex justify-between">
                                    <span>۱ساله:</span>
                                    <span>{marketMetrics.corr1Y.toFixed(2)}</span>
                                </div>
                                <div className="text-[9px] text-slate-500 font-mono flex justify-between">
                                    <span>۶۰روزه:</span>
                                    <span>{marketMetrics.corr2M.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className={`p-4 rounded-2xl border transition-all ${marketMetrics.highCorr ? 'bg-orange-500/10 border-orange-500/40' : 'bg-slate-900 border-slate-700'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Zap className={`w-4 h-4 ${marketMetrics.highCorr ? 'text-orange-500' : 'text-slate-500'}`} />
                                    <span className={`text-[10px] font-black ${marketMetrics.highCorr ? 'text-white' : 'text-slate-500'}`}>ریسک همبستگی</span>
                                </div>
                                <div className="h-1 bg-slate-950 rounded-full overflow-hidden mb-2">
                                    <div className={`h-full transition-all duration-700 ${marketMetrics.highCorr ? 'bg-orange-500' : 'bg-slate-600'}`} style={{width: `${Math.max(0, marketMetrics.corr2M) * 100}%`}}></div>
                                </div>
                                <span className="text-[9px] font-mono text-slate-500 block text-center">{marketMetrics.corr2M.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-amber-500" />
                                <span className="text-slate-400">روند نسبت (Ratio):</span>
                            </div>
                            <span className={`font-black ${marketMetrics.ratioAboveMA ? 'text-amber-400' : 'text-cyan-400'}`}>
                                {marketMetrics.ratioAboveMA ? 'طلا برتر' : 'شاخص برتر'}
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
                            <span className="text-sm font-bold text-cyan-400" dir="ltr">{toShamsi(dateMode === 'current' ? '20230101' : '20230101')}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row p-6 items-center">
                        <div className="flex-1 h-[340px] w-full relative">
                            <ResponsiveContainer>
                                <RechartsPieChart>
                                    <Pie data={strategy.allocation} cx="50%" cy="50%" innerRadius={85} outerRadius={125} paddingAngle={5} dataKey="value" stroke="none">
                                        {strategy.allocation.map((entry, index) => <Cell key={index} fill={entry.fill} className="hover:opacity-80 transition-opacity cursor-pointer" />)}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} 
                                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className="text-slate-300 font-bold text-xs">{value}</span>} />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                <div className="text-center">
                                    <span className="block text-3xl font-black text-white">پرتفوی</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Weighting</span>
                                </div>
                            </div>
                        </div>
                        <div className="lg:w-2/5 mt-6 lg:mt-0 p-6 bg-slate-900/40 rounded-3xl border border-slate-700/50 backdrop-blur-sm">
                            <h5 className="text-sm font-black text-white mb-4 flex items-center gap-2 border-b border-slate-700/50 pb-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> 
                                اقدام استراتژیک پیشنهادی
                            </h5>
                            <p className="text-xs text-slate-300 leading-7 text-justify mb-6 font-medium">{strategy.description}</p>
                            <div className="space-y-3">
                                {strategy.allocation.map((a, i) => (
                                    <div key={i} className="flex justify-between items-center group">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: a.fill}}></div>
                                            <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{a.name}:</span>
                                        </div>
                                        <span className="font-black text-sm text-white group-hover:text-cyan-400 transition-colors">{a.value}%</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2 text-[9px] text-slate-500 italic">
                                <InfoIcon className="w-3 h-3" />
                                مبنای محاسبات: منطق قفل ۳/۳ با انحراف ۱۰٪ و خروج ۷٪
                            </div>
                        </div>
                    </div>
                </div>
            </div>
         </div>
       )}

       {status === FetchStatus.IDLE && (
         <div className="flex flex-col items-center justify-center p-20 bg-slate-800/50 rounded-3xl border border-slate-700 border-dashed opacity-50">
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
