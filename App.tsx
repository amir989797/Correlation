
import React, { useState, useEffect } from 'react';
import { LineChart, Home, Scale, Briefcase, GraduationCap } from 'lucide-react';
import { HomePage } from './pages/HomePage';
import { CorrelationPage } from './pages/CorrelationPage';
import { RatioPage } from './pages/RatioPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { Router, Routes, Route, useLocation, useRouter } from './router';

// Shared Menu Items Configuration
const MENU_ITEMS = [
  { path: '/', label: 'خانه', icon: Home, isExternal: false },
  { path: '/correlation', label: 'همبستگی', icon: LineChart, isExternal: false },
  { path: '/technical', label: 'تکنیکال', icon: Scale, isExternal: false },
  { path: '/portfolio', label: 'سبد دارایی', icon: Briefcase, isExternal: false },
  { path: 'https://learn.arkarise.ir', label: 'آموزش', icon: GraduationCap, isExternal: true },
];

function Sidebar() {
  const location = useLocation();
  const { navigate } = useRouter();

  return (
    <aside className="hidden md:flex fixed right-0 top-0 h-full w-28 bg-slate-900/95 backdrop-blur-sm border-l border-slate-800 flex-col z-50 transition-all">
      {/* Logo Area */}
      <div className="h-24 flex items-center justify-center border-b border-slate-800 mb-4">
        <div className="bg-gradient-to-tr from-cyan-500 to-blue-500 w-12 h-12 rounded-2xl shadow-lg shadow-cyan-500/20 flex items-center justify-center">
             <span className="font-black text-white text-sm">TSE</span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-4 flex flex-col items-center">
        {MENU_ITEMS.map((item) => {
          const isActive = !item.isExternal && location.pathname === item.path;
          
          return (
            <a
              key={item.label}
              href={item.path}
              target={item.isExternal ? "_blank" : undefined}
              onClick={(e) => { 
                  if (!item.isExternal) {
                      e.preventDefault(); 
                      navigate(item.path); 
                  }
              }}
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
         <span className="text-xs text-slate-600">v1.4</span>
      </div>
    </aside>
  );
}

function MobileHeader() {
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowHeader(false); // Scrolling down
      } else {
        setShowHeader(true); // Scrolling up
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
      <header 
        className={`md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 z-40 flex items-center justify-center px-4 transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="flex items-center gap-3">
           <div className="bg-gradient-to-tr from-cyan-500 to-blue-500 w-8 h-8 rounded-lg shadow-lg flex items-center justify-center">
             <span className="font-black text-white text-[10px]">TSE</span>
           </div>
           <span className="font-bold text-slate-200 text-lg">تحلیلگر بورس</span>
        </div>
      </header>
  );
}

function MobileBottomNav() {
  const location = useLocation();
  const { navigate } = useRouter();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-50 flex items-center justify-around px-2 pb-safe">
      {MENU_ITEMS.map((item) => {
          const isActive = !item.isExternal && location.pathname === item.path;
          return (
            <a
              key={item.label}
              href={item.path}
              target={item.isExternal ? "_blank" : undefined}
              onClick={(e) => { 
                  if (!item.isExternal) {
                      e.preventDefault(); 
                      navigate(item.path); 
                  }
              }}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                isActive ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`relative p-1 rounded-full ${isActive ? 'bg-cyan-500/10' : ''}`}>
                 <item.icon className={`w-5 h-5 ${isActive ? 'stroke-cyan-400' : ''}`} />
                 {isActive && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.6)]"></span>
                 )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-cyan-400' : ''}`}>{item.label}</span>
            </a>
          );
      })}
    </nav>
  );
}

export function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0b1121] text-slate-200 font-[Vazirmatn]">
        <Sidebar />
        <MobileHeader />
        
        {/* Main Content Area */}
        <main className="md:mr-28 mr-0 pt-20 pb-20 md:pt-8 md:pb-8 min-h-screen transition-all">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
             <Routes>
               <Route path="/" element={<HomePage />} />
               <Route path="/correlation" element={<CorrelationPage />} />
               <Route path="/technical" element={<RatioPage />} />
               <Route path="/portfolio" element={<PortfolioPage />} />
             </Routes>
          </div>
        </main>
        
        <MobileBottomNav />
      </div>
    </Router>
  );
}
