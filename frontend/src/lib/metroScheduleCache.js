/**
 * Metro Schedule LocalStorage Cache
 * 
 * Strategy: Stale-While-Revalidate with 24h TTL
 * - Instantly return cached data if available
 * - Fetch fresh data in background
 * - Cache expires at 04:00 daily (before metro service starts)
 */

const CACHE_PREFIX = 'metro_schedule_';
const CACHE_VERSION = 'v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate cache key for a metro schedule request
 */
function getCacheKey(stationId, directionId) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${CACHE_PREFIX}${CACHE_VERSION}_${stationId}_${directionId}_${today}`;
}

/**
 * Get cache expiry time (04:00 next day)
 */
function getExpiryTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(4, 0, 0, 0); // 04:00 tomorrow
  return tomorrow.getTime();
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.data || !cacheEntry.expiresAt) {
    return false;
  }
  
  const now = Date.now();
  return now < cacheEntry.expiresAt;
}

/**
 * Get cached schedule
 */
export function getCachedSchedule(stationId, directionId) {
  try {
    const key = getCacheKey(stationId, directionId);
    const cached = localStorage.getItem(key);
    
    if (!cached) return null;
    
    const parsed = JSON.parse(cached);
    
    if (!isCacheValid(parsed)) {
      // Expired - remove it
      localStorage.removeItem(key);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Set cached schedule
 */
export function setCachedSchedule(stationId, directionId, data) {
  try {
    const key = getCacheKey(stationId, directionId);
    const expiresAt = getExpiryTime();
    
    const cacheEntry = {
      data,
      cachedAt: Date.now(),
      expiresAt,
      version: CACHE_VERSION
    };
    
    localStorage.setItem(key, JSON.stringify(cacheEntry));
    
    // Cleanup old cache entries (prevent storage bloat)
    cleanupOldCache();
  } catch (error) {
    // LocalStorage quota exceeded or other error
    console.warn('Cache write error:', error);
    
    // Try to free up space by clearing old entries
    if (error.name === 'QuotaExceededError') {
      cleanupOldCache();
      // Retry once
      try {
        localStorage.setItem(key, JSON.stringify({
          data,
          cachedAt: Date.now(),
          expiresAt: getExpiryTime(),
          version: CACHE_VERSION
        }));
      } catch (retryError) {
        console.error('Cache write failed after cleanup:', retryError);
      }
    }
  }
}

/**
 * Cleanup expired cache entries
 */
export function cleanupOldCache() {
  try {
    const now = Date.now();
    const keysToRemove = [];
    
    // Find all metro schedule cache keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const cached = localStorage.getItem(key);
          const parsed = JSON.parse(cached);
          
          // Remove if expired or old version
          if (!isCacheValid(parsed) || parsed.version !== CACHE_VERSION) {
            keysToRemove.push(key);
          }
        } catch (error) {
          // Invalid JSON - remove it
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove expired entries
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (keysToRemove.length > 0) {
      console.log(`Cleaned up ${keysToRemove.length} expired metro schedule cache entries`);
    }
  } catch (error) {
    console.warn('Cache cleanup error:', error);
  }
}

/**
 * Clear all metro schedule cache
 */
export function clearMetroScheduleCache() {
  try {
    const keysToRemove = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`Cleared ${keysToRemove.length} metro schedule cache entries`);
  } catch (error) {
    console.warn('Cache clear error:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  try {
    let count = 0;
    let totalSize = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        count++;
        const value = localStorage.getItem(key);
        totalSize += new Blob([value]).size;
      }
    }
    
    return {
      entries: count,
      sizeKB: (totalSize / 1024).toFixed(2),
      sizeMB: (totalSize / (1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.warn('Cache stats error:', error);
    return { entries: 0, sizeKB: 0, sizeMB: 0 };
  }
}
