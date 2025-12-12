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
    <Link href={href} className={cn(
      "flex flex-col items-center justify-center space-y-1 transition-colors w-full h-full",
      isActive ? "text-primary" : "text-gray-500 hover:text-text"
    )}>
      <Icon className="h-6 w-6" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const { closePanel } = useAppStore();
  
  useEffect(() => {
    closePanel();
  }, [pathname, closePanel]);
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1000] border-t border-white/10 bg-surface pb-safe shadow-lg">
       <nav className="mx-auto flex h-16 max-w-md items-center justify-around">
         <NavItem href="/" icon={Map} label={t('map')} />
         <NavItem href="/forecast" icon={Star} label={t('favorites')} />
         <NavItem href="/settings" icon={Settings} label={t('settings')} />
       </nav>
     </div>
  );
}
