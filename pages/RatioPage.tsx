
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { generateRatioAnalysisData, parseTsetmcCsv } from '../utils/mathUtils';
import { CorrelationChart } from '../components/CorrelationChart';
import { PriceChart } from '../components/PriceChart';
import { DistanceChart } from '../components/DistanceChart';
import { ChartDataPoint, FetchStatus, TsetmcDataPoint, SearchResult } from '../types';
import { Upload, FileText, X, Search, Loader2 } from 'lucide-react';
import { SeoHelmet } from '../components/SeoHelmet';

type InputMode = 'database' | 'file';

const WINDOW_OPTIONS = [
  { val: 30, label: '۳۰ روزه', color: '#3b82f6' },
  { val: 60, label: '۶۰ روزه', color: '#10b981' },
  { val: 90, label: '۹۰ روزه', color: '#8b5cf6' },
];

// --- Duplicated Input Components to be safe and independent ---

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

const FileDropzone = ({ 
    label, 
    file, 
    onFileSelect 
  }: { 
    label: string; 
    file: File | null; 
    onFileSelect: (f: File | null) => void;
  }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
  
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
  
    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };
  
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileSelect(e.dataTransfer.files[0]);
      }
    };
  
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-400">{label}</label>
        
        <div 
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative group cursor-pointer
            border-2 border-dashed rounded-xl p-8
            flex flex-col items-center justify-center text-center
            transition-all duration-300 min-h-[160px]
            ${isDragging 
                ? 'border-amber-500 bg-amber-500/10 scale-[1.02]' 
                : file 
                  ? 'border-emerald-500/50 bg-emerald-500/5' 
                  : 'border-slate-600 bg-slate-900/50 hover:border-amber-400 hover:bg-slate-800'
            }
          `}
        >
          <input 
            ref={inputRef}
            type="file" 
            accept=".csv,.txt" 
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                 onFileSelect(e.target.files[0]);
              }
            }}
          />
  
          {file ? (
            <div className="flex flex-col items-center w-full">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                 <FileText className="w-6 h-6" />
              </div>
              <p className="text-emerald-200 font-medium text-sm truncate max-w-full px-4 mb-1" dir="ltr">
                {file.name}
              </p>
              <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onFileSelect(null);
                    if (inputRef.current) inputRef.current.value = '';
                }}
                className="mt-2 px-3 py-1 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded text-xs transition-colors"
              >
                حذف
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-slate-400 group-hover:text-amber-400 transition-colors">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 bg-slate-800 group-hover:bg-amber-500/10">
                 <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm">آپلود فایل</p>
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
  const [mode, setMode] = useState<InputMode>('database');
  
  const [symbol1, setSymbol1] = useState<SearchResult | null>(null);
  const [symbol2, setSymbol2] = useState<SearchResult | null>(null);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  // Settings
  const [showCorrelation, setShowCorrelation] = useState(false);
  const [selectedWindows, setSelectedWindows] = useState<number[]>([30, 60, 90]);
  const [showDistance, setShowDistance] = useState(false);
  const [showMa100, setShowMa100] = useState(false);
  const [showMa200, setShowMa200] = useState(false);

  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [names, setNames] = useState<{s1: string, s2: string}>({ s1: 'صورت', s2: 'مخرج' });

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

  const handleFileSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!file1 || !file2) { setError('لطفا هر دو فایل را انتخاب کنید'); return; }

      setStatus(FetchStatus.LOADING);
      setError(null);

      try {
        const read = (f: File) => new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = (e) => resolve(e.target?.result as string);
            r.readAsText(f);
        });

        const [t1, t2] = await Promise.all([read(file1), read(file2)]);
        const r1 = parseTsetmcCsv(t1);
        const r2 = parseTsetmcCsv(t2);

        setNames({ s1: r1.name || 'فایل ۱', s2: r2.name || 'فایل ۲' });
        processData(r1.data, r2.data);

      } catch (err: any) {
          setStatus(FetchStatus.ERROR);
          setError('خطا در پردازش فایل‌ها');
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
  const showDistBrush = showDistance;
  const showCorrBrush = showCorrelation && !showDistance;
  const showPriceBrush = !showCorrelation && !showDistance;

  // X Axis Logic for Correlation
  const showCorrAxis = !showDistance; 

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
        <SeoHelmet />
        <header className="mb-8 space-y-6">
            <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 inline-block mb-2">
            تحلیل نسبت (Ratio)
            </h2>
            <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 backdrop-blur-sm shadow-xl transition-all duration-300">
                <p className="text-slate-300 leading-8 text-justify font-medium">
                نمودار تقسیم قیمت نماد اول بر نماد دوم (Ratio Chart) ابزاری قدرتمند برای شناسایی دارایی‌های جامانده یا حباب‌دار است. با استفاده از ابزارهای تکنیکال روی این نسبت، می‌توانید نقاط ورود و خروج بهینه بین دو دارایی را پیدا کنید.
                </p>
            </div>
        </header>

        {/* Mode Toggle */}
        <div className="flex justify-start mb-6">
          <div className="bg-slate-800 p-1 rounded-xl flex shadow-lg border border-slate-700">
            <button onClick={() => setMode('database')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'database' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400'}`}>جستجو</button>
            <button onClick={() => setMode('file')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'file' ? 'bg-amber-500 text-white shadow-lg' : 'text-slate-400'}`}>آپلود</button>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
            {/* Settings */}
            <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 grid md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">اندیکاتورهای نسبت (Ratio)</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showMa100} onChange={(e) => setShowMa100(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-purple-600"/>
                            <span className={`text-sm ${showMa100 ? 'text-purple-400' : 'text-slate-500'}`}>MA100</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showMa200} onChange={(e) => setShowMa200(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-orange-600"/>
                            <span className={`text-sm ${showMa200 ? 'text-orange-400' : 'text-slate-500'}`}>MA200</span>
                        </label>
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">نمودارهای کمکی</label>
                    <div className="space-y-3">
                        {/* helper charts checkboxes */}
                        <div className="flex gap-4 flex-wrap">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showCorrelation} onChange={(e) => setShowCorrelation(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-cyan-500"/>
                                <span className={`text-sm ${showCorrelation ? 'text-cyan-400' : 'text-slate-500'}`}>همبستگی نمادها</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showDistance} onChange={(e) => setShowDistance(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-cyan-500"/>
                                <span className={`text-sm ${showDistance ? 'text-cyan-400' : 'text-slate-500'}`}>فاصله از میانگین</span>
                            </label>
                        </div>

                        {/* Conditional Window Selection for Correlation */}
                        <div className={`transition-all duration-300 overflow-hidden ${showCorrelation ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-3 bg-slate-800 rounded border border-slate-700 flex flex-col gap-2">
                                <span className="text-[10px] text-slate-400">بازه‌های همبستگی:</span>
                                <div className="flex gap-4">
                                    {WINDOW_OPTIONS.map(opt => (
                                        <label key={opt.val} className="flex items-center gap-1.5 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedWindows.includes(opt.val)} 
                                                onChange={(e) => handleWindowChange(opt.val, e.target.checked)} 
                                                className="h-3.5 w-3.5 rounded bg-slate-700 border-slate-500 text-cyan-500"
                                            />
                                            <span className={`text-xs ${selectedWindows.includes(opt.val) ? 'text-slate-200' : 'text-slate-500'}`}>{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                 </div>
            </div>

            {mode === 'database' ? (
                <form onSubmit={handleDbSubmit} className="grid md:grid-cols-2 gap-6">
                    <SearchInput label="صورت کسر (نماد اول)" value={symbol1} onSelect={setSymbol1} />
                    <SearchInput label="مخرج کسر (نماد دوم)" value={symbol2} onSelect={setSymbol2} />
                    <button type="submit" disabled={status === FetchStatus.LOADING} className="md:col-span-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all border-none">
                        {status === FetchStatus.LOADING ? 'در حال محاسبه...' : 'ترسیم نمودار نسبت'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleFileSubmit} className="grid md:grid-cols-2 gap-6">
                    <FileDropzone label="فایل صورت کسر" file={file1} onFileSelect={setFile1} />
                    <FileDropzone label="فایل مخرج کسر" file={file2} onFileSelect={setFile2} />
                    <button type="submit" disabled={status === FetchStatus.LOADING} className="md:col-span-2 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold py-3 rounded-lg shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all border-none">محاسبه</button>
                </form>
            )}
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
                     <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                         <h3 className="font-bold text-slate-200">نمودار نسبت <span className="text-amber-500 text-sm mx-2">({names.s1} / {names.s2})</span></h3>
                     </div>
                     
                     <div className="p-4 pl-2 pb-10 space-y-8">
                        {/* Main Ratio Chart */}
                        <div className="h-[400px]">
                            <PriceChart 
                                data={chartData}
                                dataKey="ratio"
                                color="#fbbf24" // Amber/Gold for Ratio
                                showMa100={showMa100}
                                showMa200={showMa200}
                                label="نسبت"
                                syncId="ratio-view"
                                showBrush={showPriceBrush}
                                showXAxis={showPriceBrush}
                            />
                        </div>

                        {/* Optional Correlation Chart */}
                        {showCorrelation && (
                            <div className="border-t border-slate-700/50 pt-6 relative flex flex-col h-[200px]">
                                <div className="relative bg-slate-800 w-full h-full">
                                    <ChartBackgroundLabel text="همبستگی" />
                                    <div className="relative z-10 w-full h-full">
                                        <CorrelationChart 
                                            data={chartData} 
                                            syncId="ratio-view" 
                                            activeWindows={activeWindowConfigs} 
                                            showXAxis={showCorrAxis}
                                            showBrush={showCorrBrush}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Optional Distance Chart */}
                        {showDistance && (
                            <div className="border-t border-slate-700/50 pt-6 relative flex flex-col h-[200px]">
                                <div className="relative bg-slate-800 w-full h-full">
                                    <ChartBackgroundLabel text="فاصله از میانگین" />
                                    <div className="relative z-10 w-full h-full">
                                        <DistanceChart 
                                            data={chartData.map(d => ({ ...d, dist_ma100_1: d.dist_ma100_ratio }))}
                                            syncId="ratio-view"
                                            showSymbol1={true}
                                            showSymbol2={false}
                                            name1="نسبت"
                                            name2=""
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
