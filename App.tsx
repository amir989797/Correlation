import React, { useState, useRef, useMemo } from 'react';
import { extractIdFromUrl, fetchStockHistory, getDownloadLink } from './services/tsetmcService';
import { alignDataByDate, calculateRollingCorrelations, parseTsetmcCsv } from './utils/mathUtils';
import { CorrelationChart } from './components/CorrelationChart';
import { PriceChart } from './components/PriceChart';
import { ChartDataPoint, FetchStatus, TsetmcDataPoint } from './types';

type InputMode = 'url' | 'file';

const WINDOW_OPTIONS = [
  { val: 7, label: '۷ روزه', color: '#f59e0b' },   // Amber
  { val: 30, label: '۳۰ روزه', color: '#3b82f6' }, // Blue
  { val: 60, label: '۶۰ روزه', color: '#10b981' }, // Emerald
  { val: 90, label: '۹۰ روزه', color: '#8b5cf6' }, // Violet
  { val: 365, label: '۳۶۵ روزه (سالانه)', color: '#ec4899' }, // Pink
];

export function App() {
  const [mode, setMode] = useState<InputMode>('url');
  
  // URL Mode State
  const [url1, setUrl1] = useState('');
  const [url2, setUrl2] = useState('');
  
  // File Mode State
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  // Auto-Download Helper State
  const [showAutoDownloadHelper, setShowAutoDownloadHelper] = useState(false);
  const [helperIds, setHelperIds] = useState<{id1: string, id2: string} | null>(null);

  // Calculation State
  // Default to 60 days selected
  const [selectedWindows, setSelectedWindows] = useState<number[]>([60]);
  const [showMa100, setShowMa100] = useState<boolean>(false);
  const [showMa200, setShowMa200] = useState<boolean>(false);
  const [cachedData, setCachedData] = useState<{d1: TsetmcDataPoint[], d2: TsetmcDataPoint[]} | null>(null);
  
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
      setShowAutoDownloadHelper(false); // Hide helper on success
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
        // If calculation succeeds, ensure status is SUCCESS
        if (newWindows.length > 0) {
            setStatus(FetchStatus.SUCCESS);
        }
      } catch (err: any) {
        handleError(err.message);
      }
    }
  };

  const handleFetchFailure = (id1: string, id2: string) => {
    console.log('Switching to Manual Download Mode due to fetch failure');
    setStatus(FetchStatus.IDLE); 
    setHelperIds({ id1, id2 });
    setShowAutoDownloadHelper(true);
    setMode('file'); 
    setErrorContent(null);
    
    // Attempt to use the browser to download the files immediately
    try {
        const link1 = getDownloadLink(id1);
        const link2 = getDownloadLink(id2);
        
        window.open(link1, '_blank');
        
        setTimeout(() => {
           window.open(link2, '_blank');
        }, 1500);
        
    } catch (e) {
        console.warn("Auto-popup blocked", e);
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
    setShowAutoDownloadHelper(false);
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
      if (err.message === 'FALLBACK_TO_BROWSER' || err.message.includes('HTTP')) {
        handleFetchFailure(id1, id2);
      } else {
        handleError(err.message || 'خطای ناشناخته رخ داده است.');
      }
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
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

  const triggerDownload = (id: string) => {
    window.open(getDownloadLink(id), '_blank');
  };

  // Memoize the active window configurations to prevent re-renders of the CorrelationChart
  // which contains the Brush (zoom state). This ensures that toggling the Price Chart side
  // or other unrelated state changes do not reset the zoom.
  const activeWindowConfigs = useMemo(() => {
    return WINDOW_OPTIONS.filter(opt => selectedWindows.includes(opt.val));
  }, [selectedWindows]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 flex flex-col items-center">
      
      <header className="mb-8 text-center max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-4">
          محاسبه همبستگی نمادها
        </h1>
        <p className="text-slate-400 text-lg leading-relaxed">
          نمودار همبستگی (Correlation) تاریخی دو نماد بورس را مشاهده کنید.
        </p>
      </header>

      <div className="w-full max-w-4xl space-y-8">
        
        {/* Input Method Toggle */}
        {!showAutoDownloadHelper && (
          <div className="flex justify-center mb-6">
            <div className="bg-slate-800 p-1 rounded-xl flex shadow-lg border border-slate-700">
              <button
                onClick={() => { setMode('url'); setErrorContent(null); setShowAutoDownloadHelper(false); }}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'url' 
                    ? 'bg-cyan-500 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                دریافت خودکار (لینک)
              </button>
              <button
                onClick={() => { setMode('file'); setErrorContent(null); setShowAutoDownloadHelper(false); }}
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
        )}

        {/* HELPER UI */}
        {showAutoDownloadHelper && helperIds ? (
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl border border-cyan-500/30 animate-fade-in relative overflow-hidden">
             
             <div className="relative z-10">
               <div className="flex items-center gap-3 mb-6 bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
                 <div className="bg-yellow-500/20 p-2 rounded-full flex-shrink-0">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-white">شروع دانلود خودکار...</h3>
                    <p className="text-slate-400 text-sm">مرورگر شما در حال دانلود فایل‌هاست. لطفا آن‌ها را در کادر زیر بارگذاری کنید.</p>
                 </div>
               </div>

               <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-4 opacity-75">
                     <h4 className="font-bold text-cyan-400 border-b border-cyan-500/20 pb-2 flex items-center gap-2">
                       <span className="bg-cyan-500/20 text-cyan-400 w-6 h-6 rounded-full flex items-center justify-center text-sm">۱</span>
                       دانلود مجدد (در صورت نیاز)
                     </h4>
                     <p className="text-xs text-slate-400">اگر دانلود خودکار انجام نشد، دکمه‌های زیر را بزنید:</p>
                     <div className="flex flex-col gap-3">
                        <button onClick={() => triggerDownload(helperIds.id1)} className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg flex items-center justify-between group transition-all border border-slate-600 hover:border-cyan-500/50">
                           <span className="text-sm">دانلود فایل نماد اول</span>
                           <span className="text-cyan-400 group-hover:translate-y-1 transition-transform">⬇</span>
                        </button>
                        <button onClick={() => triggerDownload(helperIds.id2)} className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-lg flex items-center justify-between group transition-all border border-slate-600 hover:border-cyan-500/50">
                           <span className="text-sm">دانلود فایل نماد دوم</span>
                           <span className="text-cyan-400 group-hover:translate-y-1 transition-transform">⬇</span>
                        </button>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <h4 className="font-bold text-green-400 border-b border-green-500/20 pb-2 flex items-center gap-2">
                       <span className="bg-green-500/20 text-green-400 w-6 h-6 rounded-full flex items-center justify-center text-sm">۲</span>
                       آپلود فایل‌ها
                     </h4>
                     <p className="text-xs text-slate-400">فایل‌های دانلود شده را در اینجا انتخاب کنید:</p>
                     <div className="space-y-3">
                        <input
                          type="file"
                          accept=".csv,.txt"
                          onChange={(e) => setFile1(e.target.files ? e.target.files[0] : null)}
                          className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-500/10 file:text-green-400 hover:file:bg-green-500/20 cursor-pointer border border-dashed border-slate-600 rounded-lg p-2"
                        />
                        <input
                          type="file"
                          accept=".csv,.txt"
                          onChange={(e) => setFile2(e.target.files ? e.target.files[0] : null)}
                          className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-500/10 file:text-green-400 hover:file:bg-green-500/20 cursor-pointer border border-dashed border-slate-600 rounded-lg p-2"
                        />
                     </div>
                  </div>
               </div>
               
               <div className="flex gap-4">
                 <button
                    onClick={(e) => handleCalculateFile(e)}
                    disabled={!file1 || !file2}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:grayscale shadow-lg shadow-cyan-500/20"
                  >
                    محاسبه همبستگی
                  </button>
                  <button
                    onClick={() => { setShowAutoDownloadHelper(false); setMode('url'); }}
                    className="px-6 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    بازگشت
                  </button>
               </div>
             </div>
          </div>
        ) : (
          /* Normal Form Logic */
          <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
            {/* Common Settings Area - Checkboxes */}
            <div className="mb-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
               
               {/* Correlation Windows */}
               <div className="mb-4 border-b border-slate-700 pb-4">
                 <label className="block text-sm font-medium text-slate-400 mb-3">
                   بازه‌های زمانی محاسبه همبستگی (Rolling Window)
                 </label>
                 <div className="flex flex-wrap gap-4">
                   {WINDOW_OPTIONS.map((opt) => (
                     <label key={opt.val} className="flex items-center gap-2 cursor-pointer group">
                       <div className="relative flex items-center">
                         <input 
                           type="checkbox" 
                           checked={selectedWindows.includes(opt.val)}
                           onChange={(e) => handleWindowChange(opt.val, e.target.checked)}
                           className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-600 bg-slate-800 transition-all checked:bg-slate-700 hover:border-slate-500"
                         />
                         <span style={{ backgroundColor: opt.color }} className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-sm transition-transform peer-checked:scale-100"></span>
                       </div>
                       <span className={`text-sm select-none transition-colors ${selectedWindows.includes(opt.val) ? 'text-white' : 'text-slate-500 group-hover:text-slate-400'}`}>
                         {opt.label}
                       </span>
                     </label>
                   ))}
                 </div>
                 {selectedWindows.length === 0 && (
                     <p className="text-xs text-red-400 mt-2">لطفا حداقل یک بازه زمانی را انتخاب کنید.</p>
                 )}
               </div>

               {/* Indicators (MAs) */}
               <div>
                  <label className="block text-sm font-medium text-slate-400 mb-3">
                    ابزارهای تکنیکال
                  </label>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 cursor-pointer group w-fit">
                       <div className="relative flex items-center">
                         <input 
                           type="checkbox" 
                           checked={showMa100}
                           onChange={(e) => setShowMa100(e.target.checked)}
                           className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-600 bg-slate-800 transition-all checked:bg-purple-600 hover:border-purple-500"
                         />
                         <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-sm bg-white transition-transform peer-checked:scale-100"></span>
                       </div>
                       <span className={`text-sm select-none transition-colors ${showMa100 ? 'text-purple-400 font-bold' : 'text-slate-500 group-hover:text-slate-400'}`}>
                         میانگین متحرک ۱۰۰ روزه (MA100)
                       </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group w-fit">
                       <div className="relative flex items-center">
                         <input 
                           type="checkbox" 
                           checked={showMa200}
                           onChange={(e) => setShowMa200(e.target.checked)}
                           className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-600 bg-slate-800 transition-all checked:bg-orange-600 hover:border-orange-500"
                         />
                         <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-sm bg-white transition-transform peer-checked:scale-100"></span>
                       </div>
                       <span className={`text-sm select-none transition-colors ${showMa200 ? 'text-orange-400 font-bold' : 'text-slate-500 group-hover:text-slate-400'}`}>
                         میانگین متحرک ۲۰۰ روزه (MA200)
                       </span>
                    </label>
                  </div>
               </div>
            </div>

            {mode === 'url' ? (
              <form onSubmit={handleCalculateUrl} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="url1" className="block text-sm font-medium text-slate-400">لینک نماد اول</label>
                    <input
                      id="url1"
                      type="text"
                      value={url1}
                      onChange={(e) => setUrl1(e.target.value)}
                      placeholder="https://old.tsetmc.com/..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all text-sm ltr-text text-left"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="url2" className="block text-sm font-medium text-slate-400">لینک نماد دوم</label>
                    <input
                      id="url2"
                      type="text"
                      value={url2}
                      onChange={(e) => setUrl2(e.target.value)}
                      placeholder="https://old.tsetmc.com/..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all text-sm ltr-text text-left"
                      dir="ltr"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={status === FetchStatus.LOADING || selectedWindows.length === 0}
                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                  >
                    {status === FetchStatus.LOADING ? 'در حال پردازش...' : 'محاسبه همبستگی'}
                  </button>
                  <button
                    type="button"
                    onClick={handleFillExample}
                    className="px-6 py-3 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-medium"
                  >
                    نمونه تستی
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCalculateFile} className="space-y-6">
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-sm text-blue-200 mb-4">
                  فایل‌های اکسل/CSV سابقه را از سایت TSETMC دریافت کرده و در اینجا بارگذاری کنید.
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1">فایل سابقه نماد اول</label>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => setFile1(e.target.files ? e.target.files[0] : null)}
                      className="block w-full text-sm text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-slate-700 file:text-cyan-400
                        hover:file:bg-slate-600 cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1">فایل سابقه نماد دوم</label>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={(e) => setFile2(e.target.files ? e.target.files[0] : null)}
                      className="block w-full text-sm text-slate-400
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-lg file:border-0
                        file:text-sm file:font-semibold
                        file:bg-slate-700 file:text-cyan-400
                        hover:file:bg-slate-600 cursor-pointer"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={status === FetchStatus.LOADING || selectedWindows.length === 0}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                >
                  محاسبه همبستگی از روی فایل
                </button>
              </form>
            )}
          </div>
        )}

        {/* Error Message */}
        {errorContent && !showAutoDownloadHelper && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center gap-3 animate-fade-in">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
             </svg>
             <div>{errorContent}</div>
          </div>
        )}

        {/* Results Section - Unified Chart View */}
        {status === FetchStatus.SUCCESS && chartData.length > 0 && (
          <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <span className="block text-slate-400 text-sm mb-1">تعداد نقاط مشترک</span>
                <span className="text-2xl font-bold text-white">{chartData.length} روز</span>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <span className="block text-slate-400 text-sm mb-1">وضعیت محاسبه</span>
                <span className="text-base text-white">
                  {selectedWindows.length > 0 ? `${selectedWindows.length} بازه زمانی فعال` : 'هیچ بازه‌ای انتخاب نشده'}
                </span>
              </div>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <span className="block text-slate-400 text-sm mb-1">بازه زمانی</span>
                <span className="text-lg font-bold text-white flex justify-center items-center gap-2">
                  <span>{chartData[0].date}</span>
                  <span>تا</span>
                  <span>{chartData[chartData.length - 1].date}</span>
                </span>
              </div>
            </div>

            {/* UNIFIED CHART CONTAINER */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
                {/* Header Toolbar */}
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-slate-700 bg-slate-800/50">
                   <div className="flex items-center gap-4 mb-2 sm:mb-0">
                      <h3 className="font-bold text-slate-200">نمودار تحلیل تکنیکال و همبستگی</h3>
                      <div className="flex gap-2">
                        {activeWindowConfigs.map(w => (
                          <span key={w.val} style={{ backgroundColor: w.color }} className="px-2 py-0.5 rounded text-xs text-white bg-opacity-80">
                            {w.val}D
                          </span>
                        ))}
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                     <button
                        onClick={() => setPriceDisplaySide('price1')}
                        className={`px-3 py-1 text-sm rounded transition-all ${priceDisplaySide === 'price1' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'}`}
                     >
                       {symbolNames.s1}
                     </button>
                     <div className="w-px h-4 bg-slate-700"></div>
                     <button
                        onClick={() => setPriceDisplaySide('price2')}
                        className={`px-3 py-1 text-sm rounded transition-all ${priceDisplaySide === 'price2' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'}`}
                     >
                       {symbolNames.s2}
                     </button>
                   </div>
                </div>

                {/* Charts Area */}
                <div className="p-4 space-y-2">
                   {/* Top Chart: Price */}
                   <div className="h-[400px]">
                      <PriceChart 
                          data={chartData} 
                          dataKey={priceDisplaySide} 
                          syncId="unified-view"
                          color="#10b981"
                          showMa100={showMa100}
                          showMa200={showMa200}
                      />
                   </div>

                   {/* Bottom Chart: Correlation Indicator */}
                   <div className="h-[200px] border-t border-slate-700/50 pt-2">
                      <CorrelationChart 
                          data={chartData} 
                          syncId="unified-view"
                          activeWindows={activeWindowConfigs}
                      />
                   </div>
                </div>
            </div>
            
            <p className="text-center text-slate-500 text-sm mt-4">
               * برای زوم کردن، روی نمودار پایین (همبستگی) درگ کنید. نمودار بالا به طور خودکار همگام می‌شود.
            </p>
          </div>
        )}

        {status === FetchStatus.SUCCESS && chartData.length === 0 && (
           <div className="text-center text-slate-400 mt-8">
             داده‌ای برای نمایش یافت نشد.
           </div>
        )}
      </div>
    </div>
  );
}