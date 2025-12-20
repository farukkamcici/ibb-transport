"""Bus schedule prefetching and persistent caching service.

Caches IETT planned bus schedules (PlanlananSeferSaati) in Postgres to avoid
runtime SOAP/XML timeouts and improve daytime reliability.

Data is stored per (line_code, valid_for, day_type) where day_type is one of:
- I: weekday (Mon-Fri)
- C: Saturday
- P: Sunday
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional, Tuple

import requests
import xml.etree.ElementTree as ET
from sqlalchemy import func
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from ..models import BusScheduleCache, TransportLine

logger = logging.getLogger(__name__)


class BusScheduleCacheService:
    """Handles fetching and persistent caching of IETT planned bus schedules."""

    IETT_API_URL = "https://api.ibb.gov.tr/iett/UlasimAnaVeri/PlanlananSeferSaati.asmx"
    SOAP_ACTION = "http://tempuri.org/GetPlanlananSeferSaati_XML"

    SOAP_ENVELOPE_TEMPLATE = """<?xml version=\"1.0\" encoding=\"utf-8\"?>
<soap:Envelope xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" 
               xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\" 
               xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">
  <soap:Body>
    <GetPlanlananSeferSaati_XML xmlns=\"http://tempuri.org/\">
      <HatKodu>{line_code}</HatKodu>
    </GetPlanlananSeferSaati_XML>
  </soap:Body>
