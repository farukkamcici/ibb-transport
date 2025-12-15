# Project Logbook

_Last updated: 2025-12-15_

## Entry · 2025-12-15 23:40 (+03)

### Commit
- **Hash:** `dafecd0de466b7d18babc7806e453b4de2cd3e36`
- **Message:** `fix marmaray service hours with hardcode`

### Summary
- Implemented hardcoded service hours (06:00-00:00 with midnight wrap) for MARMARAY line to fix "Out of Service" prediction issues caused by missing schedule data.

### Details
- Added special-case handling in `forecast.py::_get_service_hours()` to return hardcoded service window for MARMARAY with `wraps_midnight: True`.
- Updated `status_service.py` with MARMARAY-specific operation check using same service hours and wrap-midnight logic.
- Frontend already had Marmaray-specific bypasses to show empty schedule state and force 24h chart display.

### Notes
- Eliminates "No schedule payload for MARMARAY; assuming active" warnings in logs.
- Hours 0 (midnight) now correctly marked as in-service; hours 1-5 marked as out-of-service.

## Entry · 2025-12-15 23:34 (+03)

### Commit
- **Hash:** `397852c65f25432c5bae793273f8e7b777ee451d`
- **Message:** `refactor SearchBar.jsx section`

### Summary
- Major UI/UX refactor: extracted SearchBar and weather from individual pages into a reusable MapTopBar component, added panel state management, and redesigned Settings/Forecast pages.

### Details
- Created `MapTopBar.jsx` combining SearchBar + Nowcast for consistent header across Map and Forecast pages.
- Added `PageHeader.jsx` component for Settings page with locale-aware layout.
- Introduced `isPanelMinimized` state in Zustand store separate from `isPanelOpen` for better panel collapse control.
- Redesigned Settings page with improved section organization and spacing.
- Updated Forecast page layout to use MapTopBar with favorited lines grid.

### Notes
- This refactor improves code reusability and provides consistent navigation/search experience across pages.

## Entry · 2025-12-15 18:16 (+03)

### Commit
- **Hash:** `e644927f4ef763bdb9ee470579596e5dbe602523`
- **Message:** `handle marmaray errors`

### Summary
- Implemented Marmaray-specific bypasses in frontend to handle missing schedule data gracefully.

### Details
- `ScheduleWidget.jsx`: Added Marmaray check before metro/ferry checks to show custom empty state ("Tarife bilgisi mevcut değil").
- `ScheduleModal.jsx`: Added early return to prevent modal from opening for Marmaray.
- `LineDetailPanel.jsx`: Added `isMarmaray` flag to force 24h chart display even without schedule data, bypassing `hasAnyInServiceHour` check.

### Notes
- Frontend changes prepare for backend hardcoded service hours implementation.

## Entry · 2025-12-13 02:37 (+03)

### Commit
- **Hash:** `703289af1a29e3d38dad9de333e1f8ed81b9352b`
- **Message:** `redesign admin panel ui`

### Summary
- Complete admin panel UI redesign with improved layout, navigation, and visual hierarchy.

### Details
- Redesigned all admin panel components with consistent card-based layout and color scheme.
- Enhanced `SchedulerPanel`, `ForecastCoverage`, `MetroCachePanel`, `ReportsPanel`, and `UserManagement` with better spacing and typography.
- Removed deprecated `page-old.jsx` and unused admin endpoints.
- Simplified scheduler interface by removing redundant controls.

### Notes
- Improves admin dashboard usability and visual consistency.

## Entry · 2025-12-13 01:51 (+03)

### Commit
- **Hash:** `970c140e32cb18d6292410f89d4b7d5c78948b68`
- **Message:** `admin ui rev for multiple days scheduled ops`

### Summary
- Enhanced batch forecast scheduler to support multiple-day scheduling and improved job tracking.

### Details
- Modified `scheduler.py` to accept `days_ahead` parameter (default: 1) allowing batch forecast for T+1, T+2, etc.
- Added database migration for new `JobExecution` columns to track multi-day operations.
- Updated admin UI to display multi-day forecast scheduling controls.
- Enhanced job execution tracking with better error logging and status management.

### Notes
- Enables proactive forecast generation for multiple days ahead, improving data availability.

## Entry · 2025-12-13 01:20 (+03)

### Commit
- **Hash:** `ee146a063389192e860e4025be47e8db1ca7fb83`
- **Message:** `feat: add multiple days batch forecast, empty-state for crowd chart out of service hours`

### Summary
- Implemented multi-day batch forecast capability and improved out-of-service hour UX with empty state cards.

### Details
- Backend: Extended `batch_forecast.py` to generate forecasts for configurable number of days ahead.
- Backend: Added admin endpoint `POST /admin/forecast/batch-multi-day` accepting `days_ahead` parameter.
- Frontend: Enhanced `LineDetailPanel` with out-of-service empty state cards showing clock icon and helpful tips.
- Frontend: Added translation keys for out-of-service messages in both Turkish and English.
- Frontend: Improved chart rendering logic to handle mix of in-service and out-of-service hours.

### Notes
- Out-of-service empty states improve user understanding when predictions unavailable for specific hours.

## Entry · 2025-12-12 18:28 (+03)

### Commit
- **Hash:** `bec727ae62cb74e1b4254c9bcf870891cad2dafe`
- **Message:** `rev`

### Summary
- Iterated on the metro UX polish by tightening the map/selection flow and cleaning up follow-up issues after the M1A/M1B split.

### Details
- Stabilized metro map interactions so the LineDetailPanel selectors, map station clicks, and MetroStationInfoCard stay in sync.
- Refined the MetroStationInfoCard layout and direction-switch affordance for both mobile and desktop.

### Notes
- This commit is primarily a UX/stability follow-up on the metro map/schedule rollout.

## Entry · 2025-12-12 18:16 (+03)

### Commit
- **Hash:** `c7a17f16d34b0b93dbdf73fd6fd8cdd761bc1cf4`
- **Message:** `fix: handle ıut of service hours for rail systems and fix bugs`

### Summary
- Extended the “out of service” forecast pipeline to metro/rail so 24h charts stay visible while inactive hours correctly show gaps instead of misleading predictions.

### Details
- Updated `/forecast/{line}` to derive service windows for metro/rail lines from topology metadata (first/last time), including wrap-midnight handling.
- Fixed edge cases where rail lines were incorrectly treated as 24/7 active due to missing schedule metadata.

### Notes
- This makes the chart UX consistent across buses and rail: always render the 24h curve, but blank out inactive hours.

## Entry · 2025-12-12 18:00 (+03)

### Commit
- **Hash:** `2d929503d4aa389f9db02f580d33579e86eab946`
- **Message:** `feat: split M1 into M1A/M1B search results, fix mapview bugs`

### Summary
- Split M1 into M1A and M1B in the search experience to avoid branch-specific station/direction mismatches and make metro selection behave like other lines.

### Details
- Updated line search and metadata handling so M1A/M1B are surfaced as separate selectable lines while forecasts can still share the underlying M1 prediction data.
- Fixed map view metro issues around station selection consistency and schedule lookups.

### Notes
- This reduces special-casing in the UI and prevents users from selecting stations that don’t belong to the chosen branch.

## Entry · 2025-12-11 23:43 (+03)

### Commit
- **Hash:** `487429ae8bf3716fd86b5333cae6c6bb8064eaf7`
- **Message:** `add cache scheduler for metro schedule in api`

### Summary
- Added a backend APScheduler-based prefetch pipeline so metro timetables are served from a persistent Postgres cache first, reducing latency and shielding the UI from upstream outages.

### Details
- Implemented a daily prefetch cron plus retry/cleanup jobs that populate `metro_schedules` for all station/direction pairs.
- Updated `/metro/schedule` to read from the persistent cache and gracefully fall back to older snapshots during upstream failures.

### Notes
- This is the server-side counterpart to the client stale-while-revalidate cache.

## Entry · 2025-12-11 23:14 (+03)

### Commit
- **Hash:** `acf2e53645fc86c1a12c72245349f0c6c1d2e596`
- **Message:** `add map view for metro lines`

### Summary
- Added metro line rendering to the Leaflet map, including station markers and tooltips.

### Details
- Introduced the MetroLayer overlay for polylines/stations using the generated metro topology JSON.
- Wired map selection hooks to support station inspection flows.

## Entry · 2025-12-11 22:34 (+03)

### Commit
- **Hash:** `1990f92308a1df9d9758c7f4834de58a530535c5`
- **Message:** `add map view for metro lines`

### Summary
- Delivered the initial metro map overlay foundation used by subsequent schedule and UX improvements.

### Details
- Added base metro line rendering primitives and integrated them into MapView.

## Entry · 2025-12-11 22:25 (+03)

### Commit
- **Hash:** `3cd680a049f72a3f1350908c90202a15bab52fc8`
- **Message:** `docs rev`

### Summary
- Refreshed documentation ahead of the metro rollout and cache/scheduler work.

### Details
- Updated internal project log and summary to reflect the latest metro integration milestones.

## Entry · 2025-12-11 22:11 (+03)

### Commit
- **Hash:** `cfd60e6401f57e3462806d5c312b3ff833ccd219`
- **Message:** `add metro schedule cache system`

### Summary
- Implemented a stale-while-revalidate localStorage cache for Metro Istanbul timetables, eliminating repeated 2–3 second API waits and insulating the UI from upstream timeouts.

### Details
- Added `metroScheduleCache.js` with keyed entries per station/direction/day, 04:00 automatic expiry, and background refresh to keep cached data fresh.
- Wired the cache into both `MetroScheduleWidget` and `MetroScheduleModal`, allowing instant renders when cached data exists while silent retries keep data current.
- Included automatic cleanup, quota handling, and developer helpers (`clearMetroScheduleCache`, `getCacheStats`) for observability and manual resets.

### Notes
- Cached schedules guarantee graceful degradation when the Metro API throttles or fails, giving users reliable timetable visibility even offline.

## Entry · 2025-12-11 21:50 (+03)

### Commit
- **Hash:** `1ce663b00df1a387d33cfd7144394c9eef98e9b8`
- **Message:** `Add metro schedule modal for full-day schedule view`

### Summary
- Built a full-screen Metro schedule modal with station/direction selectors so riders can browse the entire day’s departures and destination context directly inside LineDetailPanel.

### Details
- Added `MetroScheduleModal` with dropdown station ordering, direction-aware filtering, current destination labels, and next-train highlighting across the grid view.
- Hooked the modal to the compact widget (tap to expand) and localized new schedule, disclaimer, and CTA strings in `tr.json`/`en.json`.
- Updated backend `/metro/schedule` adapter to deliver the richer payload consumed by the modal.

### Notes
- The modal mirrors the bus schedule UX, creating consistent interactions for metro and bus users while surfacing the raw Metro Istanbul service windows.

## Entry · 2025-12-11 21:13 (+03)

### Commit
- **Hash:** `4f27c3f2d84689f59e4d869a45294d2cd3cf944e`
- **Message:** `fix: connect metro forecast & schedule end-to-end`

### Summary
- Finished the metro experience by aligning forecasts, schedule fetches, topology lookups, and translations so every metro line now shows routes, live departures, and 24h forecasts without manual tweaks.

### Details
- Enabled forecast fetching for metro lines in `LineDetailPanel`, ensured `CrowdChart` renders for metro datasets, and added `direction` awareness when marking hours out of service.
- Added line-code fallback logic (e.g., map `M1` requests to `M1A`) and normalized Metro API timetable responses to the frontend schema with remaining-minute calculations.
- Extended Pydantic schemas and locale files to cover new schedule labels, making the entire workflow i18n-ready.

### Notes
- After this change, metro lines behave identically to buses/ferries in the dashboard: select a line, view live departures, inspect the 24h crowd curve, and trust that state persists per direction.

## Entry · 2025-12-09 22:21 (+03)

### Commit
- **Hash:** `4056e1f4789b3cae3c973e290b03cc10a693d7b0`
- **Message:** `remove metro alert feature`

### Summary
- Rolled back the experimental Metro alert plumbing to simplify the MVP and avoid surfacing partially reliable upstream data.

### Details
- Deleted the unused `useMetroAlerts` hook, alert API helpers, and backend schema definitions tied to Metro announcements.
- Trimmed `LineDetailPanel` to only show alert banners driven by the existing bus status system.

### Notes
- By narrowing scope to reliable schedule + forecast data, the metro feature can ship without confusing users with stale or empty alert states.

## Entry · 2025-12-09 21:26 (+03)

### Commit
- **Hash:** `fb5b8354114df38f0c4489e0bfd7cac66445b73b`
- **Message:** `add metro api integration`

### Summary
- Delivered end-to-end Metro Istanbul integration covering topology ingestion, backend routers, and frontend visualization; follow-up commits `1d00fe4`, `ee57eac`, and `b98497e` refactored schemas and module layout to stabilize the API surface.

### Details
- Added `fetch_metro_topology.py` to pull lines, stations, directions, and accessibility data into `metro_topology.json`, plus a FastAPI `metro_service`/router exposing topology, schedule, and duration endpoints with Pydantic contracts.
- Built React hooks (`useMetroTopology`, `useMetroSchedule`) and a `MetroLayer` map overlay so metro lines render with official colors, markers, and direction metadata, reusing the new API client helpers.
- Updated LineDetailPanel to detect metro lines, show stop selectors, and fetch live departures via the new backend endpoints.

