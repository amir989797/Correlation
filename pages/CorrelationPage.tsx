
import React, { useEffect, useState } from 'react';
import { Search, Factory, Briefcase, X, Loader2, Building2 } from 'lucide-react';
import { SeoHelmet } from '../components/SeoHelmet';
import { fetchIndustries, fetchSymbolsByIndustry, IndustryData } from '../services/tsetmcService';
import { SearchResult } from '../types';

interface SymbolsModalProps {
    industry: string;
    isOpen: boolean;
    onClose: () => void;
}

const SymbolsModal = ({ industry, isOpen, onClose }: SymbolsModalProps) => {
    const [symbols, setSymbols] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');

    useEffect(() => {
        if (isOpen && industry) {
            const load = async () => {
                setLoading(true);
                const res = await fetchSymbolsByIndustry(industry);
                setSymbols(res);
                setLoading(false);
            };
            load();
        } else {
            setSymbols([]);
            setFilter('');
        }
    }, [isOpen, industry]);

    if (!isOpen) return null;

    const filtered = symbols.filter(s => 
        s.symbol.includes(filter) || s.name.includes(filter)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-500/10 p-2 rounded-lg text-cyan-400">
                            <Factory className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">صنعت: {industry}</h3>
                            <span className="text-xs text-slate-400">لیست نمادهای فعال در این گروه</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-slate-700/50 hover:bg-slate-700 p-2 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Bar inside Modal */}
                <div className="p-4 border-b border-slate-700/50 bg-slate-900/30">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="جستجو در نمادهای این صنعت..." 
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 pl-10 text-sm text-white placeholder-slate-500 focus:border-cyan-500 outline-none transition-all"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                            <span className="text-sm text-slate-400">در حال دریافت لیست نمادها...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 text-sm">
                            موردی یافت نشد.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {filtered.map((sym) => (
                                <div key={sym.symbol} className="bg-slate-700/30 hover:bg-slate-700 border border-slate-600/50 hover:border-cyan-500/50 rounded-xl p-3 flex flex-col items-center text-center transition-all cursor-default group">
                                    <span className="font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">{sym.symbol}</span>
                                    <span className="text-[10px] text-slate-400 truncate w-full">{sym.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-3 border-t border-slate-700 bg-slate-800/50 rounded-b-2xl flex justify-between items-center text-xs text-slate-500 px-6">
                    <span>تعداد کل: {symbols.length}</span>
                </div>
            </div>
        </div>
    );
};

export function SearchPage() {
  const [industries, setIndustries] = useState<IndustryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  useEffect(() => {
      const load = async () => {
          setLoading(true);
          const data = await fetchIndustries();
          setIndustries(data);
          setLoading(false);
      };
      load();
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      <SeoHelmet />
      
      {/* Header */}
      <div className="flex flex-col items-center text-center space-y-4 mb-12">
          <div className="bg-cyan-500/10 p-6 rounded-3xl shadow-[0_0_30px_rgba(6,182,212,0.15)] mb-2">
            <Search className="w-16 h-16 text-cyan-400" />
          </div>
          <h2 className="text-4xl font-black text-white">صنایع و گروه‌های بازار</h2>
          <p className="text-slate-400 max-w-lg mx-auto leading-7">
            دسته‌بندی نمادهای بازار بر اساس صنعت. با انتخاب هر گروه، لیست نمادهای فعال در آن را مشاهده کنید.
          </p>
      </div>

      {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-32 bg-slate-800 rounded-2xl animate-pulse"></div>
              ))}
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {industries.map((ind) => (
                  <button 
                    key={ind.industry}
                    onClick={() => setSelectedIndustry(ind.industry)}
                    className="group relative bg-slate-800 p-6 rounded-2xl border border-slate-700 hover:border-cyan-500 transition-all hover:shadow-xl hover:shadow-cyan-500/10 text-right overflow-hidden flex flex-col justify-between min-h-[140px]"
                  >
                      <div className="absolute top-0 left-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl -ml-10 -mt-10 group-hover:bg-cyan-500/10 transition-all"></div>
                      
                      <div className="relative z-10 flex justify-between items-start w-full">
                          <div className="bg-slate-700/50 p-2.5 rounded-xl group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-colors text-slate-400">
                             <Building2 className="w-6 h-6" />
                          </div>
                          <span className="text-xs font-black bg-slate-900/50 px-2 py-1 rounded-lg text-slate-400 border border-slate-700/50">
                              {ind.count} نماد
                          </span>
                      </div>

                      <div className="relative z-10 mt-4">
                          <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
                              {ind.industry}
                          </h3>
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0">
                              مشاهده لیست <Briefcase className="w-3 h-3" />
                          </span>
                      </div>
                  </button>
              ))}
          </div>
      )}

      {/* Modal */}
      <SymbolsModal 
        isOpen={!!selectedIndustry} 
        industry={selectedIndustry || ''} 
        onClose={() => setSelectedIndustry(null)} 
      />

    </div>
  );
}
