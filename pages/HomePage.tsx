
import React from 'react';
import { Link } from '../router';
import { LineChart, Zap } from 'lucide-react';

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6 space-y-12">
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
          تحلیلگر بورس
        </h1>
        <p className="text-xl text-slate-400">
          پلتفرم جامع تحلیل تکنیکال و بررسی همبستگی نمادهای بازار سرمایه
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        <Link to="/correlation" className="group relative bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-cyan-500 transition-all hover:shadow-2xl hover:shadow-cyan-500/20 text-right overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-cyan-500/20 transition-all"></div>
          <div className="relative z-10 flex flex-col items-start">
             <div className="bg-cyan-500/20 p-3 rounded-lg mb-4 text-cyan-400">
                <LineChart className="w-8 h-8" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">محاسبه همبستگی</h3>
             <p className="text-slate-400 text-sm leading-relaxed">
               بررسی ضریب همبستگی تاریخی بین دو نماد، مشاهده واگرایی‌ها و تحلیل روند قیمتی.
             </p>
          </div>
        </Link>

        <Link to="/signal" className="group relative bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-purple-500 transition-all hover:shadow-2xl hover:shadow-purple-500/20 text-right overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-all"></div>
          <div className="relative z-10 flex flex-col items-start">
             <div className="bg-purple-500/20 p-3 rounded-lg mb-4 text-purple-400">
                <Zap className="w-8 h-8" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">سیگنال</h3>
             <p className="text-slate-400 text-sm leading-relaxed">
               بخش سیگنال‌های تکنیکال (به زودی).
             </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
