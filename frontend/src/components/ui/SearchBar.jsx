'use client';
import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import useAppStore from '@/store/useAppStore';
import { searchLines } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { getTransportType } from '@/lib/transportTypes';
import { useGetTransportLabel } from '@/hooks/useGetTransportLabel';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SearchBar() {
  const t = useTranslations('searchBar');
  const locale = useLocale();
  const getTransportLabel = useGetTransportLabel();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { setSelectedLine } = useAppStore();
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length > 1) {
      queueMicrotask(() => setLoading(true));
      searchLines(debouncedQuery).then(data => {
        setResults(data);
        setLoading(false);
      });
    } else {
      queueMicrotask(() => setResults([]));
    }
  }, [debouncedQuery]);

  const handleSelectLine = (lineData) => {
    const lineObject = {
      id: lineData.line_name,
      name: lineData.line_name,
      metadata: {
        transport_type_id: lineData.transport_type_id,
        road_type: lineData.road_type,
        line: lineData.line,
      }
    };
    setSelectedLine(lineObject);
    setResults([]);
    setQuery('');
  };

  const highlightMatch = (text, query) => {
    if (!query || !text) return text;

    // Locale-aware lowercasing matters for Turkish dotted İ/i.
    const casingLocale = locale === 'tr' ? 'tr-TR' : 'en-US';
    const normalizedQuery = query.toLocaleLowerCase(casingLocale);
    const normalizedText = text.toLocaleLowerCase(casingLocale);
    
    const index = normalizedText.indexOf(normalizedQuery);
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return (
      <>
        {before}
        <mark className="bg-primary/30 text-primary font-semibold">{match}</mark>
        {after}
      </>
    );
  };

  return (
    <div className="relative w-full h-14">
      <div className="flex items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a2332] px-5 h-14 shadow-[0_6px_20px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] focus-within:ring-2 focus-within:ring-primary/40 focus-within:shadow-[0_8px_24px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200">
         <Search className="h-5 w-5 text-secondary shrink-0" />
         <input 
           type="text"
           inputMode="text"
           value={query}
           onChange={(e) => setQuery(e.target.value)}
           placeholder={t('placeholder')} 
           className="min-w-0 flex-1 truncate bg-transparent text-base text-text outline-none placeholder:text-white/40" 
         />
         {query.length > 0 ? (
           <button
             type="button"
             onClick={() => {
               setQuery('');
               setResults([]);
             }}
             className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
             aria-label={t('clear')}
           >
             <X className="h-5 w-5" />
           </button>
         ) : null}
      </div>
      
      {(results.length > 0 || loading) && (
        <div className="absolute top-full mt-3 w-full max-h-[400px] overflow-y-auto overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1a2332] shadow-[0_12px_32px_rgba(0,0,0,0.5),0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)] z-50 scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-background/50">
          {loading && (
            <div className="p-4 space-y-3" aria-busy="true" aria-live="polite">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`search-skeleton-${index}`}
                  className="rounded-lg border border-white/5 bg-background/40 p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-3 w-5/6" />
                </div>
              ))}
              <span className="sr-only">{t('loading')}</span>
            </div>
          )}
          {!loading && results.map((result) => {
            const transportType = getTransportType(result.transport_type_id);
            
            return (
              <button 
                key={result.line_name}
                onClick={() => handleSelectLine(result)}
                className="flex w-full flex-col gap-2 border-b border-white/5 p-4 text-left hover:bg-white/5 last:border-0 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg text-primary">{result.line_name}</span>
                  <span 
                    className={`px-2 py-0.5 rounded text-xs font-medium border ${transportType.bgColor} ${transportType.textColor} ${transportType.borderColor}`}
                  >
                    {getTransportLabel(transportType.labelKey)}
                  </span>
                </div>
                <div className="text-sm text-gray-400 line-clamp-1">
                  {highlightMatch(result.line, debouncedQuery)}
                </div>
              </button>
            );
          })}
          {!loading && results.length === 0 && query.length > 1 && (
            <div className="p-4 text-center text-sm text-gray-400">
              {t('noResults', { query })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
