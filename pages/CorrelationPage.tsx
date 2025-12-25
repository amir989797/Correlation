
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { alignDataByDate, generateAnalysisData, parseTsetmcCsv } from '../utils/mathUtils';
import { CorrelationChart } from '../components/CorrelationChart';
import { PriceChart } from '../components/PriceChart';
import { DistanceChart } from '../components/DistanceChart';
import { ChartDataPoint, FetchStatus, TsetmcDataPoint, SearchResult } from '../types';
import { Upload, FileText, X, Search, Loader2, Link2, BarChart3, ArrowLeftRight } from 'lucide-react';

type InputMode = 'database' | 'file' | 'link';

const WINDOW_OPTIONS = [
  { val: 7, label: '۷ روزه (کوتاه مدت)', color: '#f59e0b' },   
  { val: 30, label: '۳۰ روزه (میان مدت)', color: '#3b82f6' }, 
  { val: 60, label: '۶۰ روزه (فصلی)', color: '#10b981' }, 
  { val: 90, label: '۹۰ روزه', color: '#8b5cf6' }, 
  { val: 365, label: '۱ ساله (روند بلندمدت)', color: '#ec4899' }, 
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
        <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-emerald-500/30 rounded-xl text-emerald-400">
           <div className="flex items-center gap-3">
             <FileText className="w-5 h-5 opacity-60" />
             <span className="font-black text-sm">{value.symbol}</span>
           </div>
           <button onClick={() => { onSelect(null); setQuery(''); }} className="p-1 hover:bg-red-500/10 rounded text-slate-500 hover:text-red-400 transition-all">
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
          placeholder="نام یا نماد..." 
          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-4 pr-11 py-3 focus:ring-1 focus:ring-cyan-500 outline-none text-sm text-right" 
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
        </div>
        {isOpen && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar">
             {results.map((item, idx) => (
               <button key={idx} type="button" onClick={() => { onSelect(item); setIsOpen(false); }} className="w-full text-right px-4 py-3 hover:bg-slate-700 border-b border-slate-700 last:border-0 flex justify-between items-center group transition-colors">
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

const FileDropzone = ({ label, file, onFileSelect }: { label: string; file: File | null; onFileSelect: (f: File | null) => void; }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-400">{label}</label>
      <div 
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/30 hover:border-cyan-500/50'}`}
      >
        <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { if (e.target.files && e.target.files[0]) onFileSelect(e.target.files[0]); }} />
        {file ? (
          <div className="flex flex-col items-center">
            <FileText className="w-6 h-6 text-emerald-500 mb-2" />
            <p className="text-emerald-200 font-bold text-xs truncate max-w-[150px]" dir="ltr">{file.name}</p>
          </div>
        ) : (
          <div className="text-slate-500 flex flex-col items-center">
            <Upload className="w-6 h-6 mb-2" />
            <span className="text-xs font-bold">انتخاب فایل CSV</span>
          </div>
        )}
      </div>
    </div>
  );
};

const LinkInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-2">
    <label className="block text-sm font-medium text-slate-400">{label}</label>
    <div className="relative">
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://tsetmc.com/loader.aspx?i=..." 
        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-4 pr-11 py-3 focus:ring-1 focus:ring-cyan-500 outline-none text-xs text-left font-mono" 
        dir="ltr"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
        <Link2 className="w-5 h-5" />
      </div>
    </div>
  </div>
);

export function CorrelationPage() {
  const [mode, setMode] = useState<InputMode>('database');
  const [selectedSymbol1, setSelectedSymbol1] = useState<SearchResult | null>(null);
  const [selectedSymbol2, setSelectedSymbol2] = useState<SearchResult | null>(null);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [link1, setLink1] = useState('');
  const [link2, setLink2] = useState('');
  const [selectedWindows, setSelectedWindows] = useState<number[]>([60]);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [symbolNames, setSymbolNames] = useState({ s1: 'نماد اول', s2: 'نماد دوم' });
  const [priceDisplaySide, setPriceDisplaySide] = useState<'price1' | 'price2'>('price1');

  const extractIdFromLink = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get('i');
    } catch { return null; }
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(FetchStatus.LOADING);
    try {
      let d1: TsetmcDataPoint[] = [], d2: TsetmcDataPoint[] = [];
      let name1 = '', name2 = '';

      if (mode === 'database') {
        if (!selectedSymbol1 || !selectedSymbol2) throw new Error('لطفا هر دو نماد را انتخاب کنید.');
        const [res1, res2] = await Promise.all([fetchStockHistory(selectedSymbol1.symbol), fetchStockHistory(selectedSymbol2.symbol)]);
        d1 = res1.data; d2 = res2.data; name1 = selectedSymbol1.symbol; name2 = selectedSymbol2.symbol;
      } else if (mode === 'link') {
        const id1 = extractIdFromLink(link1), id2 = extractIdFromLink(link2);
        if (!id1 || !id2) throw new Error('لینک‌های وارد شده معتبر نیستند. لطفا لینک کامل صفحه نماد را وارد کنید.');
        const [res1, res2] = await Promise.all([fetchStockHistory(id1), fetchStockHistory(id2)]);
        d1 = res1.data; d2 = res2.data; name1 = id1; name2 = id2;
      } else {
        if (!file1 || !file2) throw new Error('لطفا هر دو فایل را انتخاب کنید.');
        const read = (f: File) => new Promise<string>(r => { const fr = new FileReader(); fr.onload = (ev) => r(ev.target?.result as string); fr.readAsText(f); });
        const [t1, t2] = await Promise.all([read(file1), read(file2)]);
        const p1 = parseTsetmcCsv(t1), p2 = parseTsetmcCsv(t2);
        d1 = p1.data; d2 = p2.data; name1 = p1.name; name2 = p2.name;
      }

      setSymbolNames({ s1: name1, s2: name2 });
      const analysisData = generateAnalysisData(d1, d2, selectedWindows);
      if (analysisData.length === 0) throw new Error('بازه زمانی مشترکی یافت نشد.');
      setChartData(analysisData);
      setStatus(FetchStatus.SUCCESS);
    } catch (err: any) { setError(err.message); setStatus(FetchStatus.ERROR); }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
            <div>
              <h2 className="text-3xl font-black text-white mb-2">تحلیل هوشمند همبستگی</h2>
              <p className="text-slate-400 text-sm">«لینک دو نماد را از TSETMC وارد کنید تا ضریب همبستگی تاریخی بین آن‌ها را مشاهده کنید»</p>
            </div>
            <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700">
              <button onClick={() => setMode('database')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'database' ? 'bg-cyan-500 text-white' : 'text-slate-500'}`}>جستجو</button>
              <button onClick={() => setMode('link')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'link' ? 'bg-cyan-500 text-white' : 'text-slate-500'}`}>لینک</button>
              <button onClick={() => setMode('file')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'file' ? 'bg-cyan-500 text-white' : 'text-slate-500'}`}>فایل</button>
            </div>
        </header>

        <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700 shadow-xl">
           <div className="grid md:grid-cols-2 gap-6 mb-8">
              {mode === 'database' && (
                <>
                  <SearchInput label="نماد اول (پایه)" value={selectedSymbol1} onSelect={setSelectedSymbol1} />
                  <SearchInput label="نماد دوم (مقایسه)" value={selectedSymbol2} onSelect={setSelectedSymbol2} />
                </>
              )}
              {mode === 'link' && (
                <>
                  <LinkInput label="لینک TSETMC نماد اول" value={link1} onChange={setLink1} />
                  <LinkInput label="لینک TSETMC نماد دوم" value={link2} onChange={setLink2} />
                </>
              )}
              {mode === 'file' && (
                <>
                  <FileDropzone label="فایل نماد اول" file={file1} onFileSelect={setFile1} />
                  <FileDropzone label="فایل نماد دوم" file={file2} onFileSelect={setFile2} />
                </>
              )}
           </div>

           <div className="bg-slate-900/50 p-4 rounded-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-800">
              <span className="text-xs font-black text-slate-500">بازه محاسباتی:</span>
              <div className="flex gap-2">
                 {WINDOW_OPTIONS.map(opt => (
                   <button key={opt.val} onClick={() => setSelectedWindows(prev => prev.includes(opt.val) ? prev.filter(w => w !== opt.val) : [...prev, opt.val].sort((a,b)=>a-b))} className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${selectedWindows.includes(opt.val) ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                     {opt.label}
                   </button>
                 ))}
              </div>
           </div>

           <button onClick={handleCalculate} disabled={status === FetchStatus.LOADING} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3">
             {status === FetchStatus.LOADING ? <Loader2 className="w-6 h-6 animate-spin" /> : <><ArrowLeftRight className="w-5 h-5" /> شروع تحلیل مقایسه‌ای</>}
           </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-red-400 text-sm flex items-center gap-3 animate-fade-in">
             <X className="w-5 h-5" /> <p className="font-bold">{error}</p>
          </div>
        )}

        {status === FetchStatus.SUCCESS && chartData.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-800/80 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
                    <div className="flex items-center gap-3">
                       <BarChart3 className="text-cyan-500 w-6 h-6" />
                       <h3 className="text-lg font-black text-white">نمودار ترکیبی و واگرایی <span className="text-xs text-slate-500 mx-2">({symbolNames.s1} vs {symbolNames.s2})</span></h3>
                    </div>
                    <div className="bg-slate-900 p-1 rounded-lg border border-slate-700 flex">
                        <button onClick={() => setPriceDisplaySide('price1')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${priceDisplaySide === 'price1' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{symbolNames.s1}</button>
                        <button onClick={() => setPriceDisplaySide('price2')} className={`px-4 py-1.5 rounded-md text-xs font-black transition-all ${priceDisplaySide === 'price2' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>{symbolNames.s2}</button>
                    </div>
                </div>
                <div className="p-6 space-y-12">
                   <div className="h-[350px]">
                      <PriceChart data={chartData} dataKey={priceDisplaySide} syncId="master" color="#06b6d4" />
                   </div>
                   <div className="h-[200px] border-t border-slate-700 pt-8">
                      <CorrelationChart data={chartData} syncId="master" activeWindows={WINDOW_OPTIONS.filter(o => selectedWindows.includes(o.val))} showBrush={true} />
                   </div>
                </div>
            </div>
          </div>
        )}
    </div>
  );
}
