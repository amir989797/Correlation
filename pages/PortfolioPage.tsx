
import React, { useState, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { calculateFullHistorySMA, jalaliToGregorian, getTodayShamsi, alignDataByDate, calculatePearson } from '../utils/mathUtils';
import { SearchResult, TsetmcDataPoint, FetchStatus } from '../types';
import { Search, Loader2, Info, X, Calendar, Clock, ChevronDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Activity, ShieldAlert, Zap, History, Target, Swords, Boxes, Sparkles } from 'lucide-react';
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
  devHistory: number[]; 
}

interface StrategyResult {
  allocation: { name: string; value: number; fill: string }[];
  scenario: string;
  id: string; 
  description: string;
}

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

  /**
   * Refined Hysteresis Simulation
   * Following user requirements for 3-day confirmation on entry and exit.
   */
  const calculateStateHysteresis = (data: TsetmcDataPoint[], maMap: Map<string, number>, targetIndex: number): MarketState => {
    let currentState: MarketState = 'Normal';
    let ceilingEntryCounter = 0;
    let ceilingExitCounter = 0;
    let floorEntryCounter = 0;
    let floorExitCounter = 0;

    // Simulate history to accurately determine state at targetIndex
    for (let i = 100; i <= targetIndex; i++) {
      const point = data[i];
      const ma = maMap.get(point.date);
      if (!ma) continue;
      const dev = ((point.close - ma) / ma) * 100;

      if (currentState === 'Normal') {
        // Entry logic for Ceiling
        if (dev > 10) {
          ceilingEntryCounter++;
          if (ceilingEntryCounter >= 3) {
            currentState = 'Ceiling';
            ceilingEntryCounter = 0;
          }
        } else {
          ceilingEntryCounter = 0;
        }

        // Entry logic for Floor
        if (dev < -10) {
          floorEntryCounter++;
          if (floorEntryCounter >= 3) {
            currentState = 'Floor';
            floorEntryCounter = 0;
          }
        } else {
          floorEntryCounter = 0;
        }
      } 
      else if (currentState === 'Ceiling') {
        // Exit logic for Ceiling (back to Normal)
        if (dev < 7) {
          ceilingExitCounter++;
          if (ceilingExitCounter >= 3) {
            currentState = 'Normal';
            ceilingExitCounter = 0;
          }
        } else {
          ceilingExitCounter = 0;
        }
      } 
      else if (currentState === 'Floor') {
        // Exit logic for Floor (back to Normal)
        if (dev > -7) {
          floorExitCounter++;
          if (floorExitCounter >= 3) {
            currentState = 'Normal';
            floorExitCounter = 0;
          }
        } else {
          floorExitCounter = 0;
        }
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
      if (stockData.length < 400 || goldData.length < 400) throw new Error('سابقه معاملاتی کافی نیست.');
      
      const targetDateStr = dateMode === 'current' ? stockData[stockData.length - 1].date : (() => {
        const { gy, gm, gd } = jalaliToGregorian(shamsiDate.jy, shamsiDate.jm, shamsiDate.jd);
        return `${gy}${gm < 10 ? '0'+gm : gm}${gd < 10 ? '0'+gd : gd}`;
      })();
      
      const stockIdx = stockData.findIndex(d => d.date === targetDateStr);
      const goldIdx = goldData.findIndex(d => d.date === targetDateStr);
      if (stockIdx === -1 || goldIdx === -1) throw new Error('داده‌ای برای تاریخ انتخابی یافت نشد.');

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

      let scenario = "";
      let sid = "";
      let description = "";
      let alloc: { name: string; value: number; fill: string }[] = [];

      // Logic matrix based on identified states
      if ((goldState === 'Ceiling' && stockState === 'Floor') || (goldState === 'Floor' && stockState === 'Ceiling')) {
          scenario = "تقابل اکستریم (جنگی)";
          sid = "combat";
          const cheapAsset = goldState === 'Floor' ? 'gold' : 'index';
          if (isAnomaly) {
              description = "ناهنجاری همبستگی تشخیص داده شد. حمله به سمت دارایی ارزان برای شکار بازگشت قیمت.";
              alloc = cheapAsset === 'gold'
                  ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                  : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
          } else {
              const ratioSupportsCheap = cheapAsset === 'gold' ? ratioTrendAbove : !ratioTrendAbove;
              if (ratioSupportsCheap) {
                   description = "روند Ratio با دارایی ارزان هم‌سو است. حمله تهاجمی به سمت دارایی کف قیمتی.";
                   alloc = cheapAsset === 'gold'
                      ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                      : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              } else {
                   description = "تضاد بین وضعیت تکنیکال و روند Ratio. استراتژی محتاطانه برابر اعمال شد.";
                   alloc = [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
              }
          }
      } 
      else if (goldState === 'Ceiling' && stockState === 'Ceiling') {
          scenario = "حباب دوطرفه (خطر ریزش)";
          sid = "bubble";
          description = "هر دو دارایی در سقف هستند. نقدینگی به ۵۰٪ افزایش یافت.";
          alloc = ratioTrendAbove
              ? [ { name: GOLD_SYMBOL, value: 30, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ]
              : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 30, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ];
      }
      else if (goldState === 'Floor' && stockState === 'Floor') {
          scenario = "فرصت دوطرفه (کف‌خوری)";
          sid = "opportunity";
          description = "هر دو دارایی در کف ارزنده هستند. خرید تهاجمی با ۳۰٪ اوراق.";
          alloc = ratioTrendAbove 
            ? [ { name: GOLD_SYMBOL, value: 45, fill: '#fbbf24' }, { name: symbol.symbol, value: 25, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ]
            : [ { name: GOLD_SYMBOL, value: 25, fill: '#fbbf24' }, { name: symbol.symbol, value: 45, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
      }
      else if (goldState === 'Ceiling' || stockState === 'Ceiling') {
          scenario = "تک‌سقف (توزیع)";
          sid = "one-ceiling";
          const highAsset = goldState === 'Ceiling' ? 'gold' : 'index';
          const ratioConfirmsSell = highAsset === 'gold' ? !ratioTrendAbove : ratioTrendAbove; 
          if (ratioConfirmsSell) {
             description = `روند Ratio ضعف ${highAsset === 'gold' ? 'طلا' : symbol.symbol} را تایید می‌کند. خروج سنگین.`;
             alloc = highAsset === 'gold'
                ? [ { name: GOLD_SYMBOL, value: 15, fill: '#fbbf24' }, { name: symbol.symbol, value: 50, fill: '#10b981' }, { name: 'اوراق', value: 35, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 50, fill: '#fbbf24' }, { name: symbol.symbol, value: 15, fill: '#10b981' }, { name: 'اوراق', value: 35, fill: '#3b82f6' } ];
          } else {
             description = "دارایی در سقف است اما Ratio هنوز معکوس نشده. سیو سود پله‌ای.";
             alloc = [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
          }
      }
      else if (goldState === 'Floor' || stockState === 'Floor') {
          scenario = "تک‌کف (شکار فرصت)";
          sid = "one-floor";
          const cheapAsset = goldState === 'Floor' ? 'gold' : 'index';
          if (isHighCorrRisk) {
              description = "هشدار: همبستگی مثبت شدید است. خرید به ۴۰٪ محدود شد.";
              alloc = cheapAsset === 'gold'
                ? [ { name: GOLD_SYMBOL, value: 40, fill: '#fbbf24' }, { name: symbol.symbol, value: 30, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ]
                : [ { name: GOLD_SYMBOL, value: 30, fill: '#fbbf24' }, { name: symbol.symbol, value: 40, fill: '#10b981' }, { name: 'اوراق', value: 30, fill: '#3b82f6' } ];
          } else {
              const ratioSupportsBuy = cheapAsset === 'gold' ? ratioTrendAbove : !ratioTrendAbove;
              if (ratioSupportsBuy) {
                 description = "قیمت ارزان + روند Ratio موافق. خرید تهاجمی ۶۰ درصدی.";
                 alloc = cheapAsset === 'gold'
                    ? [ { name: GOLD_SYMBOL, value: 60, fill: '#fbbf24' }, { name: symbol.symbol, value: 20, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                    : [ { name: GOLD_SYMBOL, value: 20, fill: '#fbbf24' }, { name: symbol.symbol, value: 60, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              } else {
                 description = "قیمت ارزان است اما Ratio هنوز سیگنال موافق قطعی نمی‌دهد. خرید متعادل ۴۰/۴۰.";
                 alloc = [ { name: GOLD_SYMBOL, value: 40, fill: '#fbbf24' }, { name: symbol.symbol, value: 40, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
              }
          }
      }
      else {
          scenario = "صلح (وضعیت نرمال)";
          sid = "peace";
          if (isHighCorrRisk) {
              description = "هشدار همبستگی مثبت شدید: نقدینگی به ۵۰٪ افزایش یافت.";
              alloc = [ { name: GOLD_SYMBOL, value: 25, fill: '#fbbf24' }, { name: symbol.symbol, value: 25, fill: '#10b981' }, { name: 'اوراق', value: 50, fill: '#3b82f6' } ];
          } else if (isSafeCorr) {
              description = "همبستگی معکوس امن: فرصت عالی برای کاهش نقدینگی به ۱۰٪.";
              alloc = ratioTrendAbove
                 ? [ { name: GOLD_SYMBOL, value: 55, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 10, fill: '#3b82f6' } ]
                 : [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 55, fill: '#10b981' }, { name: 'اوراق', value: 10, fill: '#3b82f6' } ];
          } else {
              description = "وضعیت تعادلی بازار و همبستگی خنثی. سهم اوراق ۲۰٪.";
              alloc = ratioTrendAbove
                 ? [ { name: GOLD_SYMBOL, value: 45, fill: '#fbbf24' }, { name: symbol.symbol, value: 35, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ]
                 : [ { name: GOLD_SYMBOL, value: 35, fill: '#fbbf24' }, { name: symbol.symbol, value: 45, fill: '#10b981' }, { name: 'اوراق', value: 20, fill: '#3b82f6' } ];
          }
      }

      setStrategy({ allocation: alloc, scenario, id: sid, description });
      setStatus(FetchStatus.SUCCESS);
    } catch (err: any) { setError(err.message); setStatus(FetchStatus.ERROR); }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
       <header className="mb-4">
          <h2 className="text-3xl font-bold text-white mb-2">مدیریت پرتفوی استراتژیک</h2>
          <p className="text-slate-400">سیستم تصمیم‌گیر هوشمند بر اساس قفل ۳/۳ و ماتریس سناریوهای بازار</p>
       </header>

       <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-700 pb-4">
             <Info className="w-5 h-5 text-cyan-400" /> تنظیمات تحلیل
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
            <div className="md:col-span-4 flex flex-col">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg h-full flex flex-col">
                    <h4 className="font-bold text-white mb-6 border-b border-slate-700 pb-2 flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-400" /> تشخیص وضعیت (State Logic)</h4>
                    <div className="space-y-6 flex-1 flex flex-col">
                        {[marketMetrics.gold, marketMetrics.index].map((m, idx) => (
                           <div key={idx} className="bg-slate-900 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group">
                               <div className={`absolute top-0 right-0 w-1 h-full ${m.state === 'Ceiling' ? 'bg-red-500' : m.state === 'Floor' ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                               <div className="flex justify-between items-center mb-4">
                                   <span className="text-white font-black text-sm">{m.symbol}</span>
                                   <div className="flex items-center gap-3">
                                       <div className="relative group/hist">
                                            <History className="w-4 h-4 text-slate-500 cursor-help hover:text-cyan-400 transition-colors" />
                                            <div className="absolute left-full mr-2 top-0 w-44 bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl z-50 opacity-0 pointer-events-none group-hover/hist:opacity-100 transition-opacity">
                                                <span className="text-[9px] text-slate-500 block mb-2 border-b border-slate-800 pb-1">پایداری (روزهای گذشته)</span>
                                                <div className="flex flex-col gap-2">
                                                    {m.devHistory.slice(1, 3).map((d, i) => (
                                                        <div key={i} className="flex justify-between text-[10px]">
                                                            <span className="text-slate-600">{i === 0 ? 'دیروز' : 'پریروز'}</span>
                                                            <span className={d > 0 ? 'text-emerald-400' : 'text-red-400'}>{d.toFixed(1)}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 pt-1 border-t border-slate-900 text-[8px] text-slate-700 italic">مبنای قفل ۳/۳</div>
                                            </div>
                                       </div>
                                       <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${m.state === 'Ceiling' ? 'bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.3)]' : m.state === 'Floor' ? 'bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-slate-700 text-slate-300'}`}>
                                           {m.state === 'Ceiling' ? 'سقف' : m.state === 'Floor' ? 'کف' : 'نرمال'}
                                       </span>
                                   </div>
                               </div>
                               
                               <div className="flex flex-col items-center justify-center py-2 bg-slate-950/30 rounded-xl border border-slate-800/50">
                                   <span className="text-[9px] text-slate-500 mb-1">انحراف از میانگین ۱۰۰ روزه</span>
                                   {/* Color Logic updated: Positive = Green (Emerald), Negative = Red */}
                                   <span className={`text-2xl font-black ${m.dev > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                       {m.dev > 0 ? '+' : ''}{m.dev.toFixed(1)}%
                                   </span>
                               </div>
                           </div>
                        ))}

                        <div className="flex flex-col gap-3">
                            <div className={`p-4 rounded-2xl border transition-all ${marketMetrics.anomaly ? 'bg-red-500/10 border-red-500/40 shadow-inner' : 'bg-slate-900 border-slate-700 opacity-60'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <ShieldAlert className={`w-4 h-4 ${marketMetrics.anomaly ? 'text-red-500' : 'text-slate-500'}`} />
                                    <span className={`text-[10px] font-black ${marketMetrics.anomaly ? 'text-white' : 'text-slate-500'}`}>ناهنجاری</span>
                                </div>
                                <span className="text-[9px] text-slate-500 block">تضاد همبستگی کوتاه‌مدت و بلندمدت</span>
                            </div>

                            <div className={`p-4 rounded-2xl border bg-slate-900 border-slate-700 transition-all`}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-orange-500" />
                                        <span className="text-[10px] font-black text-white">مدیریت ریسک همبستگی</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400" dir="ltr">{marketMetrics.corr2M.toFixed(2)}</span>
                                </div>
                                
                                <div className="relative h-4 mt-4 mb-2">
                                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/40 via-slate-700 to-emerald-500/40 rounded-full border border-slate-800"></div>
                                    <div className="absolute left-1/2 top-0 h-full w-px bg-slate-400/50 z-10"></div>
                                    <div 
                                        className="absolute top-0 w-2.5 h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] z-20 transition-all duration-1000 ease-out border border-slate-900"
                                        style={{ left: `${((1 - marketMetrics.corr2M) / 2) * 100}%`, transform: 'translateX(-50%)' }}
                                    ></div>
                                    <div className="absolute -top-4 left-0 text-[8px] text-red-400 font-black">۱+ (ریسک)</div>
                                    <div className="absolute -top-4 right-0 text-[8px] text-emerald-400 font-black">۱- (امن)</div>
                                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-slate-500">۰</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 flex justify-between items-center text-xs mt-auto">
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-amber-500" />
                                <span className="text-slate-400">فیلتر Ratio:</span>
                            </div>
                            <span className={`font-black ${marketMetrics.ratioAboveMA ? 'text-amber-400' : 'text-cyan-400'}`}>
                                {marketMetrics.ratioAboveMA ? 'طلا برتر' : 'شاخص برتر'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Panel */}
            <div className="md:col-span-8 flex flex-col">
                <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden flex flex-col h-full">
                    <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                        <div>
                            <span className="text-xs text-slate-500 block mb-1 uppercase tracking-tighter">سناریوی جاری شناسایی شده</span>
                            <h3 className="text-2xl font-black text-white">{strategy.scenario}</h3>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col lg:flex-row p-6 items-center">
                        <div className="flex-1 h-[340px] w-full relative">
                            <ResponsiveContainer>
                                <RechartsPieChart>
                                    <Pie 
                                      data={strategy.allocation} 
                                      cx="50%" 
                                      cy="50%" 
                                      innerRadius={85} 
                                      outerRadius={125} 
                                      paddingAngle={5} 
                                      dataKey="value" 
                                      stroke="none"
                                    >
                                        {strategy.allocation.map((entry, index) => <Cell key={index} fill={entry.fill} className="hover:opacity-80 transition-opacity cursor-pointer" />)}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', color: '#fff' }} 
                                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                        labelStyle={{ color: '#fff' }}
                                    />
                                    <Legend 
                                      verticalAlign="bottom" 
                                      height={36} 
                                      iconType="circle" 
                                      formatter={(value) => <span className="text-slate-300 font-bold text-xs">{value}</span>} 
                                    />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                <div className="text-center">
                                    <span className="block text-3xl font-black text-white">پرتفوی</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">Weights</span>
                                </div>
                            </div>
                        </div>
                        <div className="lg:w-2/5 p-6 bg-slate-900/40 rounded-3xl border border-slate-700/50 backdrop-blur-sm shadow-inner">
                            <h5 className="text-sm font-black text-white mb-4 flex items-center gap-2 border-b border-slate-700/50 pb-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> اقدام استراتژیک
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
                        </div>
                    </div>
                </div>
            </div>
         </div>
       )}

       {/* STRATEGY GUIDE SECTION */}
       {status === FetchStatus.SUCCESS && strategy && (
         <section className="animate-fade-in mt-12">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2"><Target className="w-6 h-6 text-amber-500" /> راهنمای جامع استراتژی‌های بازار</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { id: 'combat', icon: Swords, title: 'تقابل اکستریم (جنگی)', desc: 'تضاد شدید سقف و کف. در صورت ناهنجاری یا تایید Ratio، ۶۰٪ به سمت دارایی ارزان متمایل می‌شود.' },
                  { id: 'bubble', icon: Boxes, title: 'حباب دوطرفه (اشباع)', desc: 'اشباع خرید کامل. ۵۰٪ اوراق اجباری و توزیع باقی‌مانده ۳۰/۲۰ بر اساس قدرت نسبی (Ratio).' },
                  { id: 'opportunity', icon: Sparkles, title: 'فرصت دوطرفه (کف‌خوری)', desc: 'ارزندگی کل بازار. نقدینگی ۳۰٪ و تمرکز ۴۵ درصدی بر دارایی پیشرو در چارت نسبت.' },
                  { id: 'one-ceiling', icon: TrendingDown, title: 'تک‌سقف (توزیع)', desc: 'اشباع یک دارایی. اگر Ratio تایید کند خروج سنگین (۱۵٪ وزن) و در غیر این صورت خروج پله‌ای.' },
                  { id: 'one-floor', icon: TrendingUp, title: 'تک‌کف (فرصت خرید)', desc: 'ارزندگی یک دارایی. در صورت همبستگی خطرناک حجم ورود به ۴۰٪ محدود و در حالت امن تا ۶۰٪ افزایش می‌یابد.' },
                  { id: 'peace', icon: CheckCircle2, title: 'صلح (وضعیت نرمال)', desc: 'وضعیت تعادلی. سهم نقدینگی بین ۱۰٪ تا ۵۰٪ متغیر و تابع مستقیم ریسک همبستگی و Ratio است.' },
                ].map((s) => {
                    const isActive = strategy.id === s.id;
                    return (
                        <div key={s.id} className={`p-6 rounded-3xl border transition-all duration-500 flex flex-col relative overflow-hidden ${isActive ? 'bg-slate-800 border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.1)] ring-1 ring-cyan-500/50' : 'bg-slate-900/50 border-slate-800 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 hover:border-slate-700'}`}>
                            {isActive && <div className="absolute top-4 left-4 bg-cyan-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-lg">استراتژی جاری</div>}
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${isActive ? 'bg-cyan-500/20 text-cyan-400 shadow-inner' : 'bg-slate-800 text-slate-500'}`}>
                                <s.icon className="w-6 h-6" />
                            </div>
                            <h4 className={`font-black mb-2 text-sm ${isActive ? 'text-white' : 'text-slate-400'}`}>{s.title}</h4>
                            <p className="text-[11px] text-slate-500 leading-6 text-justify">{s.desc}</p>
                        </div>
                    );
                })}
            </div>
         </section>
       )}

       {status === FetchStatus.IDLE && (
         <div className="flex flex-col items-center justify-center p-20 bg-slate-800/50 rounded-3xl border border-slate-700 border-dashed opacity-50">
            <Activity className="w-16 h-16 text-slate-600 mb-4" />
            <p className="text-slate-500">لطفا نماد را انتخاب و دکمه محاسبه را بزنید تا وضعیت پرتفوی تحلیل شود.</p>
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
