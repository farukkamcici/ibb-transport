'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import useAppStore from '@/store/useAppStore';
import { searchLines } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { getTransportType } from '@/lib/transportTypes';
import { useGetTransportLabel } from '@/hooks/useGetTransportLabel';

export default function SearchBar() {
  const t = useTranslations('searchBar');
  const getTransportLabel = useGetTransportLabel();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { setSelectedLine } = useAppStore();
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery.length > 1) {
      setLoading(true);
      searchLines(debouncedQuery).then(data => {
        setResults(data);
        setLoading(false);
      });
    } else {
      setResults([]);
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
    
    const normalizedQuery = query.toLocaleLowerCase('tr-TR');
    const normalizedText = text.toLocaleLowerCase('tr-TR');
    
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
    <div className="relative w-full h-12">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface/90 px-3 h-12 shadow-lg backdrop-blur-md">
         <Search className="h-4 w-4 text-secondary shrink-0" />
         <input 
           type="text" 
           inputMode="numeric"
           pattern="[0-9]*"
           value={query}
           onChange={(e) => setQuery(e.target.value)}
           placeholder={t('placeholder')} 
           className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-gray-500" 
         />
      </div>
      
      {(results.length > 0 || loading) && (
        <div className="absolute top-full mt-2 w-full max-h-[400px] overflow-y-auto overflow-hidden rounded-xl border border-white/10 bg-surface shadow-xl z-50">
          {loading && <div className="p-4 text-center text-sm text-gray-400">{t('loading')}</div>}
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