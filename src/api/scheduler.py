"""
APScheduler-based Cron Job System for IBB Transport Platform
Handles automated forecast generation and data cleanup
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
import logging
import traceback
from typing import Dict, List, Optional

from .db import SessionLocal
from .models import DailyForecast, JobExecution
from .services.batch_forecast import run_daily_forecast_job
from .services.metro_schedule_cache import metro_schedule_cache_service
from .services.bus_schedule_cache import bus_schedule_cache_service
from .state import get_model, get_feature_store, get_capacity_store

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler(timezone="Europe/Istanbul")

# Job execution tracking
job_stats = {
    'daily_forecast': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
    'cleanup_old_forecasts': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
    'data_quality_check': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
    'metro_schedule_prefetch': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
    'bus_schedule_prefetch': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
}

metro_cache_state: Dict[str, Optional[Dict]] = {
    'pending_pairs': {},
    'last_run': None,
    'last_success': None,
    'last_result': None,
    'retry_job_id': None,
    'current_valid_for': None
}

bus_cache_state: Dict[str, Optional[Dict]] = {
    'pending_lines': {},
    'last_run': None,
    'last_success': None,
    'last_result': None,
    'retry_job_id': None,
    'current_valid_for': None
}



# ============================================================================
# JOB 1: DAILY FORECAST GENERATION
# ============================================================================

def generate_daily_forecast(target_date: Optional[date] = None, num_days: int = 2, retry_count: int = 0):
    """
    Generate forecast for target date and subsequent days (default: T+1 and T+2).
    Implements retry logic with exponential backoff.
    
    Args:
        target_date: Starting date to generate forecast for (defaults to tomorrow)
        num_days: Number of consecutive days to forecast (default: 2 for T+1 and T+2)
        retry_count: Current retry attempt number
    """
    job_name = 'daily_forecast'
    max_retries = 3
    
    try:
        # Default: tomorrow's forecast
        if target_date is None:
            target_date = date.today() + timedelta(days=1)
        
        end_date = target_date + timedelta(days=num_days - 1)
        logger.info(f"🚀 [CRON] Starting daily forecast generation for {num_days} day(s) ({target_date} to {end_date})")
        
        # Get dependencies
        db = SessionLocal()
        try:
            model = get_model()
            store = get_feature_store()
            capacity_store = get_capacity_store()
            
            # Run forecast job for multiple days
            result = run_daily_forecast_job(db, store, model, target_date, num_days, capacity_store=capacity_store)
            
            # Update stats
            job_stats[job_name]['last_run'] = datetime.now()
            job_stats[job_name]['last_status'] = result.get('status', 'unknown')
            job_stats[job_name]['run_count'] += 1
            
            if result.get('status') == 'success':
                processed = result.get('processed_count', 0)
                days = result.get('num_days', num_days)
                logger.info(f"✅ [CRON] Daily forecast completed: {processed} predictions for {days} day(s) ({target_date} to {end_date})")
                logger.info(f"📊 Fallback stats: {result.get('fallback_stats', {})}")
            else:
                raise Exception(f"Forecast job failed: {result.get('error', 'Unknown error')}")
                
        finally:
            db.close()
            
    except Exception as e:
        job_stats[job_name]['error_count'] += 1
        error_msg = f"❌ [CRON] Daily forecast failed (attempt {retry_count + 1}/{max_retries}): {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        
        # Retry logic with exponential backoff
        if retry_count < max_retries:
            retry_delay = 2 ** retry_count * 60  # 1min, 2min, 4min
            logger.info(f"🔄 Scheduling retry in {retry_delay} seconds...")
            scheduler.add_job(
                generate_daily_forecast,
                'date',
                run_date=datetime.now() + timedelta(seconds=retry_delay),
                args=[target_date, num_days, retry_count + 1],
                id=f'daily_forecast_retry_{retry_count + 1}',
                replace_existing=True
            )
        else:
            logger.critical(f"🚨 Daily forecast FAILED after {max_retries} attempts for {target_date}")
            # TODO: Send alert notification (email, Slack, etc.)


# ============================================================================
# JOB 2: CLEANUP OLD FORECASTS
# ============================================================================

def cleanup_old_forecasts(days_to_keep: int = 3):
    """
    Delete forecast records older than specified days.
    Keeps T-1, T, T+1 (yesterday, today, tomorrow) as minimum.
    
    Args:
        days_to_keep: Number of days to retain (default: 3)
    """
    job_name = 'cleanup_old_forecasts'
    db = SessionLocal()
    job_log = None
    
    try:
        # Calculate cutoff date (keep last 3 days minimum)
        cutoff_date = date.today() - timedelta(days=max(days_to_keep, 3))
        
        logger.info(f"🗑️  [CRON] Starting cleanup of forecasts before {cutoff_date}")
        
        # Create job log
        job_log = JobExecution(
            job_type="cleanup_old_forecasts",
            target_date=cutoff_date,
            status="RUNNING",
            start_time=datetime.now(),
            job_metadata={"days_to_keep": days_to_keep, "cutoff_date": str(cutoff_date)}
        )
        db.add(job_log)
        db.commit()
        db.refresh(job_log)
        
        # Count records to delete
        count_query = db.query(DailyForecast).filter(DailyForecast.date < cutoff_date)
        records_to_delete = count_query.count()
        
        if records_to_delete == 0:
            logger.info(f"✅ [CRON] No old forecasts to delete (cutoff: {cutoff_date})")
            job_stats[job_name]['last_status'] = 'success_nothing_to_delete'
            job_log.status = "SUCCESS"
            job_log.end_time = datetime.now()
            job_log.records_processed = 0
            db.commit()
            return
        
        # Delete old records
        deleted = count_query.delete()
        db.commit()
        
        # Update job log
        job_log.status = "SUCCESS"
        job_log.end_time = datetime.now()
        job_log.records_processed = deleted
        db.commit()
        
        # Update stats
        job_stats[job_name]['last_run'] = datetime.now()
        job_stats[job_name]['last_status'] = 'success'
        job_stats[job_name]['run_count'] += 1
        
        logger.info(f"✅ [CRON] Deleted {deleted} forecast records before {cutoff_date}")
        logger.info(f"💾 Database cleanup freed space for ~{deleted * 0.5}KB")
        
    except Exception as e:
        job_stats[job_name]['error_count'] += 1
        logger.error(f"❌ [CRON] Cleanup failed: {str(e)}")
        logger.error(traceback.format_exc())
        job_stats[job_name]['last_status'] = 'failed'
        
        if job_log:
            job_log.status = "FAILED"
            job_log.end_time = datetime.now()
            job_log.error_message = str(e)[:1000]
            db.commit()
    finally:
        db.close()


# ============================================================================
# JOB 3: DATA QUALITY CHECK
# ============================================================================

def data_quality_check():
    """
    Verify data quality and forecast coverage.
    Checks:
    - All dates (T-1, T, T+1) have forecasts
    - No missing hours
    - Reasonable prediction values
    - Feature store health
    """
    job_name = 'data_quality_check'
    db = SessionLocal()
    job_log = None
    issues = []
    
    try:
        logger.info(f"🔍 [CRON] Starting data quality check")
        
        # Create job log
        job_log = JobExecution(
            job_type="data_quality_check",
            target_date=date.today(),
            status="RUNNING",
            start_time=datetime.now(),
            job_metadata={"check_type": "forecast_coverage_and_quality"}
        )
        db.add(job_log)
        db.commit()
        db.refresh(job_log)
        
        try:
            # Check forecast coverage for critical dates
            critical_dates = [
                date.today() - timedelta(days=1),  # Yesterday (T-1)
                date.today(),                       # Today (T)
                date.today() + timedelta(days=1)    # Tomorrow (T+1)
            ]
            
            for check_date in critical_dates:
                # Count forecasts for this date
                forecast_count = db.query(DailyForecast).filter(
                    DailyForecast.date == check_date
                ).count()
                
                # Expected: ~500 lines × 24 hours = 12,000 records
                expected_min = 10000  # Allow some tolerance
                
                if forecast_count < expected_min:
                    issue = f"Low forecast count for {check_date}: {forecast_count} (expected >{expected_min})"
                    issues.append(issue)
                    logger.warning(f"⚠️  {issue}")
                else:
                    logger.info(f"✅ {check_date}: {forecast_count} forecasts (OK)")
            
            # Check for future forecast gaps
            future_dates = [date.today() + timedelta(days=i) for i in range(1, 4)]
            for future_date in future_dates:
                count = db.query(DailyForecast).filter(
                    DailyForecast.date == future_date
                ).count()
                
                if count == 0:
                    issue = f"Missing forecasts for {future_date}"
                    issues.append(issue)
                    logger.warning(f"⚠️  {issue}")
            
            # Summary
            job_stats[job_name]['last_run'] = datetime.now()
            job_stats[job_name]['run_count'] += 1
            
            # Update job log
            job_log.status = "SUCCESS" if not issues else "SUCCESS"
            job_log.end_time = datetime.now()
            job_log.records_processed = len(issues)
            job_log.job_metadata["issues"] = issues[:10]  # Store first 10 issues
            job_log.job_metadata["total_issues"] = len(issues)
            db.commit()
            
            if issues:
                job_stats[job_name]['last_status'] = 'issues_found'
                logger.warning(f"⚠️  [CRON] Data quality check found {len(issues)} issues")
            else:
                job_stats[job_name]['last_status'] = 'healthy'
                logger.info(f"✅ [CRON] Data quality check passed - all systems healthy")
                
        finally:
            db.close()
            
    except Exception as e:
        job_stats[job_name]['error_count'] += 1
        logger.error(f"❌ [CRON] Data quality check failed: {str(e)}")
        logger.error(traceback.format_exc())
        job_stats[job_name]['last_status'] = 'failed'
        
        if job_log:
            db_err = SessionLocal()
            try:
                job_log.status = "FAILED"
                job_log.end_time = datetime.now()
                job_log.error_message = str(e)[:1000]
                db_err.merge(job_log)
                db_err.commit()
            finally:
                db_err.close()


# ============================================================================
# JOB 4: METRO SCHEDULE PREFETCH
# ============================================================================

def prefetch_metro_schedules(target_date: Optional[date] = None, force: bool = False):
    """Fetch and persist metro timetables for all station/direction pairs."""
    job_name = 'metro_schedule_prefetch'
    target = target_date or bus_schedule_cache_service.today_istanbul()
    db = SessionLocal()
    job_log = None

    try:
        logger.info("🚇 [CRON] Starting metro timetable prefetch for %s", target)
        
        # Create job log
        job_log = JobExecution(
            job_type="metro_schedule_prefetch",
            target_date=target,
            status="RUNNING",
            start_time=datetime.now(),
            job_metadata={"force": force, "valid_for": str(target)}
        )
        db.add(job_log)
        db.commit()
        db.refresh(job_log)
        
        result = metro_schedule_cache_service.prefetch_all_schedules(
            db,
            valid_for=target,
            force=force
        )

        # Update job log
        job_log.status = "SUCCESS" if result.get('failed') == 0 else "SUCCESS"
        job_log.end_time = datetime.now()
        job_log.records_processed = result.get('cached', 0)
        job_log.job_metadata.update({
            "total_pairs": result.get('total_pairs', 0),
            "cached": result.get('cached', 0),
            "failed": result.get('failed', 0),
            "skipped": result.get('skipped', 0)
        })
        db.commit()

        job_stats[job_name]['last_run'] = datetime.now()
        job_stats[job_name]['run_count'] += 1
        job_stats[job_name]['last_status'] = 'success' if result.get('failed') == 0 else 'partial'

        metro_cache_state['last_run'] = datetime.now()
        metro_cache_state['last_result'] = result
        metro_cache_state['current_valid_for'] = target

        failed_pairs = result.get('failed_pairs', [])
        if failed_pairs:
            _set_pending_pairs(failed_pairs, target)
            _schedule_metro_retry_job()
            job_stats[job_name]['last_status'] = 'partial'
            logger.warning("🚇 [CRON] Metro prefetch completed with %s failures", len(failed_pairs))
        else:
            metro_cache_state['pending_pairs'] = {}
            metro_cache_state['last_success'] = datetime.now()
            _cancel_metro_retry_job()
            logger.info("✅ [CRON] Metro timetables cached for all %s pairs", result.get('total_pairs'))

        return result

    except Exception as exc:
        job_stats[job_name]['error_count'] += 1
        job_stats[job_name]['last_status'] = 'failed'
        logger.error("❌ [CRON] Metro timetable prefetch failed: %s", exc)
        logger.error(traceback.format_exc())
        
        if job_log:
            job_log.status = "FAILED"
            job_log.end_time = datetime.now()
            job_log.error_message = str(exc)[:1000]
            db.commit()
        raise
    finally:
        db.close()


def retry_failed_metro_pairs():
    """Retry fetching pending metro schedule pairs."""
    pending = metro_cache_state.get('pending_pairs') or {}
    if not pending:
        _cancel_metro_retry_job()
        return

    target = metro_cache_state.get('current_valid_for') or date.today()
    db = SessionLocal()
    try:
        resolutions = []
        for key, info in list(pending.items()):
            result = metro_schedule_cache_service.refresh_single_pair(
                db,
                station_id=info['station_id'],
                direction_id=info['direction_id'],
                valid_for=target,
                force=True
            )

            if result.get('status') == 'success':
                resolutions.append(key)
            else:
                info['attempts'] = info.get('attempts', 0) + 1
                info['last_error'] = result.get('error')
                if info['attempts'] >= 10:
                    info['abandoned'] = True

        for key in resolutions:
            pending.pop(key, None)

        if not pending:
            metro_cache_state['last_success'] = datetime.now()
            _cancel_metro_retry_job()
            logger.info("✅ All pending metro schedule pairs recovered")

    finally:
        db.close()


def _set_pending_pairs(failed_pairs: List[Dict], valid_for: date):
    pending = {}
    for pair in failed_pairs:
        key = f"{pair['station_id']}:{pair['direction_id']}"
        pending[key] = {
            'station_id': pair['station_id'],
            'direction_id': pair['direction_id'],
            'line_code': pair.get('line_code'),
            'station_name': pair.get('station_name'),
            'direction_name': pair.get('direction_name'),
            'last_error': pair.get('error'),
            'attempts': 0,
            'valid_for': valid_for.isoformat()
        }
    metro_cache_state['pending_pairs'] = pending


def _schedule_metro_retry_job():
    if metro_cache_state.get('retry_job_id'):
        return
    job = scheduler.add_job(
        retry_failed_metro_pairs,
        trigger=IntervalTrigger(minutes=30, timezone="Europe/Istanbul"),
        id='metro_schedule_retry',
        name='Retry Failed Metro Timetables',
        replace_existing=True
    )
    metro_cache_state['retry_job_id'] = job.id
    logger.info("🔁 Scheduled metro timetable retry job")


def _cancel_metro_retry_job():
    job_id = metro_cache_state.get('retry_job_id')
    if job_id:
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass
        metro_cache_state['retry_job_id'] = None


def get_metro_cache_runtime_state() -> Dict:
    return {
        'pending_pairs': list((metro_cache_state.get('pending_pairs') or {}).values()),
        'last_run': metro_cache_state.get('last_run').isoformat() if metro_cache_state.get('last_run') else None,
        'last_success': metro_cache_state.get('last_success').isoformat() if metro_cache_state.get('last_success') else None,
        'last_result': metro_cache_state.get('last_result'),
        'retry_job_active': bool(metro_cache_state.get('retry_job_id')),
        'target_date': metro_cache_state.get('current_valid_for').isoformat() if metro_cache_state.get('current_valid_for') else None
    }


def trigger_metro_prefetch_now(target_date: Optional[date] = None, force: bool = False):
    scheduler.add_job(
        prefetch_metro_schedules,
        'date',
        run_date=datetime.now(),
        args=[target_date, force],
        id='manual_metro_prefetch',
        replace_existing=True
    )


def trigger_single_metro_pair_refresh(station_id: int, direction_id: int, valid_for: Optional[date] = None):
    scheduler.add_job(
        refresh_single_metro_pair_job,
        'date',
        run_date=datetime.now(),
        args=[station_id, direction_id, valid_for],
        id=f'metro_pair_refresh_{station_id}_{direction_id}',
        replace_existing=True
    )


def refresh_single_metro_pair_job(station_id: int, direction_id: int, valid_for: Optional[date] = None):
    db = SessionLocal()
    try:
        metro_schedule_cache_service.refresh_single_pair(
            db,
            station_id=station_id,
            direction_id=direction_id,
            valid_for=valid_for or date.today(),
            force=True
        )
    finally:
        db.close()




# ============================================================================
# JOB 5: BUS SCHEDULE PREFETCH
# ============================================================================

def prefetch_bus_schedules(target_date: Optional[date] = None, num_days: int = 2, force: bool = False):
    """Fetch and persist IETT planned schedules for all bus lines."""
    job_name = 'bus_schedule_prefetch'
    start_date = target_date or (bus_schedule_cache_service.today_istanbul() + timedelta(days=1))
    horizon_dates = [start_date + timedelta(days=offset) for offset in range(max(1, num_days))]

    # Prefetch at least one valid_for per unique day_type in the horizon.
    day_type_dates: Dict[str, date] = {}
    for d in horizon_dates:
        dt = bus_schedule_cache_service.day_type_for_date(d)
        day_type_dates.setdefault(dt, d)

    dates_to_prefetch = list(day_type_dates.values())
    db = SessionLocal()
    job_log = None

    try:
        logger.info("🚌 [CRON] Starting bus schedule prefetch for %s day(s) starting %s", num_days, start_date)

        job_log = JobExecution(
            job_type="bus_schedule_prefetch",
            target_date=start_date,
            status="RUNNING",
            start_time=datetime.now(),
            job_metadata={
                "force": force,
                "start_date": str(start_date),
                "num_days": num_days,
                "prefetch_dates": [str(d) for d in dates_to_prefetch],
                "prefetch_day_types": sorted(day_type_dates.keys()),
            }
        )
        db.add(job_log)
        db.commit()
        db.refresh(job_log)

        results = []
        failed_lines = []
        for valid_for in dates_to_prefetch:
            result = bus_schedule_cache_service.prefetch_all_schedules(
                db,
                valid_for=valid_for,
                force=force
            )
            results.append(result)
            for row in result.get('failed_lines', []) or []:
                failed_lines.append({**row, "valid_for": valid_for.isoformat(), "day_type": result.get("day_type")})

        combined = {
            "start_date": start_date.isoformat(),
            "num_days": num_days,
            "prefetch_dates": [d.isoformat() for d in dates_to_prefetch],
            "results": results,
            "total_lines": max((r.get("total_lines", 0) for r in results), default=0),
            "stored": sum(r.get("stored", 0) for r in results),
            "failed": sum(r.get("failed", 0) for r in results),
            "skipped": sum(r.get("skipped", 0) for r in results),
            "failed_lines": failed_lines,
        }

        job_log.status = "SUCCESS"
        job_log.end_time = datetime.now()
        job_log.records_processed = combined.get('stored', 0)
        job_log.job_metadata.update({
            "total_lines": combined.get('total_lines', 0),
            "stored": combined.get('stored', 0),
            "failed": combined.get('failed', 0),
            "skipped": combined.get('skipped', 0),
        })
        db.commit()

        job_stats[job_name]['last_run'] = datetime.now()
        job_stats[job_name]['run_count'] += 1
        job_stats[job_name]['last_status'] = 'success' if combined.get('failed') == 0 else 'partial'

        bus_cache_state['last_run'] = datetime.now()
        bus_cache_state['last_result'] = combined
        bus_cache_state['current_valid_for'] = start_date

        if failed_lines:
            _set_pending_bus_lines(failed_lines)
            _schedule_bus_retry_job()
            bus_cache_state['last_success'] = bus_cache_state.get('last_success')
            job_stats[job_name]['last_status'] = 'partial'
            logger.warning("🚌 [CRON] Bus prefetch completed with %s failures", len(failed_lines))
        else:
            bus_cache_state['pending_lines'] = {}
            bus_cache_state['last_success'] = datetime.now()
            _cancel_bus_retry_job()
            logger.info("✅ [CRON] Bus schedules cached for all %s lines", result.get('total_lines'))

        return combined

    except Exception as exc:
        job_stats[job_name]['error_count'] += 1
        job_stats[job_name]['last_status'] = 'failed'
        logger.error("❌ [CRON] Bus schedule prefetch failed: %s", exc)
        logger.error(traceback.format_exc())

        if job_log:
            job_log.status = "FAILED"
            job_log.end_time = datetime.now()
            job_log.error_message = str(exc)[:1000]
            db.commit()
        raise
    finally:
        db.close()


def retry_failed_bus_lines():
    """Retry fetching pending bus lines."""
    pending = bus_cache_state.get('pending_lines') or {}
    if not pending:
        _cancel_bus_retry_job()
        return

    db = SessionLocal()
    try:
        resolved = []
        for key, info in list(pending.items()):
            line_code = info.get('line_code')
            valid_for_str = info.get('valid_for')
            if not line_code or not valid_for_str:
                resolved.append(key)
                continue

            valid_for = date.fromisoformat(valid_for_str)
            result = bus_schedule_cache_service.refresh_single_line(
                db,
                line_code=line_code,
                valid_for=valid_for,
                force=True
            )

            if result.get('status') == 'success':
                resolved.append(key)
            else:
                info['attempts'] = info.get('attempts', 0) + 1
                info['last_error'] = result.get('error')
                if info['attempts'] >= 10:
                    info['abandoned'] = True

        for key in resolved:
            pending.pop(key, None)

        if not pending:
            bus_cache_state['last_success'] = datetime.now()
            _cancel_bus_retry_job()
            logger.info("✅ All pending bus lines recovered")

    finally:
        db.close()


def _set_pending_bus_lines(failed_lines: List[Dict]):
    pending = bus_cache_state.get('pending_lines') or {}
    for row in failed_lines:
        line_code = row.get('line_code')
        valid_for = row.get('valid_for')
        if not line_code:
            continue

        pending_key = f"{line_code}|{valid_for or ''}"
        pending[pending_key] = {
            'line_code': line_code,
            'last_error': row.get('error'),
            'attempts': 0,
            'valid_for': valid_for,
            'day_type': row.get('day_type'),
        }
    bus_cache_state['pending_lines'] = pending


def _schedule_bus_retry_job():
    if bus_cache_state.get('retry_job_id'):
        return
    job = scheduler.add_job(
        retry_failed_bus_lines,
        trigger=IntervalTrigger(minutes=30, timezone="Europe/Istanbul"),
        id='bus_schedule_retry',
        name='Retry Failed Bus Schedules',
        replace_existing=True
    )
    bus_cache_state['retry_job_id'] = job.id
    logger.info("🔁 Scheduled bus schedule retry job")


def _cancel_bus_retry_job():
    job_id = bus_cache_state.get('retry_job_id')
    if job_id:
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass
        bus_cache_state['retry_job_id'] = None


def get_bus_cache_runtime_state() -> Dict:
    return {
        'pending_lines': list((bus_cache_state.get('pending_lines') or {}).values()),
        'last_run': bus_cache_state.get('last_run').isoformat() if bus_cache_state.get('last_run') else None,
        'last_success': bus_cache_state.get('last_success').isoformat() if bus_cache_state.get('last_success') else None,
        'last_result': bus_cache_state.get('last_result'),
        'retry_job_active': bool(bus_cache_state.get('retry_job_id')),
        'target_date': bus_cache_state.get('current_valid_for').isoformat() if bus_cache_state.get('current_valid_for') else None
    }


def trigger_bus_prefetch_now(target_date: Optional[date] = None, num_days: int = 2, force: bool = False):
    scheduler.add_job(
        prefetch_bus_schedules,
        'date',
        run_date=datetime.now(),
        args=[target_date, num_days, force],
        id='manual_bus_prefetch',
        replace_existing=True
    )


def trigger_single_bus_line_refresh(line_code: str, target_date: Optional[date] = None):
    scheduler.add_job(
        refresh_single_bus_line_job,
        'date',
        run_date=datetime.now(),
        args=[line_code, target_date],
        id=f'bus_line_refresh_{line_code}',
        replace_existing=True
    )


def refresh_single_bus_line_job(line_code: str, target_date: Optional[date] = None):
    db = SessionLocal()
    try:
        bus_schedule_cache_service.refresh_single_line(
            db,
            line_code=line_code,
            valid_for=target_date or bus_schedule_cache_service.today_istanbul(),
            force=True
        )
    finally:
        db.close()


# ============================================================================
# SCHEDULER LIFECYCLE MANAGEMENT
# ============================================================================

def start_scheduler():
    """
    Initialize and start the APScheduler with all cron jobs.
    Jobs are configured with Istanbul timezone.
    """
    
    logger.info("⏰ Initializing APScheduler...")
    
    # JOB 1: Bus schedule prefetch - should run before forecast
    scheduler.add_job(
        prefetch_bus_schedules,
        trigger=CronTrigger(hour=0, minute=10, timezone="Europe/Istanbul"),
        id="bus_schedule_prefetch",
        name="Prefetch Bus Schedules",
        replace_existing=True,
        misfire_grace_time=3600,  # Allow 1 hour delay if server was down
        coalesce=True  # Combine missed runs into one
    )

    # JOB 2: Metro Schedule Prefetch
    scheduler.add_job(
        prefetch_metro_schedules,
        trigger=CronTrigger(hour=2, minute=30, timezone="Europe/Istanbul"),
        id="metro_schedule_prefetch",
        name="Prefetch Metro Timetables",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True
    )

    # JOB 3: Daily Forecast (T+1..T+N)
    scheduler.add_job(
        generate_daily_forecast,
        trigger=CronTrigger(hour=4, minute=0, timezone="Europe/Istanbul"),
        id="daily_forecast",
        name="Generate Forecasts (T+1, T+2)",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True
    )

    # JOB 4: Cleanup
    scheduler.add_job(
        cleanup_old_forecasts,
        trigger=CronTrigger(hour=4, minute=15, timezone="Europe/Istanbul"),
        id="cleanup_old_forecasts",
        name="Delete Old Forecasts (>3 days)",
        replace_existing=True,
        misfire_grace_time=7200
    )

    # JOB 5: Data quality check
    scheduler.add_job(
        data_quality_check,
        trigger=CronTrigger(hour=4, minute=30, timezone="Europe/Istanbul"),
        id="data_quality_check",
        name="Verify Data Quality",
        replace_existing=True,
        misfire_grace_time=3600
    )

    # Start the scheduler
    scheduler.start()
    
    # Log scheduled jobs
    logger.info("✅ Scheduler started successfully")
    logger.info("📋 Scheduled jobs:")
    for job in scheduler.get_jobs():
        next_run = job.next_run_time.strftime("%Y-%m-%d %H:%M %Z") if job.next_run_time else "Not scheduled"
        logger.info(f"  • {job.name} (ID: {job.id})")
        logger.info(f"    Next run: {next_run}")
    
    return scheduler


def shutdown_scheduler():
    """
    Gracefully shutdown the scheduler.
    Waits for running jobs to complete.
    """
    if scheduler.running:
        logger.info("⏰ Shutting down scheduler...")
        scheduler.shutdown(wait=True)
        logger.info("✅ Scheduler stopped gracefully")


def pause_scheduler():
    """Pause all scheduled jobs (useful for maintenance)"""
    if scheduler.running:
        scheduler.pause()
        logger.info("⏸️  Scheduler paused")


def resume_scheduler():
    """Resume all scheduled jobs after pause"""
    if scheduler.running:
        scheduler.resume()
        logger.info("▶️  Scheduler resumed")


def get_scheduler_status():
    """
    Get current scheduler status and job information.
    
    Returns:
        dict: Scheduler state and job statistics
    """
    if not scheduler.running:
        return {
            'status': 'stopped',
            'jobs': []
        }
    
    jobs_info = []
    for job in scheduler.get_jobs():
        job_id = job.id
        stats = job_stats.get(job_id, {})
        
        jobs_info.append({
            'id': job_id,
            'name': job.name,
            'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
            'trigger': str(job.trigger),
            'last_run': stats.get('last_run').isoformat() if stats.get('last_run') else None,
            'last_status': stats.get('last_status'),
            'run_count': stats.get('run_count', 0),
            'error_count': stats.get('error_count', 0)
        })
    
    return {
        'status': 'paused' if scheduler.state == 2 else 'running',
        'jobs': jobs_info,
        'timezone': 'Europe/Istanbul'
    }


# ============================================================================
# MANUAL TRIGGERS (for admin panel)
# ============================================================================

def trigger_forecast_now(target_date: Optional[date] = None, num_days: int = 2):
    """
    Manually trigger forecast generation (bypasses schedule).
    
    Args:
        target_date: Starting date to generate forecast for (default: tomorrow)
        num_days: Number of consecutive days to forecast (default: 2 for T+1 and T+2)
    """
    if target_date is None:
        target_date = date.today() + timedelta(days=1)
    end_date = target_date + timedelta(days=num_days - 1)
    logger.info(f"🎯 Manual trigger: Generating forecast for {num_days} day(s) ({target_date} to {end_date})")
    scheduler.add_job(
        generate_daily_forecast,
        'date',
        run_date=datetime.now(),
        args=[target_date, num_days],
        id='manual_forecast_trigger',
        replace_existing=True
    )


def trigger_cleanup_now(days_to_keep: int = 3):
    """Manually trigger cleanup (bypasses schedule)"""
    logger.info(f"🎯 Manual trigger: Cleaning up forecasts older than {days_to_keep} days")
    scheduler.add_job(
        cleanup_old_forecasts,
        'date',
        run_date=datetime.now(),
        args=[days_to_keep],
        id='manual_cleanup_trigger',
        replace_existing=True
    )


def trigger_quality_check_now():
    """Manually trigger data quality check"""
    logger.info(f"🎯 Manual trigger: Running data quality check")
    scheduler.add_job(
        data_quality_check,
        'date',
        run_date=datetime.now(),
        id='manual_quality_check_trigger',
        replace_existing=True
    )
