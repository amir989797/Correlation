
import React, { useState, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { calculateFullHistorySMA, toShamsi } from '../utils/mathUtils';
import { SearchResult, TsetmcDataPoint, FetchStatus } from '../types';
import { Search, Loader2, PieChart, Info, X, Calendar, Clock } from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// --- Reusable Search Input (Local Definition) ---
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
           <span className="font-bold text-sm">{value.symbol}</span>
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
          placeholder="جستجوی نماد..." 
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
                className="w-full text-right px-4 py-3 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 flex justify-between items-center group transition-colors"
               >
                 <span className="font-bold text-white group-hover:text-amber-400">{item.symbol}</span>
                 <span className="text-xs text-slate-400">{item.name}</span>
               </button>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Portfolio Page ---

interface Allocation {
  name: string;
  value: number;
  fill: string;
}

type DateMode = 'current' | 'custom';

// Helper for pie chart label positioning
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-sm font-bold drop-shadow-md">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function PortfolioPage() {
  const [symbol, setSymbol] = useState<SearchResult | null>(null);
  
  // Date State
  const [dateMode, setDateMode] = useState<DateMode>('current');
  const [customDate, setCustomDate] = useState(''); // YYYY-MM-DD from input
  
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  const [allocation, setAllocation] = useState<Allocation[]>([]);
  const [analysisInfo, setAnalysisInfo] = useState<{
    date: string;
    price: number;
    ma100: number;
    condition: 'Above' | 'Below';
  } | null>(null);

  const handleCalculate = async () => {
    if (!symbol) {
      setError('لطفا نماد را انتخاب کنید.');
      return;
    }
    
    // Date Validation
    let formattedCustomDate = '';
    if (dateMode === 'custom') {
      if (!customDate) {
         setError('لطفا تاریخ را انتخاب کنید.');
         return;
      }
      // HTML date input gives YYYY-MM-DD, API expects YYYYMMDD
      formattedCustomDate = customDate.replace(/-/g, '');
    }

    setStatus(FetchStatus.LOADING);
    setError(null);
    setAllocation([]);
    setAnalysisInfo(null);

    try {
      const { data } = await fetchStockHistory(symbol.symbol);
      if (data.length < 100) throw new Error('سابقه معاملاتی برای محاسبه میانگین ۱۰۰ روزه کافی نیست.');

      // Calculate MA100 map
      const ma100Map = calculateFullHistorySMA(data, 100);

      // Find the specific date point
      let selectedPoint: TsetmcDataPoint | undefined;
      
      if (dateMode === 'current') {
        selectedPoint = data[data.length - 1];
      } else {
        selectedPoint = data.find(d => d.date === formattedCustomDate);
        if (!selectedPoint) {
           throw new Error('تاریخ انتخاب شده در سابقه معاملات این نماد یافت نشد (روز تعطیل یا بدون معامله).');
        }
      }

      if (!selectedPoint) throw new Error('داده‌ای یافت نشد.');

      const ma100 = ma100Map.get(selectedPoint.date);
      if (!ma100) throw new Error('میانگین ۱۰۰ روزه برای این تاریخ قابل محاسبه نیست (داده کافی قبل از این تاریخ وجود ندارد).');

      const price = selectedPoint.close;
      const isAbove = price > ma100;

      // Logic:
      // Price > MA100: Stock 50%, Gold 25%, Bonds 25%
      // Price < MA100: Stock 25%, Gold 50%, Bonds 25%
      
      const newAllocation: Allocation[] = [
        { name: symbol.symbol, value: isAbove ? 50 : 25, fill: '#10b981' }, // Stock (Emerald)
        { name: 'طلا', value: isAbove ? 25 : 50, fill: '#fbbf24' },        // Gold (Amber)
        { name: 'اوراق', value: 25, fill: '#3b82f6' }                       // Bonds (Blue)
      ];

      setAllocation(newAllocation);
      setAnalysisInfo({
        date: selectedPoint.date,
        price,
        ma100,
        condition: isAbove ? 'Above' : 'Below'
      });
      setStatus(FetchStatus.SUCCESS);

    } catch (err: any) {
      setError(err.message);
      setStatus(FetchStatus.ERROR);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
       <header className="mb-6">
          <h2 className="text-3xl font-bold text-white mb-2">مدیریت پرتفوی هوشمند</h2>
          <p className="text-slate-400">پیشنهاد وزن‌دهی دارایی‌ها بر اساس شرایط تکنیکال نماد</p>
       </header>

       <div className="grid md:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Inputs & Logic Display */}
          <div className="md:col-span-5 space-y-6">
             <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                   <Info className="w-5 h-5 text-cyan-400" />
                   تنظیمات ورودی
                </h3>
                
                <div className="space-y-6">
                   <SearchInput label="انتخاب نماد بورسی" value={symbol} onSelect={setSymbol} />
                   
                   <div>
                      <label className="block text-sm font-medium text-slate-400 mb-3">تاریخ مبنای تحلیل</label>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                          <label className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${dateMode === 'current' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                              <input 
                                type="radio" 
                                name="dateMode" 
                                value="current" 
                                checked={dateMode === 'current'} 
                                onChange={() => setDateMode('current')}
                                className="hidden"
                              />
                              <Clock className="w-6 h-6" />
                              <span className="text-sm font-bold">زمان حال</span>
                          </label>

                          <label className={`cursor-pointer rounded-xl border p-3 flex flex-col items-center gap-2 transition-all ${dateMode === 'custom' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                              <input 
                                type="radio" 
                                name="dateMode" 
                                value="custom" 
                                checked={dateMode === 'custom'} 
                                onChange={() => setDateMode('custom')}
                                className="hidden"
                              />
                              <Calendar className="w-6 h-6" />
                              <span className="text-sm font-bold">تاریخ سفارشی</span>
                          </label>
                      </div>
                      
                      {/* Date Input with simple slide down animation logic */}
                      <div className={`overflow-hidden transition-all duration-300 ${dateMode === 'custom' ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'}`}>
                         <input 
                           type="date" 
                           value={customDate}
                           onChange={(e) => setCustomDate(e.target.value)}
                           className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-colors"
                         />
                      </div>
                   </div>

                   <button 
                     onClick={handleCalculate}
                     disabled={status === FetchStatus.LOADING}
                     className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {status === FetchStatus.LOADING ? (
                        <span className="flex items-center justify-center gap-2">
                           <Loader2 className="w-4 h-4 animate-spin" />
                           در حال محاسبه...
                        </span>
                     ) : 'محاسبه پرتفوی'}
                   </button>
                </div>
             </div>

             {/* Logic Explanation Box */}
             <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                <h4 className="font-bold text-slate-300 mb-3 text-sm">منطق محاسباتی:</h4>
                <ul className="space-y-3 text-sm text-slate-400">
                   <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5"></span>
                      <div>
                         <span className="text-emerald-400 font-bold block">شرط صعودی:</span>
                         اگر قیمت بالاتر از میانگین ۱۰۰ روزه باشد:
                         <br/>
                         ۵۰٪ سهم، ۲۵٪ طلا، ۲۵٪ اوراق
                      </div>
                   </li>
                   <li className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 mt-1.5"></span>
                      <div>
                         <span className="text-red-400 font-bold block">شرط نزولی:</span>
                         اگر قیمت پایین‌تر از میانگین ۱۰۰ روزه باشد:
                         <br/>
                         ۲۵٪ سهم، ۵۰٪ طلا، ۲۵٪ اوراق
                      </div>
                   </li>
                </ul>
             </div>
          </div>

          {/* RIGHT COLUMN: Chart & Results */}
          <div className="md:col-span-7">
             <div className="bg-slate-800 rounded-2xl border border-slate-700 h-full min-h-[400px] flex flex-col relative overflow-hidden">
                
                {status === FetchStatus.SUCCESS && analysisInfo ? (
                   <div className="flex flex-col h-full">
                      {/* Info Header */}
                      <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex justify-between items-center z-10">
                         <div>
                            <h3 className="font-bold text-white text-lg">{symbol?.symbol}</h3>
                            <span className="text-xs text-slate-400" dir="ltr">{toShamsi(analysisInfo.date)}</span>
                         </div>
                         <div className="text-left">
                            <div className="text-xs text-slate-400">وضعیت نسبت به MA100</div>
                            <div className={`font-bold ${analysisInfo.condition === 'Above' ? 'text-emerald-400' : 'text-red-400'}`}>
                               {analysisInfo.condition === 'Above' ? 'بالاتر (روند صعودی)' : 'پایین‌تر (روند نزولی)'}
                            </div>
                         </div>
                      </div>

                      {/* Pie Chart */}
                      <div className="flex-1 w-full relative">
                         <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                               <Pie
                                  data={allocation}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={renderCustomizedLabel}
                                  innerRadius={80}
                                  outerRadius={130}
                                  paddingAngle={5}
                                  dataKey="value"
                                  stroke="none"
                               >
                                  {allocation.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                               </Pie>
                               <Tooltip 
                                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                  itemStyle={{ color: '#fff' }}
                                  formatter={(value: number) => `${value}%`}
                               />
                               <Legend 
                                  verticalAlign="bottom" 
                                  height={36} 
                                  iconType="circle"
                                  formatter={(value) => <span className="text-slate-300 mx-2">{value}</span>}
                               />
                            </RechartsPieChart>
                         </ResponsiveContainer>
                         
                         {/* Center Text */}
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                               <span className="block text-3xl font-black text-white">{analysisInfo.condition === 'Above' ? 'سهامی' : 'طلایی'}</span>
                               <span className="text-xs text-slate-400">استراتژی پیشنهادی</span>
                            </div>
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                      {status === FetchStatus.LOADING ? (
                         <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
                      ) : (
                         <PieChart className="w-16 h-16 mb-4 opacity-50" />
                      )}
                      <p className="text-lg font-medium">
                         {status === FetchStatus.LOADING ? 'در حال پردازش اطلاعات...' : 'برای مشاهده پرتفوی پیشنهادی، نماد را انتخاب و محاسبه کنید'}
                      </p>
                      {error && (
                         <p className="mt-4 text-red-400 bg-red-500/10 px-4 py-2 rounded-lg text-sm border border-red-500/20">
                            {error}
                         </p>
                      )}
                   </div>
                )}
             </div>
          </div>
       </div>
    </div>
  );
}
