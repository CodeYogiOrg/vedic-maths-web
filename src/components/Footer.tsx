import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Heart, BookOpen, Brain, Calculator, Camera, Video, Mail } from 'lucide-react';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-card border-t border-border mt-8">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Top section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src="/brand_logo.png" alt="Logo" className="h-[62px] w-auto object-contain" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t(
                'Master mental math with Vedic techniques. Learn, practice & become a math genius!',
                'वैदिक तकनीकों से मानसिक गणित में महारत हासिल करें!'
              )}
            </p>
          </div>

          {/* Features */}
          <div>
            <h4 className="font-display font-bold text-sm mb-3 text-foreground">{t('Features', 'सुविधाएं')}</h4>
            <ul className="space-y-2">
              <li><Link to="/learn" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><BookOpen className="w-3 h-3" />{t('Learn', 'सीखें')}</Link></li>
              <li><Link to="/practice" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><Brain className="w-3 h-3" />{t('Practice', 'अभ्यास')}</Link></li>
              <li><Link to="/abacus" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><Calculator className="w-3 h-3" />{t('Abacus', 'अबेकस')}</Link></li>
              <li><Link to="/solver" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><Camera className="w-3 h-3" />{t('Photo Solver', 'फोटो सॉल्वर')}</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-display font-bold text-sm mb-3 text-foreground">{t('Resources', 'संसाधन')}</h4>
            <ul className="space-y-2">
              <li><Link to="/videos" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><Video className="w-3 h-3" />{t('Video Lessons', 'वीडियो पाठ')}</Link></li>
              <li><Link to="/learn" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><BookOpen className="w-3 h-3" />{t('Vedic Sutras', 'वैदिक सूत्र')}</Link></li>
              <li><Link to="/about" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><BookOpen className="w-3 h-3" />{t('About Us', 'हमारे बारे में')}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-sm mb-3 text-foreground">{t('Contact', 'संपर्क')}</h4>
            <ul className="space-y-2">
              <li><a href="mailto:support@mathgenius.app" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"><Mail className="w-3 h-3" />Email</a></li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mb-4" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} MathGenius. {t('All rights reserved.', 'सर्वाधिकार सुरक्षित।')}
          </p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            {t('Made with', 'बनाया गया')} <Heart className="w-3 h-3 text-primary fill-primary" /> {t('for young mathematicians', 'युवा गणितज्ञों के लिए')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
