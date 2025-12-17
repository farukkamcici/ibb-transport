'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { usePathname } from '@/i18n/routing';
import { Map, Star, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import useAppStore from '@/store/useAppStore';

function NavItem({ href, icon: Icon, label }) {
  const pathname = usePathname();
  // Active if pathname matches href exactly OR if it's root and href is root
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  
  return (
    <Link 
      href={href} 
      className="flex flex-1 flex-col items-center justify-center gap-1.5 py-2 relative group"
    >
      <div className="relative flex items-center justify-center">
        <Icon 
          className={cn(
            "h-[22px] w-[22px] transition-all duration-200 ease-out",
            isActive 
              ? "text-primary stroke-[2]" 
              : "text-white/50 stroke-[1.5] group-hover:text-white/70"
          )} 
          strokeWidth={isActive ? 2 : 1.5}
        />
        {isActive && (
          <div className="absolute -bottom-1 h-[2px] w-5 bg-primary rounded-full" />
        )}
      </div>
      <span className={cn(
        "text-[11px] font-medium tracking-wide transition-colors duration-200",
        isActive ? "text-text" : "text-white/40 group-hover:text-white/60"
      )}>
        {label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const { closePanel } = useAppStore();
  
  useEffect(() => {
    // Only close panel when navigating to settings or admin pages
    const normalized = (() => {
      const parts = (pathname || '').split('/').filter(Boolean);
      const routeParts = parts.slice(1);
      return routeParts.length ? `/${routeParts.join('/')}` : '/';
    })();

    if (normalized.startsWith('/settings') || normalized.startsWith('/admin')) {
      closePanel();
    }
    // Panel stays open when switching between Map and Favorites tabs
  }, [pathname, closePanel]);
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1000] pointer-events-none pb-safe">
      {/* Blur & occlusion layer - only affects nav footprint */}
      <div className="absolute inset-x-0 bottom-0 h-[88px] pb-safe">
        <div className="absolute inset-0 backdrop-blur-xl" />
      </div>
      
      {/* Floating nav container */}
      <div className="relative mx-auto max-w-md px-4 pb-2 pointer-events-auto">
        <nav className="flex items-center h-[68px] rounded-[24px] border border-white/[0.08] bg-[#0f172a] shadow-[0_6px_20px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] transition-shadow duration-200">
          <NavItem href="/" icon={Map} label={t('map')} />
          <div className="h-8 w-px bg-white/[0.06]" />
          <NavItem href="/forecast" icon={Star} label={t('favorites')} />
          <div className="h-8 w-px bg-white/[0.06]" />
          <NavItem href="/settings" icon={Settings} label={t('settings')} />
        </nav>
      </div>
    </div>
  );
}