</soap:Envelope>"""

    def __init__(self) -> None:
        self.tz = ZoneInfo("Europe/Istanbul")
        self.request_timeout = 15
        self.max_attempts = 3
        self.retry_backoff_seconds = 4
        self.retention_days = 5

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; IBB-Transport-Platform/1.0)',
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': self.SOAP_ACTION
        })

    # ------------------------------------------------------------------
    # Day/type helpers
    # ------------------------------------------------------------------

    def day_type_for_date(self, target: date) -> str:
        weekday = target.weekday()  # Monday=0 ... Sunday=6
        if weekday == 6:
            return "P"
        if weekday == 5:
            return "C"
        return "I"

    def today_istanbul(self) -> date:
        return datetime.now(self.tz).date()

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    def _parse_time(self, time_str: str) -> Optional[time]:
        try:
            for fmt in ["%H:%M", "%H:%M:%S", "%I:%M %p"]:
                try:
                    return datetime.strptime(time_str.strip(), fmt).time()
                except ValueError:
                    continue

            parts = time_str.strip().split(':')
            if len(parts) >= 2:
                hour = int(parts[0])
                minute = int(parts[1])
                return time(hour=hour, minute=minute)
        except Exception as exc:
            logger.warning("Failed to parse time '%s': %s", time_str, exc)
        return None

    def _parse_route_name(self, route_name: str) -> Dict[str, str]:
        if not route_name or ' - ' not in route_name:
            return {"start": "", "end": ""}
        parts = route_name.split(' - ', 1)
        if len(parts) == 2:
            return {"start": parts[0].strip(), "end": parts[1].strip()}
        return {"start": "", "end": ""}

    def _parse_xml_response(self, xml_text: str) -> Optional[List[Dict]]:
        try:
            root = ET.fromstring(xml_text)

            namespaces = {
                'soap': 'http://schemas.xmlsoap.org/soap/envelope/',
                'diffgr': 'urn:schemas-microsoft-com:xml-diffgram-v1',
                'msdata': 'urn:schemas-microsoft-com:xml-msdata'
            }

            body = root.find('.//NewDataSet', namespaces)
            if body is None:
                body = root.find('.//NewDataSet')
            if body is None:
                logger.warning("No NewDataSet found in XML response")
                return None

            tables = body.findall('.//Table')
            if not tables:
                logger.warning("No Table elements found in XML response")
                return None

            schedule_data: List[Dict] = []
            for table in tables:
                record: Dict[str, str] = {}
                for child in table:
                    tag = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                    record[tag] = child.text if child.text else ""
                if record:
                    schedule_data.append(record)

            return schedule_data

        except ET.ParseError as exc:
            logger.error("XML parsing error: %s", exc)
            return None
        except Exception as exc:
            logger.error("Unexpected error parsing XML: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Fetch helpers
    # ------------------------------------------------------------------

    def fetch_schedule_from_api(self, line_code: str) -> List[Dict]:
        """Fetch raw schedule rows from IETT SOAP API."""
        soap_body = self.SOAP_ENVELOPE_TEMPLATE.format(line_code=line_code)

        last_error: Optional[str] = None
        for attempt in range(1, self.max_attempts + 1):
            try:
                resp = self.session.post(
                    self.IETT_API_URL,
                    data=soap_body.encode('utf-8'),
                    timeout=self.request_timeout
                )
                resp.raise_for_status()
                parsed = self._parse_xml_response(resp.text)
                if parsed is None:
                    raise RuntimeError("Failed to parse IETT schedule XML")
                return parsed
            except (requests.Timeout, requests.RequestException, RuntimeError) as exc:
                last_error = str(exc)
                logger.warning(
                    "IETT schedule fetch failed for line=%s attempt=%s/%s: %s",
                    line_code,
                    attempt,
                    self.max_attempts,
                    exc
                )
                if attempt < self.max_attempts:
                    # linear backoff, keeps runtime predictable
                    import time as _time
                    _time.sleep(self.retry_backoff_seconds * attempt)

        raise RuntimeError(last_error or "Unknown IETT schedule failure")

    def build_filtered_payload(self, raw_data: List[Dict], *, target_date: date) -> Dict:
        """Filter raw rows by target_date day_type and build canonical response payload."""
        day_type = self.day_type_for_date(target_date)

        schedules_by_direction: Dict[str, List[str]] = {'G': [], 'D': []}
        route_names_by_direction: Dict[str, str] = {}

        for record in raw_data:
            schedule_day_type = record.get('SGUNTIPI') or record.get('sguntipi') or record.get('GunTipi')
            direction = record.get('SYON') or record.get('syon') or record.get('Yon')
            time_str = record.get('DT') or record.get('dt') or record.get('Saat')
            route_name = record.get('HATADI') or record.get('hatadi') or record.get('HatAdi') or ""

            if not all([schedule_day_type, direction, time_str]):
                continue
            if schedule_day_type != day_type:
                continue

            if direction not in route_names_by_direction and route_name:
                route_names_by_direction[direction] = route_name

            if direction in schedules_by_direction:
                schedules_by_direction[direction].append(time_str)

        # Sort times chronologically
        for direction in schedules_by_direction:
            parsed_times = []
            for ts in schedules_by_direction[direction]:
                parsed = self._parse_time(ts)
                if parsed:
                    parsed_times.append((parsed, ts))
            parsed_times.sort(key=lambda x: x[0])
            schedules_by_direction[direction] = [ts for _, ts in parsed_times]

        meta: Dict[str, Dict[str, str]] = {}
        for direction, route_name in route_names_by_direction.items():
            parsed_route = self._parse_route_name(route_name)
            if direction == 'G':
                meta['G'] = {"start": parsed_route.get('start', ''), "end": parsed_route.get('end', '')}
            elif direction == 'D':
                # reverse
                meta['D'] = {"start": parsed_route.get('end', ''), "end": parsed_route.get('start', '')}

        has_service_today = bool(schedules_by_direction['G'] or schedules_by_direction['D'])
        data_status = "OK" if has_service_today else "NO_SERVICE_DAY"

        return {
            **schedules_by_direction,
            "meta": meta,
            "has_service_today": has_service_today,
            "data_status": data_status,
            "day_type": day_type,
            "valid_for": target_date.isoformat(),
        }

    def trips_per_hour_from_payload(self, payload: Optional[Dict]) -> List[int]:
        """Compute trips-per-hour from a cached schedule payload.

        The forecast model predicts G+D total passengers, so this returns the
        combined G+D trips-per-hour counts.
        """
        counts = [0] * 24
        if not payload:
            return counts

        for direction in ("G", "D"):
            for time_str in payload.get(direction, []) or []:
                parsed = self._parse_time(time_str)
                if not parsed:
                    continue
                hour = int(parsed.hour)
                if 0 <= hour <= 23:
                    counts[hour] += 1

        return counts

    # ------------------------------------------------------------------
    # DB helpers
    # ------------------------------------------------------------------

    def store_schedule(
        self,
        db: Session,
        *,
        line_code: str,
        valid_for: date,
        day_type: str,
        payload: Dict,
        status: str = "SUCCESS",
        error_message: Optional[str] = None,
    ) -> BusScheduleCache:
        record = db.query(BusScheduleCache).filter(
            BusScheduleCache.line_code == line_code,
            BusScheduleCache.valid_for == valid_for,
            BusScheduleCache.day_type == day_type,
        ).one_or_none()

        now = datetime.utcnow()
        if record:
            record.payload = payload
            record.fetched_at = now
            record.source_status = status
            record.error_message = error_message
        else:
            record = BusScheduleCache(
                line_code=line_code,
                valid_for=valid_for,
                day_type=day_type,
                payload=payload,
                fetched_at=now,
                source_status=status,
                error_message=error_message,
            )
            db.add(record)

        db.commit()
        db.refresh(record)
        return record

    def get_cached_schedule(
        self,
        db: Session,
        line_code: str,
        *,
        valid_for: Optional[date] = None,
        max_stale_days: int = 2,
    ) -> Tuple[Optional[Dict], bool, Optional[BusScheduleCache]]:
        target = valid_for or self.today_istanbul()
        day_type = self.day_type_for_date(target)

        fresh = db.query(BusScheduleCache).filter(
            BusScheduleCache.line_code == line_code,
            BusScheduleCache.valid_for == target,
            BusScheduleCache.day_type == day_type,
            BusScheduleCache.source_status == 'SUCCESS',
        ).one_or_none()
        if fresh:
            return fresh.payload, False, fresh

        fallback = db.query(BusScheduleCache).filter(
            BusScheduleCache.line_code == line_code,
            BusScheduleCache.day_type == day_type,
            BusScheduleCache.source_status == 'SUCCESS',
            BusScheduleCache.valid_for <= target,
        ).order_by(BusScheduleCache.valid_for.desc()).first()

        if fallback and (target - fallback.valid_for).days <= max_stale_days:
            return fallback.payload, True, fallback

        return None, True, None

    def get_or_fetch_schedule(
        self,
        db: Session,
        line_code: str,
        *,
        valid_for: Optional[date] = None,
        max_stale_days: int = 2,
    ) -> Tuple[Optional[Dict], bool, bool]:
        """Return a cached schedule; on miss, fetch from upstream and persist.

        Returns:
            (payload, is_stale, fetched_live)
        """
        payload, is_stale, record = self.get_cached_schedule(
            db,
            line_code,
            valid_for=valid_for,
            max_stale_days=max_stale_days,
        )
        if payload is not None:
            return payload, is_stale, False

        target = valid_for or self.today_istanbul()
        day_type = self.day_type_for_date(target)

        try:
            raw_rows = self.fetch_schedule_from_api(line_code)
            payload = self.build_filtered_payload(raw_rows, target_date=target)
            self.store_schedule(
                db,
                line_code=line_code,
                valid_for=target,
                day_type=day_type,
                payload=payload,
                status='SUCCESS',
            )
            return payload, False, True
        except Exception as exc:
            logger.warning(
                "Live fetch failed for bus schedule line=%s valid_for=%s: %s",
                line_code,
                target,
                exc,
            )

            failed_payload = {
                "G": [],
                "D": [],
                "meta": {},
                "has_service_today": False,
                "data_status": "NO_DATA",
                "day_type": day_type,
                "valid_for": target.isoformat(),
            }
            try:
                self.store_schedule(
                    db,
                    line_code=line_code,
                    valid_for=target,
                    day_type=day_type,
                    payload=failed_payload,
                    status='FAILED',
                    error_message=str(exc)[:1000],
                )
            except Exception:
                pass

            return None, True, True

    def cleanup_old_entries(self, db: Session, *, older_than_days: Optional[int] = None) -> int:
        cutoff_days = older_than_days or self.retention_days
        cutoff = self.today_istanbul() - timedelta(days=cutoff_days)
        deleted = db.query(BusScheduleCache).filter(BusScheduleCache.valid_for < cutoff).delete()
        if deleted:
            logger.info("🧹 Deleted %s stale bus schedule cache rows (cutoff=%s)", deleted, cutoff)
        db.commit()
        return deleted

    def get_status(self, db: Session) -> Dict:
        today = self.today_istanbul()
        day_type = self.day_type_for_date(today)

        total_lines = db.query(TransportLine).filter(TransportLine.transport_type_id == 1).count()
        todays_cached = db.query(BusScheduleCache).filter(
            BusScheduleCache.valid_for == today,
            BusScheduleCache.day_type == day_type,
        ).count()
        todays_fresh = db.query(BusScheduleCache).filter(
            BusScheduleCache.valid_for == today,
            BusScheduleCache.day_type == day_type,
            BusScheduleCache.source_status == 'SUCCESS',
        ).count()

        last_entry = db.query(BusScheduleCache).order_by(BusScheduleCache.fetched_at.desc()).first()

        return {
            'today': {
                'date': today.isoformat(),
                'day_type': day_type,
                'lines_total': total_lines,
                'lines_cached': todays_cached,
                'fresh_lines': todays_fresh,
                'stale_lines': max(todays_cached - todays_fresh, 0),
            },
            'storage': {
                'entries_total': db.query(func.count(BusScheduleCache.id)).scalar() or 0,
                'last_entry_at': last_entry.fetched_at.isoformat() if last_entry else None,
                'retention_days': self.retention_days,
            },
        }


    def prefetch_all_schedules(
        self,
        db: Session,
        *,
        valid_for: Optional[date] = None,
        force: bool = False,
        limit: Optional[int] = None,
    ) -> Dict:
        """Fetch and persist schedules for all bus lines (transport_type_id == 1)."""
        target = valid_for or self.today_istanbul()
        day_type = self.day_type_for_date(target)

        q = db.query(TransportLine.line_name).filter(TransportLine.transport_type_id == 1).order_by(TransportLine.line_name)
        if limit:
            q = q.limit(limit)
        line_codes = [row[0] for row in q.all()]

        stats = {
            'target_date': target.isoformat(),
            'day_type': day_type,
            'total_lines': len(line_codes),
            'stored': 0,
            'skipped': 0,
            'failed': 0,
            'failed_lines': []
        }

        for line_code in line_codes:
            existing = db.query(BusScheduleCache).filter(
                BusScheduleCache.line_code == line_code,
                BusScheduleCache.valid_for == target,
                BusScheduleCache.day_type == day_type,
                BusScheduleCache.source_status == 'SUCCESS',
            ).one_or_none()

            if existing and not force:
                stats['skipped'] += 1
                continue

            try:
                raw_rows = self.fetch_schedule_from_api(line_code)
                payload = self.build_filtered_payload(raw_rows, target_date=target)
                self.store_schedule(
                    db,
                    line_code=line_code,
                    valid_for=target,
                    day_type=day_type,
                    payload=payload,
                    status='SUCCESS'
                )
                stats['stored'] += 1
            except RuntimeError as exc:
                stats['failed'] += 1
                error_msg = str(exc)
                stats['failed_lines'].append({'line_code': line_code, 'error': error_msg})

                failed_payload = {
                    "G": [],
                    "D": [],
                    "meta": {},
                    "has_service_today": False,
                    "data_status": "NO_DATA",
                    "day_type": day_type,
                    "valid_for": target.isoformat(),
                }
                try:
                    self.store_schedule(
                        db,
                        line_code=line_code,
                        valid_for=target,
                        day_type=day_type,
                        payload=failed_payload,
                        status='FAILED',
                        error_message=error_msg[:1000]
                    )
                except Exception:
                    pass

        self.cleanup_old_entries(db)
        return stats

    def refresh_single_line(
        self,
        db: Session,
        *,
        line_code: str,
        valid_for: Optional[date] = None,
        force: bool = True,
    ) -> Dict:
        target = valid_for or self.today_istanbul()
        day_type = self.day_type_for_date(target)

        existing = db.query(BusScheduleCache).filter(
            BusScheduleCache.line_code == line_code,
            BusScheduleCache.valid_for == target,
            BusScheduleCache.day_type == day_type,
            BusScheduleCache.source_status == 'SUCCESS',
        ).one_or_none()
        if existing and not force:
            return {'status': 'skipped', 'record_id': existing.id, 'valid_for': existing.valid_for.isoformat()}

        try:
            raw_rows = self.fetch_schedule_from_api(line_code)
            payload = self.build_filtered_payload(raw_rows, target_date=target)
            record = self.store_schedule(
                db,
                line_code=line_code,
                valid_for=target,
                day_type=day_type,
                payload=payload,
                status='SUCCESS'
            )
            return {'status': 'success', 'record_id': record.id, 'valid_for': record.valid_for.isoformat(), 'day_type': day_type}
        except RuntimeError as exc:
            return {'status': 'failed', 'error': str(exc)}


bus_schedule_cache_service = BusScheduleCacheService()
