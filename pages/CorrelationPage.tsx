
import React, { useState, useMemo } from 'react';
import { extractIdFromUrl, fetchStockHistory } from '../services/tsetmcService';
import { alignDataByDate, calculateRollingCorrelations, parseTsetmcCsv } from '../utils/mathUtils';
import { CorrelationChart } from '../components/CorrelationChart';
import { PriceChart } from '../components/PriceChart';
import { DistanceChart } from '../components/DistanceChart';
import { ChartDataPoint, FetchStatus, TsetmcDataPoint } from '../types';

type InputMode = 'url' | 'file';

const WINDOW_OPTIONS = [
  { val: 7, label: '۷ روزه', color: '#f59e0b' },   // Amber
  { val: 30, label: '۳۰ روزه', color: '#3b82f6' }, // Blue
  { val: 60, label: '۶۰ روزه', color: '#10b981' }, // Emerald
  { val: 90, label: '۹۰ روزه', color: '#8b5cf6' }, // Violet
  { val: 365, label: '۳۶۵ روزه (سالانه)', color: '#ec4899' }, // Pink
];

export function CorrelationPage() {
  const [mode, setMode] = useState<InputMode>('url');
  
  // URL Mode State
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');
  
  // File Mode State
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  // Calculation State
  const [selectedWindows, setSelectedWindows] = useState<number[]>([60]);
  const [showMa100, setShowMa100] = useState<boolean>(false);
  const [showMa200, setShowMa200] = useState<boolean>(false);
  const [cachedData, setCachedData] = useState<{d1: TsetmcDataPoint[], d2: TsetmcDataPoint[]} | null>(null);
  
  // Indicator State (Distance from MA)
  const [showDist1, setShowDist1] = useState<boolean>(false);
  const [showDist2, setShowDist2] = useState<boolean>(false);

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

    // Check if data is enough for the SMALLEST window to allow at least one plot
    const minWindow = Math.min(...wSizes);

    if (d1.length < minWindow || d2.length < minWindow) {
      throw new Error(`داده‌های تاریخی کافی برای محاسبه همبستگی (حداقل ${minWindow} روز معاملاتی) وجود ندارد.`);
    }

    const mergedData = alignDataByDate(d1, d2);
    
    if (mergedData.length < minWindow) {
      throw new Error(`تعداد روزهای معاملاتی مشترک (${mergedData.length}) کمتر از حداقل بازه انتخابی (${minWindow} روز) است.`);
    }

    // Calculate rolling correlations
    const correlationData = calculateRollingCorrelations(mergedData, wSizes);
    setChartData(correlationData);
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

    // If we have data, recalculate immediately
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

  const handleCalculateUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const id1 = extractIdFromUrl(url1);
    const id2 = extractIdFromUrl(url2);

    if (!id1 || !id2) {
      handleError('لینک‌های وارد شده معتبر نیستند. لطفا لینک‌های صحیح سایت TSETMC را وارد کنید.');
      return;
    }

    if (id1 === id2) {
      handleError('لطفا دو نماد متفاوت را انتخاب کنید.');
      return;
    }

    setStatus(FetchStatus.LOADING);
    setErrorContent(null);
    setChartData([]);
    setCachedData(null); // Reset cache on new fetch

    try {
      // Parallel fetch attempt
      const [res1, res2] = await Promise.all([
        fetchStockHistory(id1),
        fetchStockHistory(id2)
      ]);
      setSymbolNames({ s1: res1.name || 'نماد اول', s2: res2.name || 'نماد دوم' });
      processData(res1.data, res2.data);
    } catch (err: any) {
      handleError(err.message || 'خطای ناشناخته رخ داده است.');
    }
  };

  const validateFile = (file: File): string | null => {
    // Check Extension
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.txt')) {
      return `فایل ${file.name} معتبر نیست. لطفا فایل CSV یا TXT آپلود کنید.`;
    }
    // Check Size (2MB Limit)
    const maxSize = 2 * 1024 * 1024; // 2MB in bytes
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
    setCachedData(null); // Reset cache

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

  const handleFillExample = () => {
    setUrl1('https://old.tsetmc.com/Loader.aspx?ParTree=151311&i=59142194115401696');
    setUrl2('https://old.tsetmc.com/Loader.aspx?ParTree=151311&i=47041908051542008');
  };

  const activeWindowConfigs = useMemo(() => {
    return WINDOW_OPTIONS.filter(opt => selectedWindows.includes(opt.val));
  }, [selectedWindows]);

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
              onClick={() => { setMode('url'); setErrorContent(null); }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                mode === 'url' 
                  ? 'bg-cyan-500 text-white shadow-lg' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              دریافت خودکار (لینک)
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
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={showDist1} onChange={(e) => setShowDist1(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-cyan-500"/>
                          <span className={`text-sm ${showDist1 ? 'text-cyan-400' : 'text-slate-500'}`}>نماد اول</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={showDist2} onChange={(e) => setShowDist2(e.target.checked)} className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-purple-500"/>
                          <span className={`text-sm ${showDist2 ? 'text-purple-400' : 'text-slate-500'}`}>نماد دوم</span>
                      </label>
                    </div>
                </div>
              </div>
          </div>

          {mode === 'url' ? (
            <form onSubmit={handleCalculateUrl} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="url1" className="block text-sm font-medium text-slate-400">لینک نماد اول</label>
                  <input id="url1" type="text" value={url1} onChange={(e) => setUrl1(e.target.value)} placeholder="https://old.tsetmc.com/..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none text-sm ltr-text text-left" dir="ltr" required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="url2" className="block text-sm font-medium text-slate-400">لینک نماد دوم</label>
                  <input id="url2" type="text" value={url2} onChange={(e) => setUrl2(e.target.value)} placeholder="https://old.tsetmc.com/..." className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 outline-none text-sm ltr-text text-left" dir="ltr" required />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <button type="submit" disabled={status === FetchStatus.LOADING || selectedWindows.length === 0} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all hover:scale-[1.02] shadow-lg disabled:opacity-50">
                  {status === FetchStatus.LOADING ? 'در حال پردازش...' : 'محاسبه همبستگی'}
                </button>
                <button type="button" onClick={handleFillExample} className="px-6 py-3 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium">
                  نمونه تستی
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCalculateFile} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400 mb-2">فایل نماد اول (CSV/TXT - حداکثر ۲ مگابایت)</label>
                    <input type="file" accept=".csv,.txt" onChange={(e) => setFile1(e.target.files ? e.target.files[0] : null)} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-cyan-400 hover:file:bg-slate-600"/>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400 mb-2">فایل نماد دوم (CSV/TXT - حداکثر ۲ مگابایت)</label>
                    <input type="file" accept=".csv,.txt" onChange={(e) => setFile2(e.target.files ? e.target.files[0] : null)} className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-cyan-400 hover:file:bg-slate-600"/>
                  </div>
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
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50">
                   <h3 className="font-bold text-slate-200">نمودار ترکیبی</h3>
                   
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

                <div className="p-4 space-y-2">
                   {/* 1. Price Chart */}
                   <div className="h-[350px]">
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
                   <div className="h-[180px] border-t border-slate-700/50 pt-2 relative">
                      <div className="absolute top-2 left-2 text-[10px] bg-slate-900/80 px-2 py-1 rounded text-slate-400 z-10 pointer-events-none">ضریب همبستگی</div>
                      <CorrelationChart 
                          data={chartData} 
                          syncId="unified-view"
                          activeWindows={activeWindowConfigs}
                      />
                   </div>

                   {/* 3. Distance Chart (Conditional) */}
                   {(showDist1 || showDist2) && (
                     <div className="h-[180px] border-t border-slate-700/50 pt-2 relative">
                        <div className="absolute top-2 left-2 text-[10px] bg-slate-900/80 px-2 py-1 rounded text-slate-400 z-10 pointer-events-none">فاصله از میانگین (٪)</div>
                        <DistanceChart
                           data={chartData}
                           syncId="unified-view"
                           showSymbol1={showDist1}
                           showSymbol2={showDist2}
                           name1={symbolNames.s1}
                           name2={symbolNames.s2}
                        />
                     </div>
                   )}
                </div>
            </div>
          </div>
        )}
    </div>
  );
}
