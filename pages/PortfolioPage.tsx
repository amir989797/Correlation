import React, { useState, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { calculateFullHistorySMA, jalaliToGregorian, getTodayShamsi, alignDataByDate, calculatePearson, toShamsi } from '../utils/mathUtils';
import { SearchResult, TsetmcDataPoint, FetchStatus } from '../types';
import { 
  Search, Loader2, Info, X, Calendar, Clock, ChevronDown, CheckCircle2, 
  Activity, ShieldAlert, Zap, LayoutDashboard, SearchCode, ShieldCheck
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
const GOLD_SYMBOL_FIXED = 'عیار'; 
const ACCEL_SYMBOL_FIXED = 'شتاب';
const STOCK_SYMBOL_FIXED = 'آگاس';
const FIXED_SYMBOL_FIXED = 'سپر';

type MarketState = 'Ceiling' | 'Floor' | 'Normal';
type TabMode = 'suggested' | 'check';

interface AssetMetrics {
  symbol: string;
  price: number;
  dev: number;
  state: MarketState;
  devHistory: number[]; 
  stateSince: string; 
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

const MarketStateCard = ({ metrics }: { metrics: AssetMetrics }) => {
  const { symbol, dev, state, devHistory, stateSince, daysActive, timer, timerType } = metrics;
  const stateLabel = state === 'Ceiling' ? 'حباب مثبت (گران)' : state === 'Floor' ? 'حباب منفی (ارزان)' : 'محدوده تعادلی قیمت';
  const stateColor = state === 'Ceiling' ? 'bg-red-500' : state === 'Floor' ? 'bg-emerald-500' : 'bg-slate-700';

  return (
    <div className="bg-slate-900/60 rounded-3xl border border-slate-700/50 overflow-hidden group hover:border-slate-500 transition-all shadow-2xl relative backdrop-blur-xl">
      <div className={`absolute top-0 right-0 w-1.5 h-full ${stateColor} ${state !== 'Normal' ? 'animate-pulse' : ''}`}></div>
      <div className="p-6 space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-white font-black text-xl">{symbol}</h3>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase ${stateColor}`}>
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
        <div className="bg-slate-950/50 px-4 py-3 rounded-2xl border border-slate-800/50 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <ShieldCheck className="w-4 h-4 text-cyan-400" />
             <span className="text-[10px] text-slate-300 font-bold">تثبیت روند:</span>
             {timerType !== 'none' && <span className="text-[9px] text-amber-400 animate-pulse font-black">({timer}/۳ روز)</span>}
           </div>
           <div className="flex gap-4">
              {devHistory.slice(0, 3).reverse().map((val, idx) => (
                <div key={idx} className={`w-3 h-3 rounded-full ${Math.abs(val) > 10 ? 'bg-red-500' : Math.abs(val) > 7 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
              ))}
           </div>
        </div>
        <div className="flex items-center justify-between py-3 border-y border-slate-800/50">
          <div className="flex items-center gap-2 text-[10px]">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">شروع موج:</span>
            <span className="text-white font-bold">{stateSince}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-white font-black">({daysActive} روز)</span>
          </div>
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
        <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-700 rounded-xl text-cyan-400">
           <span className="font-black text-sm">{value.symbol}</span>
           <button onClick={() => { onSelect(null); setQuery(''); }} className="p-1 hover:bg-black rounded-lg text-slate-400 transition-colors">
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
          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-4 pr-11 py-3 focus:ring-1 focus:ring-cyan-500 outline-none text-sm text-right text-white" 
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
        </div>
        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar">
             {results.map((item, idx) => (
               <button key={idx} type="button" onClick={() => { onSelect(item); setIsOpen(false); }} className="w-full text-right px-5 py-4 hover:bg-slate-800 border-b border-slate-800 last:border-0 flex justify-between items-center group transition-colors">
                 <span className="font-black text-white group-hover:text-cyan-400">{item.symbol}</span>
                 <span className="text-xs text-slate-500">{item.name}</span>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export function PortfolioPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('suggested');
  const [stockType, setStockType] = useState<string>(STOCK_SYMBOL_FIXED);
  const [useGold, setUseGold] = useState(true);
  const [useFixed, setUseFixed] = useState(true);
  const [symbol, setSymbol] = useState<SearchResult | null>(null);
  const [dateMode, setDateMode] = useState<'current' | 'custom'>('current');
  const [shamsiDate, setShamsiDate] = useState(getTodayShamsi());
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<StrategyResult | null>(null);
  const [marketMetrics, setMarketMetrics] = useState<any>(null);

  const calculateStateHysteresis = (data: TsetmcDataPoint[], maMap: Map<string, number>, targetIndex: number) => {
    // Explicitly define as MarketState and initialize
    let currentState: MarketState = 'Normal';
    let stateStartDate = data[0].date;
    let ceilingEntryCounter = 0, ceilingExitCounter = 0, floorEntryCounter = 0, floorExitCounter = 0;
    
    for (let i = 100; i <= targetIndex; i++) {
      const point = data[i], ma = maMap.get(point.date);
      if (!ma) continue;
      const dev = ((point.close - ma) / ma) * 100;
      const prevState = currentState;
      
      // Use type assertion to bypass problematic narrowing in some TS environments
      switch (currentState as MarketState) {
        case 'Normal':
          if (dev > 10) { ceilingEntryCounter++; if (ceilingEntryCounter >= 3) { currentState = 'Ceiling'; ceilingEntryCounter = 0; } } else ceilingEntryCounter = 0;
          if (dev < -10) { floorEntryCounter++; if (floorEntryCounter >= 3) { currentState = 'Floor'; floorEntryCounter = 0; } } else floorEntryCounter = 0;
          break;
        case 'Ceiling':
          if (dev < 7) { ceilingExitCounter++; if (ceilingExitCounter >= 3) { currentState = 'Normal'; ceilingExitCounter = 0; } } else ceilingExitCounter = 0;
          break;
        case 'Floor':
          if (dev > -7) { floorExitCounter++; if (floorExitCounter >= 3) { currentState = 'Normal'; floorExitCounter = 0; } } else floorExitCounter = 0;
          break;
      }
      if (prevState !== currentState) stateStartDate = point.date;
    }
    
    // Casting to MarketState during comparisons ensures TS respects the intended logic despite its narrowing analysis
    const timer = ((currentState as MarketState) === 'Normal') ? (ceilingEntryCounter || floorEntryCounter) : (ceilingExitCounter || floorExitCounter);
    const timerType = ((currentState as MarketState) === 'Normal' && (ceilingEntryCounter || floorEntryCounter)) ? 'entry' : ((currentState as MarketState) !== 'Normal' && (ceilingExitCounter || floorExitCounter)) ? 'exit' : 'none';
    
    return { state: currentState, stateSince: toShamsi(stateStartDate), daysActive: targetIndex - data.findIndex(d => d.date === stateStartDate) + 1, timer, timerType };
  };

  const runStrategy = async () => {
    let finalStockSymbol = activeTab === 'suggested' ? stockType : (symbol?.symbol || "");
    if (activeTab === 'suggested' && (!useGold && !useFixed)) return setError('لطفا حداقل دو گزینه را برای تحلیل انتخاب کنید.');
    if (activeTab === 'check' && !finalStockSymbol) return setError('لطفا نماد را انتخاب کنید.');

    setStatus(FetchStatus.LOADING);
    setError(null);
    try {
      const [stockRes, goldRes] = await Promise.all([fetchStockHistory(finalStockSymbol), fetchStockHistory(GOLD_SYMBOL_FIXED)]);
      const stockData = stockRes.data, goldData = goldRes.data;
      const targetDateStr = (activeTab === 'check' && dateMode === 'custom') ? (() => { const { gy, gm, gd } = jalaliToGregorian(shamsiDate.jy, shamsiDate.jm, shamsiDate.jd); return `${gy}${gm < 10 ? '0'+gm : gm}${gd < 10 ? '0'+gd : gd}`; })() : stockData[stockData.length - 1].date;
      const stockIdx = stockData.findIndex(d => d.date === targetDateStr), goldIdx = goldData.findIndex(d => d.date === targetDateStr);
      if (stockIdx === -1 || goldIdx === -1) throw new Error('داده‌ای برای تاریخ انتخابی یافت نشد.');
      
      const stockMA100Map = calculateFullHistorySMA(stockData, 100), goldMA100Map = calculateFullHistorySMA(goldData, 100);
      const stockLogic = calculateStateHysteresis(stockData, stockMA100Map, stockIdx), goldLogic = calculateStateHysteresis(goldData, goldMA100Map, goldIdx);
      const corr2M = calculatePearson(stockData.slice(stockIdx-60, stockIdx).map(s=>s.close), goldData.slice(goldIdx-60, goldIdx).map(g=>g.close));
      
      const stockMA = stockMA100Map.get(targetDateStr)!, goldMA = goldMA100Map.get(targetDateStr)!;
      const stockDev = ((stockData[stockIdx].close - stockMA) / stockMA) * 100;
      const goldDev = ((goldData[goldIdx].close - goldMA) / goldMA) * 100;

      setMarketMetrics({
        gold: { symbol: GOLD_SYMBOL_FIXED, dev: goldDev, ...goldLogic, devHistory: [0,0,0] },
        index: { symbol: finalStockSymbol, dev: stockDev, ...stockLogic, devHistory: [0,0,0] },
        corr2M
      });

      const FIXED_NAME = activeTab === 'suggested' ? FIXED_SYMBOL_FIXED : 'درآمد ثابت';
      let sid = "peace", scenario = "بازار متعادل", description = "شرایط بازار در وضعیت پایدار و متعادل است. هیجان خاصی در قیمت‌ها دیده نمی‌شود. پیشنهاد می‌شود وزن دارایی‌ها را طبق استراتژی بلندمدت خود حفظ کنید.", alloc = [{ name: GOLD_SYMBOL_FIXED, value: 40, fill: '#fbbf24' }, { name: finalStockSymbol, value: 40, fill: '#10b981' }, { name: FIXED_NAME, value: 20, fill: '#3b82f6' }];

      if (goldLogic.state === 'Ceiling' && stockLogic.state === 'Ceiling') {
        sid = "bubble"; scenario = "هشدار حباب بازار"; description = "هر دو دارایی اصلی در محدوده اشباع خرید و سقف قیمتی قرار دارند. برای محافظت از اصل سرمایه، پیشنهاد می‌شود ۵۰٪ پورتفو را به درآمد ثابت (نقدینگی) اختصاص دهید.";
        alloc = [{ name: GOLD_SYMBOL_FIXED, value: 25, fill: '#fbbf24' }, { name: finalStockSymbol, value: 25, fill: '#10b981' }, { name: FIXED_NAME, value: 50, fill: '#3b82f6' }];
      } else if (goldLogic.state === 'Floor' && stockLogic.state === 'Floor') {
        sid = "opportunity"; scenario = "فرصت خرید طلایی"; description = "هر دو دارایی در محدوده کف قیمتی و حباب منفی هستند. زمان مناسبی برای ورود پله‌ای سنگین به دارایی با انحراف منفی بیشتر فراهم شده است.";
        alloc = [{ name: GOLD_SYMBOL_FIXED, value: 45, fill: '#fbbf24' }, { name: finalStockSymbol, value: 45, fill: '#10b981' }, { name: FIXED_NAME, value: 10, fill: '#3b82f6' }];
      }

      setStrategy({ allocation: alloc, scenario, id: sid, description });
      setStatus(FetchStatus.SUCCESS);
    } catch (err: any) { setError(err.message); setStatus(FetchStatus.ERROR); }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-20 animate-fade-in">
       <header>
          <h2 className="text-4xl font-black text-white mb-2">مدیریت سبد دارایی هوشمند</h2>
          <p className="text-slate-400 font-medium">«بهینه‌سازی پرتفوی بر اساس حباب‌سنجی و واگرایی‌های بازار»</p>
       </header>

       <div className="flex bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/50 w-fit backdrop-blur-xl shadow-xl">
          <button onClick={() => setActiveTab('suggested')} className={`px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'suggested' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><LayoutDashboard className="w-4 h-4" /> پرتفوی پیشنهادی</button>
          <button onClick={() => setActiveTab('check')} className={`px-8 py-3 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'check' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}><SearchCode className="w-4 h-4" /> بررسی تخصصی نماد</button>
       </div>

       <div className="bg-slate-800/40 p-8 rounded-[32px] border border-slate-700/50 shadow-2xl backdrop-blur-2xl">
          {activeTab === 'suggested' ? (
            <div className="grid md:grid-cols-3 gap-8">
               <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">۱- انتخاب صندوق سهامی</label>
                  <select value={stockType} onChange={(e) => setStockType(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-4 text-white outline-none focus:ring-1 focus:ring-cyan-500 font-bold appearance-none">
                     <option value={STOCK_SYMBOL_FIXED}>صندوق سهامی (آگاس)</option>
                     <option value={ACCEL_SYMBOL_FIXED}>صندوق اهرمی (شتاب)</option>
                  </select>
               </div>
               <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">۲- پوشش طلا</label>
                  <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                     <span className="font-bold text-slate-300">صندوق طلا (عیار)</span>
                     <input type="checkbox" checked={useGold} onChange={(e)=>setUseGold(e.target.checked)} className="h-5 w-5 rounded bg-slate-800 border-slate-600 text-cyan-500" />
                  </div>
               </div>
               <div className="space-y-4">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">۳- امنیت نقدینگی</label>
                  <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-between">
                     <span className="font-bold text-slate-300">درآمد ثابت (سپر)</span>
                     <input type="checkbox" checked={useFixed} onChange={(e)=>setUseFixed(e.target.checked)} className="h-5 w-5 rounded bg-slate-800 border-slate-600 text-cyan-500" />
                  </div>
               </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-8">
                <SearchInput label="جستجوی نماد مورد نظر" value={symbol} onSelect={setSymbol} />
                <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-700/50 flex items-center gap-4 text-xs text-slate-400 leading-relaxed"><Info className="w-8 h-8 text-cyan-500 shrink-0" /> وضعیت نماد در مقایسه با طلا و میانگین‌های بلندمدت بررسی می‌شود تا بهترین استراتژی تخصیص ارائه گردد.</div>
            </div>
          )}
          <button onClick={runStrategy} disabled={status === FetchStatus.LOADING} className="mt-10 w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-black py-5 rounded-2xl shadow-xl transition-all border-none flex items-center justify-center gap-3 active:scale-[0.98]">
            {status === FetchStatus.LOADING ? <Loader2 className="w-6 h-6 animate-spin" /> : 'تحلیل جامع و چیدمان سبد پیشنهادی'}
          </button>
       </div>

       {status === FetchStatus.SUCCESS && strategy && marketMetrics && (
         <div className="grid lg:grid-cols-12 gap-8 animate-fade-in">
            <div className="lg:col-span-5 space-y-6">
                <MarketStateCard metrics={marketMetrics.gold} />
                <MarketStateCard metrics={marketMetrics.index} />
                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-xl">
                   <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                         <Zap className="w-4 h-4 text-cyan-500" />
                         <span className="text-xs font-bold text-slate-400">ضریب همبستگی کوتاه‌مدت</span>
                      </div>
                      <span className="text-lg font-black text-white" dir="ltr">{marketMetrics.corr2M.toFixed(2)}</span>
                   </div>
                   <div className="h-2 bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-cyan-500" style={{width: `${(marketMetrics.corr2M + 1) * 50}%`}}></div></div>
                </div>
            </div>
            <div className="lg:col-span-7 flex flex-col">
                <div className="bg-slate-800/60 rounded-[40px] border border-slate-700/50 shadow-2xl flex flex-col h-full overflow-hidden">
                    <div className="p-8 border-b border-slate-700/50 bg-slate-900/30">
                        <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest block mb-2">سناریوی پورتفو</span>
                        <h3 className="text-3xl font-black text-white">{strategy.scenario}</h3>
                    </div>
                    <div className="p-8 flex-1 flex flex-col items-center gap-10">
                        <div className="w-full h-72 relative">
                            <ResponsiveContainer>
                                <RechartsPieChart>
                                    <Pie data={strategy.allocation} cx="50%" cy="50%" innerRadius={85} outerRadius={120} paddingAngle={10} dataKey="value" stroke="none">
                                        {strategy.allocation.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', color: '#fff'}} />
                                    <Legend iconType="circle" />
                                </RechartsPieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-4">
                               <span className="text-2xl font-black text-white bg-slate-900/40 px-4 py-2 rounded-xl backdrop-blur-sm">پرتفوی</span>
                            </div>
                        </div>
                        <div className="bg-slate-900/60 p-8 rounded-[32px] border border-slate-700/50 w-full space-y-6">
                           <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                              <h5 className="font-black text-white flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> ترکیب پیشنهادی دارایی‌ها</h5>
                              <div className="flex gap-4">
                                {strategy.allocation.map((a, i) => <div key={i} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: a.fill}}></div><span className="text-[10px] font-black text-white">{a.value}%</span></div>)}
                              </div>
                           </div>
                           <p className="text-sm text-slate-400 leading-8 text-justify font-medium">{strategy.description}</p>
                        </div>
                    </div>
                </div>
            </div>
         </div>
       )}

       {status === FetchStatus.IDLE && (
         <div className="flex flex-col items-center justify-center p-32 bg-slate-800/10 rounded-[64px] border border-slate-700/30 border-dashed opacity-40">
            <Activity className="w-24 h-24 text-slate-700 mb-8 animate-pulse" />
            <p className="text-slate-500 font-black text-center max-w-sm">در انتظار دریافت داده‌ها برای تحلیل چیدمان سبد دارایی...</p>
         </div>
       )}
    </div>
  );
}
