
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { generateRatioAnalysisData } from '../utils/mathUtils';
import { CorrelationChart } from '../components/CorrelationChart';
import { PriceChart } from '../components/PriceChart';
import { DistanceChart } from '../components/DistanceChart';
import { ChartDataPoint, FetchStatus, TsetmcDataPoint, SearchResult } from '../types';
import { FileText, X, Search, Loader2 } from 'lucide-react';
import { SeoHelmet } from '../components/SeoHelmet';

const WINDOW_OPTIONS = [
  { val: 30, label: '۳۰ روزه', color: '#3b82f6' },
  { val: 60, label: '۶۰ روزه', color: '#10b981' },
  { val: 90, label: '۹۰ روزه', color: '#8b5cf6' },
];

const SearchInput = ({ 
  label, 
  value, 
  onSelect 
}: { 
  label: string; 
  value: SearchResult | null; 
  onSelect: (val: SearchResult | null) => void;
}) => {
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
        <div className="flex items-center justify-between p-3 bg-slate-900 border border-emerald-500/50 rounded-lg text-emerald-400">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <FileText className="w-4 h-4" />
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
          placeholder="جستجو (مثلا: اهرم)..." 
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-10 py-3 focus:ring-2 focus:ring-amber-500 outline-none text-sm text-right" 
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> : <Search className="w-5 h-5" />}
        </div>

        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
             {results.map((item, idx) => (
               <button 
                key={idx}
                type="button"
                onClick={() => { onSelect(item); setIsOpen(false); }}
                className="w-full text-right px-4 py-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 flex flex-col items-start gap-1 group transition-colors"
               >
                 <span className="font-bold text-white text-sm group-hover:text-amber-400">{item.symbol}</span>
                 <span className="text-[10px] text-slate-400 truncate w-full">{item.name}</span>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ChartBackgroundLabel = ({ text }: { text: string }) => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
       <h3 className="text-[12vw] sm:text-6xl md:text-8xl font-black text-slate-800/30 select-none whitespace-nowrap">{text}</h3>
    </div>
  );

// --- Page Component ---

export function RatioPage() {
  const [symbol1, setSymbol1] = useState<SearchResult | null>(null);
  const [symbol2, setSymbol2] = useState<SearchResult | null>(null);

  // Settings
  const [showRatioChart, setShowRatioChart] = useState(true);
  const [showPriceChart, setShowPriceChart] = useState(true);
  const [priceDisplaySide, setPriceDisplaySide] = useState<'price1' | 'price2'>('price1');

  const [showCorrelation, setShowCorrelation] = useState(false);
  const [selectedWindows, setSelectedWindows] = useState<number[]>([30, 60, 90]);
  const [showDistance, setShowDistance] = useState(false);
  
  // Indicators State - Split for Price and Ratio
  const [showPriceMa100, setShowPriceMa100] = useState(false);
  const [showPriceMa200, setShowPriceMa200] = useState(false);
  const [showRatioMa100, setShowRatioMa100] = useState(false);
  const [showRatioMa200, setShowRatioMa200] = useState(false);

  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [names, setNames] = useState<{s1: string, s2: string}>({ s1: 'صورت', s2: 'مخرج' });

  // Automatically show Distance Chart if Indicators are selected
  useEffect(() => {
    if (showPriceMa100 || showPriceMa200 || showRatioMa100 || showRatioMa200) {
        setShowDistance(true);
    } else {
        setShowDistance(false);
    }
  }, [showPriceMa100, showPriceMa200, showRatioMa100, showRatioMa200]);

  // Calculate all windows regardless of selection so toggling is fast
  const processData = (d1: TsetmcDataPoint[], d2: TsetmcDataPoint[]) => {
      try {
          const allWindows = WINDOW_OPTIONS.map(w => w.val);
          const data = generateRatioAnalysisData(d1, d2, allWindows);
          if (data.length < 10) throw new Error('داده‌های مشترک کافی برای محاسبه وجود ندارد.');
          setChartData(data);
          setStatus(FetchStatus.SUCCESS);
      } catch (err: any) {
          setError(err.message);
          setStatus(FetchStatus.ERROR);
      }
  };

  const handleDbSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!symbol1 || !symbol2) { setError('لطفا هر دو نماد را انتخاب کنید'); return; }
      if (symbol1.symbol === symbol2.symbol) { setError('نمادها باید متفاوت باشند'); return; }

      setStatus(FetchStatus.LOADING);
      setError(null);
      setChartData([]);

      try {
          const [res1, res2] = await Promise.all([
              fetchStockHistory(symbol1.symbol),
              fetchStockHistory(symbol2.symbol)
          ]);
          setNames({ s1: symbol1.symbol, s2: symbol2.symbol });
          processData(res1.data, res2.data);
      } catch (err: any) {
          setStatus(FetchStatus.ERROR);
          setError(err.message);
      }
  };

  const handleWindowChange = (val: number, checked: boolean) => {
      if (checked) {
          setSelectedWindows(prev => [...prev, val].sort((a,b) => a - b));
      } else {
          setSelectedWindows(prev => prev.filter(w => w !== val));
      }
  };

  const activeWindowConfigs = useMemo(() => {
    return WINDOW_OPTIONS.filter(opt => selectedWindows.includes(opt.val));
  }, [selectedWindows]);

  // Determine which chart gets the Brush (time navigation)
  // Priority: Distance -> Correlation -> Ratio -> Price
  const showDistBrush = showDistance;
  const showCorrBrush = showCorrelation && !showDistance;
  const showRatioBrush = showRatioChart && !showCorrelation && !showDistance;
  const showPriceBrush = showPriceChart && !showRatioChart && !showCorrelation && !showDistance;

  // X Axis Logic
  const showRatioAxis = !showDistance && !showCorrelation;
  const showPriceAxis = !showDistance && !showCorrelation && !showRatioChart;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
        <SeoHelmet />
        <header className="mb-8 space-y-6">
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 inline-block mb-2">
            تحلیل تکنیکال
            </h2>
            <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm shadow-xl transition-all duration-300">
                <p className="text-slate-300 leading-8 text-justify font-medium">
                نمودار تقسیم قیمت نماد اول بر نماد دوم (Ratio Chart) ابزاری قدرتمند برای شناسایی دارایی‌های جامانده یا حباب‌دار است. در این بخش می‌توانید ضریب همبستگی تاریخی بین دو نماد را بررسی کنید. همبستگی مثبت (نزدیک به ۱) یعنی دو نماد هم‌جهت حرکت می‌کنند و همبستگی منفی (نزدیک به ۱-) یعنی خلاف جهت یکدیگرند. با استفاده از ابزارهای تکنیکال روی این نسبت، می‌توانید نقاط ورود و خروج بهینه بین دو دارایی را پیدا کنید.
                </p>
            </div>
        </header>

        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
            {/* Settings */}
            <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 grid md:grid-cols-3 gap-6">
                 {/* Main Charts */}
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">نمودارهای اصلی</label>
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showPriceChart} onChange={(e) => setShowPriceChart(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-emerald-500"/>
                            <span className={`text-sm ${showPriceChart ? 'text-emerald-400' : 'text-slate-500'}`}>نمودار قیمت نمادها</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showRatioChart} onChange={(e) => setShowRatioChart(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-amber-500"/>
                            <span className={`text-sm ${showRatioChart ? 'text-amber-400' : 'text-slate-500'}`}>نمودار نسبت (Ratio)</span>
                        </label>
                    </div>
                 </div>

                 {/* Indicators */}
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">اندیکاتورها</label>
                    <div className="flex flex-col gap-3">
                        {/* Row 1: Price Indicators */}
                        <div className="flex flex-col gap-1">
                             <span className="text-[10px] text-emerald-500 font-bold border-b border-slate-700 pb-1 mb-1 w-fit">نمودار قیمت</span>
                             <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={showPriceMa100} onChange={(e) => setShowPriceMa100(e.target.checked)} className="h-3 w-3 rounded bg-slate-800 border-slate-600 text-purple-600"/>
                                    <span className={`text-xs ${showPriceMa100 ? 'text-purple-400' : 'text-slate-500'}`}>MA100</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={showPriceMa200} onChange={(e) => setShowPriceMa200(e.target.checked)} className="h-3 w-3 rounded bg-slate-800 border-slate-600 text-orange-600"/>
                                    <span className={`text-xs ${showPriceMa200 ? 'text-orange-400' : 'text-slate-500'}`}>MA200</span>
                                </label>
                             </div>
                        </div>

                        {/* Row 2: Ratio Indicators */}
                        <div className="flex flex-col gap-1">
                             <span className="text-[10px] text-amber-500 font-bold border-b border-slate-700 pb-1 mb-1 w-fit">نمودار نسبت</span>
                             <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={showRatioMa100} onChange={(e) => setShowRatioMa100(e.target.checked)} className="h-3 w-3 rounded bg-slate-800 border-slate-600 text-purple-600"/>
                                    <span className={`text-xs ${showRatioMa100 ? 'text-purple-400' : 'text-slate-500'}`}>MA100</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={showRatioMa200} onChange={(e) => setShowRatioMa200(e.target.checked)} className="h-3 w-3 rounded bg-slate-800 border-slate-600 text-orange-600"/>
                                    <span className={`text-xs ${showRatioMa200 ? 'text-orange-400' : 'text-slate-500'}`}>MA200</span>
                                </label>
                             </div>
                        </div>
                    </div>
                 </div>

                 {/* Helpers */}
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">نمودارهای کمکی</label>
                    <div className="space-y-3">
                        <div className="flex gap-4 flex-wrap">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showCorrelation} onChange={(e) => setShowCorrelation(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-cyan-500"/>
                                <span className={`text-sm ${showCorrelation ? 'text-cyan-400' : 'text-slate-500'}`}>همبستگی</span>
                            </label>
                        </div>

                        <div className={`transition-all duration-300 overflow-hidden ${showCorrelation ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-2 bg-slate-800 rounded border border-slate-700 flex flex-col gap-1">
                                <span className="text-[10px] text-slate-400">بازه‌های همبستگی:</span>
                                <div className="flex gap-2">
                                    {WINDOW_OPTIONS.map(opt => (
                                        <label key={opt.val} className="flex items-center gap-1 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedWindows.includes(opt.val)} 
                                                onChange={(e) => handleWindowChange(opt.val, e.target.checked)} 
                                                className="h-3 w-3 rounded bg-slate-700 border-slate-500 text-cyan-500"
                                            />
                                            <span className={`text-[10px] ${selectedWindows.includes(opt.val) ? 'text-slate-200' : 'text-slate-500'}`}>{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
            </div>

            <form onSubmit={handleDbSubmit} className="grid md:grid-cols-2 gap-6">
                <SearchInput label="صورت کسر (نماد اول)" value={symbol1} onSelect={setSymbol1} />
                <SearchInput label="مخرج کسر (نماد دوم)" value={symbol2} onSelect={setSymbol2} />
                <button type="submit" disabled={status === FetchStatus.LOADING} className="md:col-span-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all border-none">
                    {status === FetchStatus.LOADING ? 'در حال محاسبه...' : 'ترسیم نمودار'}
                </button>
            </form>
        </div>

        {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center gap-3">
                <span className="font-bold">خطا:</span> {error}
            </div>
        )}

        {status === FetchStatus.SUCCESS && chartData.length > 0 && (
            <div className="space-y-8 animate-fade-in">
                 
                 {/* UNIFIED CHART CONTAINER */}
                 <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
                     <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                         <h3 className="font-bold text-slate-200">تحلیل نموداری <span className="text-amber-500 text-sm mx-2">({names.s1} / {names.s2})</span></h3>
                         
                         {/* Toolbar for Price Switching */}
                         {showPriceChart && (
                             <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                                <button onClick={() => setPriceDisplaySide('price1')} className={`px-3 py-1 text-sm rounded ${priceDisplaySide === 'price1' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}>
                                    {names.s1}
                                </button>
                                <div className="w-px h-4 bg-slate-700"></div>
                                <button onClick={() => setPriceDisplaySide('price2')} className={`px-3 py-1 text-sm rounded ${priceDisplaySide === 'price2' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}>
                                    {names.s2}
                                </button>
                                </div>
                            </div>
                         )}
                     </div>
                     
                     <div className="p-4 pl-2 pb-10 space-y-8">
                        
                        {/* 1. Price Chart (Individual Symbol) */}
                        {showPriceChart && (
                            <div className="h-[350px] relative transition-all duration-300 ease-in-out">
                                <div className="relative bg-slate-800 w-full h-full">
                                    <ChartBackgroundLabel text="قیمت نماد" />
                                    <div className="relative z-10 w-full h-full">
                                        <PriceChart 
                                            data={chartData} 
                                            dataKey={priceDisplaySide} 
                                            syncId="ratio-view"
                                            color="#10b981" // Emerald
                                            showMa100={showPriceMa100}
                                            showMa200={showPriceMa200}
                                            label={priceDisplaySide === 'price1' ? names.s1 : names.s2}
                                            showBrush={showPriceBrush}
                                            showXAxis={showPriceAxis}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. Main Ratio Chart */}
                        {showRatioChart && (
                            <div className={`${showPriceChart ? 'border-t border-slate-700/50 pt-6' : ''} h-[400px] relative transition-all duration-300`}>
                                <div className="relative bg-slate-800 w-full h-full">
                                    <ChartBackgroundLabel text="نمودار نسبت" />
                                    <div className="relative z-10 w-full h-full">
                                        <PriceChart 
                                            data={chartData}
                                            dataKey="ratio"
                                            color="#fbbf24" // Amber/Gold for Ratio
                                            showMa100={showRatioMa100}
                                            showMa200={showRatioMa200}
                                            label="نسبت"
                                            syncId="ratio-view"
                                            showBrush={showRatioBrush}
                                            showXAxis={showRatioAxis}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. Optional Correlation Chart */}
                        {showCorrelation && (
                            <div className="border-t border-slate-700/50 pt-6 relative flex flex-col h-[200px]">
                                <div className="relative bg-slate-800 w-full h-full">
                                    <ChartBackgroundLabel text="همبستگی" />
                                    <div className="relative z-10 w-full h-full">
                                        <CorrelationChart 
                                            data={chartData} 
                                            syncId="ratio-view" 
                                            activeWindows={activeWindowConfigs} 
                                            showXAxis={!showDistance}
                                            showBrush={showCorrBrush}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 4. Optional Distance Chart */}
                        {showDistance && (
                            <div className="border-t border-slate-700/50 pt-6 relative flex flex-col h-[200px]">
                                <div className="relative bg-slate-800 w-full h-full">
                                    <ChartBackgroundLabel text="فاصله از میانگین" />
                                    <div className="relative z-10 w-full h-full">
                                        <DistanceChart 
                                            data={chartData.map(d => ({ 
                                                ...d, 
                                                // Dynamic mapping based on which charts are visible
                                                // If Price Chart is ON, dist_ma100_1 maps to the visible Price Symbol's distance
                                                dist_ma100_1: (showPriceChart && showPriceMa100) 
                                                    ? (priceDisplaySide === 'price1' ? d.dist_ma100_1 : d.dist_ma100_2) 
                                                    : null,
                                                // If Ratio Chart is ON, dist_ma100_2 maps to Ratio's distance
                                                dist_ma100_2: (showRatioChart && showRatioMa100) ? d.dist_ma100_ratio : null
                                            }))}
                                            syncId="ratio-view"
                                            showSymbol1={showPriceChart && showPriceMa100}
                                            showSymbol2={showRatioChart && showRatioMa100}
                                            name1={priceDisplaySide === 'price1' ? names.s1 : names.s2}
                                            name2="نسبت"
                                            showBrush={showDistBrush}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                     </div>
                 </div>
            </div>
        )}
    </div>
  );
}
