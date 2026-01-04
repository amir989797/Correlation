
import React from 'react';
import { Link } from '../router';
import { LineChart, Briefcase, GraduationCap, Search } from 'lucide-react';
import { SeoHelmet } from '../components/SeoHelmet';

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6 space-y-12">
      <SeoHelmet />
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">
          تحلیلگر بورس
        </h1>
        <p className="text-xl text-slate-400">
          پلتفرم جامع تحلیل تکنیکال و مدیریت دارایی‌های بازار سرمایه
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl">
        
        {/* 1. Identification Card (Formerly Correlation) */}
        <Link to="/search" className="group relative bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-cyan-500 transition-all hover:shadow-2xl hover:shadow-cyan-500/20 text-right overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-cyan-500/20 transition-all"></div>
          <div className="relative z-10 flex flex-col items-start">
             <div className="bg-cyan-500/20 p-3 rounded-lg mb-4 text-cyan-400">
                <Search className="w-8 h-8" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">شناسایی</h3>
             <p className="text-slate-400 text-sm leading-relaxed">
               ابزارهای پیشرفته برای جستجو و شناسایی فرصت‌های معاملاتی در بازار.
             </p>
          </div>
        </Link>

        {/* 2. Technical Card */}
        <Link to="/technical" className="group relative bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-amber-500 transition-all hover:shadow-2xl hover:shadow-amber-500/20 text-right overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-amber-500/20 transition-all"></div>
          <div className="relative z-10 flex flex-col items-start">
             <div className="bg-amber-500/20 p-3 rounded-lg mb-4 text-amber-400">
                <LineChart className="w-8 h-8" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">تحلیل تکنیکال</h3>
             <p className="text-slate-400 text-sm leading-relaxed">
               مقایسه قدرت نسبی دو دارایی، شناسایی حباب و نقاط ورود بهینه با نمودار تقسیمی.
             </p>
          </div>
        </Link>

        {/* 3. Portfolio Card */}
        <Link to="/portfolio" className="group relative bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-blue-500 transition-all hover:shadow-2xl hover:shadow-blue-500/20 text-right overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all"></div>
          <div className="relative z-10 flex flex-col items-start">
             <div className="bg-blue-500/20 p-3 rounded-lg mb-4 text-blue-400">
                <Briefcase className="w-8 h-8" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">سبد دارایی هوشمند</h3>
             <p className="text-slate-400 text-sm leading-relaxed">
               ساخت پرتفوی بهینه از صندوق‌های طلا، سهام و درآمد ثابت بر اساس تحلیل بازار.
             </p>
          </div>
        </Link>

        {/* 4. Education Card (External Link) */}
        <Link to="https://learn.arkarise.ir" target="_blank" className="group relative bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-purple-500 transition-all hover:shadow-2xl hover:shadow-purple-500/20 text-right overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-all"></div>
          <div className="relative z-10 flex flex-col items-start">
             <div className="bg-purple-500/20 p-3 rounded-lg mb-4 text-purple-400">
                <GraduationCap className="w-8 h-8" />
             </div>
             <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">مرکز آموزش</h3>
             <p className="text-slate-400 text-sm leading-relaxed">
               دسترسی به مقالات، ویدیوهای آموزشی و تحلیل‌های روز برای یادگیری بیشتر.
             </p>
          </div>
        </Link>

      </div>
    </div>
  );
}
