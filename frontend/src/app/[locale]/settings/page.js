'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import BottomNav from '@/components/ui/BottomNav';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import ReportForm from '@/components/settings/ReportForm';
import useAppStore from '@/store/useAppStore';
import { 
  Globe, 
  Moon, 
  Database, 
  Trash2, 
  RefreshCw, 
  MessageSquare, 
  Info, 
  Star,
  Shield,
  Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';

function SettingSection({ title, description, icon: Icon, children }) {
  return (
    <div className="mx-4 mb-4 overflow-hidden rounded-2xl bg-surface border border-white/5">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-white">{title}</h2>
            {description && (
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

function SettingItem({ icon: Icon, label, description, value, action, danger }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Icon size={18} className={cn("shrink-0", danger ? "text-red-400" : "text-secondary")} />
        <div className="min-w-0">
          <div className={cn("font-medium", danger ? "text-red-400" : "text-white")}>{label}</div>
          {description && (
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {value && <span className="text-sm text-gray-400 ml-2">{value}</span>}
      {action}
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const [showReportForm, setShowReportForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(null);
  const favorites = useAppStore((state) => state.favorites);

  const handleClearFavorites = () => {
    if (favorites.length === 0) {
      alert(t('noFavorites'));
      return;
    }
    
    setShowConfirm('favorites');
  };

  const handleResetApp = () => {
    setShowConfirm('reset');
  };

  const confirmClearFavorites = () => {
    try {
      localStorage.removeItem('ibb-transport-storage');
      useAppStore.persist.clearStorage();
      setShowConfirm(null);
      alert(t('favoritesCleared'));
      window.location.reload();
    } catch (error) {
      console.error('Error clearing favorites:', error);
      alert(t('errorClearing'));
    }
  };

  const confirmResetApp = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
          });
        });
      }
      
      setShowConfirm(null);
      window.location.reload();
    } catch (error) {
      console.error('Error resetting app:', error);
      alert(t('errorResetting'));
    }
  };

  return (
    <>
      <main className="relative flex min-h-screen flex-col bg-background pb-20 font-sans text-text">
        <div className="p-6 pt-12">
          <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('subtitle')}
          </p>
        </div>

        <SettingSection
          title={t('preferences')}
          description={t('preferencesDesc')}
          icon={Globe}
        >
          <SettingItem
            icon={Globe}
            label={t('language')}
            action={<LanguageSwitcher />}
          />
          <SettingItem
            icon={Moon}
            label={t('theme')}
            value="Dark"
            description={t('themeDesc')}
          />
        </SettingSection>

        <SettingSection
          title={t('dataStorage')}
          description={t('dataStorageDesc')}
          icon={Database}
        >
          <SettingItem
            icon={Star}
            label={t('clearFavorites')}
            description={`${favorites.length} ${t('savedLines')}`}
            action={
              <button
                onClick={handleClearFavorites}
                disabled={favorites.length === 0}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  favorites.length === 0
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-background border border-white/10 text-gray-400 hover:bg-white/5"
                )}
              >
                <Trash2 size={14} />
              </button>
            }
          />
          <SettingItem
            icon={RefreshCw}
            label={t('resetApp')}
            description={t('resetAppDesc')}
            danger
            action={
              <button
                onClick={handleResetApp}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                {t('reset')}
              </button>
            }
          />
        </SettingSection>

        <SettingSection
          title={t('supportFeedback')}
          description={t('supportDesc')}
          icon={MessageSquare}
        >
          <SettingItem
            icon={Heart}
            label={t('aboutProject')}
            description={t('aboutDesc')}
          />
          <SettingItem
            icon={MessageSquare}
            label={t('reportIssue')}
            description={t('reportDesc')}
            action={
              <button
                onClick={() => setShowReportForm(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                {t('report')}
              </button>
            }
          />
          <SettingItem
            icon={Shield}
            label={t('dataSource')}
            value="IBB Open Data"
          />
          <SettingItem
            icon={Info}
            label={t('version')}
            value="v1.0.0 (MVP)"
          />
        </SettingSection>

        <div className="mt-4 px-6 text-center pb-6">
          <p className="text-xs text-gray-500">
            {t('footer')}<br/>
            {t('footerTagline')}
          </p>
        </div>

        <BottomNav />
      </main>

      {showReportForm && (
        <ReportForm onClose={() => setShowReportForm(false)} />
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-2xl border border-white/10 p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white mb-2">
              {showConfirm === 'favorites' 
                ? t('confirmClearFavorites')
                : t('confirmResetApp')
              }
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {showConfirm === 'favorites'
                ? t('confirmClearFavoritesDesc')
                : t('confirmResetAppDesc')
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-background border border-white/10 text-gray-400 hover:bg-white/5 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={showConfirm === 'favorites' ? confirmClearFavorites : confirmResetApp}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
