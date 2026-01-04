
import React, { useEffect, useState, useMemo } from 'react';
import { Search, Layers, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Factory, LayoutGrid, X } from 'lucide-react';
import { SeoHelmet } from '../components/SeoHelmet';
import { MarketSymbol, FetchStatus } from '../types';

interface IndustryGroup {
  name: string;
  symbols: MarketSymbol[];
  avgChange: number;
  positiveCount: number;
  negativeCount: number;
  volume: number; // Placeholder for now, could aggregate if data available
}

export function SearchPage() {
  const [data, setData] = useState<MarketSymbol[]>([]);
  const [status, setStatus] = useState<FetchStatus>(FetchStatus.IDLE);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryGroup | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setStatus(FetchStatus.LOADING);
      try {
        const res = await fetch('/api/market/overview');
        if (!res.ok) throw new Error('Failed to fetch market data');
        const json = await res.json();
        setData(json);
        setStatus(FetchStatus.SUCCESS);
      } catch (e) {
        console.error(e);
        setStatus(FetchStatus.ERROR);
      }
    };
    fetchData();
  }, []);

  const { indices, industries } = useMemo(() => {
    const indicesList: MarketSymbol[] = [];
    const industryMap = new Map<string, IndustryGroup>();

    data.forEach(item => {
      // Logic from prompt: Indices have industry = 'شاخص'
      if (item.industry === 'شاخص') {
        indicesList.push(item);
      } else {
        const indName = item.industry || 'سایر';
        if (!industryMap.has(indName)) {
          industryMap.set(indName, {
            name: indName,
            symbols: [],
            avgChange: 0,
            positiveCount: 0,
            negativeCount: 0,
            volume: 0
          });
        }
        const group = industryMap.get(indName)!;
        group.symbols.push(item);
        if (item.change_percent > 0) group.positiveCount++;
        else if (item.change_percent < 0) group.negativeCount++;
      }
    });

    // Calculate Averages
    const industryList = Array.from(industryMap.values()).map(group => {
      const sumChange = group.symbols.reduce((acc, s) => acc + (parseFloat(s.change_percent as any) || 0), 0);
      group.avgChange = group.symbols.length ? sumChange / group.symbols.length : 0;
      return group;
    });

    // Sort Industries by Average Change (Desc)
    return {
      indices: indicesList.sort((a,b) => b.change_percent - a.change_percent),
      industries: industryList.sort((a, b) => b.avgChange - a.avgChange)
    };
  }, [data]);

  const filteredIndustries = useMemo(() => {
    if (!searchTerm) return industries;
    return industries.filter(ind => 
      ind.name.includes(searchTerm) || 
      ind.symbols.some(s => s.symbol.includes(searchTerm))
    );
  }, [industries, searchTerm]);

  // Handle Modal Close
  const closeModal = () => setSelectedIndustry(null);

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 space-y-8 animate-fade-in relative">
      <SeoHelmet />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-3xl font-black text-white flex items-center gap-3">
             <LayoutGrid className="w-8 h-8 text-cyan-400" />
             نمای بازار و صنایع
          </h2>
          <p className="text-slate-400 mt-2 text-sm">بررسی وضعیت کلی بازار، شاخص‌های اصلی و عملکرد صنایع</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative w-full md:w-72">
           <input 
             type="text" 
             placeholder="جستجوی صنعت یا نماد..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pl-10 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
           />
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        </div>
      </div>

      {status === FetchStatus.LOADING && (
         <div className="flex items-center justify-center h-64">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
         </div>
      )}

      {status === FetchStatus.SUCCESS && (
        <>
          {/* 1. Market Indices Section */}
          {indices.length > 0 && (
             <section className="space-y-4">
                 <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    شاخص‌های بازار
                 </h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {indices.map(idx => (
                        <div key={idx.symbol} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-slate-500 transition-colors">
                            <span className="text-xs text-slate-400 block mb-1">شاخص</span>
                            <h4 className="font-bold text-white text-sm truncate mb-2">{idx.symbol}</h4>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-300 font-mono tracking-tighter">{new Intl.NumberFormat('en-US').format(idx.close)}</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${idx.change_percent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`} dir="ltr">
                                   {idx.change_percent > 0 ? '+' : ''}{idx.change_percent}%
                                </span>
                            </div>
                        </div>
                    ))}
                 </div>
             </section>
          )}

          {/* 2. Industries Grid */}
          <section className="space-y-4">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <Factory className="w-5 h-5 text-amber-400" />
                وضعیت صنایع
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredIndustries.map(ind => {
                      const isPositive = ind.avgChange >= 0;
                      return (
                        <div 
                           key={ind.name} 
                           onClick={() => setSelectedIndustry(ind)}
                           className="group cursor-pointer bg-slate-800 rounded-xl overflow-hidden border border-slate-700 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-300 relative"
                        >
                            {/* Color Bar */}
                            <div className={`h-1.5 w-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                            
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <h4 className="font-bold text-slate-100 truncate pr-2">{ind.name}</h4>
                                    <div className={`flex items-center gap-0.5 text-xs font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`} dir="ltr">
                                       {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                       {ind.avgChange.toFixed(2)}%
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-4">
                                    <span>{ind.symbols.length} نماد</span>
                                    <div className="flex gap-1">
                                        <span className="text-emerald-500" title="مثبت">{ind.positiveCount}</span>
                                        <span>/</span>
                                        <span className="text-red-500" title="منفی">{ind.negativeCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                      );
                  })}
              </div>
          </section>
        </>
      )}

      {/* Industry Modal */}
      {selectedIndustry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeModal}>
              <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                  
                  {/* Modal Header */}
                  <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                      <div>
                          <h3 className="font-bold text-white text-lg">{selectedIndustry.name}</h3>
                          <span className="text-xs text-slate-400 mt-1 block">میانگین بازدهی: <span dir="ltr" className={selectedIndustry.avgChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>{selectedIndustry.avgChange.toFixed(2)}%</span></span>
                      </div>
                      <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                          <X className="w-6 h-6" />
                      </button>
                  </div>

                  {/* Symbols List */}
                  <div className="p-4 overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {selectedIndustry.symbols.sort((a,b) => b.change_percent - a.change_percent).map(sym => (
                              <div key={sym.symbol} className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex justify-between items-center hover:border-slate-600 transition-colors">
                                  <span className="text-sm font-bold text-slate-200">{sym.symbol}</span>
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${sym.change_percent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`} dir="ltr">
                                      {sym.change_percent > 0 ? '+' : ''}{sym.change_percent}%
                                  </span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
