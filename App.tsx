
import React from 'react';
import { LineChart, Zap, Home, Scale, Briefcase } from 'lucide-react';
import { HomePage } from './pages/HomePage';
import { CorrelationPage } from './pages/CorrelationPage';
import { SignalPage } from './pages/SignalPage';
import { RatioPage } from './pages/RatioPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { Router, Routes, Route, useLocation, useRouter } from './router';

function Sidebar() {
  const location = useLocation();
  const { navigate } = useRouter();

  const menuItems = [
    { path: '/', label: 'خانه', icon: Home },
    { path: '/correlation', label: 'همبستگی', icon: LineChart },
    { path: '/ratio', label: 'نسبت', icon: Scale },
    { path: '/portfolio', label: 'سبد دارایی', icon: Briefcase },
    { path: '/signal', label: 'سیگنال', icon: Zap },
  ];

  return (
    <aside className="fixed right-0 top-0 h-full w-28 bg-slate-900/95 backdrop-blur-sm border-l border-slate-800 flex flex-col z-50 transition-all">
      {/* Logo Area */}
      <div className="h-24 flex items-center justify-center border-b border-slate-800 mb-4">
        <div className="bg-gradient-to-tr from-cyan-500 to-blue-500 w-12 h-12 rounded-2xl shadow-lg shadow-cyan-500/20 flex items-center justify-center">
             <span className="font-black text-white text-sm">TSE</span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-4 flex flex-col items-center">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => { e.preventDefault(); navigate(item.path); }}
              className={`relative flex flex-col items-center justify-center w-24 h-24 rounded-2xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-inner' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon 
                className={`w-8 h-8 transition-all duration-300 ${isActive ? '-translate-y-2 text-cyan-400' : 'group-hover:-translate-y-2'}`} 
              />
              
              <span className={`absolute bottom-3 text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                  isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
              }`}>
                {item.label}
              </span>
              
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-1.5 bg-cyan-500 rounded-r-full"></div>
              )}
            </a>
          );
        })}
      </nav>

      {/* Footer Version */}
      <div className="p-4 border-t border-slate-800 flex justify-center">
         <span className="text-xs text-slate-600">v1.2</span>
      </div>
    </aside>
  );
}

export function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0b1121] text-slate-200 font-[Vazirmatn]">
        <Sidebar />
        
        {/* Main Content Area */}
        <main className="mr-28 min-h-screen transition-all">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
             <Routes>
               <Route path="/" element={<HomePage />} />
               <Route path="/correlation" element={<CorrelationPage />} />
               <Route path="/ratio" element={<RatioPage />} />
               <Route path="/portfolio" element={<PortfolioPage />} />
               <Route path="/signal" element={<SignalPage />} />
             </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}
