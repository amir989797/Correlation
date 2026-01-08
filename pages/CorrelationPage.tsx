
import React from 'react';
import { Search } from 'lucide-react';
import { SeoHelmet } from '../components/SeoHelmet';

export function SearchPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-6 animate-fade-in">
      <SeoHelmet />
      
      <div className="bg-cyan-500/10 p-8 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.2)]">
        <Search className="w-20 h-20 text-cyan-400" />
      </div>
      
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-white">بخش شناسایی</h2>
        <p className="text-slate-400 max-w-md mx-auto text-sm leading-7">
          این بخش آماده‌سازی شده است. منتظر دستورالعمل‌های بعدی شما برای پیاده‌سازی ابزارهای شناسایی هستم.
        </p>
      </div>
    </div>
  );
}
