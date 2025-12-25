
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { calculateFullHistorySMA, toShamsi, getTodayShamsi } from '../utils/mathUtils';
import { SearchResult, TsetmcDataPoint, FetchStatus } from '../types';
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

// CONSTANTS
const SYMBOL_AYAR = 'عیار';
const SYMBOL_SEPAR = 'سپر';
const SYMBOL_AGAS = 'آگاس';
const SYMBOL_SHETAB = 'شتاب';
const FIXED_ASSET_NAME = 'صندوق درآمد ثابت (اوراق)';

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
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  if (value) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-400">{label}</label>
        <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-600 rounded-lg text-emerald-400">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
             </div>
             <div>
               <span className="block font-bold text-sm">{value.symbol}</span>
               <span className="block text-xs opacity-70">{value.name}</span>
             </div>
           </div>
           <button onClick={() => { onSelect(null); setQuery(''); }} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors">
             <X className="w-5 h-5" />
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <label className="block text-sm font-medium text-slate-400">{label}</label>
      <div className="relative">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجوی دارایی (مثلا: طلا)..." 
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-10 py-3 focus:ring-2 focus:ring-cyan-500 outline-none text-sm text-right" 
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-cyan-500" /> : <Search className="w-5 h-5" />}
        </div>

        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
             {results.map((item, idx) => (
               <button 
                key={idx}
                type="button"
                onClick={() => { onSelect(item); setIsOpen(false); }}
                className="w-full text-right px-4 py-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 flex justify-between items-center group transition-colors"
               >
                 <span className="font-bold text-white group-hover:text-cyan-400">{item.symbol}</span>
                 <span className="text-xs text-slate-400">{item.name}</span>
               </button>
             ))}
          </div>
        )}
        
        {isOpen && results.length === 0 && !loading && (
            <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 p-4 text-center text-slate-500 text-sm">
                نمادی یافت نشد
            </div>
        )}
      </div>
    </div>
  );
};

export function PortfolioPage() {
    const [assets, setAssets] = useState<AssetMetrics[]>([]);
    const [loading, setLoading] = useState(false);
    const [newItem, setNewItem] = useState<SearchResult | null>(null);

    const calculateAssetLogic = (symbol: string, history: TsetmcDataPoint[]): AssetMetrics => {
        const ma100Map = calculateFullHistorySMA(history, 100);
        
        // We need the last few days to determine state
        // Sort by date ascending is assumed from history fetch
        const dataLength = history.length;
        if (dataLength < 100) {
            throw new Error(`داده‌های تاریخی کافی نیست: ${symbol}`);
        }

        const today = history[dataLength - 1];
        const ma100 = ma100Map.get(today.date) || 0;
        const price = today.close;
        const currentDev = ((price - ma100) / ma100) * 100;

        // Calculate history of deviations for last few days
        const devHistory: number[] = [];
        for (let i = 0; i < 5; i++) {
            const idx = dataLength - 1 - i;
            if (idx >= 0) {
                const d = history[idx];
                const m = ma100Map.get(d.date) || 1;
                devHistory.push(((d.close - m) / m) * 100);
            }
        }

        // Simple State Logic (Placeholder for Hysteresis 3/3 rule)
        // If last 3 days > 10 => Ceiling
        // If last 3 days < -10 => Floor
        // Else check previous state (not persistent here without DB, so we approximate)
        
        let state: MarketState = 'Normal';
        let timer = 0;
        
        const last3 = devHistory.slice(0, 3);
        const over10 = last3.filter(d => d > 10).length;
        const underNeg10 = last3.filter(d => d < -10).length;

        if (over10 === 3) state = 'Ceiling';
        else if (underNeg10 === 3) state = 'Floor';

        // Timer is how many of the last 3 days met the criteria
        if (currentDev > 10) timer = over10;
        else if (currentDev < -10) timer = underNeg10;
        
        return {
            symbol,
            price,
            dev: currentDev,
            state,
            devHistory,
            stateSince: toShamsi(today.date),
            daysActive: 1, // Placeholder
            timer,
            timerType: state === 'Normal' ? (Math.abs(currentDev) > 10 ? 'entry' : 'none') : 'exit'
        };
    };

    const addAsset = async () => {
        if (!newItem) return;
        setLoading(true);
        try {
            const history = await fetchStockHistory(newItem.symbol);
            const metrics = calculateAssetLogic(newItem.symbol, history.data);
            setAssets(prev => [...prev.filter(a => a.symbol !== newItem.symbol), metrics]);
            setNewItem(null);
        } catch (e) {
            console.error(e);
            alert('خطا در محاسبه متریک‌های دارایی');
        } finally {
            setLoading(false);
        }
    };

    const removeAsset = (symbol: string) => {
        setAssets(prev => prev.filter(a => a.symbol !== symbol));
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
            <header className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">مدیریت پرتفوی هوشمند</h2>
                <p className="text-slate-400">بررسی وضعیت دارایی‌ها بر اساس انحراف از میانگین و سیگنال‌های اشباع</p>
            </header>

            {/* Add Asset Section */}
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <SearchInput label="افزودن دارایی جدید" value={newItem} onSelect={setNewItem} />
                    </div>
                    <button 
                        onClick={addAsset} 
                        disabled={!newItem || loading}
                        className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all h-[52px]"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'افزودن'}
                    </button>
                </div>
            </div>

            {/* Assets Grid */}
            {assets.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assets.map(asset => (
                        <div key={asset.symbol} className="relative group">
                            <button 
                                onClick={() => removeAsset(asset.symbol)}
                                className="absolute -top-2 -right-2 z-10 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <MarketStateCard metrics={asset} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-3xl">
                    <Briefcase className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">هنوز دارایی به پرتفوی اضافه نشده است.</p>
                </div>
            )}
        </div>
    );
}
