# Metro Schedule Cache Strategy

## Problem
Metro Istanbul API is slow (1-3 seconds) and sometimes times out, causing poor UX.

## Solution
**Remote Prefetch + LocalStorage Stale-While-Revalidate**

As of this change the backend now pre-fetches every metro timetable once per day
and stores the raw `GetTimeTable` payloads inside the `metro_schedules` table in
Postgres. An APScheduler cron job (`metro_schedule_prefetch`) runs at 03:15
(Europe/Istanbul), iterates over all station/direction pairs defined in
`metro_topology.json`, fetches the data from Metro İstanbul, and persists it with
the target service date. Failed pairs are automatically retried every 30 minutes
until a healthy response is stored, and stale rows older than five days are
purged.

The API endpoint (`POST /metro/schedule`) now serves data from this cache first
and only falls back to the upstream API when a cache miss occurs. This keeps the
runtime API fast and shields the UI from upstream outages. The frontend
LocalStorage cache described below still applies and now builds on top of the
server-side snapshot.

### Cache Behavior

#### First Request (Cache Miss)
```
User Action → Check Cache (miss) → Show Loading → API Call → Save to Cache → Display
Time: 1-3 seconds (API latency)
```

#### Subsequent Requests (Cache Hit)
```
User Action → Check Cache (hit) → Display Instantly → Background API Call → Update Cache
Time: 0ms (instant from localStorage)
```

#### Cache Expiry
- **TTL**: 24 hours
- **Expiry Time**: 04:00 next day (before metro service starts)
- **Auto Cleanup**: Removes expired entries on next read/write

### Technical Implementation

#### Cache Key Format
```javascript
metro_schedule_v1_{stationId}_{directionId}_{YYYY-MM-DD}
```

Example: `metro_schedule_v1_123_456_2025-12-11`

#### Storage Structure
```json
{
  "data": { /* Full Metro API Response */ },
  "cachedAt": 1733934000000,
  "expiresAt": 1734048000000,
  "version": "v1"
}
```

#### Cache Size Analysis
- **Single Entry**: ~5-10 KB
- **Typical User**: 5-10 favorite lines = 50-100 KB
- **Heavy User**: 20 lines × 20 stations × 2 directions = ~2 MB
- **LocalStorage Limit**: 5-10 MB
- **Conclusion**: ✅ No storage issues

### Edge Cases Handled

#### 1. API Timeout with Cache
```javascript
// Cache exists → Show cached data instantly
// API times out → Keep using cache, log warning
// User sees: Instant load, no error
```

#### 2. API Timeout without Cache
```javascript
// Cache doesn't exist → Show loading
// API times out → Show error message
// User sees: Error state
```

#### 3. Quota Exceeded
```javascript
// Write fails → Cleanup old entries
// Retry write once
// If still fails → Log error, continue without cache
```

#### 4. Corrupted Cache
```javascript
// JSON.parse fails → Remove corrupted entry
// Fetch fresh data
```

#### 5. Version Change
```javascript
// Cache version !== current version
// Auto-cleanup removes old version entries
```

### API Integration

#### MetroScheduleWidget.jsx
```javascript
useEffect(() => {
  // Step 1: Check cache (instant)
  const cached = getCachedSchedule(stationId, directionId);
  if (cached) {
    setSchedule(cached); // 0ms
    setLoading(false);
  } else {
    setLoading(true);
  }

  // Step 2: Fetch fresh data (background if cached)
  const data = await fetch(...);
  
  // Step 3: Update cache
  setCachedSchedule(stationId, directionId, data);
}, [stationId, directionId]);
```

#### MetroScheduleModal.jsx
Same implementation - both components share cache.

### Performance Impact

| Scenario | Before Cache | After Cache (Hit) | Improvement |
|----------|--------------|-------------------|-------------|
| First Load | 1-3s | 1-3s | - |
| Second Load | 1-3s | 0ms | **∞ faster** |
| API Timeout | Error | Instant (cached) | **100% uptime** |

### Cache Management

#### Manual Cache Clear (Console)
```javascript
import { clearMetroScheduleCache } from '@/lib/metroScheduleCache';
clearMetroScheduleCache();
```

#### Get Cache Stats (Console)
```javascript
import { getCacheStats } from '@/lib/metroScheduleCache';
console.log(getCacheStats());
// { entries: 12, sizeKB: "58.34", sizeMB: "0.06" }
```

#### Force Refresh (User Action)
Currently not implemented. Future enhancement:
- Add "refresh" button in MetroScheduleModal
- Manually trigger cache invalidation

### Benefits

✅ **Instant Loading**: 0ms for cached schedules  
✅ **Offline Resilience**: Works when API is down  
✅ **Reduced Server Load**: Less API calls  
✅ **Better UX**: No timeout errors for cached data  
✅ **Auto Cleanup**: No manual maintenance needed  

### Trade-offs

⚠️ **Stale Data Risk**: Max 24h old (acceptable for metro schedules)  
⚠️ **Storage Usage**: ~50-100 KB per user (negligible)  
⚠️ **Background Updates**: Fetches even when cached (good for freshness)

### Future Enhancements

1. **Service Worker Cache**: For true offline support
2. **Cache Warming**: Pre-fetch popular routes
3. **Cache Analytics**: Track hit/miss rates
4. **Manual Refresh**: User-triggered cache invalidation
5. **Cache Version Migration**: Smooth upgrades when schema changes

### Testing

#### Test Cache Hit
```javascript
// 1. Open Metro M1
// 2. Select station/direction
// 3. Wait for load
// 4. Close panel
// 5. Reopen same station/direction
// Expected: Instant load (0ms)
```

#### Test Cache Miss
```javascript
// 1. Clear localStorage
// 2. Open Metro M1
// Expected: Loading spinner, 1-3s wait
```

#### Test API Timeout with Cache
```javascript
// 1. Load schedule once (cache it)
// 2. Disconnect internet
// 3. Reopen same schedule
// Expected: Instant load from cache, warning in console
```

### Monitoring

Check cache effectiveness:
```javascript
// In browser console after using metro schedule
import { getCacheStats } from '@/lib/metroScheduleCache';
const stats = getCacheStats();
console.log(`Cache: ${stats.entries} entries, ${stats.sizeKB} KB`);
```

## Backend Prefetch Pipeline Summary

- **Persistent cache**: Postgres table `metro_schedules` stores raw Metro API payloads per `(station_id, direction_id, valid_for)` with metadata (line code, fetch status, error message).
- **Cron jobs**: `metro_schedule_prefetch` seeds the table daily at 03:15 (Europe/Istanbul). `metro_schedule_retry` automatically reruns every 30 minutes for pairs that previously failed until they succeed or hit the attempt cap. Entries older than five days are deleted after each run.
- **API fallback**: `/metro/schedule` responds from the cache first, then attempts a live fetch and stores the result. If the upstream request fails it falls back to the latest stored day (up to 7 days old) so the UI keeps working without exposing errors to users.
- **Admin controls**: New endpoints (`/admin/metro/cache/status`, `/admin/metro/cache/refresh`, `/admin/metro/cache/cleanup`) power the admin panel, enabling operators to monitor freshness, view pending pairs, trigger manual refreshes (all or per station) and purge historical rows on demand.

---

**Author**: Cache System  
**Date**: 2025-12-11  
**Status**: ✅ Implemented
