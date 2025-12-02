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
      alert(t('noFavorites', { defaultValue: 'No favorites to clear' }));
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
      alert(t('favoritesCleared', { defaultValue: 'Favorites cleared successfully!' }));
      window.location.reload();
    } catch (error) {
      console.error('Error clearing favorites:', error);
      alert(t('errorClearing', { defaultValue: 'Failed to clear favorites' }));
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
      alert(t('errorResetting', { defaultValue: 'Failed to reset application' }));
    }
  };

  return (
    <>
      <main className="relative flex min-h-screen flex-col bg-background pb-20 font-sans text-text">
        <div className="p-6 pt-12">
          <h1 className="text-2xl font-bold text-primary">{t('title')}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {t('subtitle', { defaultValue: 'Customize your experience' })}
          </p>
        </div>

        <SettingSection
          title={t('preferences', { defaultValue: 'Preferences' })}
          description={t('preferencesDesc', { defaultValue: 'Language and display settings' })}
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
            description={t('themeDesc', { defaultValue: 'Currently dark theme only' })}
          />
        </SettingSection>

        <SettingSection
          title={t('dataStorage', { defaultValue: 'Data & Storage' })}
          description={t('dataStorageDesc', { defaultValue: 'Manage your local data' })}
          icon={Database}
        >
          <SettingItem
            icon={Star}
            label={t('clearFavorites', { defaultValue: 'Clear Favorites' })}
            description={`${favorites.length} ${t('savedLines', { defaultValue: 'saved lines' })}`}
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
            label={t('resetApp', { defaultValue: 'Reset Application' })}
            description={t('resetAppDesc', { defaultValue: 'Clear all caches and reload' })}
            danger
            action={
              <button
                onClick={handleResetApp}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
              >
                {t('reset', { defaultValue: 'Reset' })}
              </button>
            }
          />
        </SettingSection>

        <SettingSection
          title={t('supportFeedback', { defaultValue: 'Support & Feedback' })}
          description={t('supportDesc', { defaultValue: 'Help us improve' })}
          icon={MessageSquare}
        >
          <SettingItem
            icon={Heart}
            label={t('aboutProject', { defaultValue: 'About This Project' })}
            description={t('aboutDesc', { defaultValue: 'AI-powered crowding predictions for Istanbul public transport' })}
          />
          <SettingItem
            icon={MessageSquare}
            label={t('reportIssue', { defaultValue: 'Report an Issue' })}
            description={t('reportDesc', { defaultValue: 'Bug reports, data errors, feature requests' })}
            action={
              <button
                onClick={() => setShowReportForm(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                {t('report', { defaultValue: 'Report' })}
              </button>
            }
          />
          <SettingItem
            icon={Shield}
            label={t('dataSource', { defaultValue: 'Data Source' })}
            value="IBB Open Data"
          />
          <SettingItem
            icon={Info}
            label={t('version', { defaultValue: 'Version' })}
            value="v1.0.0 (MVP)"
          />
        </SettingSection>

        <div className="mt-4 px-6 text-center pb-6">
          <p className="text-xs text-gray-500">
            {t('footer', { defaultValue: 'Istanbul Transport Prediction Platform' })}<br/>
            {t('footerTagline', { defaultValue: 'Designed for smoother commutes.' })}
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
                ? t('confirmClearFavorites', { defaultValue: 'Clear All Favorites?' })
                : t('confirmResetApp', { defaultValue: 'Reset Application?' })
              }
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              {showConfirm === 'favorites'
                ? t('confirmClearFavoritesDesc', { defaultValue: 'This will remove all saved favorites. This action cannot be undone.' })
                : t('confirmResetAppDesc', { defaultValue: 'This will clear all local data and reload the page. This action cannot be undone.' })
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-background border border-white/10 text-gray-400 hover:bg-white/5 transition-colors"
              >
                {t('cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                onClick={showConfirm === 'favorites' ? confirmClearFavorites : confirmResetApp}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                {t('confirm', { defaultValue: 'Confirm' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
