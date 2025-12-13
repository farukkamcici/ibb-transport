'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@/lib/api';
import { Bug, TrendingDown, Lightbulb, Send, CheckCircle, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

const REPORT_TYPES = [
  { value: 'bug', labelKey: 'reportTypes.bug', icon: Bug, color: 'text-red-400' },
  { value: 'data', labelKey: 'reportTypes.data', icon: TrendingDown, color: 'text-orange-400' },
  { value: 'feature', labelKey: 'reportTypes.feature', icon: Lightbulb, color: 'text-yellow-400' }
];

export default function ReportForm({ onClose }) {
  const t = useTranslations('settings');
  const [formData, setFormData] = useState({
    report_type: 'bug',
    line_code: '',
    description: '',
    contact_email: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.description.length < 10) {
      setError(t('validation.descriptionMin', { min: 10 }));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        report_type: formData.report_type,
        description: formData.description,
        ...(formData.line_code && { line_code: formData.line_code }),
        ...(formData.contact_email && { contact_email: formData.contact_email })
      };

      await apiClient.post('/reports', payload);
      
      setIsSuccess(true);
      
      setTimeout(() => {
        onClose?.();
      }, 2000);
      
    } catch (err) {
      console.error('Error submitting report:', err);
      setError(err.response?.data?.detail || t('reportSubmitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-surface rounded-2xl border border-white/10 p-6 max-w-md w-full text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            {t('reportSuccess')}
          </h3>
          <p className="text-gray-400 text-sm">
            {t('reportSuccessMessage')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl border border-white/10 p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">
            {t('reportIssue')}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('reportType')} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, report_type: type.value })}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                    formData.report_type === type.value
                      ? "bg-primary/20 border-primary text-white"
                      : "bg-background border-white/10 text-gray-400 hover:bg-white/5"
                  )}
                >
                  <type.icon size={20} className={formData.report_type === type.value ? type.color : ''} />
                  <span className="text-xs font-medium">{t(type.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="line_code" className="block text-sm font-medium text-gray-300 mb-2">
              {t('lineCode')} ({t('optional')})
            </label>
            <input
              id="line_code"
              type="text"
              placeholder={t('lineCodePlaceholder')}
              value={formData.line_code}
              onChange={(e) => setFormData({ ...formData, line_code: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary transition-colors"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              {t('description')} *
            </label>
            <textarea
              id="description"
              rows={5}
              placeholder={t('descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary transition-colors resize-none"
              required
              minLength={10}
              maxLength={2000}
              disabled={isSubmitting}
            />
            <div className="text-xs text-gray-500 mt-1 text-right">
              {formData.description.length}/2000
            </div>
          </div>

          <div>
            <label htmlFor="contact_email" className="block text-sm font-medium text-gray-300 mb-2">
              {t('email')} ({t('optional')})
            </label>
            <input
              id="contact_email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:border-primary transition-colors"
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('emailNote')}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-background border border-white/10 text-gray-400 hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || formData.description.length < 10}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Skeleton className="h-4 w-24 bg-white/20" />
                  <span className="sr-only">{t('submitting')}</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  {t('submit')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
