
import React, { useState, useEffect } from 'react';
import { LineChart, Zap, Home, Scale, Briefcase, Menu, X } from 'lucide-react';
import { HomePage } from './pages/HomePage';
import { CorrelationPage } from './pages/CorrelationPage';
import { SignalPage } from './pages/SignalPage';
import { RatioPage } from './pages/RatioPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { Router, Routes, Route, useLocation, useRouter } from './router';

// Menu Configuration
const MENU_ITEMS = [
  { path: '/', label: 'خانه', icon: Home },
  { path: '/correlation', label: 'همبستگی', icon: LineChart },
  { path: '/ratio', label: 'نسبت', icon: Scale },
  { path: '/portfolio', label: 'سبد دارایی', icon: Briefcase },
  { path: '/signal', label: 'سیگنال', icon: Zap },
];

function DesktopSidebar() {
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
         <span className="text-xs text-slate-600">v1.3</span>
      </div>
    </aside>
  );
}

function MobileHeader({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Get Current Page Title
  const currentItem = MENU_ITEMS.find(item => item.path === location.pathname);
  const title = currentItem ? currentItem.label : 'تحلیلگر بورس';

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If menu is open, don't hide the header
      if (isOpen) {
        setIsVisible(true);
        return;
      }

      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling Down
        setIsVisible(false);
      } else {
        // Scrolling Up
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isOpen]);

  return (
    <>
      {/* Mobile Header Bar */}
      <header 
        className={`md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 h-16 px-4 flex items-center justify-between transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="text-lg font-bold text-white">{title}</h1>
        </div>

        <div className="bg-gradient-to-tr from-cyan-500 to-blue-500 w-8 h-8 rounded-lg shadow-lg flex items-center justify-center">
             <span className="font-black text-white text-[10px]">TSE</span>
        </div>
      </header>

      {/* Mobile Full Screen Menu Overlay */}
      <div className={`md:hidden fixed inset-0 z-40 bg-slate-900 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
        <div className="pt-24 px-6 flex flex-col gap-4 h-full overflow-y-auto pb-10">
           {MENU_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              const { navigate } = useRouter();
              
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => { 
                    e.preventDefault(); 
                    navigate(item.path);
                    setIsOpen(false); 
                  }}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                   <item.icon className={`w-6 h-6 ${isActive ? 'text-cyan-400' : ''}`} />
                   <span className="text-lg font-bold">{item.label}</span>
                   {isActive && <div className="mr-auto w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>}
                </a>
              );
           })}
           
           <div className="mt-auto pt-8 border-t border-slate-800 text-center text-slate-600 text-sm">
             نسخه ۱.۳
           </div>
        </div>
      </div>
    </>
  );
}

export function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <Router>
      <div className="min-h-screen bg-[#0b1121] text-slate-200 font-[Vazirmatn]">
        {/* Desktop Navigation */}
        <DesktopSidebar />
        
        {/* Mobile Navigation */}
        <MobileHeader isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />
        
        {/* Main Content Area */}
        <main className={`md:mr-28 min-h-screen transition-all duration-300 ${isMobileMenuOpen ? 'blur-sm md:blur-0' : ''}`}>
          {/* Added top padding for mobile to account for the header */}
          <div className="pt-20 md:pt-8 p-4 md:p-8 max-w-7xl mx-auto">
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
