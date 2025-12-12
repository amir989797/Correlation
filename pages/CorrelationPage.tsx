
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { alignDataByDate, generateAnalysisData, parseTsetmcCsv } from '../utils/mathUtils';
import { CorrelationChart } from '../components/CorrelationChart';
import { PriceChart } from '../components/PriceChart';
import { DistanceChart } from '../components/DistanceChart';
import { ChartDataPoint, FetchStatus, TsetmcDataPoint, SearchResult } from '../types';
import { Upload, FileText, X, Search, Loader2 } from 'lucide-react';

type InputMode = 'database' | 'file';

const WINDOW_OPTIONS = [
  { val: 7, label: '۷ روزه', color: '#f59e0b' },   // Amber
  { val: 30, label: '۳۰ روزه', color: '#3b82f6' }, // Blue
  { val: 60, label: '۶۰ روزه', color: '#10b981' }, // Emerald
  { val: 90, label: '۹۰ روزه', color: '#8b5cf6' }, // Violet
  { val: 365, label: '۳۶۵ روزه (سالانه)', color: '#ec4899' }, // Pink
];

// --- Sub-components ---

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

  // Debounce search
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

  // Click outside to close
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
          placeholder="جستجوی نماد (مثلا: فولاد)..." 
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

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-400">{label}</label>
      
      <div 
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative group cursor-pointer
          border-2 border-dashed rounded-xl p-8
          flex flex-col items-center justify-center text-center
          transition-all duration-300 min-h-[160px]
          ${isDragging 
              ? 'border-cyan-500 bg-cyan-500/10 scale-[1.02]' 
              : file 
                ? 'border-emerald-500/50 bg-emerald-500/5' 
                : 'border-slate-600 bg-slate-900/50 hover:border-cyan-400 hover:bg-slate-800'
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
          <div className="flex flex-col items-center animate-fade-in w-full">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
               <FileText className="w-6 h-6" />
            </div>
            <p className="text-emerald-200 font-medium text-sm truncate max-w-full px-4 mb-1" dir="ltr">
              {file.name}
            </p>
            <p className="text-slate-500 text-xs mb-4">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button 
              onClick={handleRemove}
              className="px-4 py-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg text-xs flex items-center gap-2 transition-colors border border-slate-700 hover:border-red-500/30 z-10"
            >
              <X className="w-3.5 h-3.5" />
              حذف فایل
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-slate-400 group-hover:text-cyan-400 transition-colors">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all ${isDragging ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-500 group-hover:bg-cyan-500/10 group-hover:text-cyan-400'}`}>
               <Upload className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm mb-2">
              برای آپلود کلیک کنید یا فایل را اینجا رها کنید
            </p>
            <p className="text-xs text-slate-500">
              فرمت مجاز: CSV یا TXT (حداکثر ۲ مگابایت)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Component for background titles
const ChartBackgroundLabel = ({ text }: { text: string }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
     <h3 className="text-[12vw] sm:text-6xl md:text-8xl font-black text-slate-800/30 select-none whitespace-nowrap">{text}</h3>
  </div>
);


export function CorrelationPage() {
  const [mode, setMode] = useState<InputMode>('database');
  
  // Database Mode State
  const [selectedSymbol1, setSelectedSymbol1] = useState<SearchResult | null>(null);
  const [selectedSymbol2, setSelectedSymbol2] = useState<SearchResult | null>(null);
  
  // File Mode State
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  // Calculation State
  const [selectedWindows, setSelectedWindows] = useState<number[]>([60]);
  const [showMa100, setShowMa100] = useState<boolean>(false);
  const [showMa200, setShowMa200] = useState<boolean>(false);
  const [cachedData, setCachedData] = useState<{d1: TsetmcDataPoint[], d2: TsetmcDataPoint[]} | null>(null);
  
  // Indicator State (Distance from MA)
  const [showDistActive, setShowDistActive] = useState<boolean>(false);
  const [showDistBoth, setShowDistBoth] = useState<boolean>(false);

  // Symbol Names
  const [symbolNames, setSymbolNames] = useState<{s1: string, s2: string}>({ s1: 'نماد اول', s2: 'نماد دوم' });

  // Price Chart Selection State
  const [priceDisplaySide, setPriceDisplaySide] = useState<'price1' | 'price2'>('price1');

  const [errorContent, setErrorContent] = useState<React.ReactNode | null>(null);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const handleError = (message: string) => {
    console.error(message);
    setStatus(FetchStatus.ERROR);
    setErrorContent(<p>{message}</p>);
  };

  const performCalculation = (d1: TsetmcDataPoint[], d2: TsetmcDataPoint[], wSizes: number[]) => {
    if (wSizes.length === 0) {
      setChartData([]); // No windows selected, show empty
      return;
    }

    const minWindow = Math.min(...wSizes);

    if (d1.length < minWindow || d2.length < minWindow) {
      throw new Error(`داده‌های تاریخی کافی برای محاسبه همبستگی (حداقل ${minWindow} روز معاملاتی) وجود ندارد.`);
    }

    const mergedData = alignDataByDate(d1, d2);
    
    if (mergedData.length < minWindow) {
      throw new Error(`تعداد روزهای معاملاتی مشترک (${mergedData.length}) کمتر از حداقل بازه انتخابی (${minWindow} روز) است.`);
    }

    const analysisData = generateAnalysisData(d1, d2, wSizes);
    setChartData(analysisData);
  };

  const processData = (data1: TsetmcDataPoint[], data2: TsetmcDataPoint[]) => {
    setCachedData({ d1: data1, d2: data2 });
    try {
      performCalculation(data1, data2, selectedWindows);
      setStatus(FetchStatus.SUCCESS);
    } catch (err: any) {
      handleError(err.message);
    }
  };

  const handleWindowChange = (val: number, checked: boolean) => {
    let newWindows: number[];
    if (checked) {
      newWindows = [...selectedWindows, val].sort((a, b) => a - b);
    } else {
      newWindows = selectedWindows.filter(w => w !== val);
    }
    
    setSelectedWindows(newWindows);

    if (cachedData) {
      try {
        setErrorContent(null);
        performCalculation(cachedData.d1, cachedData.d2, newWindows);
        if (newWindows.length > 0) {
            setStatus(FetchStatus.SUCCESS);
        }
      } catch (err: any) {
        handleError(err.message);
      }
    }
  };

  const handleCalculateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSymbol1 || !selectedSymbol2) {
      handleError('لطفا هر دو نماد را انتخاب کنید.');
      return;
    }

    if (selectedSymbol1.symbol === selectedSymbol2.symbol) {
      handleError('لطفا دو نماد متفاوت را انتخاب کنید.');
      return;
    }

    setStatus(FetchStatus.LOADING);
    setErrorContent(null);
    setChartData([]);
    setCachedData(null); 

    try {
      const [res1, res2] = await Promise.all([
        fetchStockHistory(selectedSymbol1.symbol),
        fetchStockHistory(selectedSymbol2.symbol)
      ]);
      setSymbolNames({ s1: selectedSymbol1.symbol, s2: selectedSymbol2.symbol });
      processData(res1.data, res2.data);
    } catch (err: any) {
      handleError(err.message || 'خطای ناشناخته در ارتباط با سرور.');
    }
  };

  const validateFile = (file: File): string | null => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.txt')) {
      return `فایل ${file.name} معتبر نیست. لطفا فایل CSV یا TXT آپلود کنید.`;
    }
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return `حجم فایل ${file.name} بیشتر از ۲ مگابایت است.`;
    }
    return null;
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const error = validateFile(file);
      if (error) {
        reject(new Error(error));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('خطا در خواندن فایل'));
      reader.readAsText(file);
    });
  };

  const handleCalculateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file1 || !file2) {
      handleError('لطفا هر دو فایل را انتخاب کنید.');
      return;
    }

    setStatus(FetchStatus.LOADING);
    setErrorContent(null);
    setChartData([]);
    setCachedData(null); 

    try {
      const [text1, text2] = await Promise.all([
        readFileAsText(file1),
        readFileAsText(file2)
      ]);

      const res1 = parseTsetmcCsv(text1);
      const res2 = parseTsetmcCsv(text2);
      
      setSymbolNames({ s1: res1.name || 'نماد اول', s2: res2.name || 'نماد دوم' });

      if (res1.data.length === 0 || res2.data.length === 0) {
        throw new Error('فرمت فایل‌ها صحیح نیست یا داده‌ای یافت نشد.');
      }

      processData(res1.data, res2.data);
    } catch (err: any) {
      handleError(err.message || 'خطا در پردازش فایل‌ها.');
    }
  };

  const activeWindowConfigs = useMemo(() => {
    return WINDOW_OPTIONS.filter(opt => selectedWindows.includes(opt.val));
  }, [selectedWindows]);

  // Determine Distance Chart visibility and content
  const isDistanceVisible = showDistActive || showDistBoth;
  const showDistS1 = showDistBoth || (showDistActive && priceDisplaySide === 'price1');
  const showDistS2 = showDistBoth || (showDistActive && priceDisplaySide === 'price2');

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
        <header className="mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">محاسبه همبستگی نمادها</h2>
            <p className="text-slate-400">تحلیل همبستگی تاریخی و ابزارهای تکنیکال مقایسه‌ای</p>
        </header>
        
        {/* Input Method Toggle */}
        <div className="flex justify-start mb-6">
          <div className="bg-slate-800 p-1 rounded-xl flex shadow-lg border border-slate-700">
            <button
              onClick={() => { setMode('database'); setErrorContent(null); }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'database' 
                  ? 'bg-cyan-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              جستجو از دیتابیس
            </button>
            <button
              onClick={() => { setMode('file'); setErrorContent(null); }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'file' 
                  ? 'bg-cyan-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              آپلود فایل (دستی)
            </button>
          </div>
        </div>

        {/* Normal Form Logic */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
          {/* Common Settings Area */}
          <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 space-y-4">
              
              {/* Correlation Windows */}
              <div className="border-b border-slate-700 pb-4">
                <label className="block text-sm font-medium text-slate-400 mb-3">
                  بازه‌های زمانی همبستگی
                </label>
                <div className="flex flex-wrap gap-4">
                  {WINDOW_OPTIONS.map((opt) => (
                    <label key={opt.val} className="flex items-center gap-2 cursor-pointer group">
                      <input 
                          type="checkbox" 
                          checked={selectedWindows.includes(opt.val)}
                          onChange={(e) => handleWindowChange(opt.val, e.target.checked)}
                          className="peer h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-offset-slate-900"
                      />
                      <span className={`text-sm transition-colors ${selectedWindows.includes(opt.val) ? 'text-white' : 'text-slate-500'}`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Technical Indicators */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-3">
                      اندیکاتورهای قیمت (MA)
                    </label>
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
                    <label className="block text-sm font-medium text-slate-400 mb-3">
                      فاصله از میانگین (MA100)
                    </label>
                    <div className="flex flex-wrap gap-4">
                        {/* Option 1: Active Symbol */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={showDistActive} 
                            onChange={(e) => {
                                setShowDistActive(e.target.checked);
                                if (e.target.checked) setShowDistBoth(false);
                            }} 
                            className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-cyan-500"
                          />
                          <span className={`text-sm ${showDistActive ? 'text-cyan-400' : 'text-slate-500'}`}>
                            نماد فعال
                          </span>
                        </label>

                        {/* Option 2: Both Symbols */}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={showDistBoth} 
                            onChange={(e) => {
                                setShowDistBoth(e.target.checked);
                                if (e.target.checked) setShowDistActive(false);
                            }} 
                            className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-purple-500"
                          />
                          <span className={`text-sm ${showDistBoth ? 'text-purple-400' : 'text-slate-500'}`}>
                            هر دو نماد
                          </span>
                        </label>
                    </div>
                </div>
              </div>
          </div>

          {mode === 'database' ? (
            <form onSubmit={handleCalculateDatabase} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                 <SearchInput 
                    label="جستجوی نماد اول" 
                    value={selectedSymbol1} 
                    onSelect={setSelectedSymbol1} 
                 />
                 <SearchInput 
                    label="جستجوی نماد دوم" 
                    value={selectedSymbol2} 
                    onSelect={setSelectedSymbol2} 
                 />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button type="submit" disabled={status === FetchStatus.LOADING || selectedWindows.length === 0} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all hover:scale-[1.02] shadow-lg disabled:opacity-50">
                  {status === FetchStatus.LOADING ? 'در حال دریافت اطلاعات...' : 'محاسبه همبستگی'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCalculateFile} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <FileDropzone 
                    label="فایل نماد اول" 
                    file={file1} 
                    onFileSelect={setFile1} 
                  />
                  <FileDropzone 
                    label="فایل نماد دوم" 
                    file={file2} 
                    onFileSelect={setFile2} 
                  />
                </div>
                <button type="submit" disabled={status === FetchStatus.LOADING} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg shadow-lg">محاسبه</button>
            </form>
          )}
        </div>

        {/* Error Message */}
        {errorContent && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
             <div className="font-bold">خطا:</div>
             <div>{errorContent}</div>
          </div>
        )}

        {/* Results Section */}
        {status === FetchStatus.SUCCESS && chartData.length > 0 && (
          <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <span className="block text-slate-400 text-sm mb-1">نقاط مشترک</span>
                <span className="text-2xl font-bold text-white">{chartData.length} روز</span>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <span className="block text-slate-400 text-sm mb-1">نمادها</span>
                <span className="text-sm font-bold text-white">{symbolNames.s1} <span className="text-slate-500 mx-1">vs</span> {symbolNames.s2}</span>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <span className="block text-slate-400 text-sm mb-1">آخرین تاریخ</span>
                <span className="text-lg font-bold text-white">{chartData[chartData.length - 1].date}</span>
              </div>
            </div>

            {/* UNIFIED CHART CONTAINER */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl m-8">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50">
                   <h3 className="font-bold text-slate-200">نمودار ترکیبی</h3>
                   
                   <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                       <button onClick={() => setPriceDisplaySide('price1')} className={`px-3 py-1 text-sm rounded ${priceDisplaySide === 'price1' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400'}`}>
                         {symbolNames.s1}
                       </button>
                       <div className="w-px h-4 bg-slate-700"></div>
                       <button onClick={() => setPriceDisplaySide('price2')} className={`px-3 py-1 text-sm rounded ${priceDisplaySide === 'price2' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400'}`}>
                         {symbolNames.s2}
                       </button>
                     </div>
                   </div>
                </div>

                {/* Chart Area with Padding Left (8px) for Axis Labels */}
                <div className="p-4 pl-2 space-y-2">
                   {/* 1. Price Chart */}
                   <div className="h-[350px] relative transition-all duration-300 ease-in-out">
                      <PriceChart 
                          data={chartData} 
                          dataKey={priceDisplaySide} 
                          syncId="unified-view"
                          color="#10b981"
                          showMa100={showMa100}
                          showMa200={showMa200}
                      />
                   </div>

                   {/* 2. Correlation Chart */}
                   <div className="border-t border-slate-700/50 pt-2 relative flex flex-col h-[200px]">
                      <div className="relative bg-slate-800 w-full h-full">
                        <ChartBackgroundLabel text="ضریب همبستگی" />
                        <div className="relative z-10 w-full h-full">
                            <CorrelationChart 
                                data={chartData} 
                                syncId="unified-view"
                                activeWindows={activeWindowConfigs}
                                showBrush={!isDistanceVisible}
                                showXAxis={!isDistanceVisible}
                            />
                        </div>
                      </div>
                   </div>

                   {/* 3. Distance Chart (Conditional) */}
                   {isDistanceVisible && (
                     <div className="border-t border-slate-700/50 pt-2 relative flex flex-col h-[200px]">
                        <div className="relative bg-slate-800 w-full h-full">
                            <ChartBackgroundLabel text="فاصله از میانگین" />
                            <div className="relative z-10 w-full h-full">
                            <DistanceChart
                                data={chartData}
                                syncId="unified-view"
                                showSymbol1={showDistS1}
                                showSymbol2={showDistS2}
                                name1={symbolNames.s1}
                                name2={symbolNames.s2}
                                showBrush={true}
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
