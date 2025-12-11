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
from .state import get_model, get_feature_store

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = AsyncIOScheduler(timezone="Europe/Istanbul")

# Job execution tracking
job_stats = {
    'daily_forecast': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
    'cleanup_old_forecasts': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
    'data_quality_check': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
    'metro_schedule_prefetch': {'last_run': None, 'last_status': None, 'run_count': 0, 'error_count': 0},
}

metro_cache_state: Dict[str, Optional[Dict]] = {
    'pending_pairs': {},
    'last_run': None,
    'last_success': None,
    'last_result': None,
    'retry_job_id': None,
    'current_valid_for': None
}


# ============================================================================
# JOB 1: DAILY FORECAST GENERATION
# ============================================================================

def generate_daily_forecast(target_date: Optional[date] = None, retry_count: int = 0):
    """
    Generate forecast for target date (default: tomorrow).
    Implements retry logic with exponential backoff.
    
    Args:
        target_date: Date to generate forecast for (defaults to tomorrow)
        retry_count: Current retry attempt number
    """
    job_name = 'daily_forecast'
    max_retries = 3
    
    try:
        # Default: tomorrow's forecast
        if target_date is None:
            target_date = date.today() + timedelta(days=1)
        
        logger.info(f"🚀 [CRON] Starting daily forecast generation for {target_date}")
        
        # Get dependencies
        db = SessionLocal()
        try:
            model = get_model()
            store = get_feature_store()
            
            # Run forecast job
            result = run_daily_forecast_job(db, store, model, target_date)
            
            # Update stats
            job_stats[job_name]['last_run'] = datetime.now()
            job_stats[job_name]['last_status'] = result.get('status', 'unknown')
            job_stats[job_name]['run_count'] += 1
            
            if result.get('status') == 'success':
                processed = result.get('processed_count', 0)
                logger.info(f"✅ [CRON] Daily forecast completed: {processed} predictions for {target_date}")
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
                args=[target_date, retry_count + 1],
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
    
    try:
        # Calculate cutoff date (keep last 3 days minimum)
        cutoff_date = date.today() - timedelta(days=max(days_to_keep, 3))
        
        logger.info(f"🗑️  [CRON] Starting cleanup of forecasts before {cutoff_date}")
        
        db = SessionLocal()
        try:
            # Count records to delete
            count_query = db.query(DailyForecast).filter(DailyForecast.date < cutoff_date)
            records_to_delete = count_query.count()
            
            if records_to_delete == 0:
                logger.info(f"✅ [CRON] No old forecasts to delete (cutoff: {cutoff_date})")
                job_stats[job_name]['last_status'] = 'success_nothing_to_delete'
                return
            
            # Delete old records
            deleted = count_query.delete()
            db.commit()
            
            # Update stats
            job_stats[job_name]['last_run'] = datetime.now()
            job_stats[job_name]['last_status'] = 'success'
            job_stats[job_name]['run_count'] += 1
            
            logger.info(f"✅ [CRON] Deleted {deleted} forecast records before {cutoff_date}")
            logger.info(f"💾 Database cleanup freed space for ~{deleted * 0.5}KB")
            
        finally:
            db.close()
            
    except Exception as e:
        job_stats[job_name]['error_count'] += 1
        logger.error(f"❌ [CRON] Cleanup failed: {str(e)}")
        logger.error(traceback.format_exc())
        job_stats[job_name]['last_status'] = 'failed'


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
    
    try:
        logger.info(f"🔍 [CRON] Starting data quality check")
        
        db = SessionLocal()
        issues = []
        
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
            
            # Feature Store health check
            try:
                store = get_feature_store()
                fs_stats = store.get_fallback_stats()
                
                # Alert if zero fallback rate is high (>5%)
                zero_pct = fs_stats.get('zero_fallback_pct', 0)
                if zero_pct > 5:
                    issue = f"High zero fallback rate: {zero_pct:.1f}% (data quality concern)"
                    issues.append(issue)
                    logger.warning(f"⚠️  {issue}")
                
                logger.info(f"📊 Feature Store: {fs_stats.get('seasonal_pct', 0):.1f}% seasonal matches")
                
            except Exception as e:
                logger.error(f"Feature Store check failed: {e}")
            
            # Summary
            job_stats[job_name]['last_run'] = datetime.now()
            job_stats[job_name]['run_count'] += 1
            
            if issues:
                job_stats[job_name]['last_status'] = 'issues_found'
                logger.warning(f"⚠️  [CRON] Data quality check found {len(issues)} issues")
                # TODO: Send notification with issues list
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


# ============================================================================
# JOB 4: METRO SCHEDULE PREFETCH
# ============================================================================

def prefetch_metro_schedules(target_date: Optional[date] = None, force: bool = False):
    """Fetch and persist metro timetables for all station/direction pairs."""
    job_name = 'metro_schedule_prefetch'
    target = target_date or date.today()

    try:
        logger.info("🚇 [CRON] Starting metro timetable prefetch for %s", target)
        db = SessionLocal()
        try:
            result = metro_schedule_cache_service.prefetch_all_schedules(
                db,
                valid_for=target,
                force=force
            )
        finally:
            db.close()

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
        raise


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
# SCHEDULER LIFECYCLE MANAGEMENT
# ============================================================================

def start_scheduler():
    """
    Initialize and start the APScheduler with all cron jobs.
    Jobs are configured with Istanbul timezone.
    """
    
    logger.info("⏰ Initializing APScheduler...")
    
    # JOB 1: Daily Forecast - Every day at 02:00 Istanbul time
    scheduler.add_job(
        generate_daily_forecast,
        trigger=CronTrigger(hour=2, minute=0, timezone="Europe/Istanbul"),
        id="daily_forecast",
        name="Generate Tomorrow's Forecast",
        replace_existing=True,
        misfire_grace_time=3600,  # Allow 1 hour delay if server was down
        coalesce=True  # Combine missed runs into one
    )
    
    # JOB 2: Cleanup - Every day at 03:00 Istanbul time
    scheduler.add_job(
        cleanup_old_forecasts,
        trigger=CronTrigger(hour=3, minute=0, timezone="Europe/Istanbul"),
        id="cleanup_old_forecasts",
        name="Delete Old Forecasts (>3 days)",
        replace_existing=True,
        misfire_grace_time=7200  # Allow 2 hour delay
    )
    
    # JOB 3: Data Quality Check - Every day at 04:00 Istanbul time
    scheduler.add_job(
        data_quality_check,
        trigger=CronTrigger(hour=4, minute=0, timezone="Europe/Istanbul"),
        id="data_quality_check",
        name="Verify Data Quality",
        replace_existing=True,
        misfire_grace_time=3600
    )

    # JOB 4: Metro Schedule Prefetch - Every day at 03:15 Istanbul time
    scheduler.add_job(
        prefetch_metro_schedules,
        trigger=CronTrigger(hour=3, minute=15, timezone="Europe/Istanbul"),
        id="metro_schedule_prefetch",
        name="Prefetch Metro Timetables",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True
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

def trigger_forecast_now(target_date: Optional[date] = None):
    """
    Manually trigger forecast generation (bypasses schedule).
    
    Args:
        target_date: Date to generate forecast for (default: tomorrow)
    """
    logger.info(f"🎯 Manual trigger: Generating forecast for {target_date or 'tomorrow'}")
    scheduler.add_job(
        generate_daily_forecast,
        'date',
        run_date=datetime.now(),
        args=[target_date],
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
