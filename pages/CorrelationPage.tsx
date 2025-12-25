
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { alignDataByDate, generateAnalysisData, parseTsetmcCsv, jalaliToGregorian, getTodayShamsi } from '../utils/mathUtils';
import { CorrelationChart } from '../components/CorrelationChart';
import { PriceChart } from '../components/PriceChart';
import { DistanceChart } from '../components/DistanceChart';
import { ChartDataPoint, FetchStatus, TsetmcDataPoint, SearchResult } from '../types';
import { Upload, FileText, X, Search, Loader2, Calendar as CalendarIcon } from 'lucide-react';

type InputMode = 'database' | 'file';

const WINDOW_OPTIONS = [
  { val: 7, label: '۷ روزه', color: '#f59e0b' },
  { val: 30, label: '۳۰ روزه', color: '#3b82f6' },
  { val: 60, label: '۶۰ روزه', color: '#10b981' },
  { val: 90, label: '۹۰ روزه', color: '#8b5cf6' },
];

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
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-400">{label}</label>
        <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-600 rounded-lg text-emerald-400">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center"><FileText className="w-4 h-4" /></div>
             <div>
               <span className="block font-bold text-sm">{value.symbol}</span>
               <span className="block text-xs opacity-70">{value.name}</span>
             </div>
           </div>
           <button onClick={() => { onSelect(null); setQuery(''); }} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2" ref={wrapperRef}>
      <label className="block text-sm font-medium text-slate-400">{label}</label>
      <div className="relative">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نماد..." className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-10 py-3 focus:ring-2 focus:ring-cyan-500 outline-none text-sm text-right" />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-cyan-500" /> : <Search className="w-5 h-5" />}
        </div>
        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
             {results.map((item, idx) => (
               <button key={idx} type="button" onClick={() => { onSelect(item); setIsOpen(false); }} className="w-full text-right px-4 py-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 flex justify-between items-center group transition-colors">
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

export function CorrelationPage() {
  const [mode, setMode] = useState<InputMode>('database');
  const [selectedSymbol1, setSelectedSymbol1] = useState<SearchResult | null>(null);
  const [selectedSymbol2, setSelectedSymbol2] = useState<SearchResult | null>(null);
  
  // Date States (Shamsi)
  const today = getTodayShamsi();
  const [startDate, setStartDate] = useState({ jy: today.jy - 1, jm: today.jm, jd: today.jd });
  const [endDate, setEndDate] = useState(today);

  const [selectedWindows, setSelectedWindows] = useState<number[]>([30, 60]);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [symbolNames, setSymbolNames] = useState({ s1: '', s2: '' });
  const [cachedRaw, setCachedRaw] = useState<{ d1: TsetmcDataPoint[], d2: TsetmcDataPoint[] } | null>(null);

  const filterDataByDate = (data: TsetmcDataPoint[], startJ: any, endJ: any) => {
    const startG = jalaliToGregorian(startJ.jy, startJ.jm, startJ.jd);
    const endG = jalaliToGregorian(endJ.jy, endJ.jm, endJ.jd);
    
    const startVal = `${startG.gy}${String(startG.gm).padStart(2, '0')}${String(startG.gd).padStart(2, '0')}`;
    const endVal = `${endG.gy}${String(endG.gm).padStart(2, '0')}${String(endG.gd).padStart(2, '0')}`;
    
    return data.filter(d => d.date >= startVal && d.date <= endVal);
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSymbol1 || !selectedSymbol2) { setError('لطفا دو نماد را انتخاب کنید.'); return; }
    
    setStatus(FetchStatus.LOADING);
    setError(null);

    try {
      const [res1, res2] = await Promise.all([
        fetchStockHistory(selectedSymbol1.symbol),
        fetchStockHistory(selectedSymbol2.symbol)
      ]);

      const filtered1 = filterDataByDate(res1.data, startDate, endDate);
      const filtered2 = filterDataByDate(res2.data, startDate, endDate);

      if (filtered1.length === 0 || filtered2.length === 0) {
        throw new Error('داده‌ای برای بازه زمانی انتخابی یافت نشد. لطفا تاریخ یا سال را بررسی کنید.');
      }

      setSymbolNames({ s1: selectedSymbol1.symbol, s2: selectedSymbol2.symbol });
      const analysis = generateAnalysisData(filtered1, filtered2, selectedWindows);
      setChartData(analysis);
      setStatus(FetchStatus.SUCCESS);
    } catch (err: any) {
      setError(err.message);
      setStatus(FetchStatus.ERROR);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in">
        <header className="mb-6">
            <h2 className="text-3xl font-bold text-white mb-2">محاسبه همبستگی</h2>
            <p className="text-slate-400 text-sm">بررسی ضریب همبستگی در بازه‌های زمانی دلخواه</p>
        </header>

        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                 <SearchInput label="نماد اول" value={selectedSymbol1} onSelect={setSelectedSymbol1} />
                 <SearchInput label="نماد دوم" value={selectedSymbol2} onSelect={setSelectedSymbol2} />
            </div>

            {/* Date Range Selectors */}
            <div className="grid md:grid-cols-2 gap-6 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
                        <CalendarIcon className="w-4 h-4" /> تاریخ شروع (شمسی)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <input type="number" value={startDate.jy} onChange={e => setStartDate({...startDate, jy: parseInt(e.target.value)})} className="bg-slate-800 border border-slate-700 rounded p-2 text-center text-sm" placeholder="سال" />
                        <input type="number" value={startDate.jm} onChange={e => setStartDate({...startDate, jm: parseInt(e.target.value)})} className="bg-slate-800 border border-slate-700 rounded p-2 text-center text-sm" placeholder="ماه" />
                        <input type="number" value={startDate.jd} onChange={e => setStartDate({...startDate, jd: parseInt(e.target.value)})} className="bg-slate-800 border border-slate-700 rounded p-2 text-center text-sm" placeholder="روز" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-400">
                        <CalendarIcon className="w-4 h-4" /> تاریخ پایان (شمسی)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        <input type="number" value={endDate.jy} onChange={e => setEndDate({...endDate, jy: parseInt(e.target.value)})} className="bg-slate-800 border border-slate-700 rounded p-2 text-center text-sm" placeholder="سال" />
                        <input type="number" value={endDate.jm} onChange={e => setEndDate({...endDate, jm: parseInt(e.target.value)})} className="bg-slate-800 border border-slate-700 rounded p-2 text-center text-sm" placeholder="ماه" />
                        <input type="number" value={endDate.jd} onChange={e => setEndDate({...endDate, jd: parseInt(e.target.value)})} className="bg-slate-800 border border-slate-700 rounded p-2 text-center text-sm" placeholder="روز" />
                    </div>
                </div>
            </div>

            <button onClick={handleCalculate} disabled={status === FetchStatus.LOADING} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50">
                {status === FetchStatus.LOADING ? <Loader2 className="animate-spin mx-auto" /> : 'محاسبه همبستگی'}
            </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-center gap-3">
             <span className="font-bold">خطا:</span> {error}
          </div>
        )}

        {status === FetchStatus.SUCCESS && chartData.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <CorrelationChart data={chartData} activeWindows={WINDOW_OPTIONS.filter(w => selectedWindows.includes(w.val))} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 h-[300px]">
                    <PriceChart data={chartData} dataKey="price1" label={symbolNames.s1} color="#10b981" />
                </div>
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 h-[300px]">
                    <PriceChart data={chartData} dataKey="price2" label={symbolNames.s2} color="#3b82f6" />
                </div>
            </div>
          </div>
        )}
    </div>
  );
}