### Notes
- This is the foundation for subsequent metro UX polish—after this merge the repo gained persistent topology data, backend contract separation, and the frontend plumbing for metro-specific widgets.

## Entry · 2025-12-08 08:39 (+03)

### Commit
- **Hash:** `273d77961d66c921cb18dee3428068529b7fbea8`
- **Message:** `fix 24h chart for mobile view`

### Summary
- Reworked the mobile `CrowdChart` collapse logic so the 24-hour graph animates correctly when the panel is minimized and expanded on smaller screens.

### Details
- Simplified the conditionals that hide the Recharts canvas on mobile, added explicit height controls, and ensured the chart reflows after interaction.
- Adjusted `/forecast` responses to include missing metadata required by the new chart props.

### Notes
- The Forecast tab now keeps context visible on phones, preventing accidental blank charts when toggling sections.

## Entry · 2025-12-08 08:15 (+03)

### Commit
- **Hash:** `0dc5d66e15d8ea10c09d8c0df5088ba24221a9bd`
- **Message:** `rev`

### Summary
- Tightened the 24-hour forecast API to mark out-of-service hours using schedule data and aligned the frontend with the new payload, paving the way for accurate metro direction filtering.

### Details
- Expanded `/forecast/{line}` to cross-check line schedules (via the schedule service) and emit `in_service` + `crowd_level` overrides when a line isn’t operating.
- Updated `LineDetailPanel`, `CrowdChart`, and the API client to respect the new structure, showing “Out of Service” states instead of empty gaps.
- Tuned `status_service` fallbacks so the same schedule intelligence powers both forecasts and status banners.

### Notes
- With this groundwork, users immediately understand why certain hours lack predictions—especially important for metro lines with shorter service windows.

## Entry · 2025-12-08 07:53 (+03)

### Commit
- **Hash:** `f24ec9ae6d11bc9b86908729a7b61c7f2585def9`
- **Message:** `feat(status): improve logging and caching for line status checks`

### Summary
- Hardened the line status service with richer logging and smarter caching so operational banners remain precise without spamming the IETT API.

### Details
- Added structured debug/info logs documenting alert payloads and service windows per line, aiding in ops troubleshooting.
- Reduced redundant alert fetches by caching computed banner content while keeping real-time operational checks uncached for accuracy.

### Notes
- These diagnostics surfaced quickly while building the metro experience and made it easier to align schedule + status data across bus and metro feeds.

## Entry · 2025-12-08 07:42 (+03)

### Commit
- **Hash:** `ef1a499546195416314c9cc02a21741448dbc4a0`
- **Message:** `feat(status): add direction support for line status checks and UI enhancements`

### Summary
- Introduced direction-specific status lookups so the app can tell riders which side of a line is running, and mirrored that data in the schedule widget.

### Details
- Extended backend status routes and cache keys with direction codes (`G`/`D`) and passed the parameter through the frontend API client.
- Updated `ScheduleWidget` to show localized first/last departure chips and ensure direction toggles stay in sync with backend filters.

### Notes
- Direction-aware service windows are now shared between the status panel, schedule widget, and forecast endpoint, keeping the narrative consistent.

## Entry · 2025-12-06 19:18 (+03)

### Commit
- **Hash:** `ed02b190f5bb7b77491500f0398a43fbbd0fd8a4`
- **Message:** `chore(deps): upgrade Next.js and eslint-config-next to version 16.0.7`

### Summary
- Bumped the frontend toolchain to Next.js 16.0.7 to pick up the latest React 19 fixes, security patches, and linting improvements ahead of the metro work.

### Details
- Updated `package.json` and `package-lock.json`, refreshed lockfile integrity hashes, and verified `npm run dev` / `npm run build` succeed on the new runtime.

### Notes
- Keeping Next.js current ensured compatibility with the App Router APIs used heavily by the metro components and modal animations.

## Entry · 2025-12-06 19:08 (+03)

### Commit
- **Hash:** `2eeb82153d509d5fe5ff44ab61cbfbecb19db0a3`
- **Message:** `docs: update project log with recent commits and detailed summaries`

### Summary
- Refreshed `project-log.md` and `project-summary.md` to capture the late-November/early-December backlog before starting the metro sprint.

### Details
- Added structured entries for recent modeling, user feedback, schedule, and status features, and bumped the “last updated” metadata.

### Notes
- This commit provided the baseline documentation snapshot we’re currently extending.


## Entry · 2025-12-06 18:00 (+03)

### Commit
- **Hash:** `6ff9740ac8f3b5d7fa1d3d9a01da0616dad86d0a`
- **Message:** `feat(reports): add detailed Markdown reports and enhanced test metrics for v6`

### Summary
- Enhanced model evaluation reporting with volume-weighted accuracy metrics (NMAE, baseline comparisons) and human-readable Markdown generation for academic documentation.

### Details
- **New Metrics:** Added NMAE (Normalized MAE = MAE / Mean Volume) and volume-weighted accuracy (1 - NMAE) to quantify model performance relative to passenger volume scale.
- **Baseline Comparison:** Implemented baseline NMAE calculation for lag-24h predictor to demonstrate improvement in relative error rates.
- **Line-Level Analysis:** Enhanced worst-performing lines analysis to include mean passenger volume and line-specific NMAE, revealing that high MAE often correlates with high-volume lines.
- **Markdown Reports:** Automated generation of `test_explanation_{version}.md` files with mathematical formulas, simulated examples, and contextual explanations suitable for thesis documentation.
- **Console Output:** Updated test script to display new metrics in both absolute and percentage formats for quick performance assessment.

### Notes
- NMAE provides volume-normalized error rate (e.g., 15.9% for v6), making model performance interpretable across different line capacities.
- Markdown reports include LaTeX-formatted formulas and comparative tables suitable for academic publications.
- JSON output structure now includes `test_set_mean_volume`, `baseline_nmae_lag24`, and detailed line statistics with `{mae, mean_volume, nmae}` tuples.

## Entry · 2025-12-05 15:30 (+03)

### Commit
- **Hash:** `83a5e0362732c40b61eb95a888164f5c143c3eb4`
- **Message:** `feat(reports): introduce user report management system`

### Summary
- Implemented complete user feedback and bug reporting system with FastAPI backend, React frontend forms, and admin management interface for systematic issue tracking.

### Details
- **Backend API:** Created `/reports` endpoint ecosystem with POST (submit), GET (list with filters), GET /{id} (details), PATCH /{id}/status (admin update), and GET /summary (statistics).
- **Database Schema:** Added `user_reports` table tracking report type (bug/feedback/feature), subject, description, email, status (pending/in_review/resolved/closed), priority, and timestamps.
- **Frontend Submission:** Built `ReportForm` component with type selection, subject/description validation, optional email collection, and success/error feedback.
- **Admin Interface:** Created `ReportsPanel` with filtering by status/type, pagination, priority badges, and status update controls.
- **Statistics:** Implemented report summary endpoint providing counts by status and type for administrative oversight.

### Notes
- Enables systematic collection of user feedback for iterative platform improvements.
- Admin filtering and priority management support efficient issue triage workflow.
- Email field allows follow-up communication with users who opt in for feedback.

## Entry · 2025-12-04 14:20 (+03)

### Commit
- **Hash:** `7a0f743ee96dc0538fbecf80cfab75545c9a7227`
- **Message:** `feat(schedule): add schedule API, caching, and frontend integration`

### Summary
- Integrated real-time bus schedule data from IETT API with caching layer, enabling users to view departure times and service frequencies alongside crowding predictions.

### Details
- **API Integration:** Implemented `/lines/{line_code}/schedule` endpoint fetching timetables from IETT SOAP service with XML parsing and day-type filtering (weekday/weekend/holiday).
- **Caching Strategy:** Added TTLCache (24-hour expiration) to minimize external API calls and improve response times for frequently queried lines.
- **Schedule Display:** Created `ScheduleWidget` compact view showing next 3 departures with time formatting, and `ScheduleModal` full view with complete hourly/minutely schedules.
- **Data Filtering:** Backend logic filters schedules by current day type using calendar dimension table to determine weekday/weekend/holiday status.
- **Admin Tools:** Added `/admin/schedule/cache` endpoints for viewing cache statistics and clearing cached data.

### Notes
- Schedule integration complements crowding predictions by helping users plan departures around low-occupancy time windows.
- SOAP/XML parsing handles IETT's legacy API format with robust error handling for malformed responses.
- Cache invalidation strategy ensures schedule updates (route changes, seasonal adjustments) propagate within 24 hours.

## Entry · 2025-12-03 16:45 (+03)

### Commit
- **Hash:** `0fccb5754afd0c6251819fd8662ca41b8413044b`
- **Message:** `feat(status): add line status API and frontend integration`

### Summary
- Developed real-time line status monitoring system fetching disruption alerts from IETT API, with backend filtering logic and frontend alert display components.

### Details
- **Status Endpoint:** Created `/lines/{line_code}/status` API returning line operational status, active disruption alerts (filtered by timestamp and line code), and service hour metadata.
- **Alert Filtering:** Implemented timestamp-based filtering to exclude outdated alerts, XML namespace stripping for reliable parsing, and `HATKODU` field matching for line-specific alerts.
- **Frontend Components:** Built `StatusBanner` for compact alert display with animated scrolling text, and `AlertsModal` for detailed disruption information viewing.
- **Caching:** Applied response caching (5-minute TTL) to balance real-time accuracy with API load reduction.
- **Localization:** Added alert-related translation keys (`lineDetail.alerts`, `lineDetail.disruption`, `lineDetail.tapForDetails`) to support Turkish/English interfaces.

### Notes
- Alert integration enables proactive user awareness of service disruptions, accidents, or maintenance affecting crowding patterns.
- XML parsing robustness critical due to IETT API's inconsistent namespace usage and field naming.
- 5-minute cache window ensures users see recent updates without overwhelming IETT's infrastructure.

## Entry · 2025-12-02 13:10 (+03)

### Commit
- **Hash:** `4c9a754b6e7c2333ba9892a28fb9aaf420807f5f`
- **Message:** `feat(data-prep): add route analysis and variant processing scripts`

### Summary
- Developed geometry analysis and variant selection pipeline to identify optimal bus route polylines from IETT's multi-variant GeoJSON responses for accurate map rendering.

### Details
- **Topology Analysis:** Created `analyze_route_structure.py` diagnosing MultiLineString connectivity issues, segment reversals, and gap detection to identify rendering-ready geometries.
- **Variant Comparison:** Built `analyze_variants.py` comparing route variants by length, segment count, and coordinate coverage to select canonical representations.
- **Intelligent Selection:** Implemented `process_route_shapes.py` with weighted scoring algorithm evaluating: coordinate count (30%), segment continuity (25%), length consistency (20%), bounding box coverage (15%), and simplicity (10%).
- **Quality Filters:** Added threshold-based filtering rejecting routes with <10 coordinates, segment count >100, or length ratio >3x median to exclude malformed geometries.
- **Output:** Generated processed route shapes with single selected variant per line/direction, reducing frontend parsing complexity and map rendering overhead.

### Notes
- IETT API returns 3-8 variants per route due to different data collection methods (GPS traces, manual digitization, schedule-based paths).
- Variant selection critical for consistent map visualization, preventing overlapping polylines or conflicting geometries.
- Scoring algorithm prioritizes route completeness (full coverage) over simplicity (straight-line approximations).

## Entry · 2025-12-01 18:34 (+03)

### Commit
- **Hash:** `f78ba335dc7de3b794197c9bb82f8007dfc67145`
- **Message:** `feat(ui): localize strings in LineDetailPanel for multilingual support`

### Summary
- Completed i18n implementation for LineDetailPanel by replacing all hardcoded strings with localized translations, ensuring full multilingual support for Turkish and English users.

### Details
- **Translation Files:**
  - Added 10 new translation keys to `messages/tr.json` and `messages/en.json`:
    - `lineDetail.capacity`, `lineDetail.predicted`, `lineDetail.passengers` - data display labels
    - `lineDetail.routeView`, `lineDetail.show`, `lineDetail.hide` - route visibility controls
    - `lineDetail.expand`, `lineDetail.minimize` - panel state controls
    - `lineDetail.noRouteData`, `lineDetail.changeDirection` - informational messages
    - `lineDetail.addToFavorites`, `lineDetail.removeFromFavorites` - accessibility labels
- **Component Updates:**
  - Replaced hardcoded English strings ("Capacity", "Predicted", "passengers") with `t()` function calls
  - Localized route view controls ("Route View", "Show"/"Hide")
  - Localized panel state labels ("Expand"/"Minimize")
  - Localized button tooltips and aria-labels for screen reader accessibility
  - Updated Turkish hardcoded string ("Yön değiştir") to use translation function
- **Accessibility Improvements:**
  - All `aria-label` attributes now use localized strings for favorites buttons
  - All `title` attributes for tooltips now support both languages
  - Screen reader users will receive messages in their selected language

### Notes
- LineDetailPanel now fully supports Turkish/English language switching without requiring code changes
- All user-facing text in the component is now translatable via JSON files
- Follows existing i18n patterns established in SearchBar, Weather, and Forecast components
- Maintains consistency with project's next-intl v4.5.5 implementation

