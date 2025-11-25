'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import useAppStore from '@/store/useAppStore';
import { searchLines } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { setSelectedLine } = useAppStore();
  const router = useRouter();
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

  const handleSelectLine = (lineName) => {
    // The dummy data had an object, but the new API just returns names.
    // We'll create a mock line object for now.
    // TODO: The search endpoint should ideally return more info (id, name, type).
    const lineObject = { id: lineName, name: lineName };
    setSelectedLine(lineObject);
    setResults([]);
    setQuery('');
    router.push('/forecast');
  };

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-surface/90 p-3 shadow-lg backdrop-blur-md">
         <Search className="ml-1 h-5 w-5 text-secondary" />
         <input 
           type="text" 
           value={query}
           onChange={(e) => setQuery(e.target.value)}
           placeholder="Search line (e.g., M2, 500T)" 
           className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-gray-500" 
         />
      </div>
      
      {/* Dropdown Results */}
      {(results.length > 0 || loading) && (
        <div className="absolute top-full mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-surface shadow-xl">
          {loading && <div className="p-4 text-center text-sm text-gray-400">Loading...</div>}
          {!loading && results.map(lineName => (
            <button 
              key={lineName}
              onClick={() => handleSelectLine(lineName)}
              className="flex w-full items-center justify-between border-b border-white/5 p-4 text-left text-text hover:bg-white/5 last:border-0"
            >
              <span className="font-bold text-primary">{lineName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
