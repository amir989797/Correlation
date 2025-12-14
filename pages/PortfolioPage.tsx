
import React, { useState, useRef, useEffect } from 'react';
import { fetchStockHistory, searchSymbols } from '../services/tsetmcService';
import { calculateFullHistorySMA, toShamsi, jalaliToGregorian, getTodayShamsi } from '../utils/mathUtils';
import { SearchResult, TsetmcDataPoint, FetchStatus } from '../types';
import { Search, Loader2, PieChart, Info, X, Calendar, Clock, ChevronDown } from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// --- Reusable Search Input ---
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
      <div className="space-y-2 w-full">
        <label className="block text-sm font-medium text-slate-400">{label}</label>
        <div className="flex items-center justify-between p-3 bg-slate-900 border border-emerald-500/50 rounded-lg text-emerald-400">
           <span className="font-bold text-sm truncate">{value.symbol}</span>
           <button onClick={() => { onSelect(null); setQuery(''); }} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 transition-colors">
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
          placeholder="جستجوی نماد (مثلا: فولاد)..." 
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

// --- Custom Shamsi Date Picker ---

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

interface ShamsiDate {
  jy: number;
  jm: number;
  jd: number;
}

const ShamsiDatePicker = ({ 
  value, 
  onChange 
}: { 
  value: ShamsiDate; 
  onChange: (d: ShamsiDate) => void;
}) => {
  return (
    <div className="flex gap-2 items-center" dir="rtl">
        {/* Day */}
        <div className="relative w-20">
            <select 
                value={value.jd}
                onChange={(e) => onChange({...value, jd: parseInt(e.target.value)})}
                className="w-full appearance-none bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500 cursor-pointer text-center"
            >
                {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                ))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>

        {/* Month */}
        <div className="relative flex-1">
            <select 
                value={value.jm}
                onChange={(e) => onChange({...value, jm: parseInt(e.target.value)})}
                className="w-full appearance-none bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500 cursor-pointer text-right pr-8"
            >
                {PERSIAN_MONTHS.map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                ))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>

        {/* Year */}
        <div className="relative w-24">
            <input 
                type="number"
                min={1300}
                max={1500}
                value={value.jy}
                onChange={(e) => onChange({...value, jy: parseInt(e.target.value)})}
                className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-cyan-500 text-center"
            />
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
  const [shamsiDate, setShamsiDate] = useState<ShamsiDate>(getTodayShamsi());
  
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
    
    // Date Calculation
    let targetDateStr = ''; // YYYYMMDD
    if (dateMode === 'custom') {
        const { gy, gm, gd } = jalaliToGregorian(shamsiDate.jy, shamsiDate.jm, shamsiDate.jd);
        // Format to YYYYMMDD
        const mm = gm < 10 ? `0${gm}` : `${gm}`;
        const dd = gd < 10 ? `0${gd}` : `${gd}`;
        targetDateStr = `${gy}${mm}${dd}`;
    }

    setStatus(FetchStatus.LOADING);
    setError(null);
    setAllocation([]);
    setAnalysisInfo(null);

    try {
      const { data } = await fetchStockHistory(symbol.symbol);
      if (data.length < 100) throw new Error('سابقه معاملاتی برای محاسبه میانگین ۱۰۰ روزه کافی نیست.');

      const ma100Map = calculateFullHistorySMA(data, 100);

      let selectedPoint: TsetmcDataPoint | undefined;
      
      if (dateMode === 'current') {
        selectedPoint = data[data.length - 1];
      } else {
        // Find the specific date point (or the closest one before it if exact not found? No, exact match is safer for now)
        selectedPoint = data.find(d => d.date === targetDateStr);
        if (!selectedPoint) {
            // Check if date is in range
            const firstDate = data[0].date;
            const lastDate = data[data.length - 1].date;
            if (targetDateStr < firstDate || targetDateStr > lastDate) {
                 throw new Error('تاریخ انتخاب شده خارج از محدوده داده‌های تاریخی موجود است.');
            }
            throw new Error('تاریخ انتخاب شده در سابقه معاملات این نماد یافت نشد (روز تعطیل یا بدون معامله).');
        }
      }

      const ma100 = ma100Map.get(selectedPoint.date);
      if (!ma100) throw new Error('میانگین ۱۰۰ روزه برای این تاریخ قابل محاسبه نیست (داده کافی قبل از این تاریخ وجود ندارد).');

      const price = selectedPoint.close;
      const isAbove = price > ma100;

      // Strategy
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
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
       <header className="mb-4">
          <h2 className="text-3xl font-bold text-white mb-2">مدیریت پرتفوی هوشمند</h2>
          <p className="text-slate-400">پیشنهاد وزن‌دهی دارایی‌ها بر اساس شرایط تکنیکال نماد</p>
       </header>

       {/* SECTION 1: Top Inputs (Full Width) */}
       <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-700 pb-4">
             <Info className="w-5 h-5 text-cyan-400" />
             تنظیمات ورودی
          </h3>

          <div className="flex flex-col gap-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                  {/* Col 1: Symbol Search */}
                  <div>
                      <SearchInput label="انتخاب نماد بورسی" value={symbol} onSelect={setSymbol} />
                  </div>

                  {/* Col 2: Date Mode */}
                  <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">مبنای زمانی</label>
                      <div className="flex gap-3">
                        <label className={`flex-1 cursor-pointer rounded-lg border p-3 flex items-center justify-center gap-2 transition-all ${dateMode === 'current' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                            <input type="radio" name="dateMode" value="current" checked={dateMode === 'current'} onChange={() => setDateMode('current')} className="hidden" />
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-bold">آخرین قیمت</span>
                        </label>
                        <label className={`flex-1 cursor-pointer rounded-lg border p-3 flex items-center justify-center gap-2 transition-all ${dateMode === 'custom' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-600'}`}>
                            <input type="radio" name="dateMode" value="custom" checked={dateMode === 'custom'} onChange={() => setDateMode('custom')} className="hidden" />
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm font-bold">تاریخ خاص</span>
                        </label>
                      </div>
                  </div>

                  {/* Col 3: Date Picker (Conditional) */}
                  <div className={`transition-all duration-300 ${dateMode === 'custom' ? 'opacity-100' : 'opacity-30 pointer-events-none grayscale'}`}>
                       <label className="block text-sm font-medium text-slate-400 mb-2">انتخاب تاریخ</label>
                       <ShamsiDatePicker value={shamsiDate} onChange={setShamsiDate} />
                  </div>
              </div>

              {/* Calculate Button */}
              <button 
                  onClick={handleCalculate}
                  disabled={status === FetchStatus.LOADING}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {status === FetchStatus.LOADING ? (
                    <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        در حال پردازش و محاسبه...
                    </span>
                  ) : 'محاسبه استراتژی پرتفوی'}
              </button>
          </div>
       </div>

       {/* SECTION 2: Grid Area */}
       <div className="grid md:grid-cols-12 gap-6 items-stretch">
          
          {/* Right Column (in RTL): Logic Explanation */}
          <div className="md:col-span-4 lg:col-span-4 order-1 md:order-none">
             <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 h-full shadow-lg flex flex-col">
                <h4 className="font-bold text-white mb-4 text-base border-b border-slate-700 pb-2">منطق محاسباتی</h4>
                
                <div className="flex-1 space-y-6 text-sm">
                   <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                       <div className="flex items-center gap-2 mb-2">
                           <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"></span>
                           <span className="text-emerald-400 font-bold text-base">روند صعودی</span>
                       </div>
                       <p className="text-slate-300 leading-relaxed mb-2">
                           زمانی که قیمت پایانی <span className="text-white font-bold">بیشتر</span> از میانگین متحرک ۱۰۰ روزه باشد.
                       </p>
                       <div className="bg-slate-800 p-3 rounded-lg text-xs space-y-1">
                           <div className="flex justify-between"><span className="text-slate-400">سهم:</span> <span className="text-emerald-400 font-bold">۵۰٪</span></div>
                           <div className="flex justify-between"><span className="text-slate-400">طلا:</span> <span className="text-amber-400 font-bold">۲۵٪</span></div>
                           <div className="flex justify-between"><span className="text-slate-400">اوراق:</span> <span className="text-blue-400 font-bold">۲۵٪</span></div>
                       </div>
                   </div>

                   <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                       <div className="flex items-center gap-2 mb-2">
                           <span className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50"></span>
                           <span className="text-red-400 font-bold text-base">روند نزولی</span>
                       </div>
                       <p className="text-slate-300 leading-relaxed mb-2">
                           زمانی که قیمت پایانی <span className="text-white font-bold">کمتر</span> از میانگین متحرک ۱۰۰ روزه باشد.
                       </p>
                       <div className="bg-slate-800 p-3 rounded-lg text-xs space-y-1">
                           <div className="flex justify-between"><span className="text-slate-400">سهم:</span> <span className="text-emerald-400 font-bold">۲۵٪</span></div>
                           <div className="flex justify-between"><span className="text-slate-400">طلا:</span> <span className="text-amber-400 font-bold">۵۰٪</span></div>
                           <div className="flex justify-between"><span className="text-slate-400">اوراق:</span> <span className="text-blue-400 font-bold">۲۵٪</span></div>
                       </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Left Column (in RTL): Chart & Results */}
          <div className="md:col-span-8 lg:col-span-8 order-2 md:order-none">
             <div className="bg-slate-800 rounded-2xl border border-slate-700 h-full min-h-[500px] shadow-xl relative overflow-hidden flex flex-col">
                {status === FetchStatus.SUCCESS && analysisInfo ? (
                   <div className="flex flex-col h-full animate-fade-in">
                      {/* Result Header */}
                      <div className="p-5 border-b border-slate-700 bg-slate-800/80 backdrop-blur-sm z-10 flex flex-wrap justify-between items-center gap-4">
                         <div>
                            <div className="flex items-center gap-3">
                                <h3 className="font-black text-2xl text-white">{symbol?.symbol}</h3>
                                <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded">{toShamsi(analysisInfo.date)}</span>
                            </div>
                         </div>
                         <div className="text-left bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-500 mb-1">وضعیت نسبت به MA100</div>
                            <div className={`font-bold text-lg flex items-center gap-2 ${analysisInfo.condition === 'Above' ? 'text-emerald-400' : 'text-red-400'}`}>
                               {analysisInfo.condition === 'Above' ? 'بالاتر (صعودی)' : 'پایین‌تر (نزولی)'}
                               {analysisInfo.condition === 'Above' ? (
                                   <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                               ) : (
                                   <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
                               )}
                            </div>
                         </div>
                      </div>

                      {/* Chart Area */}
                      <div className="flex-1 w-full relative p-4">
                         <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                               <Pie
                                  data={allocation}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={renderCustomizedLabel}
                                  innerRadius={90}
                                  outerRadius={150}
                                  paddingAngle={4}
                                  dataKey="value"
                                  stroke="none"
                               >
                                  {allocation.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                               </Pie>
                               <Tooltip 
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                                  itemStyle={{ color: '#fff' }}
                                  formatter={(value: number) => `${value}%`}
                               />
                               <Legend 
                                  verticalAlign="bottom" 
                                  height={36} 
                                  iconType="circle"
                                  formatter={(value) => <span className="text-slate-300 mx-2 text-sm font-bold">{value}</span>}
                               />
                            </RechartsPieChart>
                         </ResponsiveContainer>
                         
                         {/* Center Overlay Text */}
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
                            <div className="text-center bg-slate-900/80 p-4 rounded-full backdrop-blur-sm border border-slate-700/50 shadow-2xl">
                               <span className="block text-3xl font-black text-white">{analysisInfo.condition === 'Above' ? 'سهامی' : 'طلایی'}</span>
                               <span className="text-xs text-slate-400 mt-1 block">پرتفوی پیشنهادی</span>
                            </div>
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center space-y-6">
                      {status === FetchStatus.LOADING ? (
                         <div className="flex flex-col items-center gap-4">
                             <div className="relative">
                                 <div className="w-16 h-16 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"></div>
                                 <div className="absolute inset-0 flex items-center justify-center">
                                     <div className="w-8 h-8 bg-slate-800 rounded-full"></div>
                                 </div>
                             </div>
                             <p className="text-cyan-400 animate-pulse font-medium">در حال دریافت داده‌های تاریخی...</p>
                         </div>
                      ) : (
                         <>
                            <div className="w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center border-2 border-dashed border-slate-700">
                                <PieChart className="w-10 h-10 opacity-30" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-slate-300 mb-2">هنوز محاسبه‌ای انجام نشده</p>
                                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                                   لطفا نماد مورد نظر را از پنل بالا انتخاب کرده و دکمه محاسبه را بزنید.
                                </p>
                            </div>
                            {error && (
                                <div className="mt-4 text-red-400 bg-red-500/10 px-6 py-3 rounded-xl text-sm border border-red-500/20 flex items-center gap-2">
                                    <X className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                         </>
                      )}
                   </div>
                )}
             </div>
          </div>
       </div>
    </div>
  );
}