## Entry · 2025-12-01 18:25 (+03)

### Commit
- **Hash:** `049f98f949c8b608afb6f434485509e4f093688b`
- **Message:** `feat(ui): enhance route visualization and direction info in LineDetailPanel`

### Summary
- Implemented comprehensive route visualization system with dynamic direction labels, interactive stop markers, and enhanced map display for improved user experience when viewing bus line routes.

### Details
- **useRoutePolyline Hook Enhancements:**
  - Added `getRouteStops(lineCode, direction)` method returning detailed stop objects with `{code, name, lat, lng, district}` structure
  - Implemented `getDirectionInfo(lineCode)` method generating dynamic direction labels by extracting destination stop names
  - Direction label format: `"{DESTINATION_STOP_NAME} Yönü"` (e.g., "KADIKÖY Yönü" instead of generic "Gidiş")
  - Stop name formatting logic removes suffixes (MAH., CAD., SOK.) and converts to uppercase for consistency
  - Returns comprehensive metadata: `{label, firstStop, lastStop, firstStopCode, lastStopCode}` per direction
- **LineDetailPanel Updates:**
  - Replaced static direction buttons ("Gidiş"/"Dönüş") with dynamic labels from `getDirectionInfo()`
  - Added text truncation with `title` tooltips for long destination names
  - Integrated vibration feedback (5ms) on direction change for tactile response
  - Updated both minimized and expanded state direction selectors with new labels
  - Minimized state: Compact single-line display with active direction label + toggle button using `ArrowLeftRight` icon
  - Expanded state: Side-by-side direction buttons with full destination names
- **MapView Enhancements:**
  - Added `CircleMarker` components for all stops along the route with interactive tooltips
  - Implemented polyline styling with `lineCap="round"` and `lineJoin="round"` for smooth, professional appearance
  - Distinctive start stop marker: Green filled circle (radius=6) with "Start" label and stop name in tooltip
  - Distinctive end stop marker: Red filled circle (radius=6) with "End" label and stop name in tooltip
  - Regular stop markers: White filled circles with blue borders (radius=4, weight=2)
  - All markers include `<Tooltip>` components displaying stop names on hover
  - Added `useMemo` optimization for `routeCoordinates` and `routeStops` to prevent unnecessary recalculations
- **LocateButton Position Adjustment:**
  - Implemented dynamic positioning based on panel state: `bottom: isPanelOpen ? '12rem' : '5rem'`
  - Added smooth transition animation (`transition-all duration-300`) when panel opens/closes
  - Prevents location button from being hidden behind expanded panel while keeping it accessible when panel is closed

### Notes
- Direction labels are dynamically generated from actual route data rather than hardcoded
- Stop name formatting handles common Turkish address abbreviations (MAH., CAD., SOK.)
- Map visualization provides clear visual hierarchy: green (start) → blue (intermediate stops) → red (end)
- Performance optimized with useMemo to prevent expensive recalculations on every render
- User can click direction toggle button in minimized state to cycle through available directions
- All stop markers are interactive with hover tooltips showing full stop names
- System gracefully handles routes with single direction by hiding direction selector

## Entry · 2025-12-01 17:59 (+03)

### Commit
- **Hash:** `0af174a95dd1c6e85f4c02484c6bb0a0a41ae337`
- **Message:** `feat(ui): enhance SearchBar with numeric input support`

### Summary
- Added mobile-optimized numeric keyboard support to SearchBar input field for faster bus line number entry on mobile devices.

### Details
- **Input Attributes:**
  - Added `inputMode="numeric"` - triggers numeric keyboard on mobile browsers
  - Added `pattern="[0-9]*"` - optimizes for iOS Safari to show numeric keypad
- **User Experience:**
  - Mobile users now see numeric keyboard when searching for bus lines (e.g., "500T", "M2")
  - Reduces keyboard switching time when entering line numbers
  - Desktop behavior unchanged (standard keyboard)

### Notes
- Improves mobile UX for primary use case (searching by line number)
- Pattern attribute ensures iOS compatibility alongside inputMode
- Still allows non-numeric input (type="text" preserved) for alphanumeric lines like "M2", "500T"

## Entry · 2025-12-01 17:50 (+03)

### Commit
- **Hash:** `5520ee664fc7647092ca34b5198f111626203220`
- **Message:** `feat(ui): integrate framer-motion in LineDetailPanel for animations and haptic feedback`

### Summary
- Integrated Framer Motion for advanced animations and drag gestures in LineDetailPanel, adding smooth transitions, drag-to-minimize functionality, and haptic vibration feedback for improved mobile user experience.

### Details
- **Dependencies:**
  - Added `framer-motion@^12.23.25` to `package.json` for declarative animation support
- **Drag-to-Minimize Functionality:**
  - Implemented vertical drag gesture (`drag="y"`) on mobile panel with elastic constraints
  - Drag threshold: 100px offset or 500px/s velocity to trigger minimize/expand
  - Added `dragElastic={0.2}` for subtle rubber-band effect at bounds
  - `onDragEnd` handler evaluates drag distance and velocity to determine final state
  - Animation controls reset panel position smoothly after drag release
- **Animated Transitions:**
  - Wrapped overlay backdrop with `<AnimatePresence>` for fade-in/out effects
  - Panel height transitions smoothly between states: `auto` (minimized), `55vh` (expanded), `75vh` (chart expanded)
  - Chart section uses `motion.div` with height/opacity animations (`initial/animate/exit` props)
  - Transition duration: 200-300ms for responsive feel
- **Haptic Feedback:**
  - Added vibration patterns using `navigator.vibrate()` API:
    - 10ms vibration on minimize/expand toggle
    - 10ms vibration on route show/hide toggle
    - 5ms vibration on direction change
    - 5ms vibration on favorite toggle
    - 5ms vibration on chart expand/collapse
  - Implemented safe vibration function with `typeof navigator !== 'undefined'` check for SSR compatibility
- **State Management:**
  - Added `isChartExpanded` local state for collapsible chart area
  - Dynamic panel height calculation based on `isMinimized` and `isChartExpanded` states
  - Desktop mode: Fixed height with `max-h-[calc(100vh-6rem)]`
  - Mobile mode: Dynamic height with smooth CSS transitions (`transition: 'height 0.3s ease-out'`)
- **Responsive Behavior:**
  - Drag gestures disabled on desktop (`drag={!isDesktop ? "y" : false}`)
  - Mobile panel positioned at `bottom-16` (above tab bar)
  - Desktop panel positioned at `top-20 left-4` with fixed width `w-96`
  - Added `useEffect` to auto-minimize panel when route is shown

### Notes
- Framer Motion provides better animation performance than CSS-only transitions through hardware acceleration
- Drag threshold tuned for comfortable mobile use - prevents accidental minimize while scrolling content
- Haptic feedback duration carefully chosen: 10ms for major actions, 5ms for minor interactions
- `AnimatePresence` required for exit animations when components unmount
- Vibration API gracefully degrades on browsers/devices that don't support it
- Chart expansion is mobile-only feature to save screen space - desktop always shows chart

## Entry · 2025-12-01 17:22 (+03)

### Commit
- **Hash:** `34c8cab9bdade6b21e2490bdbac692cf11ef1a5a`
- **Message:** `feat(ui): implement useMediaQuery hook and enhance LineDetailPanel responsiveness`

### Summary
- Implemented custom `useMediaQuery` React hook and redesigned LineDetailPanel with desktop-specific layout improvements, minimize/expand functionality, and enhanced visual styling for better responsiveness across devices.

### Details
- **useMediaQuery Hook:**
  - Created custom React hook (`frontend/src/hooks/useMediaQuery.js`) for responsive design queries
  - Uses `window.matchMedia()` API with event listener for real-time breakpoint detection
  - Returns boolean indicating whether media query matches
  - Includes SSR-safe initial state and cleanup on unmount
- **LineDetailPanel Desktop Layout:**
  - Added desktop-specific positioning: `top-20 left-4 w-96` (fixed 384px width sidebar)
  - Desktop height constraint: `max-h-[calc(100vh-6rem)]` to prevent viewport overflow
  - Mobile layout unchanged: `bottom-16 left-0 right-0` full-width drawer
- **Minimize/Expand Functionality:**
  - Added `isMinimized` state with `toggleMinimize()` handler
  - Desktop: Shows minimize/expand button in drag handle area with chevron icons and text labels
  - Mobile: Retains swipe-down gesture behavior (drag handle visible as horizontal bar)
  - Minimized state shows compact view: line code + route name + occupancy badge + favorite/close buttons
  - Expanded state shows full panel: all data cards, time slider, and 24h forecast chart
- **Enhanced Styling:**
  - Added direction selector UI when route is visible with multiple directions
  - Direction buttons with animated pulse effect on active MapPin icon
  - Improved crowd level badge styling: rounded corners, borders, larger text
  - Added transition animations for height changes (`transition-all duration-300`)
  - Refined spacing and padding for cleaner visual hierarchy

