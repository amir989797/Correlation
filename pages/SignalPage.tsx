
import React from 'react';
import { Construction } from 'lucide-react';

export function SignalPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 space-y-6">
      <div className="bg-yellow-500/10 p-6 rounded-full">
        <Construction className="w-16 h-16 text-yellow-500" />
      </div>
      <h2 className="text-3xl font-bold text-white">صفحه سیگنال</h2>
      <p className="text-slate-400 max-w-md">
        این بخش در حال توسعه است. به زودی ابزارهای جدید سیگنال‌دهی در اینجا قرار خواهد گرفت.
      </p>
    </div>
  );
}
