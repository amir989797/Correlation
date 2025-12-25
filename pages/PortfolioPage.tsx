
import React, { useState, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols, fetchAssetGroups } from '../services/tsetmcService';
import { calculateFullHistorySMA, jalaliToGregorian, getTodayShamsi, alignDataByDate, calculatePearson, toShamsi } from '../utils/mathUtils';
import { SearchResult, TsetmcDataPoint, FetchStatus, AssetGroup } from '../types';
import { 
  Search, Loader2, Info, X, Calendar, Clock, ChevronDown, TrendingUp, 
  TrendingDown, AlertTriangle, CheckCircle2, Activity, ShieldAlert, 
  Zap, Target, Swords, Boxes, Sparkles, ShieldCheck, PieChart, Briefcase
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

type MarketState = 'Ceiling' | 'Floor' | 'Normal';

interface AssetMetrics {
  symbol: string;
  price: number;
  dev: number;
  state: MarketState;
  devHistory: number[]; 
  stateSince: string; // Shamsi date string
  daysActive: number;
  timer: number;
  timerType: 'entry' | 'exit' | 'none';
}

interface StrategyResult {
  allocation: { name: string; value: number; fill: string }[];
  scenario: string;
  id: string; 
  description: string;
}

/**
 * MarketStateCard - Visualizes the 3/3 Hysteresis Lock logic for an asset
 */
const MarketStateCard = ({ metrics }: { metrics: AssetMetrics }) => {
  const { symbol, dev, state, devHistory, stateSince, daysActive, timer, timerType } = metrics;

  // Determine Dot Colors for Lock Visualizer
  const getDotColor = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal > 10) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    if (absVal >= 7 && absVal <= 10) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
    return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
  };

  const isInBuffer = (state === 'Ceiling' && dev >= 7 && dev <= 10) || 
                     (state === 'Floor' && dev <= -7 && dev >= -10);

  const stateLabel = state === 'Ceiling' ? 'ناحیه اشباع خرید (گران)' : state === 'Floor' ? 'ناحیه اشباع فروش (ارزان)' : 'محدوده تعادلی';
  const stateColor = state === 'Ceiling' ? 'bg-red-500' : state === 'Floor' ? 'bg-emerald-500' : 'bg-slate-700';

  const getFooterDescription = () => {
    if (isInBuffer) return 'قیمت در حال نوسان است اما وضعیت قبلی همچنان معتبر است.';
    if (state === 'Ceiling') return 'قیمت در ۳ روز گذشته در محدوده سقف تثبیت شده است (سیگنال معتبر).';
    if (state === 'Floor') return 'قیمت در ۳ روز گذشته در محدوده کف تثبیت شده است (سیگنال معتبر).';
    return 'بازار در محدوده تعادلی است و هیچ ماشه فعالی شناسایی نشده است.';
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-700 overflow-hidden group hover:border-slate-500 transition-all duration-500 shadow-2xl relative">
      {/* State Indicator Bar */}
      <div className={`absolute top-0 right-0 w-1.5 h-full ${stateColor} ${state !== 'Normal' ? 'animate-pulse' : ''}`}></div>

      <div className="p-6 space-y-5">
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-white font-black text-lg">{symbol}</h3>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider ${stateColor} ${state !== 'Normal' ? 'animate-pulse' : ''}`}>
              {stateLabel}
            </span>
          </div>
          <div className="text-right">
             <div className="text-[10px] text-slate-500 mb-1 font-bold">انحراف از میانگین ۱۰۰ روزه</div>
             <div className={`text-3xl font-black ${dev > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
               {dev > 0 ? '+' : ''}{dev.toFixed(1)}%
             </div>
          </div>
        </div>

        {/* Compact Lock Visualizer - Aligned Horizontally */}
        <div className="bg-slate-950/50 px-4 py-3 rounded-2xl border border-slate-800/50 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <ShieldCheck className="w-4 h-4 text-cyan-400" />
             <span className="text-[10px] text-slate-300 font-bold whitespace-nowrap">تاییدیه تثبیت روند:</span>
             {timerType !== 'none' && (
               <span className="text-[9px] text-amber-400 animate-pulse font-black">({timer}/۳)</span>
             )}
           </div>
           <div className="flex gap-4 items-center">
              {devHistory.slice(0, 3).reverse().map((val, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                   <div className={`w-3.5 h-3.5 rounded-full ${getDotColor(val)} transition-all duration-700`} title={`${val.toFixed(1)}%`}></div>
                   <span className="text-[8px] text-slate-500 font-bold">روز {idx + 1}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Timeline & Persistence */}
        <div className="flex items-center justify-between py-3 border-y border-slate-800/50">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-slate-400">تاریخ شروع موج:</span>
            <span className="text-[10px] text-white font-bold">{stateSince}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[10px] text-white font-black">({daysActive} روز)</span>
          </div>
        </div>

        {/* Buffer Warning or Logic Feedback */}
        <div className="min-h-[44px]">
          {isInBuffer ? (
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[10px] text-amber-200 leading-relaxed font-medium">
                {getFooterDescription()}
              </p>
            </div>
          ) : state !== 'Normal' ? (
            <div className="bg-slate-950/30 p-3 rounded-xl flex items-center gap-3 border border-slate-800/30">
               <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
               <p className="text-[10px] text-slate-400 leading-relaxed">
                 {getFooterDescription()}
               </p>
            </div>
          ) : (
            <div className="bg-emerald-500/5 p-3 rounded-xl flex items-center gap-3 border border-emerald-500/10">
               <Zap className="w-4 h-4 text-emerald-500 shrink-0" />
               <p className="text-[10px] text-slate-500 leading-relaxed">
                 {getFooterDescription()}
               </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
           <div className="flex flex-col overflow-hidden">
             <span className="font-bold text-sm truncate">{value.symbol}</span>
             <span className="text-[10px] text-slate-400 truncate">{value.name}</span>
           </div>
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
               <button 
                key={idx} 
                type="button" 
                onClick={() => { onSelect(item); setIsOpen(false); }} 
                className="w-full text-right px-4 py-2 hover:bg-slate-800 border-b border-slate-800 last:border-0 flex flex-col items-start gap-1 group transition-colors"
               >
                 <span className="font-bold text-white text-sm group-hover:text-cyan-400">{item.symbol}</span>
                 <span className="text-[10px] text-slate-400 truncate w-full">{item.name}</span>
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
  const [activeTab, setActiveTab] = useState<'suggested' | 'analysis'>('suggested');
  
  // Asset Lists from API
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // Suggested Tab State
  // We now store the SELECTED symbol for each category
  const [suggestedConfig, setSuggestedConfig] = useState({
      includeStock: true,
      stockType: 'equity' as 'equity' | 'leveraged',
      selectedStock: '',
      includeGold: true,
      selectedGold: '',
      includeFixed: true,
      selectedFixed: ''
  });

  // Load assets on mount
  useEffect(() => {
      setLoadingAssets(true);
      fetchAssetGroups().then(data => {
          setAssetGroups(data);
          // Set initial defaults if available
          const equity = data.find(d => d.type === 'equity');
          const gold = data.find(d => d.type === 'gold');
          const fixed = data.find(d => d.type === 'fixed');
          
          setSuggestedConfig(prev => ({
              ...prev,
              selectedStock: equity ? equity.symbol : '',
              selectedGold: gold ? gold.symbol : '',
              selectedFixed: fixed ? fixed.symbol : ''
          }));
      }).finally(() => setLoadingAssets(false));
  }, []);

  // Analysis Tab State
  const [symbol, setSymbol] = useState<SearchResult | null>(null);
  const [dateMode, setDateMode] = useState<'current' | 'custom'>('current');
  const [shamsiDate, setShamsiDate] = useState(getTodayShamsi());

  // Result State
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

  const calculateStateHysteresis = (data: TsetmcDataPoint[], maMap: Map<string, number>, targetIndex: number): { state: MarketState; stateSince: string; daysActive: number; timer: number; timerType: 'entry' | 'exit' | 'none' } => {
    let currentState: MarketState = 'Normal';
    let stateStartDate = data[0].date;
    let ceilingEntryCounter = 0;
    let ceilingExitCounter = 0;
    let floorEntryCounter = 0;
    let floorExitCounter = 0;

    for (let i = 100; i <= targetIndex; i++) {
      const point = data[i];
      const ma = maMap.get(point.date);
      if (!ma) continue;
      const dev = ((point.close - ma) / ma) * 100;
      const prevState = currentState;

      if (currentState === 'Normal') {
        if (dev > 10) {
          ceilingEntryCounter++;
          if (ceilingEntryCounter >= 3) { currentState = 'Ceiling'; ceilingEntryCounter = 0; }
        } else { ceilingEntryCounter = 0; }

        if (dev < -10) {
          floorEntryCounter++;
          if (floorEntryCounter >= 3) { currentState = 'Floor'; floorEntryCounter = 0; }
        } else { floorEntryCounter = 0; }
      } 
      else if (currentState === 'Ceiling') {
        if (dev < 7) {
          ceilingExitCounter++;
          if (ceilingExitCounter >= 3) { currentState = 'Normal'; ceilingExitCounter = 0; }
        } else { ceilingExitCounter = 0; }
      } 
      else if (currentState === 'Floor') {
        if (dev > -7) {
          floorExitCounter++;
          if (floorExitCounter >= 3) { currentState = 'Normal'; floorExitCounter = 0; }
        } else { floorExitCounter = 0; }
      }

      if (prevState !== currentState) {
        stateStartDate = point.date;
      }
    }

    const timer = (currentState === 'Normal') ? (ceilingEntryCounter || floorEntryCounter) : (ceilingExitCounter || floorExitCounter);
    const timerType = (currentState === 'Normal' && (ceilingEntryCounter || floorEntryCounter)) ? 'entry' : (currentState !== 'Normal' && (ceilingExitCounter || floorExitCounter)) ? 'exit' : 'none';

    const targetDateStr = data[targetIndex].date;
    const startIndex = data.findIndex(d => d.date === stateStartDate);
    const daysActive = targetIndex - startIndex + 1;

    return { 
      state: currentState, 
      stateSince: toShamsi(stateStartDate), 
      daysActive,
      timer,
      timerType
    };
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

  const calculateStrategyLogic = async (
    stockSymbol: string, 
    goldSymbol: string, 
    targetDateStr: string | null
  ) => {
      const [stockRes, goldRes] = await Promise.all([fetchStockHistory(stockSymbol), fetchStockHistory(goldSymbol)]);
      const stockData = stockRes.data;
      const goldData = goldRes.data;
      if (stockData.length < 400 || goldData.length < 400) throw new Error('سابقه معاملاتی کافی نیست.');
      
      const finalTargetDateStr = targetDateStr || stockData[stockData.length - 1].date;
      
      const stockIdx = stockData.findIndex(d => d.date === finalTargetDateStr);
      const goldIdx = goldData.findIndex(d => d.date === finalTargetDateStr);
      if (stockIdx === -1 || goldIdx === -1) throw new Error('داده‌ای برای تاریخ انتخابی یافت نشد.');

      const stockMA100 = calculateFullHistorySMA(stockData, 100);
      const goldMA100 = calculateFullHistorySMA(goldData, 100);
      const goldPoint = goldData[goldIdx];
      const stockPoint = stockData[stockIdx];
      const goldMA = goldMA100.get(finalTargetDateStr)!;
      const stockMA = stockMA100.get(finalTargetDateStr)!;
      const goldDev = ((goldPoint.close - goldMA) / goldMA) * 100;
      const stockDev = ((stockPoint.close - stockMA) / stockMA) * 100;
      
      const goldLogic = calculateStateHysteresis(goldData, goldMA100, goldIdx);
      const stockLogic = calculateStateHysteresis(stockData, stockMA100, stockIdx);

      const goldHistory = getDevHistory(goldData, goldMA100, goldIdx);
      const stockHistory = getDevHistory(stockData, stockMA100, stockIdx);
      
      const merged = alignDataByDate(stockData, goldData);
      const ratioSeries = merged.map(m => ({ date: m.date, close: m.price1 !== 0 ? m.price2 / m.price1 : 0 })); // Gold / Stock
      const ratioMA100 = calculateFullHistorySMA(ratioSeries, 100);
      const currentRatio = goldPoint.close / stockPoint.close;
      const ratioMA = ratioMA100.get(finalTargetDateStr)!;
      const ratioTrendAbove = currentRatio > ratioMA;
      const mergedTargetIdx = merged.findIndex(m => m.date === finalTargetDateStr);
      const slice2M = merged.slice(mergedTargetIdx - 60, mergedTargetIdx + 1);
      const slice1Y = merged.slice(mergedTargetIdx - 365, mergedTargetIdx + 1);
      const corr2M = calculatePearson(slice2M.map(s => s.price2), slice2M.map(s => s.price1));
      const corr1Y = calculatePearson(slice1Y.map(s => s.price2), slice1Y.map(s => s.price1));
      const isAnomaly = (corr1Y > 0 && corr2M < 0) || (corr1Y < 0 && corr2M > 0);
      const isHighCorrRisk = corr2M > 0.5;
      const isSafeCorr = corr2M < -0.5;

      const metrics = {
        gold: { symbol: goldSymbol, price: goldPoint.close, dev: goldDev, state: goldLogic.state, devHistory: goldHistory, stateSince: goldLogic.stateSince, daysActive: goldLogic.daysActive, timer: goldLogic.timer, timerType: goldLogic.timerType },
        index: { symbol: stockSymbol, price: stockPoint.close, dev: stockDev, state: stockLogic.state, devHistory: stockHistory, stateSince: stockLogic.stateSince, daysActive: stockLogic.daysActive, timer: stockLogic.timer, timerType: stockLogic.timerType },
        anomaly: isAnomaly,
        highCorr: isHighCorrRisk,
        safeCorr: isSafeCorr,
        ratioAboveMA: ratioTrendAbove,
        corr2M,
        corr1Y
      };

      // --- Scenario Logic ---
      let scenario = "";
      let sid = "";
      let description = "";
      let alloc: { name: string; value: number; fill: string, type: 'gold' | 'stock' | 'fixed' }[] = [];

      const goldState = goldLogic.state;
      const stockState = stockLogic.state;

      const fixedName = suggestedConfig.selectedFixed || "درآمد ثابت";

      if ((goldState === 'Ceiling' && stockState === 'Floor') || (goldState === 'Floor' && stockState === 'Ceiling')) {
          scenario = "فرصت نوسان‌گیری (واگرایی)";
          sid = "combat";
          description = "یکی از دارایی ها حباب مثبت و دیگری حباب منفی دارد.\nپیشنهاد: تبدیل سرمایه به سمت حباب منفی";
          const cheapAsset = goldState === 'Floor' ? 'gold' : 'index';
          if (isAnomaly) {
              alloc = cheapAsset === 'gold'
                  ? [ { name: goldSymbol, value: 60, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 20, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ]
                  : [ { name: goldSymbol, value: 20, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 60, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ];
          } else {
              const ratioSupportsCheap = cheapAsset === 'gold' ? ratioTrendAbove : !ratioTrendAbove;
              if (ratioSupportsCheap) {
                   alloc = cheapAsset === 'gold'
                      ? [ { name: goldSymbol, value: 60, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 20, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ]
                      : [ { name: goldSymbol, value: 20, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 60, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ];
              } else {
                   alloc = [ { name: goldSymbol, value: 35, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 35, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 30, fill: '#3b82f6', type: 'fixed' } ];
              }
          }
      } 
      else if (goldState === 'Ceiling' && stockState === 'Ceiling') {
          scenario = "هشدار ریزش (نقد شوید)";
          sid = "bubble";
          description = "هر دو دارایی گران شده اند.\nپیشنهاد: افزایش سطح نقدینگی (اوراق) برای حفظ اصل سرمایه";
          alloc = ratioTrendAbove
              ? [ { name: goldSymbol, value: 30, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 20, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 50, fill: '#3b82f6', type: 'fixed' } ]
              : [ { name: goldSymbol, value: 20, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 30, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 50, fill: '#3b82f6', type: 'fixed' } ];
      }
      else if (goldState === 'Floor' && stockState === 'Floor') {
          scenario = "فرصت خرید طلایی";
          sid = "opportunity";
          description = "هر دو دارایی ارزان شده اند.\nپیشنهاد: کاهش سطح نقدینگی (اوراق) برای سرمایه گزاری";
          alloc = ratioTrendAbove 
            ? [ { name: goldSymbol, value: 45, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 25, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 30, fill: '#3b82f6', type: 'fixed' } ]
            : [ { name: goldSymbol, value: 25, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 45, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 30, fill: '#3b82f6', type: 'fixed' } ];
      }
      else if (goldState === 'Ceiling' || stockState === 'Ceiling') {
          scenario = "ذخیره سود";
          sid = "one-ceiling";
          description = "یک دارایی گران شده.\nپیشنهاد: تبدیل بخشی از سود به دارایی ارزان تر و اوراق";
          const highAsset = goldState === 'Ceiling' ? 'gold' : 'index';
          const ratioConfirmsSell = highAsset === 'gold' ? !ratioTrendAbove : ratioTrendAbove; 
          if (ratioConfirmsSell) {
             alloc = highAsset === 'gold'
                ? [ { name: goldSymbol, value: 15, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 50, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 35, fill: '#3b82f6', type: 'fixed' } ]
                : [ { name: goldSymbol, value: 50, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 15, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 35, fill: '#3b82f6', type: 'fixed' } ];
          } else {
             alloc = [ { name: goldSymbol, value: 35, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 35, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 30, fill: '#3b82f6', type: 'fixed' } ];
          }
      }
      else if (goldState === 'Floor' || stockState === 'Floor') {
          scenario = "شکار فرصت";
          sid = "one-floor";
          description = "یک دارایی ارزان شده.\nپیشنهاد: تبدیل بخشی از سرمایه به دارایی ارزان تر";
          const cheapAsset = goldState === 'Floor' ? 'gold' : 'index';
          if (isHighCorrRisk) {
              alloc = cheapAsset === 'gold'
                ? [ { name: goldSymbol, value: 40, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 30, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 30, fill: '#3b82f6', type: 'fixed' } ]
                : [ { name: goldSymbol, value: 30, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 40, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 30, fill: '#3b82f6', type: 'fixed' } ];
          } else {
              const ratioSupportsBuy = cheapAsset === 'gold' ? ratioTrendAbove : !ratioTrendAbove;
              if (ratioSupportsBuy) {
                 alloc = cheapAsset === 'gold'
                    ? [ { name: goldSymbol, value: 60, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 20, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ]
                    : [ { name: goldSymbol, value: 20, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 60, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ];
              } else {
                 alloc = [ { name: goldSymbol, value: 40, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 40, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ];
              }
          }
      }
      else {
          scenario = "بازار متعادل (رونددار)";
          sid = "peace";
          description = "بازار آرام است. هیجان خاصی در قیمت‌ها نیست.\nپیشنهاد: با روند همراه شوید و وزن دارایی قوی‌تر را بیشتر کنید.";
          if (isHighCorrRisk) {
              alloc = [ { name: goldSymbol, value: 25, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 25, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 50, fill: '#3b82f6', type: 'fixed' } ];
          } else if (isSafeCorr) {
              alloc = ratioTrendAbove
                 ? [ { name: goldSymbol, value: 55, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 35, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 10, fill: '#3b82f6', type: 'fixed' } ]
                 : [ { name: goldSymbol, value: 35, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 55, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 10, fill: '#3b82f6', type: 'fixed' } ];
          } else {
              alloc = ratioTrendAbove
                 ? [ { name: goldSymbol, value: 45, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 35, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ]
                 : [ { name: goldSymbol, value: 35, fill: '#fbbf24', type: 'gold' }, { name: stockSymbol, value: 45, fill: '#10b981', type: 'stock' }, { name: fixedName, value: 20, fill: '#3b82f6', type: 'fixed' } ];
          }
      }

      return { metrics, baseStrategy: { allocation: alloc, scenario, id: sid, description } };
  }

  const handleRunSuggested = async () => {
     // Validate at least 2 are checked
     const checks = [suggestedConfig.includeStock, suggestedConfig.includeGold, suggestedConfig.includeFixed];
     if (checks.filter(c => c).length < 2) {
         setError("لطفا حداقل دو کلاس دارایی را انتخاب کنید.");
         return;
     }

     if (suggestedConfig.includeStock && !suggestedConfig.selectedStock) return setError("لطفا نماد سهامی/اهرمی را انتخاب کنید.");
     if (suggestedConfig.includeGold && !suggestedConfig.selectedGold) return setError("لطفا نماد طلا را انتخاب کنید.");
     if (suggestedConfig.includeFixed && !suggestedConfig.selectedFixed) return setError("لطفا نماد درآمد ثابت را انتخاب کنید.");

     setStatus(FetchStatus.LOADING);
     setError(null);

     try {
         // Determine symbols from selection
         const stockSym = suggestedConfig.selectedStock;
         const goldSym = suggestedConfig.selectedGold;

         // Run Core Logic (Using current date)
         const { metrics, baseStrategy } = await calculateStrategyLogic(stockSym, goldSym, null);
         
         // Set Metrics
         setMarketMetrics(metrics);

         // Normalize Allocations based on selections
         let newAlloc = [];
         let totalWeight = 0;

         for (const item of baseStrategy.allocation) {
             if (item.type === 'stock' && suggestedConfig.includeStock) {
                 newAlloc.push(item);
                 totalWeight += item.value;
             }
             else if (item.type === 'gold' && suggestedConfig.includeGold) {
                 newAlloc.push(item);
                 totalWeight += item.value;
             }
             else if (item.type === 'fixed' && suggestedConfig.includeFixed) {
                 newAlloc.push({ ...item, name: suggestedConfig.selectedFixed });
                 totalWeight += item.value;
             }
         }

         // Normalize to 100%
         if (totalWeight > 0) {
             newAlloc = newAlloc.map(item => ({
                 ...item,
                 value: Math.round((item.value / totalWeight) * 100)
             }));
             const currentSum = newAlloc.reduce((a,b) => a + b.value, 0);
             if (currentSum !== 100 && newAlloc.length > 0) {
                 newAlloc[0].value += (100 - currentSum);
             }
         }

         setStrategy({
             ...baseStrategy,
             allocation: newAlloc
         });
         setStatus(FetchStatus.SUCCESS);

     } catch (err: any) {
         setError(err.message);
         setStatus(FetchStatus.ERROR);
     }
  };

  const handleRunAnalysis = async () => {
      if (!symbol) return setError('لطفا نماد را انتخاب کنید.');
      
      // Need a gold symbol to compare against for analysis mode too. 
      // We'll use the selected gold fund if available, or fall back to a default if list is empty.
      const defaultGold = assetGroups.find(g => g.type === 'gold')?.symbol || 'عیار';

      setStatus(FetchStatus.LOADING);
      setError(null);

      try {
        const targetDateStr = dateMode === 'current' ? null : (() => {
            const { gy, gm, gd } = jalaliToGregorian(shamsiDate.jy, shamsiDate.jm, shamsiDate.jd);
            return `${gy}${gm < 10 ? '0'+gm : gm}${gd < 10 ? '0'+gd : gd}`;
        })();

        const { metrics, baseStrategy } = await calculateStrategyLogic(symbol.symbol, defaultGold, targetDateStr);
        setMarketMetrics(metrics);
        setStrategy(baseStrategy);
        setStatus(FetchStatus.SUCCESS);

      } catch (err: any) {
        setError(err.message);
        setStatus(FetchStatus.ERROR);
      }
  };

  // Helper to filter assets for dropdowns
  const getAssetsByType = (type: string) => assetGroups.filter(g => g.type === type);
  // For stocks, we combine based on the dropdown filter
  const stockAssets = suggestedConfig.stockType === 'equity' 
      ? getAssetsByType('equity') 
      : getAssetsByType('leveraged');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-20 animate-fade-in">
       <header className="mb-4">
          <h2 className="text-3xl font-bold text-white mb-2">«دستیار هوشمند سبدگردانی»</h2>
          <p className="text-slate-400">«پیشنهاد تخصیص دارایی بر اساس حباب قیمت و ریسک‌های بازار»</p>
       </header>

       {/* Analysis Settings Card */}
       <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl relative z-10">
          
          {/* Tabs Header */}
          <div className="flex border-b border-slate-700">
             <button 
               onClick={() => { setActiveTab('suggested'); setError(null); }}
               className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors rounded-tr-2xl ${activeTab === 'suggested' ? 'bg-slate-700/50 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:bg-slate-700/30'}`}
             >
                <PieChart className="w-4 h-4" /> پرتفوی پیشنهادی
             </button>
             <button 
               onClick={() => { setActiveTab('analysis'); setError(null); }}
               className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors rounded-tl-2xl ${activeTab === 'analysis' ? 'bg-slate-700/50 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:bg-slate-700/30'}`}
             >
                <Search className="w-4 h-4" /> بررسی نماد دلخواه
             </button>
          </div>

          <div className="p-6">
              {/* TAB 1: SUGGESTED PORTFOLIO */}
              {activeTab === 'suggested' && (
                  <div className="space-y-6 animate-fade-in">
                     <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <h4 className="text-white font-bold mb-4 text-sm flex items-center gap-2"><Briefcase className="w-4 h-4 text-amber-400"/> کلاس‌های دارایی</h4>
                        
                        {loadingAssets && <div className="text-center text-xs text-slate-500 mb-2">در حال بارگذاری لیست صندوق‌ها...</div>}

                        <div className="space-y-4">
                           
                           {/* Stocks Row */}
                           <div className="flex flex-col md:flex-row gap-4 p-3 rounded-lg border border-slate-700 bg-slate-800 hover:border-slate-600 transition-colors">
                               <label className="flex items-center gap-3 cursor-pointer min-w-[150px]">
                                   <input 
                                     type="checkbox" 
                                     checked={suggestedConfig.includeStock} 
                                     onChange={(e) => setSuggestedConfig(prev => ({...prev, includeStock: e.target.checked}))}
                                     className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-offset-slate-800"
                                   />
                                   <span className="text-white font-medium">بازار سهام</span>
                               </label>
                               <div className="flex-1 flex gap-2">
                                   <select 
                                     disabled={!suggestedConfig.includeStock}
                                     value={suggestedConfig.stockType}
                                     onChange={(e) => {
                                         const newType = e.target.value as any;
                                         // Auto select first of new type
                                         const first = assetGroups.find(g => g.type === newType);
                                         setSuggestedConfig(prev => ({
                                             ...prev, 
                                             stockType: newType,
                                             selectedStock: first ? first.symbol : ''
                                         }));
                                     }}
                                     className="bg-slate-900 border border-slate-600 text-white text-xs rounded-lg p-2.5 outline-none focus:border-cyan-500 disabled:opacity-50 w-32"
                                   >
                                       <option value="equity">سهامی</option>
                                       <option value="leveraged">اهرمی</option>
                                   </select>
                                   <select
                                     disabled={!suggestedConfig.includeStock}
                                     value={suggestedConfig.selectedStock}
                                     onChange={(e) => setSuggestedConfig(prev => ({...prev, selectedStock: e.target.value}))}
                                     className="flex-1 bg-slate-900 border border-slate-600 text-white text-xs rounded-lg p-2.5 outline-none focus:border-cyan-500 disabled:opacity-50"
                                   >
                                       {stockAssets.length === 0 && <option value="">لیست خالی است</option>}
                                       {stockAssets.map(a => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                                   </select>
                               </div>
                           </div>

                           {/* Gold Row */}
                           <div className="flex flex-col md:flex-row gap-4 p-3 rounded-lg border border-slate-700 bg-slate-800 hover:border-slate-600 transition-colors">
                               <label className="flex items-center gap-3 cursor-pointer min-w-[150px]">
                                   <input 
                                     type="checkbox" 
                                     checked={suggestedConfig.includeGold} 
                                     onChange={(e) => setSuggestedConfig(prev => ({...prev, includeGold: e.target.checked}))}
                                     className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-offset-slate-800"
                                   />
                                   <span className="text-white font-medium">صندوق طلا</span>
                               </label>
                               <div className="flex-1">
                                   <select
                                     disabled={!suggestedConfig.includeGold}
                                     value={suggestedConfig.selectedGold}
                                     onChange={(e) => setSuggestedConfig(prev => ({...prev, selectedGold: e.target.value}))}
                                     className="w-full bg-slate-900 border border-slate-600 text-white text-xs rounded-lg p-2.5 outline-none focus:border-amber-500 disabled:opacity-50"
                                   >
                                       {getAssetsByType('gold').length === 0 && <option value="">لیست خالی است</option>}
                                       {getAssetsByType('gold').map(a => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                                   </select>
                               </div>
                           </div>

                           {/* Fixed Income Row */}
                           <div className="flex flex-col md:flex-row gap-4 p-3 rounded-lg border border-slate-700 bg-slate-800 hover:border-slate-600 transition-colors">
                               <label className="flex items-center gap-3 cursor-pointer min-w-[150px]">
                                   <input 
                                     type="checkbox" 
                                     checked={suggestedConfig.includeFixed} 
                                     onChange={(e) => setSuggestedConfig(prev => ({...prev, includeFixed: e.target.checked}))}
                                     className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-offset-slate-800"
                                   />
                                   <span className="text-white font-medium">درآمد ثابت</span>
                               </label>
                               <div className="flex-1">
                                   <select
                                     disabled={!suggestedConfig.includeFixed}
                                     value={suggestedConfig.selectedFixed}
                                     onChange={(e) => setSuggestedConfig(prev => ({...prev, selectedFixed: e.target.value}))}
                                     className="w-full bg-slate-900 border border-slate-600 text-white text-xs rounded-lg p-2.5 outline-none focus:border-blue-500 disabled:opacity-50"
                                   >
                                       {getAssetsByType('fixed').length === 0 && <option value="">لیست خالی است</option>}
                                       {getAssetsByType('fixed').map(a => <option key={a.symbol} value={a.symbol}>{a.symbol}</option>)}
                                   </select>
                               </div>
                           </div>

                        </div>
                     </div>
                     <button onClick={handleRunSuggested} disabled={status === FetchStatus.LOADING} className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all border-none">
                       {status === FetchStatus.LOADING ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'محاسبه پرتفوی پیشنهادی'}
                     </button>
                  </div>
              )}

              {/* TAB 2: ANALYSIS */}
              {activeTab === 'analysis' && (
                  <div className="animate-fade-in grid md:grid-cols-3 gap-6">
                      <SearchInput label="انتخاب صندوق یا سهام" value={symbol} onSelect={setSymbol} />
                      <div className="space-y-2">
                          <label className="block text-sm font-medium text-slate-400">تاریخ محاسبه</label>
                          <div className="flex gap-2">
                            <button onClick={() => setDateMode('current')} className={`flex-1 p-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${dateMode === 'current' ? 'bg-slate-700 border-white text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}><Clock className="w-4 h-4" /> آخرین قیمت</button>
                            <button onClick={() => setDateMode('custom')} className={`flex-1 p-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${dateMode === 'custom' ? 'bg-slate-700 border-white text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}><Calendar className="w-4 h-4" /> تاریخ خاص</button>
                          </div>
                      </div>
                      <div className={dateMode === 'custom' ? '' : 'opacity-30 pointer-events-none'}>
                          <label className="block text-sm font-medium text-slate-400 mb-2">انتخاب تاریخ</label>
                          <ShamsiDatePicker value={shamsiDate} onChange={setShamsiDate} />
                      </div>
                      <div className="md:col-span-3">
                        <button onClick={handleRunAnalysis} disabled={status === FetchStatus.LOADING} className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 transition-all border-none">
                            {status === FetchStatus.LOADING ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'تحلیل نماد'}
                        </button>
                      </div>
                  </div>
              )}
          </div>
       </div>

       {status === FetchStatus.SUCCESS && marketMetrics && strategy && (
         <div className="grid md:grid-cols-12 gap-6 items-stretch animate-fade-in">
            
            {/* Asset State Grid */}
            <div className="md:col-span-5 flex flex-col gap-6">
                <MarketStateCard metrics={marketMetrics.gold} />
                <MarketStateCard metrics={marketMetrics.index} />
                
                {/* Secondary Indicators Block */}
                <div className="bg-slate-800 p-5 rounded-3xl border border-slate-700 shadow-lg mt-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 rounded-2xl border transition-all ${marketMetrics.anomaly ? 'bg-red-500/10 border-red-500/40' : 'bg-slate-900 border-slate-700 opacity-60'}`}>
                            <div className="flex items-center gap-2 mb-1">
                                <ShieldAlert className={`w-4 h-4 ${marketMetrics.anomaly ? 'text-red-500' : 'text-slate-500'}`} />
                                <span className={`text-[10px] font-black ${marketMetrics.anomaly ? 'text-white' : 'text-slate-500'}`}>هشدار رفتار غیرعادی بازار</span>
                            </div>
                            <span className="text-[9px] text-slate-500 block leading-relaxed">تضاد جهت‌گیری پول هوشمند در کوتاه‌مدت و بلندمدت</span>
                        </div>
                        <div className="p-4 rounded-2xl border bg-slate-900 border-slate-700">
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-orange-500" />
                                    <span className="text-[10px] font-black text-white">ریسک همبستگی</span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-400" dir="ltr">{marketMetrics.corr2M.toFixed(2)}</span>
                            </div>
                            <div className="bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                               <div className="h-full bg-orange-500" style={{ width: `${(marketMetrics.corr2M + 1) * 50}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Display Panel */}
            <div className="md:col-span-7 flex flex-col">
                <div className="bg-slate-800 rounded-3xl border border-slate-700 shadow-xl overflow-hidden flex flex-col h-full">
                    <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex justify-between items-center">
                        <div>
                            <span className="text-xs text-slate-500 block mb-1 uppercase tracking-tighter">استراتژی</span>
                            <h3 className="text-2xl font-black text-white flex items-center gap-3">
                                {strategy.scenario}
                                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></div>
                            </h3>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col p-6 items-center gap-6">
                        {/* Chart Area */}
                        <div className="w-full h-[320px] relative group">
                            <ResponsiveContainer>
                                <RechartsPieChart>
                                    <Pie 
                                      data={strategy.allocation} 
                                      cx="50%" 
                                      cy="50%" 
                                      innerRadius={80} 
                                      outerRadius={120} 
                                      paddingAngle={8} 
                                      dataKey="value" 
                                      stroke="none"
                                    >
                                        {strategy.allocation.map((entry, index) => (
                                          <Cell key={index} fill={entry.fill} className="hover:opacity-90 transition-opacity cursor-pointer shadow-2xl" />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', color: '#fff' }} 
                                        itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}
                                    />
                                    <Legend 
                                      verticalAlign="bottom" 
                                      height={36} 
                                      iconType="circle" 
                                      formatter={(value) => <span className="text-slate-400 font-bold text-xs hover:text-white transition-colors">{value}</span>} 
                                    />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                                <div className="text-center">
                                    <span className="block text-3xl font-black text-white drop-shadow-lg">دارایی</span>
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">تخصیص بهینه</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Action Description */}
                        <div className="w-full p-6 bg-slate-900/60 rounded-[28px] border border-slate-700/50 backdrop-blur-xl shadow-2xl space-y-5">
                            <div className="flex flex-col sm:flex-row justify-between items-center border-b border-slate-700/50 pb-4 gap-4">
                                <h5 className="text-sm font-black text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" /> پیشنهاد ترکیب پرتفوی
                                </h5>
                                <div className="flex gap-4">
                                  {strategy.allocation.map((a, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: a.fill}}></div>
                                          <span className="font-black text-[11px] text-white">{a.value}%</span>
                                      </div>
                                  ))}
                                </div>
                            </div>
                            <p className="text-[12px] text-slate-300 leading-7 text-justify font-medium whitespace-pre-line">{strategy.description}</p>
                        </div>
                    </div>
                </div>
            </div>
         </div>
       )}

       {/* Scenario Guide Section */}
       {status === FetchStatus.SUCCESS && strategy && (
         <section className="animate-fade-in mt-12">
            <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3"><Target className="w-7 h-7 text-amber-500" /> استراتژی ها</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { id: 'combat', icon: Swords, title: 'فرصت نوسان‌گیری (واگرایی)', desc: 'یکی از دارایی ها حباب مثبت و دیگری حباب منفی دارد.\nپیشنهاد: تبدیل سرمایه به سمت حباب منفی' },
                  { id: 'bubble', icon: Boxes, title: 'هشدار ریزش (نقد شوید)', desc: 'هر دو دارایی گران شده اند.\nپیشنهاد: افزایش سطح نقدینگی (اوراق) برای حفظ اصل سرمایه' },
                  { id: 'opportunity', icon: Sparkles, title: 'فرصت خرید طلایی', desc: 'هر دو دارایی ارزان شده اند.\nپیشنهاد: کاهش سطح نقدینگی (اوراق) برای سرمایه گزاری' },
                  { id: 'one-ceiling', icon: TrendingDown, title: 'ذخیره سود', desc: 'یک دارایی گران شده.\nپیشنهاد: تبدیل بخشی از سود به دارایی ارزان تر و اوراق' },
                  { id: 'one-floor', icon: TrendingUp, title: 'شکار فرصت', desc: 'یک دارایی ارزان شده.\nپیشنهاد: تبدیل بخشی از سرمایه به دارایی ارزان تر' },
                  { id: 'peace', icon: CheckCircle2, title: 'بازار متعادل (رونددار)', desc: 'بازار آرام است. هیجان خاصی در قیمت‌ها نیست.\nپیشنهاد: با روند همراه شوید و وزن دارایی قوی‌تر را بیشتر کنید.' },
                ].map((s) => {
                    const isActive = strategy.id === s.id;
                    return (
                        <div key={s.id} className={`group p-6 rounded-3xl border transition-all duration-500 flex flex-col relative overflow-hidden ${isActive ? 'bg-slate-800 border-cyan-500/50 shadow-[0_20px_50px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/50 scale-[1.02]' : 'bg-slate-900/40 border-slate-800 grayscale hover:grayscale-0 opacity-40 hover:opacity-100 hover:border-slate-700'}`}>
                            {isActive && (
                              <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-cyan-500 text-white text-[8px] font-black px-2.5 py-1 rounded-full animate-bounce shadow-lg uppercase">
                                <Activity className="w-2.5 h-2.5" /> وضعیت فعال
                              </div>
                            )}
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${isActive ? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-slate-800 text-slate-500 group-hover:bg-slate-700'}`}>
                                <s.icon className="w-7 h-7" />
                            </div>
                            <h4 className={`font-black mb-3 text-sm transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{s.title}</h4>
                            <p className="text-[11px] text-slate-500 leading-7 text-justify transition-colors group-hover:text-slate-400 whitespace-pre-line">{s.desc}</p>
                        </div>
                    );
                })}
            </div>
         </section>
       )}

       {/* Initial State Helper */}
       {status === FetchStatus.IDLE && (
         <div className="flex flex-col items-center justify-center p-24 bg-slate-800/40 rounded-[40px] border border-slate-700 border-dashed opacity-40 group hover:opacity-100 transition-opacity">
            <Activity className="w-20 h-20 text-slate-700 mb-6 group-hover:text-cyan-500 transition-colors animate-pulse" />
            <p className="text-slate-500 font-medium group-hover:text-slate-300 transition-colors text-center max-w-sm leading-relaxed">
              سیستم در انتظار ورودی... لطفا تنظیمات پرتفوی پیشنهادی یا تحلیل نماد را انجام دهید.
            </p>
         </div>
       )}

       {/* Error Handler */}
       {error && (
         <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl text-red-400 text-sm flex items-center gap-4 animate-shake">
             <AlertTriangle className="w-6 h-6 shrink-0" />
             <div className="flex-1">
               <span className="font-bold block mb-0.5">خطای محاسباتی</span>
               {error}
             </div>
         </div>
       )}
    </div>
  );
}