### Notes
- `useMediaQuery('(min-width: 768px)')` used as desktop breakpoint (matches Tailwind's `md:` prefix)
- Desktop sidebar layout enables simultaneous map interaction and data viewing
- Minimized state useful when user wants to see more map area while keeping line info accessible
- Direction selector only appears when route visualization is active and multiple directions available
- Hook pattern allows reuse across any component needing responsive behavior detection

## Entry · 2025-12-01 17:14 (+03)

### Commit
- **Hash:** `fb0cea15aabe8b55d686ebb373b118d81585afba`
- **Message:** `feat(data-prep): add IETT bus stop and line routes ingestion scripts`

### Summary
- Implemented comprehensive IETT bus data ingestion system with SOAP API integration, fetching and processing bus stop geometries and line route sequences for frontend map and route visualization features.

### Details
- **Bus Stop Geometry Ingestion (`fetch_geometries.py`):**
  - Implemented SOAP API client for IETT's `DurakDetay_GYY` service with retry mechanism and exponential backoff (2s → 4s → 8s delays)
  - Multi-step data flow: (1) Fetch all stop codes via `getHatDurakListesi_json`, (2) Process in batches of 100 stops, (3) Extract geometry from `getKoordinatGetir_json` SOAP responses
  - Data structure: `{stop_code: {name, lat, lng, district, type}}` with 45,000+ unique stop records
  - Implemented deduplication logic to handle stops appearing on multiple lines
  - Added caching mechanism to save intermediate batches for fault tolerance
  - Output: `frontend/public/data/stops_geometry.json` (90MB+ nested JSON)
- **Line Routes Ingestion (`fetch_line_routes.py`):**
  - Fetches ordered stop sequences for each bus line from IETT's `getGuzergah_json` SOAP endpoint
  - Handles bidirectional routes: "G" (gidiş/outbound) and "D" (dönüş/return) per line
  - Multi-level data structure: `{line_code: {direction: [ordered_stop_codes]}}`
  - Includes validation for empty routes, missing directions, and malformed responses
  - Output: `frontend/public/data/line_routes.json` (67MB+ structured JSON with 500+ lines)
- **useRoutePolyline Hook:**
  - Created custom React hook to load and cache route data in browser
  - Implements singleton loading pattern with module-level caching (`stopsCache`, `routesCache`, `loadingPromise`)
  - Provides `getPolyline(lineCode, direction)` method returning lat/lng coordinate arrays for Leaflet rendering
  - Provides `getAvailableDirections(lineCode)` to determine which directions exist for a line
  - Handles loading states, errors, and missing data gracefully
- **MapView Integration:**
  - Added `<Polyline>` component to render bus routes when `showRoute` is true
  - Polyline styling: blue color (#3b82f6), 4px weight, 70% opacity
  - Implemented `MapController` component using `useMap()` hook to auto-fit bounds when route is displayed
  - Map automatically pans and zooms to show full route with 50px padding
- **LineDetailPanel Route Controls:**
  - Added "Route View" card with toggle button to show/hide route on map
  - Direction selector buttons appear when route is visible and multiple directions available
  - Button states: active direction highlighted in primary blue, inactive in muted gray
  - Integrated with Zustand store: `showRoute`, `selectedDirection`, `setSelectedDirection`
  - Auto-minimizes panel when route is shown to maximize map visibility
- **Documentation:**
  - Created `src/data_prep/README_GEOMETRIES.md` (163 lines) with SOAP API documentation, data structure schemas, troubleshooting guide, and usage examples

### Notes
- IETT SOAP API requires XML-formatted requests with namespace declarations and structured parameters
- Stop geometry data crucial for rendering route polylines and calculating spatial queries
- Line route sequences preserve order, enabling accurate polyline rendering and stop-to-stop navigation
- Batch processing (100 stops/request) balances API load vs request overhead
- Caching strategy prevents re-downloading 157MB of data on every frontend load
- Retry logic with exponential backoff handles transient network failures and API rate limits
- Frontend hook ensures data loads once per browser session, improving performance
- Route auto-fit behavior enhances UX by eliminating manual zoom/pan when viewing routes
- System supports 500+ bus lines with both directions, covering Istanbul's public transport network

## Entry · 2025-12-01 13:23 (+03)

### Commit
- **Hash:** `4a92ad4ce24436f1e9a0c865fbcd65df648ed6ef`
- **Message:** `feat(admin): add database cleanup endpoint and Danger Zone UI`

### Summary
- Implemented database cleanup functionality for bulk deletion of forecasts and job execution history, with admin UI confirmation workflow to prevent accidental data loss.

### Details
- **API Endpoint:**
  - Added `DELETE /admin/database/cleanup-all` endpoint in `src/api/routers/admin.py`
  - Deletes all records from `forecasts` and `job_executions` tables using SQLAlchemy bulk delete
  - Requires admin authentication via `get_current_user` dependency
  - Returns cleanup summary: `{deleted_forecasts: int, deleted_jobs: int}`
  - Uses database session commit to ensure transactional consistency
- **Admin UI - Danger Zone:**
  - Added "Danger Zone" section at bottom of admin dashboard with red warning styling
  - Cleanup button disabled until user types "DELETE" in confirmation input field
  - Shows loading spinner during cleanup operation
  - Displays success message with deleted record counts after completion
  - Input field clears automatically after successful cleanup
- **Safety Mechanisms:**
  - Confirmation input with exact string match ("DELETE") required to enable button
  - Button styling changes from disabled gray to destructive red when confirmed
  - Operation requires admin JWT token, preventing unauthorized access
  - User feedback through status messages and disabled states

### Notes
- Cleanup operation is irreversible - all forecast and job history data permanently deleted
- Useful for testing, development resets, or database maintenance scenarios
- Does not affect `admin_users`, `transport_lines`, or other core tables
- Frontend confirmation workflow prevents accidental clicks from causing data loss
- Cleanup summary provides transparency about operation scope
- Consider adding scheduled cleanup in future for automatic old data pruning

## Entry · 2025-12-01 13:12 (+03)

### Commit
- **Hash:** `adcf62eeb04b04fcb716d8763be2fef14bf6ed64`
- **Message:** `feat(admin): enhance scheduler panel with manual job triggers and quick actions`

### Summary
- Enhanced SchedulerPanel component with manual job trigger functionality and quick actions UI, enabling on-demand execution of forecast generation, cleanup, and quality check jobs through admin dashboard.

### Details
- **Manual Job Triggers:**
  - Added trigger buttons for all 3 jobs: "Trigger Now" for forecast generation, cleanup, and quality check
  - Integrated with existing admin API endpoints: `POST /admin/scheduler/trigger/{job_type}`
  - Implemented loading states per button with spinner icons during execution
  - Added success/error feedback with 3-second auto-dismiss messages
  - Secure API calls with `getAuthHeaders()` for token-based authentication
- **Quick Actions Section:**
  - Created dedicated "Quick Actions" UI card with descriptive task buttons
  - Actions include: "Generate Today's Forecast", "Clean Old Data", "Run Quality Check"
  - Each button shows clear description of what operation will be performed
  - Loading states prevent duplicate triggers while job is running
  - Status messages display below actions with color-coded success (green) / error (red) styling
- **UI/UX Improvements:**
  - Consolidated trigger controls: removed inline "Trigger Now" from individual job cards
  - Improved visual hierarchy: Quick Actions panel separate from scheduler status display
  - Enhanced button styling: primary blue for actions, gray borders for secondary controls
  - Better error messaging: shows full API error messages to admin users
  - Auto-refresh continues after manual triggers to show updated job statistics

### Notes
- Manual triggers bypass schedule and execute immediately, useful for:
  - Testing job functionality without waiting for cron schedule
  - Emergency forecast regeneration if automated job fails
  - On-demand data cleanup outside scheduled 03:00 run
  - Ad-hoc quality checks before deployments
- Quick Actions centralize common admin tasks in one location
- Loading states prevent double-triggering jobs (could cause conflicts)
- Success messages auto-dismiss to reduce UI clutter
- Trigger operations logged in `job_executions` table with `job_type="manual_trigger"`
- Consider rate limiting if manual triggers become too frequent

## Entry · 2025-12-01 13:05 (+03)

### Commit
- **Hash:** `3dd6e11a7363c9ee7260492cce61689c0034ec42`
- **Message:** `feat(admin): add locale-based admin dashboard and user management UI`

### Summary
- Implemented comprehensive admin dashboard with user management capabilities, featuring locale-aware routing, CRUD operations for admin users, and enhanced scheduler/forecast coverage visualization.

### Details
- **AdminDashboard Component:**
  - Refactored `page.jsx` with locale-aware routing using `useParams()` for dynamic locale handling
  - Implemented dashboard layout with 6 main sections: scheduler status, job history, forecast coverage, feature store stats, performance testing, and user management
  - Added secure API calls with `getAuthHeaders()` for all data fetching operations
  - Integrated auto-refresh (5-second intervals) for scheduler and job data
  - Enhanced error handling with user-friendly messages and retry mechanisms
- **UserManagement Component:**
  - Created dedicated component (`frontend/src/components/admin/UserManagement.jsx`) for admin user CRUD operations
  - Features:
    - List all admin users with username, last login timestamp, and action buttons
    - Create new admin user with username/password form validation
    - Change password for existing users with separate form
    - Delete users with confirmation prompt (prevents accidental deletion)
  - Form states: separate UI sections for each operation with loading/error/success feedback
  - Validation: password confirmation matching, required field checks
  - API integration: calls `/admin/users`, `/admin/users` (POST), `/admin/users/change-password`, `/admin/users/{username}` (DELETE)
- **Dashboard Enhancements:**
  - Scheduler section shows real-time job status with next/last run times
  - Job history displays target dates, execution times, status badges, and error messages
  - Forecast coverage table with 7-day view, status indicators (complete/partial/missing), and delete actions
  - Feature Store panel showing fallback statistics with visual warnings
  - Performance testing interface with configurable line/hour counts
- **Locale Support:**
  - All navigation and redirects use dynamic locale paths (e.g., `/${locale}/admin/login`)
  - Login/logout flows preserve selected language
  - Admin routes support both Turkish (`/tr/admin`) and English (`/en/admin`) URLs

### Notes
- User management enables multi-admin setup without direct database access
- Password change requires knowing target username (security consideration)
- Delete operation protected by confirmation to prevent accidental user removal
- Dashboard auto-refresh keeps data current without manual reload
- All API calls include JWT token via Authorization header
- Component structure allows easy addition of new admin features
- Consider adding password strength requirements in future iteration
- User creation doesn't validate username uniqueness in UI (handled by backend)

## Entry · 2025-12-01 12:58 (+03)

### Commit
- **Hash:** `516d0a11ee7b80ef72e6d2e2c6c70ff2ad3af230`
- **Message:** `feat(admin): add admin user management endpoints for CRUD operations`

### Summary
- Implemented comprehensive admin user management API endpoints enabling CRUD operations, password management, and user listing functionality with secure authentication and validation.

### Details
- **User Listing:**
  - `GET /admin/users` - returns list of all admin users with username and last_login timestamp
  - Excludes sensitive data (hashed passwords) from response
  - Requires admin authentication via `get_current_user` dependency
- **Current User Info:**
  - `GET /admin/users/me` - returns authenticated admin's username and last_login
  - Useful for displaying current user info in UI
- **User Creation:**
  - `POST /admin/users` - creates new admin user with username and password
  - Password hashing handled by `auth.hash_password()` before storage
  - Request body: `{username: str, password: str}`
  - Returns created user details (excludes hashed password)
  - Validates username uniqueness at database level (raises 500 if duplicate)
- **Password Management:**
  - `POST /admin/users/change-password` - updates password for existing user
  - Request body: `{username: str, new_password: str}`
  - Returns 404 if user not found
  - Re-hashes password using bcrypt with 72-byte truncation for compatibility
- **User Deletion:**
  - `DELETE /admin/users/{username}` - removes admin user from system
  - Returns 404 if user not found
  - Returns 400 if attempting to delete last remaining admin (safety constraint)
  - Checks `current_admin_count > 1` before allowing deletion
  - Returns success message with deleted username
- **Security Considerations:**
  - All endpoints require JWT token authentication via `get_current_user` dependency
  - Passwords hashed using bcrypt via passlib (version pinned for compatibility)
  - Last admin deletion prevented to avoid lockout scenario
  - Password truncation to 72 bytes handles bcrypt limitation

### Notes
- Endpoints enable building admin user management UI without database access
- Consider adding username validation (length, allowed characters) in future iteration
- Password change endpoint doesn't require old password verification (admin-only operation)
- User creation could benefit from duplicate username check before database insert
- Consider adding pagination for `GET /admin/users` if user count grows large
- Deletion constraint ensures at least one admin always exists to prevent lockout

## Entry · 2025-12-01 12:39 (+03)

### Commit
- **Hash:** `a40c61373a694c5bf24945355c378249f7a45595`
- **Message:** `fix(auth): resolve bcrypt compatibility and password length issues`

### Summary
- Fixed bcrypt password hashing errors by pinning bcrypt version and adding password truncation logic to handle bcrypt's 72-byte limitation, preventing authentication failures on startup and login.

### Details
- **Bcrypt Version Pinning:**
  - Pinned `bcrypt==4.0.1` in `requirements.txt` for compatibility with passlib
  - Resolves version conflicts causing import errors and hashing failures
- **Password Truncation:**
  - Added 72-byte truncation in `verify_password()` and `hash_password()` functions
  - Bcrypt has hard limit of 72 bytes; longer passwords cause "password cannot be longer than 72 bytes" error
  - Truncation formula: `password[:72].encode('utf-8')` before hashing
  - Affects both verification (login) and hashing (admin creation)
- **Admin Password Warning:**
  - Added startup warning when `ADMIN_PASSWORD` env var exceeds 72 characters
  - Warns: "ADMIN_PASSWORD exceeds 72 bytes. Password will be truncated to 72 bytes for bcrypt compatibility"
  - Helps administrators understand password length constraints during setup
- **Error Prevention:**
  - Prevents startup crashes when default admin user creation attempts to hash long passwords
  - Prevents login failures when verifying passwords exceeding bcrypt limit
  - Ensures consistent hashing behavior across all password operations

### Notes
- Bcrypt's 72-byte limit is a well-known security library constraint, not a bug
- UTF-8 encoding means 72-byte limit ≈ 72 ASCII characters or fewer Unicode characters
- Password truncation is safe because 72 bytes provides sufficient entropy for security
- Affects `ADMIN_PASSWORD` env var and any admin passwords set via API
- Consider documenting password length constraint in deployment guide
- Alternative: could reject passwords >72 bytes instead of truncating (stricter approach)

## Entry · 2025-12-01 12:31 (+03)

### Commit
- **Hash:** `a08f1efa6579a30f6c6dba343b959e8712293051`
- **Message:** `feat(admin): enable locale-based routing and secure admin API requests`

### Summary
- Implemented locale-aware routing for admin panel and enhanced CORS configuration to support authenticated API requests with proper header exposure.

### Details
- **Locale-Based Routing:**
  - Updated `admin/login/page.jsx` to use `useParams()` for dynamic locale extraction
  - Login success redirects to `/${locale}/admin` instead of hardcoded `/admin`
  - Logout redirects to `/${locale}/admin/login` preserving user's language preference
  - ProtectedRoute component now handles locale-aware redirect URLs
- **Secure API Requests:**
  - Introduced `getAuthHeaders()` utility function to retrieve JWT token from localStorage
  - Updated all Axios requests in admin components to include Authorization header
  - Header format: `{Authorization: 'Bearer {token}'}`
  - Enables secure communication with protected admin endpoints
- **CORS Enhancement:**
  - Updated CORS middleware in `src/api/main.py` with `allow_origin_regex` pattern
  - Regex: `r"^https?://localhost:3000$"` matches both http and https development URLs
  - Added `expose_headers=["*"]` to allow frontend access to custom response headers
  - Enables proper handling of authentication tokens and custom API headers
- **AuthContext Updates:**
  - Modified `login()` function to include locale parameter
  - Post-login navigation preserves language selection
  - Enhanced logout flow with locale-aware redirect

### Notes
- Locale support enables seamless Turkish/English admin panel experience
- Token-based authentication secures all admin API operations
- CORS regex pattern provides flexibility for local development (http/https)
- `expose_headers=["*"]` needed for Authorization header visibility in browser
- Consider adding token refresh mechanism for long admin sessions
- Future: implement role-based access control for different admin permission levels

## Entry · 2025-12-01 12:24 (+03) (Continued from previous)

### Commit
- **Hash:** `a031ef3135a63548c0f78132068f2183586ebad4`
- **Message:** `feat(admin): add JWT-based admin authentication with UI and API integration`

### Summary
- Implemented comprehensive JWT-based authentication system for admin access, including secure login/logout flows, password hashing, token management, and React authentication context with protected routes.

### Details
- **Backend Authentication:**
  - Created `src/api/auth.py` module (102 lines) with JWT token generation and password hashing logic
  - Token configuration: HS256 algorithm, 24-hour expiration, secret key from `ADMIN_SECRET_KEY` env var
  - Password hashing: bcrypt via passlib with 12 rounds, UTF-8 encoding
  - `create_access_token()`: generates JWT with username claim and expiration timestamp
  - `verify_password()`: compares plaintext password against bcrypt hash
  - `hash_password()`: creates secure bcrypt hash from plaintext password
  - `get_current_user()`: FastAPI dependency for protected routes, validates JWT token and returns authenticated user
- **Database Schema:**
  - Added `admin_users` table to `src/api/models.py` with columns: id (PK), username (unique), hashed_password, created_at, last_login
  - Created migration: `migrations/create_admin_users_table.sql` with idempotent CREATE TABLE IF NOT EXISTS
  - Default admin user creation on startup: username from `ADMIN_USERNAME` env var (default: "admin"), password from `ADMIN_PASSWORD`
  - Last login timestamp updated on each successful login
- **Admin API Endpoints:**
  - `POST /admin/login` - accepts `{username, password}`, returns `{access_token, token_type: "bearer"}`, updates last_login
  - Protected admin endpoints now use `current_user: AdminUser = Depends(get_current_user)` to require authentication
  - Returns 401 Unauthorized if token invalid, expired, or missing
- **Frontend Authentication:**
  - Created `AuthContext` (`frontend/src/contexts/AuthContext.jsx`) for global admin session management
  - Context provides: `adminUser` state, `login(username, password)`, `logout()`, `isLoading` state
  - Stores JWT token in localStorage (`adminToken` key) for persistence across page reloads
  - Validates stored token on initial load via `GET /admin/users/me` endpoint
  - Clears token and user state on logout
- **Login Page:**
  - Created `frontend/src/app/[locale]/admin/login/page.jsx` with form validation
  - Form fields: username (required), password (required)
  - Displays error messages for failed login attempts
  - Redirects to `/admin` dashboard on successful authentication
  - Stores credentials in AuthContext and localStorage
- **Protected Routes:**
  - Created `ProtectedRoute` component (`frontend/src/components/admin/ProtectedRoute.jsx`)
  - Wraps admin pages to require authentication before rendering
  - Redirects unauthenticated users to `/admin/login`
  - Shows loading spinner while checking authentication status
- **Layout Integration:**
  - Updated `frontend/src/app/[locale]/layout.js` to wrap app with `<AuthProvider>`
  - Makes authentication context available to all components
- **Dependencies:**
  - Added to `requirements.txt`:
    - `python-jose[cryptography]==3.3.0` - JWT token encoding/decoding
    - `passlib[bcrypt]==1.7.4` - password hashing with bcrypt
    - `python-multipart==0.0.6` - form data parsing for login endpoint

### Notes
- Token expiration set to 24 hours balances security and usability
- Default admin account created automatically on first startup for initial access
- bcrypt provides future-proof password security with adjustable cost factor
- Token stored in localStorage (consider httpOnly cookie for enhanced security in production)
- Protected route pattern easily extensible to other admin pages
- Consider adding token refresh mechanism for long admin sessions
- Future enhancement: role-based access control (RBAC) for different admin permission levels
- Security: admin endpoints must not be exposed without HTTPS in production

## Entry · 2025-11-29 20:43 (+03)

### Commit
- **Hash:** `2b243c3dcf1914172e705beee6d2e727074934e7`
- **Message:** `refactor(api): update database module import path for consistency`

### Summary
- Fixed import path in `src/api/auth.py` to use relative import for database module, improving code organization and consistency with project structure.

### Details
- Changed import from `from database import SessionLocal` to `from .database import SessionLocal`
- Relative import ensures proper module resolution within `src/api/` package
- Aligns with Python package best practices for intra-package imports

### Notes
- Minor refactor with no functional changes
- Improves maintainability and IDE autocomplete support
- Part of cleanup after admin authentication implementation

## Entry · 2025-11-29 19:55 (+03)

### Commit
- **Hash:** `4209c2c048e5d38814d8afe3923db8969b7d92f1`
- **Message:** `feat(admin): integrate scheduler management and forecast coverage in admin panel`

### Summary
- Implemented comprehensive APScheduler-based cron job system with automated daily forecast generation, data cleanup, and quality monitoring, along with full admin panel integration for scheduler management and forecast coverage visualization.

### Details
- **APScheduler Integration:**
  - Created `src/api/scheduler.py` with 400+ lines implementing complete cron job orchestration
  - Integrated scheduler lifecycle with FastAPI application startup/shutdown in `main.py`
  - Configured 3 automated jobs with Europe/Istanbul timezone:
    - **Job 1**: Daily forecast generation (02:00) - generates T+1 forecasts with 3-attempt retry logic and exponential backoff
    - **Job 2**: Cleanup old forecasts (03:00) - maintains rolling 3-day window (T-1, T, T+1) by deleting forecasts older than 3 days
    - **Job 3**: Data quality check (04:00) - verifies forecast coverage, Feature Store health, and alerts on issues
  - Implemented robust error handling with retry mechanisms, misfire grace time (1-2 hours), and job coalescing
  - Added job statistics tracking (run count, error count, last status) for monitoring
- **Admin API Endpoints:**
  - Added `GET /admin/scheduler/status` for viewing scheduler state and all job information
  - Added `POST /admin/scheduler/pause` and `POST /admin/scheduler/resume` for maintenance control
  - Added `POST /admin/scheduler/trigger/forecast`, `trigger/cleanup`, and `trigger/quality-check` for manual job execution
  - Added `DELETE /admin/forecasts/date/{date}` to delete all forecasts for specific date
  - Added `GET /admin/forecasts/coverage` returning 7-day forecast availability summary with status indicators
- **Frontend Components:**
  - Created `SchedulerPanel.jsx` component displaying scheduler status, individual job cards with next/last run times, execution counts, error rates, and pause/resume controls
  - Created `ForecastCoverage.jsx` component with table showing 7-day forecast coverage, status badges (complete/partial/missing), T-1/T/T+1 labeling, and delete actions per date
  - Integrated both components into admin page with auto-refresh every 5 seconds
  - Added state management for scheduler status and forecast coverage data
- **Multi-Day Forecast Strategy:**
  - Implemented rolling 3-day window approach: daily cleanup at 03:00 removes forecasts before T-3, maintaining only T-1 (yesterday), T (today), T+1 (tomorrow)
  - System automatically rotates: at 02:00 generates new T+1, at 03:00 old T-3 is deleted, effectively maintaining consistent 3-day coverage
- **Documentation:**
  - Created `docs/cron-jobs-guide.md` (800+ lines) - comprehensive user guide covering job schedules, error handling, API reference, troubleshooting, and best practices
  - Created `docs/cron-system-implementation.md` (400+ lines) - technical implementation summary with architecture diagrams, testing checklist, deployment instructions
- **Dependencies:**
  - Added `APScheduler==3.10.4` to `requirements.txt` for async job scheduling with timezone support

### Notes
- Scheduler uses AsyncIOScheduler for compatibility with FastAPI's async runtime
- Exponential backoff retry logic: 1min → 2min → 4min delays between attempts, prevents cascading failures
- Misfire grace time allows jobs to run even if scheduled time was missed due to server downtime (up to 1-2 hours late)
- Job coalescing ensures multiple missed schedules combine into single execution, avoiding duplicate work
- Cleanup job enforces minimum 3-day retention to prevent accidental data loss
- Data quality check logs warnings but doesn't block operations, enabling proactive issue detection
- Manual triggers bypass schedule and execute immediately, useful for testing or recovery scenarios
- Frontend UI provides real-time visibility into scheduler health with color-coded status indicators and error rate tracking
- All timestamps use Europe/Istanbul timezone for consistency with business operations
- System is production-ready with graceful shutdown (waits for running jobs to complete before stopping)

## Entry · 2025-11-29 19:26 (+03)

### Commit
- **Hash:** `df2ae68819a4ea2a62780f2eb88b60d4d0de29e9`
- **Message:** `feat(admin): add target_date for job tracking and improve lag fallback stats`

### Summary
- Enhanced job execution tracking with target date column and implemented robust multi-year seasonal lag fallback strategy with comprehensive monitoring and admin panel integration.

### Details
- **Database Schema Enhancement:**
  - Added `target_date` column (Date type) to `job_executions` table in `src/api/models.py`
  - Column tracks which date each forecast job was generating predictions for (e.g., 2025-11-30)
  - Created migration file `migrations/add_target_date_to_jobs.sql` with idempotent ALTER TABLE using `IF NOT EXISTS`
  - Added index `idx_job_executions_target_date` for faster queries by target date
  - Migration is backward compatible (NULL allowed) for existing job records
- **Batch Forecast Service:**
  - Updated `run_daily_forecast_job()` in `batch_forecast.py` to set `target_date` when creating job log
  - Added fallback statistics logging at job completion showing seasonal match %, hour fallback %, and zero fallback %
  - Enhanced console output with emoji indicators for better readability (✅ success, 📊 stats, ❌ errors)
  - Job result now includes `fallback_stats` dictionary for monitoring lag feature retrieval quality
- **Feature Store Enhancements:**
  - Implemented multi-year seasonal fallback in `services/store.py` with configurable lookback window (default: 3 years)
  - Refactored `_build_lag_lookup()` to include `year` column in seasonal aggregation, enabling year-by-year fallback
  - Updated `get_historical_lags()` with 3-tier fallback strategy:
    - Tier 1: Try up to 3 previous years for same month/day (e.g., Nov 29: 2024 → 2023 → 2022)
    - Tier 2: Use most recent hour-based match (same hour, any date)
    - Tier 3: Zero fallback as last resort
  - Added age-based filtering to skip data older than `max_seasonal_lookback_years` (prevents using stale 2019 data in 2025)
  - Enhanced None-value checking across all tiers to ensure data quality
  - Implemented `get_batch_historical_lags()` optimization using same multi-year logic for bulk operations
- **Fallback Statistics Tracking:**
  - Added `fallback_stats` dictionary tracking usage of each tier: `seasonal_match`, `hour_fallback`, `zero_fallback`
  - Implemented `get_fallback_stats()` method returning counts and percentages for monitoring
  - Added `reset_fallback_stats()` method for per-job or per-day tracking
  - Detailed logging at debug/info/warning levels based on fallback tier used
- **Admin API Endpoints:**
  - Updated `JobLogResponse` schema to include `target_date` field
  - Changed `GET /admin/jobs` default limit from 10 to 20, made limit configurable via query parameter
  - Added `GET /admin/feature-store/stats` returning fallback statistics and config (lookback window)
  - Added `POST /admin/feature-store/reset-stats` to reset counters for fresh tracking
  - Updated job history endpoint to return `target_date` in response
- **Frontend Admin Panel:**
  - Enhanced job history table to display target date prominently in large bold font with job type as subtitle
  - Added job limit selector dropdown (10/20/50/100) in table header with instant update on change
  - Integrated Feature Store lag fallback statistics card with 4-column grid showing:
    - Total requests count
    - Seasonal match % (green, target >95%)
    - Hour fallback % (yellow, acceptable <5%)
    - Zero fallback % (red if >5%, indicates data quality issue)
  - Each metric shows percentage in large font with absolute hit count below in smaller text
  - Added lookback window display (e.g., "Lookback: 3 years")
  - All stats auto-refresh every 5 seconds for real-time monitoring
- **Documentation:**
  - Created `docs/lag-fallback-strategy.md` documenting multi-tier fallback logic, monitoring approach, debugging guide
  - Created `docs/admin-panel-improvements.md` detailing UI/UX enhancements, API changes, migration guide
  - Created `migrations/README.md` with migration application instructions for Docker and local setups

### Notes
- Multi-year seasonal fallback preserves calendar-based ridership patterns (holidays, weekends) by trying recent years first
- Age-based filtering (3-year window) prevents using outdated data from pre-COVID era or after major route changes
- None-value filtering ensures predictions never crash on incomplete historical data, gracefully falling back to next tier
- Target date tracking enables debugging which date a failed job was processing and supports future multi-date scheduling
- Fallback statistics provide data quality insights: high zero fallback % (>5%) indicates missing historical data or new transport lines
- Seasonal match target >95% ensures most predictions use calendar-appropriate historical patterns
- Job limit selector addresses user feedback about limited visibility (was fixed at 10, now up to 100)
- Feature Store stats card helps identify data quality issues proactively (e.g., incomplete feature engineering, data collection gaps)
- Migration is safe to re-run (idempotent) and doesn't require downtime (backward compatible)
- Frontend uses locale-sensitive date formatting (MMM dd, yyyy) for better readability across languages

## Entry · 2025-11-27 16:39 (+03)

### Commit
- **Hash:** `8ebd3f88c71787fa1e55ac76fdd276bde73ddc73`
- **Message:** `feat(ui): add favorite lines feature with real-time status and improved search highlighting`

### Summary
- Implemented favorites system with localStorage persistence and redesigned Forecast page as a personalized dashboard showing real-time crowd levels for bookmarked lines.

### Details
- **State Management & Persistence:**
  - Enhanced `useAppStore.js` with Zustand persist middleware using `createJSONStorage(() => localStorage)`
  - Added `favorites` array state with `toggleFavorite(lineId)` and `isFavorite(lineId)` actions
  - Configured partialize strategy to persist only `favorites` and `selectedHour` in localStorage under key `ibb-transport-storage`
- **LineDetailPanel Enhancements:**
  - Added star button to panel header for marking/unmarking lines as favorites
  - Implemented filled yellow star (Lucide-react Star with fill) when line is favorited, outlined gray when not
  - Added backdrop blur overlay (`bg-black/60 backdrop-blur-sm`) behind panel for better visual focus
  - Backdrop click closes panel for improved UX
- **Forecast Page Redesign:**
  - Transformed from placeholder to favorites dashboard displaying saved lines with real-time status
  - Created `FavoriteLineCard` component that fetches line metadata and current hour forecast data
  - Each card shows line code badge, transport type, current crowd level (Low/Medium/High/Very High), occupancy percentage, and predicted passenger count
  - Implemented empty state with star icon, descriptive text, and "Go to Lines" button when no favorites exist
  - Clicking favorite card opens `LineDetailPanel` with full 24h forecast
  - Added `LineDetailPanel` component to forecast page to support line detail viewing
- **Search Improvements:**
  - Enhanced `SearchBar.jsx` highlight function with Turkish locale-sensitive matching using `toLocaleLowerCase('tr-TR')`
  - Fixed highlight rendering to properly match and emphasize Turkish characters (İ/i, I/ı) in search results
  - Backend search normalization already handles Turkish character pairs correctly via `turkish_lower()` function
- **Navigation UX:**
  - Added automatic panel closure on pathname change in `BottomNav.jsx` using `useEffect` hook
  - Prevents panel state confusion when switching between Lines and Forecast tabs
- **Localization:**
  - Extended `messages/tr.json` and `messages/en.json` with favorites-specific translations
  - Added `forecast.subtitle`, `forecast.occupancy`, `forecast.passengers`, `forecast.crowdLevels`, and `forecast.emptyState` keys
  - Updated forecast page title to "Favorilerim" (TR) / "My Favorites" (EN)

### Notes
- Favorites system requires no authentication; all data stored client-side in browser localStorage
- Panel backdrop z-index set to 998, panel to 999, ensuring proper layering above bottom nav (1000)
- Empty state encourages user discovery by redirecting to map via router.push('/')
- Turkish search highlighting now matches backend normalization logic for consistent user experience

## Log Schema
- **Timestamp:** Commit date and hour (local timezone) recorded from repository history.
- **Commit:** Hash and message identifying the change captured in the log.
- **Summary:** One-line status of the project immediately after the commit.
- **Details:** Key updates introduced in the commit with brief explanations.
- **Notes:** Additional context or decisions relevant to the logged work.

## Entry · 2025-11-27 16:09 (+03)

### Commit
- **Hash:** `83b0e6cb638844d1815abd79137aecfb20e2ab26`
- **Message:** `feat(i18n): implement localization framework and migrate app structure for multi-language support`

### Summary
- Implemented comprehensive internationalization (i18n) with Turkish and English language support, restructuring the entire frontend application to support locale-based routing and dynamic translation.

### Details
- **i18n Infrastructure:**
  - Created `src/i18n/config.js` defining supported locales (tr, en) with Turkish as default
  - Implemented `src/i18n/request.js` using next-intl's `getRequestConfig` for server-side message loading
  - Added `src/i18n/routing.js` with locale-aware navigation helpers (Link, redirect, useRouter, usePathname)
  - Created middleware (`src/middleware.js`) for automatic locale detection and URL prefix routing
  - Configured next.config.js with `withNextIntl` plugin wrapper
- **Translation Files:**
  - Created `messages/tr.json` with complete Turkish translations for all UI components
  - Created `messages/en.json` with English translations for metadata, navigation, search, line details, weather, transport types, forecast, settings, admin, errors, and common terms
  - Structured translations hierarchically by component/feature domain (e.g., `searchBar`, `lineDetail`, `weather`, `transportTypes`)
- **App Structure Migration:**
  - Migrated entire `src/app/` directory to `src/app/[locale]/` for dynamic locale routing
  - Moved all pages (page.js, forecast/page.js, admin/page.jsx, settings/page.js) under `[locale]` folder
  - Created new root layout (`src/app/[locale]/layout.js`) with `NextIntlClientProvider` wrapper
  - Removed old root layout.js and consolidated locale-specific metadata generation
  - Implemented `generateStaticParams()` to pre-render both tr and en routes
- **Component Localization:**
  - **BottomNav.jsx:** Replaced hardcoded labels with `useTranslations('navigation')` hook
  - **SearchBar.jsx:** Localized placeholder, loading message, and no results text using `useTranslations('searchBar')`
  - **LineDetailPanel.jsx:** Translated crowd level labels, occupancy text, predicted passenger count, and forecast header with dynamic hour interpolation
  - **TimeSlider.jsx:** Localized "Time Travel" label using `useTranslations('timeSlider')`
  - **Nowcast.jsx:** Translated weather UI text ("Next Hours", "Auto-closes", "Istanbul") using `useTranslations('weather')` and `useTranslations('common')`
  - **Settings page:** Localized page title, language selector label, theme label with integrated LanguageSwitcher component
  - **Forecast page:** Translated page title and added no data message
  - **Admin page:** Localized dashboard title and subtitle
- **Language Switcher Component:**
  - Created `src/components/ui/LanguageSwitcher.jsx` with TR/EN toggle buttons
  - Implemented smooth transitions using `useTransition` hook
  - Integrated locale switching with next-intl's router (`useRouter` from `@/i18n/routing`)
  - Added to Settings page with Globe icon for discoverability
- **Transport Type Localization:**
  - Refactored `src/lib/transportTypes.js` to use `labelKey` instead of hardcoded `label` values
  - Changed transport type labels to keys: `bus`, `metro`, `ferry`, `unknown`
  - Created custom hook `src/hooks/useGetTransportLabel.js` for runtime translation lookup
  - Updated SearchBar and LineDetailPanel to use `getTransportLabel(transportType.labelKey)` for dynamic labels

### Notes
- URL structure now includes locale prefix: `/tr/`, `/en/`, `/tr/forecast`, `/en/settings`, etc.
- Middleware automatically redirects root path `/` to `/tr` (default locale)
- All static text across 10+ components successfully localized without breaking functionality
- Build verification successful with all routes generating correctly for both locales
- Transport type badges (Bus/Otobüs, Metro, Ferry/Vapur) now dynamically translate based on selected language
- Weather widget shows "Istanbul"/"İstanbul" based on locale
- Custom hook pattern (`useGetTransportLabel`) provides reusable translation mechanism for computed values
- next-intl v4.5.5 integrated with Next.js 16.0.3 and App Router architecture
- Locale persistence handled via cookies through next-intl middleware
- Future enhancement opportunity: Add more languages by creating new message files (e.g., `messages/de.json` for German)

## Entry · 2025-11-27 15:05 (+03)

### Commit
- **Hash:** `62ed47e5989528a2d31c97b1fbbb2c6aa82b0a42`
- **Message:** `refactor(ui): enhance CrowdChart with improved tooltip, empty state handling, and gradient styling`

### Summary
- Integrated forecast API with frontend components, implementing robust error handling, data validation, and enhanced visualization with production-ready chart component.

### Details
- **Backend API Enhancements (routers/forecast.py):**
  - Added comprehensive request validation with Pydantic Field constraints (hour: 0-23, occupancy: 0-100)
  - Implemented line existence verification before forecast retrieval to prevent unnecessary queries
  - Added date range validation limiting forecasts to 7 days in the future
  - Enhanced error handling with specific HTTP status codes (400, 404, 500) and descriptive messages
  - Implemented incomplete data detection logging when forecast has fewer than 24 hours
  - Added structured error responses with contextual detail messages
- **Backend Lines Endpoint (routers/lines.py):**
  - Created new `GET /lines/{line_name}` endpoint for fetching transport line metadata
  - Added `TransportLineResponse` Pydantic model with proper SQLAlchemy configuration
  - Implemented 404 handling for non-existent lines with descriptive error messages
- **Frontend API Client (lib/api.js):**
  - Configured request/response interceptors for automatic retry logic on timeouts (ECONNABORTED)
  - Implemented rate limiting handling with 1-second delay retry for 429 status codes
  - Added 10-second timeout configuration to prevent hanging requests
  - Enhanced `getForecast()` with URL encoding, data validation, and status-specific error messages
  - Added response format validation checking for array type and 24-hour completeness
  - Created `getLineMetadata()` function for line detail retrieval
  - Implemented comprehensive error categorization (network, server, validation errors)
- **CrowdChart Component (components/ui/CrowdChart.jsx):**
  - Completely redesigned to consume API response format (occupancy_pct, predicted_value, crowd_level)
  - Implemented `CustomTooltip` component showing hour, occupancy percentage, crowd level, and passenger count
  - Added color-coding logic for occupancy levels (green <30%, yellow 30-50%, orange 50-70%, red ≥70%)
  - Created multi-stop gradient (green → yellow → red) for visual density representation
  - Implemented empty state UI with "No forecast data available" message
  - Enhanced X-axis with 2-hour intervals and "h" suffix formatting
  - Enhanced Y-axis with percentage formatting
  - Updated grid and axis styling to match dark theme (rgba colors with opacity)
  - Removed obsolete "score" dataKey, replaced with "occupancy_pct"
  - Added smooth animation with 800ms duration
- **LineDetailPanel Component (components/ui/LineDetailPanel.jsx):**
  - Enhanced state management to reset forecastData and error on panel open/close
  - Improved error handling displaying API error messages directly to users
  - Added proper cleanup setting empty arrays and null errors when panel closes
  - Enhanced error logging with contextual "Forecast fetch error" prefix
- **SearchBar Component (components/ui/SearchBar.jsx):**
  - Removed automatic navigation to forecast tab after line selection
  - Line selection now opens LineDetailPanel on current page without route change
  - Cleaned up TODO comments about API response format
- **Configuration:**
  - Added to-do.md to .gitignore for developer task tracking
  - Set fallback API URL in apiClient to production endpoint

### Notes
- API integration is production-ready with proper error boundaries, validation, and UX considerations
- Chart component now accurately represents crowd density with occupancy percentage instead of arbitrary scores
- Retry logic handles transient network issues and rate limiting gracefully
- Error messages are user-friendly while maintaining detailed logging for debugging
- Empty state handling prevents rendering errors when data is unavailable

## Entry · 2025-11-26 19:21 (+03)

### Commit
- **Hash:** `4e95bf6f8deeec2d0672ccaf40ab2a413caf50fa`
- **Message:** `refactor(batch_forecast): implement batch lag loading for improved performance and maintainability`

### Summary
- Optimized the Feature Store with batch lag loading and precomputed lookup caching, significantly reducing database calls and improving batch prediction performance.

### Details
- **Feature Store Optimization:**
  - Implemented `_load_lags_batch()` method in `services/store.py` to fetch lag features for multiple lines/hours in a single database query
  - Added precomputed lag lookup cache that builds an in-memory dictionary mapping (line_id, target_datetime) to lag features for O(1) retrieval
  - Introduced seasonal lag batch loading with fallback to recent data if seasonal matches are insufficient
  - Simplified fallback handling with default zero values for missing lag features to ensure robustness
- **Performance Improvements:**
  - Reduced redundant database calls during batch prediction by loading all required lags upfront
  - Enhanced logging with timing metrics for lag loading operations to aid debugging and performance monitoring
- **Admin Endpoint Updates:**
  - Refined `/admin/forecast/test` endpoint to leverage new batch loading capabilities
  - Improved timing breakdown to isolate lag loading performance from prediction time

### Notes
- Batch lag loading is critical for improving the daily forecast job performance, especially when processing 24 hours × 500+ lines
- The precomputed cache approach trades memory for speed, suitable for the batch prediction use case
- Default zero-filled lag features ensure predictions can complete even with incomplete historical data

## Entry · 2025-11-26 19:06 (+03)

### Commit
- **Hash:** `7a8c4b879adcd3f06f345edc0c652d3187e456e6`
- **Message:** `feat(admin): add quick performance test functionality with results display`

### Summary
- Enhanced the frontend admin dashboard with a performance testing interface for quick model evaluation and bottleneck diagnosis.

### Details
- **Admin UI Testing Tools:**
  - Added "Test" button to admin page alongside existing "Run Forecast" button
  - Displays test configuration modal showing number of lines and hours tested
  - Presents timing metrics including total execution time, per-prediction average, and estimated full-job duration
  - Shows bottleneck detection highlighting if lag loading, batch processing, or result handling is the slowest component
  - Renders sample predictions table with line names, hours, and crowd scores for quick validation
- **User Experience:**
  - Test results appear in an expandable card with organized sections
  - Success/error feedback with loading states during test execution
  - Results remain visible until new test is run or page is refreshed

### Notes
- Testing tool complements the backend `/admin/forecast/test` endpoint added in previous commit
- Helps diagnose performance issues before running full 24-hour batch jobs
- Useful for validating model behavior after Feature Store or prediction pipeline changes

## Entry · 2025-11-26 19:02 (+03)

### Commit
- **Hash:** `18093481a3aa8733695e30d6763b63a11c471890`
- **Message:** `feat(admin): add `/admin/forecast/test` endpoint for quick forecast testing`

### Summary
- Created a lightweight admin endpoint for rapid forecast model testing with configurable parameters and detailed performance metrics.

### Details
- **New Admin Endpoint:**
  - Added `POST /admin/forecast/test` accepting `num_lines` (default: 5) and `num_hours` (default: 3) parameters
  - Samples random transport lines and generates predictions for the next N hours
  - Returns timing breakdown for lag loading, batch processing, and result handling
  - Provides per-prediction average time and estimated full-job execution duration
  - Includes sample predictions with line metadata and crowd scores for validation
- **Performance Analysis:**
  - Identifies bottlenecks by reporting time spent in each pipeline stage
  - Extrapolates test results to estimate full 24-hour × 500+ line job duration
  - Enables rapid iteration on Feature Store and prediction optimizations without running full batch jobs

### Notes
- Test endpoint uses the same batch forecast service components as production jobs
- Useful for validating changes to lag loading strategies, model inference, or database queries
- Estimated full-job time helps assess whether optimizations are ready for production deployment

## Entry · 2025-11-26 18:58 (+03)

### Commit
- **Hash:** `2a558a6915cf5f2d2ecf6f0b74ef76de794cfe20`
- **Message:** `refactor(batch_forecast): optimize batch prediction process and improve performance`

### Summary
- Introduced batch processing for model predictions, replacing row-by-row inference to significantly reduce execution time.

### Details
- **Batch Prediction Implementation:**
  - Refactored prediction loop in `services/batch_forecast.py` to accumulate input arrays and predict in batches
  - Batch size determined dynamically based on the number of lines × hours being processed
  - Reduced model invocation overhead by calling `model.predict()` once per batch instead of per row
- **Result Processing:**
  - Simplified result handling with metadata tracking (line_id, forecast_datetime) aligned with prediction arrays
  - Streamlined database insertion by preparing all forecast records before bulk insert
- **Logging Enhancements:**
  - Added detailed logs for input building, batch processing start/end, and result handling
  - Timing metrics help identify performance bottlenecks in the prediction pipeline

### Notes
- Batch prediction is a critical optimization for production deployment where 12,000+ predictions (500 lines × 24 hours) are generated daily
- Model inference time reduced from O(n) individual calls to O(1) batch call with n samples
- Maintains backward compatibility with existing forecast database schema and API responses

## Entry · 2025-11-26 18:50 (+03)

### Commit
- **Hash:** `0518cbfa3a73efa98354b04f57d3476b345c60ab`
- **Message:** `refactor(batch_forecast): improve logging, error handling, and prediction loop processing`

### Summary
- Enhanced batch forecast service with comprehensive logging, critical error detection, and improved handling of missing data.

### Details
- **Logging Improvements:**
  - Added detailed logging for weather data fetching with timestamp information
  - Introduced progress logging during prediction loop showing processed line count
  - Enhanced calendar feature loading logs with date range coverage
- **Error Handling:**
  - Added critical error checks for missing calendar features with raised exceptions
  - Implemented graceful handling of missing hourly weather data without excessive logging
  - Improved error context to help diagnose data availability issues
- **Code Quality:**
  - Simplified conditional logic for weather fallback scenarios
  - Ensured calendar features are validated before entering prediction loop

### Notes
- Critical error handling prevents silent failures when calendar dimension data is incomplete
- Reduced log noise for expected missing data scenarios (e.g., future weather forecasts)
- Logging enhancements aid in production debugging and monitoring

## Entry · 2025-11-26 18:36 (+03)

### Commit
- **Hash:** `c1566a21c864cab7cf142fbbfd2759275c11b5b1`
- **Message:** `refactor(forecast): improve job execution handling; add session management and stuck job reset`

### Summary
- Hardened batch forecast job execution with dedicated database session management, enhanced error handling, and an admin endpoint to recover from stuck jobs.

### Details
- **Session Management:**
  - Introduced dedicated `SessionLocal()` session for background forecast tasks to prevent lifecycle conflicts with request-scoped sessions
  - Ensures database connections are properly managed and closed in long-running batch jobs
- **Error Handling Enhancements:**
  - Added comprehensive traceback logging for job failures with full exception details
  - Implemented error message truncation (500 chars) to prevent database field overflow
  - Improved job status updates to accurately reflect COMPLETED, FAILED states
- **Admin Recovery Tools:**
  - Added `POST /admin/jobs/reset-stuck` endpoint to reset jobs stuck in RUNNING status
  - Allows manual recovery from jobs that failed due to process crashes or deployment interruptions
  - Returns count of reset jobs for audit trail
- **Logging Improvements:**
  - Enhanced logging throughout job lifecycle (start, progress, completion, failure)
  - Added forecast count feedback in job results

### Notes
- Dedicated session management resolves issues with SQLAlchemy session lifecycle in FastAPI background tasks
- Stuck job reset endpoint is critical for production operations where jobs may be interrupted by deployments
- Error message truncation prevents database constraint violations while preserving debug information in logs

## Entry · 2025-11-26 18:13 (+03)

### Commit
- **Hash:** `382084ae185fceb51b6c81db41548cf65058275c`
- **Message:** `refactor(weather): enhance hourly forecast logic and UI; add precipitation data`

### Summary
- Extended weather service and Nowcast component to include precipitation data and improved hourly forecast display clarity.

### Details
- **Backend Weather Service:**
  - Updated `services/weather.py` to fetch and include precipitation data in API responses
  - Enhanced fallback logic to provide precipitation values when live API calls fail
  - Maintained compatibility with existing temperature and weather code responses
- **Frontend Nowcast Component:**
  - Refined hourly forecast parsing logic in `Nowcast.jsx` for clearer data handling
  - Added precipitation display to the hourly forecast dropdown
  - Improved component robustness with better handling of missing or malformed weather data
- **Documentation:**
  - Updated project log and summary to reflect weather feature enhancements

### Notes
- Precipitation data complements temperature for more comprehensive weather context
- Hourly forecast UI now displays precipitation probability/amount alongside temperature
- Fallback mechanism ensures weather component remains functional even when external API is unavailable

## Entry · 2025-11-25 18:40 (+03)

### Commit
- **Hash:** `3125a54519413d79628c2fe8201710191c22a6a2`
- **Message:** `add CORS support for ibb-transport.vercel.app`

### Summary
- Enabled production frontend deployment by adding CORS origin for the Vercel-hosted application and renamed README file for user documentation.

### Details
- **Backend CORS Configuration:**
  - Updated `src/api/main.py` to include `https://ibb-transport.vercel.app` in allowed CORS origins
  - Maintains existing localhost:3000 origin for local development
  - Enables the deployed frontend to make authenticated API requests to the backend
- **Documentation Restructure:**
  - Renamed `README_USER.md` to `README.md` to serve as the primary user-facing documentation
  - User-focused README now covers platform features, crowd score interpretation, FAQ, and getting started guide

### Notes
- CORS configuration now supports both local development and production deployment environments
- The frontend is deployed on Vercel at ibb-transport.vercel.app
- Backend API credentials and methods remain unrestricted for all allowed origins

## Entry · 2025-11-25 16:24 (+03)

### Commit
- **Hash:** `5b92677c931f5d11e42bc150c99481d277794a58`
- **Message:** `chore: remove redundant documentation; integrate hourly weather sync and nowcast UI enhancements`

### Summary
- Major UI/UX improvements to the weather nowcast component with unified header layout, smooth animations, and simplified weather service architecture. Removed redundant documentation files.

### Details
- **Frontend Weather Badge Redesign:**
  - Refactored Nowcast component to align perfectly with SearchBar in unified header row (fixed h-12 height)
  - Removed weather icon display and user location dependency - now Istanbul-specific with fixed coordinates
  - Implemented smooth dropdown animations (400ms ease-in-out with staggered item transitions)
  - Added intelligent hover/click behavior with delays (300ms expand, 800ms collapse)
  - Cleaned up 100+ lines of redundant code (icon mapping, location throttling, unused functions)
  - Simplified to show only temperature + "İstanbul" label with hourly forecast expansion
- **Layout Improvements:**
  - Updated SearchBar and weather badge to use consistent h-12 height for perfect alignment
  - Changed weather badge to dynamic width (w-auto) in minimized state for content-based sizing
  - Positioned both components in same row with proper gap spacing and z-index hierarchy
- **Backend Weather Service:**
  - Optimized weather.py with improved error handling and retry logic
  - Created weather_backup.py preserving original implementation
  - Streamlined nowcast API integration with OpenMeteo
- **Documentation Cleanup:**
  - Removed redundant GEMINI.md and Turkish README.md files
  - Added frontend DESIGN_SYSTEM.md for UI component guidelines

### Notes
- Weather component now follows Istanbul-specific design pattern (aligns with app's transit focus)
- Removed reverse geocoding complexity in favor of simpler, faster implementation
- All animations tested and working consistently across mobile and desktop screens
- Component refresh interval set to 30 minutes to balance freshness with API efficiency

## Entry · 2025-11-25 13:37 (+03)

### Commit
- **Hash:** `b7a80b31542bae888082b79e6d01166e13178f30`
- **Message:** `add backend API for admin, forecast, and line search; frontend admin dashboard integration, and deployment setup`

### Summary
- Developed the core backend API with endpoints for administration, forecasts, and line searches, and integrated the admin dashboard with the backend. Also, configured the production deployment environment.

### Details
- Created a FastAPI backend with routers for `admin`, `forecast`, and `lines`.
- Implemented an admin dashboard in the frontend to interact with the new admin endpoints.
- Added a search functionality for transport lines in the frontend.
- Configured `docker-compose.yml` and `Dockerfile` for production deployment.
- Added `DEPLOY.md` with deployment instructions.

### Notes
- This commit establishes the core backend functionality and prepares the project for production deployment.

# Project Logbook

_Last updated: 2025-11-24_

## Log Schema
- **Timestamp:** Commit date and hour (local timezone) recorded from repository history.
- **Commit:** Hash and message identifying the change captured in the log.
- **Summary:** One-line status of the project immediately after the commit.
- **Details:** Key updates introduced in the commit with brief explanations.
- **Notes:** Additional context or decisions relevant to the logged work.

## Entry · 2025-11-24 15:00 (+03)

### Commit
- **Hash:** `828d5aee70a696634f5b6fa51f3f3b48bd9bd1c9`
- **Message:** `add alert component and locate button for user location tracking; integrate with map and store`

### Summary
- Implemented a "Current Location" feature with a floating button on the map and replaced the default browser alert with a custom, modern alert component.

### Details
- Added a "Locate Me" button to the map that uses the browser's Geolocation API to find the user's location.
- The map view now centers on the user's location and displays a custom, modern marker.
- The button is positioned at the bottom right, above the tab bar, and styled to be modern and borderless.
- Created a new `Alert.jsx` component for displaying error messages, managed through the global Zustand store.
- The alert component is styled according to the project's design system and automatically dismisses after 5 seconds.
- Updated the `useAppStore` to manage state for both user location and alert messages.

### Notes
- The new alert system provides a more integrated and user-friendly way to display notifications.
- The "Locate Me" feature enhances user experience by allowing quick map orientation to their current position.

## Entry · 2025-11-19 19:59 (+03)

### Commit
- **Hash:** `e8854d7`
- **Message:** `add frontend setup with Next.js, Tailwind CSS, and initial components`

### Summary
- Established the initial frontend application structure with Next.js and Tailwind CSS.

### Details
- Created the basic frontend skeleton with a mobile-first design.
- Implemented the main map view, a search bar, and a bottom navigation bar.
- Set up the project with a dark/marine theme using a custom color palette in Tailwind CSS.
- Added a data layer with dummy data for transport lines and a Zustand store for state management.
- Implemented a line detail panel with a chart to display crowd forecast data.
- Added a time slider to control the displayed hour.
- Implemented multi-page navigation with separate pages for "Forecast" and "Settings".

### Notes
- This commit marks the initial setup of the frontend application. The components are functional but use dummy data.

## Entry · 2025-11-19 18:03 (+03)

### Commit
- **Hash:** `c100978`
- **Message:** `add random forest baseline training script, evaluation metrics, and update documentation`

### Summary
- Added a Random Forest baseline model to the project for performance comparison.

### Details
- Created `src/model/utils/train_rf_baseline.py` to train a Random Forest model as a baseline.
- The script is designed to be run from the Makefile, but the evaluation has not been performed yet.
- Updated project documentation to reflect the addition of the new baseline model.

### Notes
- The Random Forest model is intended to provide an additional baseline for evaluating the performance of the main LightGBM models. The evaluation reports for this model will be generated later.

## Entry · 2025-11-18 16:51 (+03)

### Commit
- **Hash:** `88e5ee2`
- **Message:** `add evaluation results and reports for lgbm_transport_v6, update project documentation`

### Summary
- Added evaluation results for the new v6 model and updated project documentation.

### Details
- Generated evaluation reports and metrics for the `lgbm_transport_v6` model.
- The v6 model achieves a MAE of 72.77 on the unseen test set, which is a 74.9% improvement over the 24-hour lag baseline.
- Updated `project-log.md` and `project-summary.md` to reflect the latest changes and model performance.

### Notes
- The v6 model shows strong performance, especially in improving upon the baseline. The top 10 worst performing lines are consistent with previous models, with MARMARAY and metro lines having the highest MA
E.

## Entry · 2025-11-17 16:17 (+03)

### Commit
- **Hash:** `b441ca9`
- **Message:** `refactor: Overhaul model evaluation and testing scripts for robustness`

### Summary
- Refactored the model evaluation and testing scripts to be configuration-driven, robustly handling multiple model versions and fixing critical data-handlin
g bugs.

### Details
- Rewrote `src/model/eval_model.py` to dynamically load the correct configuration (`v1.yaml`, `v5.yaml`, etc.) for each model being evaluated, ensuring a pe
rfect match with the training environment.
- Fixed a persistent `ValueError` related to categorical feature encoding by ensuring the evaluation script mimics the training script's data handling (usin
g combined train+validation sets for category mapping).
- Re-integrated denormalization logic into `eval_model.py` (controlled by a `needs_denormalization` config flag) to correctly process older, normalized mode
ls.
- Rewrote `src/model/test_model.py` as a command-line tool that accepts a model version (e.g., `v5`) and loads its configuration dynamically, removing all h
ardcoded values.
- Added detailed segment analysis (MAE by hour, top 10 worst lines) back into the evaluation and test reports.

### Notes
- This major refactoring makes the model evaluation and testing pipeline significantly more robust, maintainable, and resilient to changes in model configur
ations.

## Entry · 2025-11-13 20:43 (+03)

### Commit
- **Hash:** `fbfaacc`
- **Message:** `add new model (v4) evaluation results and test model`

### Summary
- Added a new model (v4) and its evaluation results. Also added a script to test the models.

### Details
- Added a new model configuration `v4.yaml` for the LightGBM model.
- Trained the v4 model and generated evaluation results, including metrics and feature importance.
- Added `src/model/test_model.py` to load a trained model and make predictions on a sample of data.
- Updated the evaluation script to include the v4 model in the comparison reports.

### Notes
- The new v4 model uses a different set of hyperparameters, which are defined in `src/model/config/v4.yaml`.
- The `test_model.py` script can be used to quickly test any of the trained models.

## Entry · 2025-11-10 21:23 (+03)

### Commit
- **Hash:** `2e57a76`
- **Message:** `enhance eval script with unified model processing, and update dependencies`

### Summary
- Refactored the modeling pipeline to be configuration-driven, integrated MLflow for experiment tracking, and unified the evaluation script to process all available models automatically.

### Details
- Restructured `src/model/train_model.py` to load all parameters from YAML files (`v1.yaml`, `v2.yaml`, etc.), making experiments more repeatable and easier to define.
- Integrated `mlflow` into the training script to log parameters, metrics (MAE, MSE), and the trained model artifact for each run, establishing a formal experiment tracking system.
- Heavily refactored `src/model/eval_model.py` to automatically discover all model files (`.txt`) in the `/models` directory instead of hardcoding paths for v1 and v2.
- The evaluation script now generates a single, unified comparison report (`evaluation_summary_all.csv` and `.json`) for all discovered models.
- Added on-demand artifact generation to the evaluation script, which now creates feature importance and SHAP plots only if they are missing for a given model.
- Created a new `src/model/utils` directory to house shared utilities for configuration loading (`config_loader.py`), data preparation (`data_prep.py`), and path management (`paths.py`), improving code orga
nization.
- Updated `requirements.txt` to include `PyYAML` and `mlflow`.

### Notes
- This commit marks a shift from standalone, version-specific scripts to a more robust, scalable, and reproducible MLOps-style pipeline.
- The new evaluation script is idempotent; it can be run multiple times and will only generate missing reports or artifacts.

## Entry · 2025-11-05 12:42 (+03)

### Commit
- **Hash:** `b620000`
- **Message:** `add evaluation and training scripts for models v1/v2, update feature splitting, and enhance requirements with new dependencies`

### Summary
- Delivered the repository’s first full modeling loop, from normalized LightGBM training through a multi-baseline evaluation and SHAP explainability assets, to validate the v1/v2 architecture.

### Details
- Added `src/model/train_model.py` to orchestrate the v1 normalized LightGBM pipeline: caps per-line outliers, derives `y_norm`, handles categorical typing, trains with early stopping, then persists the boo
ster alongside gain-based feature importances, CSV exports, and PNG charts under `models/` and `reports/`.
- Embedded a commented v2 configuration within the training script documenting the alternative hyperparameters, callbacks, and artifact naming (`lgbm_transport_v2.txt`) so follow-up tuning work can be activ
ated without rewriting the setup.
- Authored `src/model/eval_model.py` to reload v1/v2 boosters, denormalize predictions with train-set statistics, and benchmark them against lag-24h, lag-168h, and line+hour means while emitting MAE/RMSE/SM
APE metrics, per-hour slices, worst-line diagnostics, SHAP summaries, and improvement ratios to JSON/CSV/PNG outputs.
- Refined `src/features/split_features.py` by parsing `datetime` before applying the cutoff windows and dropping both `datetime` and `year`, keeping the split parquet files free from leak-prone time columns
 for downstream modeling scripts.
- Expanded `requirements.txt` with `matplotlib` for plotting and `shap` for model explainability, satisfying the new training and evaluation dependencies in a single install step.

### Notes
- Regenerate the split parquet files before training so `train_model.py` can build normalized datasets, and align the saved booster filenames (e.g., rename `lgbm_transport_v1_norm.txt` to the name expected 
by `eval_model.py`) ahead of running the evaluation workflow.
- SHAP sampling in `eval_model.py` draws 5k validation rows; ensure the environment has sufficient memory/GPU (if available) or reduce the sample size for constrained setups.

## Entry · 2025-11-04 13:18 (+03)

### Commit
- **Hash:** `5de9afd`
- **Message:** `update requirements and add feature splitting script`

### Summary
- Added train/validation/test parquet splits and modeling dependencies to prepare feature sets for upcoming experiments.

### Details
- Extended `requirements.txt` with `numpy`, `lightgbm`, and `scikit-learn` to support planned model training workflows.
- Updated `src/features/build_final_features.py` to retain the `datetime` column by dropping only `date`, ensuring downstream scripts can time-slice outputs.
- Authored `src/features/split_features.py` to partition `features_pd.parquet` into train, validation, and test parquet files under `data/processed/split_features`.

### Notes
- Execute the new split script after regenerating `features_pd.parquet`, and confirm the `data/processed/split_features` directory exists before writing outputs.
- Consider parameterizing the datetime cutoffs or sourcing them from configuration once the modeling workflow stabilizes.

## Entry · 2025-11-01 17:38 (+03)

### Commit
- **Hash:** `c98e0af`
- **Message:** `add end-to-end feature generation pipeline`

### Summary
- Stitched lag features, weather, and calendar signals into a reproducible feature mart with automated quality checks and pandas export support.

### Details
- Redirected hourly aggregation outputs in `src/data_prep/load_raw.py` to `data/interim` to distinguish staging artifacts from processed modeling assets.
- Hardened calendar dimension typing by casting weekend and school-term indicators to `Int8`, preventing Polars-to-parquet boolean drift before joins.
- Assembled the modeling-ready dataset via `src/features/build_final_features.py`, joining lagged transport, weather, and calendar tables and normalizing categorical/time features prior to persisting `featu
res_pl.parquet`.
- Normalized the weather dimension to use a `datetime` column and consistent timestamp logging, enabling direct joins without timezone conversion hacks.
- Authored `src/features/check_features_quality.py` for Polars-based data quality audits, producing timestamped logs under `docs/data_quality_log_pl.txt` with schema, null, and range diagnostics.
- Added `src/features/convert_features_to_pandas.py` to emit `features_pd.parquet`, keeping downstream notebooks aligned with pandas tooling.

### Notes
- Recommended execution order: rebuild interim transport aggregates → run lag/rolling feature generator → execute `build_final_features.py` before QA and pandas export scripts.
- Ensure `docs/data_quality_log_pl.txt` is gitignored or rotated; the QA script appends logs on each run and may require periodic pruning.

## Entry · 2025-11-01 14:53 (+03)

### Commit
- **Hash:** `b2e5c94`
- **Message:** `add lag/rolling feature generation`

### Summary
- Introduced lag and rolling feature generation pipeline and aligned data exploration output with the new dataset.

### Details
- Added `src/features/build_log_roliing_transport_data.py` to engineer per-line lag features and rolling statistics before writing `lag_rolling_transport_hourly.parquet`.
- Updated `src/data_prep/explore_data.py` to inspect the new lag and rolling dataset for quick validation of feature outputs.
- Removed `src/data_prep/clean_weather_data.py`, consolidating weather rounding into upstream preparation steps and eliminating redundant processing.

### Notes
- Ensure `transport_hourly.parquet` is regenerated before running the lag and rolling builder so features shift over a complete hourly history.
- Consider folding the lag and rolling computation into the model training pipeline to avoid manual parquet exports once modeling scripts solidify.

## Entry · 2025-10-31 17:30 (+03)

### Commit
- **Hash:** `a7af96f`
- **Message:** `generate weather dimensional table with historical data and cleaning script`

### Summary
- Added hourly weather dimension builder with cached download and rounding cleanup steps.

### Details
- Introduced `src/features/build_weather_dim.py` to fetch 2022–2024 hourly weather via Open-Meteo with request caching and persist `weather_dim.parquet`.
- Created `src/data_prep/clean_weather_data.py` to round temperature, precipitation, and wind speed values in the weather dimension file.
- Extended `requirements.txt` with Open-Meteo client, caching, and retry dependencies needed for the new pipeline.

### Notes
- Ensure `../../data/cache` exists before running the weather builder so the cached session can persist responses.
- Update downstream jobs to consume `weather_dim.parquet` after the cleaning script to avoid duplicate rounding operations.

## Entry · 2025-10-31 00:42 (+03)

### Commit
- **Hash:** `94da046`
- **Message:** `generate calendar dimensional table for 2022-2031 with holidays and seasons`

### Summary
- Added calendar dimension generator covering 2022–2031 with weekend, season, school term, and holiday context.

### Details
- Created `src/features/build_calendar_dim.py` to construct daily records via Polars, join external holiday CSVs, and persist `calendar_dim.parquet`.
- Derived season labels, holiday leading/lag indicators, and school term flag directly within the feature script.
- Emits preview output to stdout for quick verification after parquet write.

### Notes
- Script expects `../../data/raw/holidays-2022-2031.csv`; guard for missing file or parameterize the path when integrating into pipelines.
- Consider promoting helper functions (season mapping, holiday windows) for reuse across future feature jobs.

## Entry · 2025-10-30 23:02 (+03)

### Commit
- **Hash:** `445d01c`
- **Message:** `process line-level metadata and update README with project overview`

### Summary
- Swapped district aggregation for line metadata export and published initial README overview.

### Details
- Replaced the active Polars pipeline in `src/data_prep/load_raw.py` to materialize a `transport_meta.parquet` dataset capturing unique line attributes.
- Commented out prior district/hour aggregation block, pausing both `transport_hourly.parquet` and `transport_district_hourly.parquet` outputs.
- Populated `README.md` with project summary, setup steps, repository structure, and documentation links.

### Notes
- Confirm whether downstream tooling still depends on the hourly parquet files and restore them if needed alongside the new metadata export.
- Consider renaming `district_meta` to reflect line-level content for clarity and future maintainability.

## Entry · 2025-10-30 22:33 (+03)

### Commit
- **Hash:** `ea6c7a3`
- **Message:** `process district-level hourly data and add cleaning script`

### Summary
- Pivoted aggregation pipeline to district/hour granularity and introduced basic cleaning utilities.

### Details
- Added `src/data_prep/clean_data.py` pandas helper to drop records with missing `town` and persist a cleaned parquet for downstream use.
- Reworked `src/data_prep/load_raw.py` to build `transport_district_hourly.parquet` via Polars, commenting out the previous line-level aggregation in the process.
- Expanded `src/data_prep/explore_data.py` diagnostics to surface dataset head/tail snapshots plus null and missing row counts.

### Notes
- New cleaning script relies on relative paths resolved from the execution directory; consider anchoring to `Path(__file__).parent` to avoid failures when run from the project root.
- Line-level parquet generation is now disabled, yet `explore_data.py` still targets `transport_hourly.parquet`; align the scripts or reinstate the line-level export to prevent stale references.

## Entry · 2025-10-29 22:17 (+03)

### Commit
- **Hash:** `28e59d2`
- **Message:** `add initial project setup and data processing`

### Summary
- Established baseline project files and implemented foundational data ingestion utilities.

### Details
- Introduced empty `Makefile` and `README.md` placeholders to scaffold project automation and documentation.
- Added `requirements.txt` with core data tooling dependencies (`polars`, `pandas`, `pyarrow`, `pathlib`).
- Implemented `src/data_prep/load_raw.py` to aggregate raw CSVs into hourly parquet outputs using Polars streaming.
- Created `src/data_prep/explore_data.py` helper for quick parquet inspection and basic dataset diagnostics.
- Updated `.gitignore` with additional patterns suited to the new project structure.

### Notes
- Represents first substantial code drop beyond baseline ignore file; subsequent commits should track feature engineering, modeling, and service layers.

## Entry · 2025-10-29 17:07 (+03)

### Commit
- **Hash:** `bee9760`
- **Message:** `first commit`

### Summary
- Initial repository setup with `.gitignore` baseline; further source files pending future commits.

### Details
- Added comprehensive `.gitignore` (258 lines) covering Python artifacts, environment folders, IDE settings, and build outputs to keep the repository clean from generated files.

### Notes
- Serves as the initial baseline commit; subsequent work (documentation, data ingestion scripts, tooling) remains to be committed and logged in future entries.
