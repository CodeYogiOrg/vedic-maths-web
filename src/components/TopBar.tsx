import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Brain, Calculator, Camera, Video, User, Info, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { path: '/learn', icon: BookOpen, labelEn: 'Learn', labelHi: 'सीखें' },
  { path: '/practice', icon: Brain, labelEn: 'Practice', labelHi: 'अभ्यास' },
  { path: '/abacus', icon: Calculator, labelEn: 'Abacus', labelHi: 'अबेकस' },
  { path: '/solver', icon: Camera, labelEn: 'Solver', labelHi: 'सॉल्वर' },
  { path: '/videos', icon: Video, labelEn: 'Videos', labelHi: 'वीडियो' },
  { path: '/about', icon: Info, labelEn: 'About', labelHi: 'हमारे बारे में' },
  { path: '/profile', icon: User, labelEn: 'Profile', labelHi: 'प्रोफाइल' },
];

const TopBar = () => {
  const { t } = useLanguage();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-[70px]">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src="/brand_logo.png" alt="Logo" className="h-[44px] w-auto object-contain" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all duration-200 ${isActive ? 'gradient-primary text-primary-foreground shadow-warm scale-105' : 'text-muted-foreground hover:text-foreground hover:bg-primary/10 hover:scale-105 hover:shadow-warm'}`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {t(item.labelEn, item.labelHi)}
              </Link>
            );
          })}
        </nav>

        {/* Mobile menu button */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-1.5 rounded-lg bg-muted">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav Dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border bg-card overflow-hidden"
          >
            <div className="max-w-7xl mx-auto p-3 grid grid-cols-3 gap-2">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl text-center transition-all duration-200 ${isActive ? 'gradient-primary text-primary-foreground shadow-warm' : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary hover:scale-105'}`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-display font-bold">{t(item.labelEn, item.labelHi)}</span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default TopBar;
