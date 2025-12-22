"""Metro schedule prefetching and caching service."""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import requests
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..clients.metro_api import metro_api_client
from ..models import MetroScheduleCache
from .metro_service import metro_service

logger = logging.getLogger(__name__)


class MetroScheduleCacheService:
    """Handles persistent caching of Metro Istanbul timetables."""

    def __init__(self) -> None:
        self.request_timeout = 12
        self.max_attempts = 3
        self.retry_backoff_seconds = 4
        self.retention_days = 5
        self._pair_cache: Optional[List[Dict]] = None
        self._pair_lookup: Dict[str, Dict] = {}

    # ------------------------------------------------------------------
    # Pair helpers
    # ------------------------------------------------------------------

    def get_station_direction_pairs(self) -> List[Dict]:
        if self._pair_cache is None:
            self._pair_cache = metro_service.get_station_direction_pairs()
            self._pair_lookup = {
                self._pair_key(pair['station_id'], pair['direction_id']): pair
                for pair in self._pair_cache
            }
        return self._pair_cache

    def get_pair_metadata(self, station_id: int, direction_id: int) -> Optional[Dict]:
        if not self._pair_lookup:
            self.get_station_direction_pairs()
        return self._pair_lookup.get(self._pair_key(station_id, direction_id))

    def _pair_key(self, station_id: int, direction_id: int) -> str:
        return f"{station_id}:{direction_id}"

    # ------------------------------------------------------------------
    # Fetch & persist helpers
    # ------------------------------------------------------------------

    def fetch_schedule_from_api(self, station_id: int, direction_id: int) -> Dict:
        payload = {
            "BoardingStationId": station_id,
            "DirectionId": direction_id
        }

        last_error: Optional[str] = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                response = metro_api_client.post(
                    "/GetTimeTable",
                    json=payload,
                    timeout=self.request_timeout
                )
                response.raise_for_status()
                data = response.json()

                if not data.get('Success'):
                    raise ValueError(data.get('Error', {}).get('Message', 'Unknown Metro API error'))

                return data
            except (requests.Timeout, requests.RequestException, ValueError) as exc:
                last_error = str(exc)
                logger.warning(
                    "Metro API timetable fetch failed for station=%s direction=%s attempt=%s/%s: %s",
                    station_id,
                    direction_id,
                    attempt,
                    self.max_attempts,
                    exc
                )
                if attempt < self.max_attempts:
                    time.sleep(self.retry_backoff_seconds * attempt)

        raise RuntimeError(last_error or "Unknown Metro API failure")

    def store_schedule(
        self,
        db: Session,
        *,
        station_id: int,
        direction_id: int,
        line_code: Optional[str],
        station_name: Optional[str],
        direction_name: Optional[str],
        valid_for: date,
        payload: Dict,
        status: str = "SUCCESS",
        error_message: Optional[str] = None
    ) -> MetroScheduleCache:
        record = db.query(MetroScheduleCache).filter(
            MetroScheduleCache.station_id == station_id,
            MetroScheduleCache.direction_id == direction_id,
            MetroScheduleCache.valid_for == valid_for
        ).one_or_none()

        now = datetime.utcnow()
        if record:
            record.payload = payload
            record.fetched_at = now
            record.source_status = status
            record.error_message = error_message
            if line_code:
                record.line_code = line_code
            if station_name:
                record.station_name = station_name
            if direction_name:
                record.direction_name = direction_name
        else:
            record = MetroScheduleCache(
                station_id=station_id,
                direction_id=direction_id,
                line_code=line_code,
                station_name=station_name,
                direction_name=direction_name,
                valid_for=valid_for,
                payload=payload,
                fetched_at=now,
                source_status=status,
                error_message=error_message
            )
            db.add(record)

        db.commit()
        db.refresh(record)
        return record

    # ------------------------------------------------------------------
    # Cache lookups
    # ------------------------------------------------------------------

    def get_cached_schedule(
        self,
        db: Session,
        station_id: int,
        direction_id: int,
        *,
        valid_for: Optional[date] = None,
        max_stale_days: int = 2
    ) -> Tuple[Optional[Dict], bool, Optional[MetroScheduleCache]]:
        target_date = valid_for or date.today()

        # Prefer fresh entry
        fresh = db.query(MetroScheduleCache).filter(
            MetroScheduleCache.station_id == station_id,
            MetroScheduleCache.direction_id == direction_id,
            MetroScheduleCache.valid_for == target_date,
            MetroScheduleCache.source_status == 'SUCCESS'
        ).one_or_none()

        if fresh:
            return fresh.payload, False, fresh

        # Fallback to most recent entry within allowed window
        fallback = db.query(MetroScheduleCache).filter(
            MetroScheduleCache.station_id == station_id,
            MetroScheduleCache.direction_id == direction_id,
            MetroScheduleCache.valid_for <= target_date
        ).order_by(MetroScheduleCache.valid_for.desc()).first()

        if fallback and (target_date - fallback.valid_for).days <= max_stale_days:
            return fallback.payload, True, fallback

        return None, True, None

    def get_latest_record(self, db: Session, station_id: int, direction_id: int) -> Optional[MetroScheduleCache]:
        return db.query(MetroScheduleCache).filter(
            MetroScheduleCache.station_id == station_id,
            MetroScheduleCache.direction_id == direction_id
        ).order_by(MetroScheduleCache.valid_for.desc()).first()

    # ------------------------------------------------------------------
    # Trips-per-hour helpers
    # ------------------------------------------------------------------

    @staticmethod
    def trips_per_hour_from_timetable_payload(payload: Optional[Dict]) -> List[int]:
        """Compute trips-per-hour from a Metro Istanbul GetTimeTable payload.

        Payload format (observed):
          { Success: bool, Data: [ { TimeInfos: { Times: ["HH:MM", ...] }, ... }, ... ] }
        """
        counts = [0] * 24
        if not payload:
            return counts

        data = payload.get("Data") or []
        if not isinstance(data, list):
            return counts

        all_times: List[str] = []
        for row in data:
            time_infos = (row or {}).get("TimeInfos") or {}
            times = time_infos.get("Times") or []
            if isinstance(times, list):
                all_times.extend([t for t in times if isinstance(t, str)])

        # Deduplicate to avoid counting multiple schedule segments.
        for time_str in set(all_times):
            parts = time_str.strip().split(':')
            if len(parts) < 2:
                continue
            try:
                hour = int(parts[0])
            except Exception:
                continue
            if 0 <= hour <= 23:
                counts[hour] += 1
        return counts

    def get_line_trips_per_hour(
        self,
        db: Session,
        line_code: str,
        *,
        valid_for: date,
        max_stale_days: int = 2,
    ) -> Optional[List[int]]:
        """Return combined (both directions) trips-per-hour for a metro line.

        Strategy:
        - Use terminus stations only (first + last station on the line).
        - For each terminus, aggregate departures across all direction_ids
          available at that station.
        - Combine both termini to get total departures per hour (both directions).

        Returns None if no usable cached timetable is found.
        """
        line_code = (line_code or "").strip()

        # Backwards-compatible alias: our forecasts use "M1" while topology uses M1A/M1B.
        # For capacity/trips we pool both branches.
        line_codes = [line_code]
        if line_code == "M1":
            line_codes = ["M1A", "M1B"]

        combined = [0] * 24
        any_found = False

        def add_station_departures(station: Dict) -> None:
            nonlocal combined, any_found

            station_id = station.get("id")
            if station_id is None:
                return

            direction_ids = [d.get("id") for d in (station.get("directions") or []) if d.get("id") is not None]
            if not direction_ids:
                return

            # Union times at the terminus across all direction variants to avoid double counting
            # when topology exposes multiple direction_ids for the same physical departure set.
            terminus_times: set[str] = set()
            for direction_id in direction_ids:
                payload, _, _ = self.get_cached_schedule(
                    db,
                    int(station_id),
                    int(direction_id),
                    valid_for=valid_for,
                    max_stale_days=max_stale_days,
                )
                if not payload:
                    continue

                data = payload.get("Data") or []
                if not isinstance(data, list):
                    continue
                for row in data:
                    time_infos = (row or {}).get("TimeInfos") or {}
                    times = time_infos.get("Times") or []
                    if isinstance(times, list):
                        terminus_times.update([t for t in times if isinstance(t, str)])

            if not terminus_times:
                return

            # Convert unioned times into per-hour counts.
            counts = self.trips_per_hour_from_timetable_payload({"Data": [{"TimeInfos": {"Times": sorted(terminus_times)}}]})
            if any(counts):
                any_found = True
                combined = [a + b for a, b in zip(combined, counts)]

        for code in line_codes:
            line = metro_service.get_line(code)
            if not line:
                continue
            stations = sorted((line.get("stations") or []), key=lambda s: s.get("order", 0))
            if not stations:
                continue

            first_station = stations[0]
            last_station = stations[-1]

            # Only count departures starting from termini. Intermediate stations include
            # pass-through trains, which would inflate capacity.
            add_station_departures(first_station)
            add_station_departures(last_station)

        return combined if any_found else None

    # ------------------------------------------------------------------
    # Prefetch orchestration
    # ------------------------------------------------------------------

    def prefetch_all_schedules(
        self,
        db: Session,
        *,
        valid_for: Optional[date] = None,
        force: bool = False,
        limit: Optional[int] = None
    ) -> Dict:
        target = valid_for or date.today()
        pairs = self.get_station_direction_pairs()
        if limit:
            pairs = pairs[:limit]

        stats = {
            'target_date': target.isoformat(),
            'total_pairs': len(pairs),
            'stored': 0,
            'skipped': 0,
            'failed': 0,
            'failed_pairs': []
        }

        for pair in pairs:
            key = self._pair_key(pair['station_id'], pair['direction_id'])
            existing = db.query(MetroScheduleCache).filter(
                MetroScheduleCache.station_id == pair['station_id'],
                MetroScheduleCache.direction_id == pair['direction_id'],
                MetroScheduleCache.valid_for == target,
                MetroScheduleCache.source_status == 'SUCCESS'
            ).one_or_none()

            if existing and not force:
                stats['skipped'] += 1
                continue

            try:
                payload = self.fetch_schedule_from_api(pair['station_id'], pair['direction_id'])
                self.store_schedule(
                    db,
                    station_id=pair['station_id'],
                    direction_id=pair['direction_id'],
                    line_code=pair.get('line_code'),
                    station_name=pair.get('station_name'),
                    direction_name=pair.get('direction_name'),
                    valid_for=target,
                    payload=payload,
                    status='SUCCESS'
                )
                stats['stored'] += 1
            except RuntimeError as exc:
                stats['failed'] += 1
                stats['failed_pairs'].append({
                    'station_id': pair['station_id'],
                    'direction_id': pair['direction_id'],
                    'line_code': pair.get('line_code'),
                    'station_name': pair.get('station_name'),
                    'direction_name': pair.get('direction_name'),
                    'error': str(exc)
                })

        self.cleanup_old_entries(db)
        return stats

    def refresh_single_pair(
        self,
        db: Session,
        station_id: int,
        direction_id: int,
        *,
        valid_for: Optional[date] = None,
        force: bool = True
    ) -> Dict:
        target = valid_for or date.today()
        pair_meta = self.get_pair_metadata(station_id, direction_id)

        if not pair_meta:
            raise ValueError("Station/direction pair not found in topology")

        try:
            payload = self.fetch_schedule_from_api(station_id, direction_id)
            record = self.store_schedule(
                db,
                station_id=station_id,
                direction_id=direction_id,
                line_code=pair_meta.get('line_code'),
                station_name=pair_meta.get('station_name'),
                direction_name=pair_meta.get('direction_name'),
                valid_for=target,
                payload=payload,
                status='SUCCESS'
            )
            return {
                'status': 'success',
                'record_id': record.id,
                'valid_for': record.valid_for.isoformat()
            }
        except RuntimeError as exc:
            return {
                'status': 'failed',
                'error': str(exc)
            }

    # ------------------------------------------------------------------
    # Maintenance / stats
    # ------------------------------------------------------------------

    def cleanup_old_entries(self, db: Session, *, older_than_days: Optional[int] = None) -> int:
        cutoff_days = older_than_days or self.retention_days
        cutoff = date.today() - timedelta(days=cutoff_days)
        deleted = db.query(MetroScheduleCache).filter(
            MetroScheduleCache.valid_for < cutoff
        ).delete()
        if deleted:
            logger.info("🧹 Deleted %s stale metro schedule cache rows (cutoff=%s)", deleted, cutoff)
        db.commit()
        return deleted

    def get_status(self, db: Session) -> Dict:
        today = date.today()
        total_pairs = len(self.get_station_direction_pairs())
        todays_cached = db.query(MetroScheduleCache).filter(MetroScheduleCache.valid_for == today).count()
        todays_fresh = db.query(MetroScheduleCache).filter(
            MetroScheduleCache.valid_for == today,
            MetroScheduleCache.source_status == 'SUCCESS'
        ).count()
        todays_stale = todays_cached - todays_fresh

        last_entry = db.query(MetroScheduleCache).order_by(MetroScheduleCache.fetched_at.desc()).first()

        return {
            'today': {
                'date': today.isoformat(),
                'pairs_total': total_pairs,
                'pairs_cached': todays_cached,
                'fresh_pairs': todays_fresh,
                'stale_pairs': max(todays_stale, 0)
            },
            'storage': {
                'entries_total': db.query(func.count(MetroScheduleCache.id)).scalar() or 0,
                'last_entry_at': last_entry.fetched_at.isoformat() if last_entry else None,
                'retention_days': self.retention_days
            }
        }


metro_schedule_cache_service = MetroScheduleCacheService()
