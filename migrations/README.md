# Database Migrations

This directory contains SQL migration scripts for the İBB Transport database schema updates.

## How to Apply Migrations

### Option 1: Using psql (Recommended for Docker deployments)

```bash
# If running in Docker
docker exec -i ibb-postgres psql -U your_user -d ibb_transport < migrations/add_target_date_to_jobs.sql

# If running locally
psql -U your_user -d ibb_transport -f migrations/add_target_date_to_jobs.sql
```

### Option 2: Using Python

```python
from sqlalchemy import create_engine, text

engine = create_engine("postgresql://user:password@localhost:5432/ibb_transport")

with open("migrations/add_target_date_to_jobs.sql") as f:
    migration_sql = f.read()

with engine.connect() as conn:
    conn.execute(text(migration_sql))
    conn.commit()
```

### Option 3: Auto-apply on Startup (for development)

The application can auto-apply migrations on startup. Add this to `src/api/main.py`:

```python
from sqlalchemy import text

@app.on_event("startup")
async def run_migrations():
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='job_executions' AND column_name='target_date';
        """))
        if not result.fetchone():
            print("Running migration: add_target_date_to_jobs...")
            with open("migrations/add_target_date_to_jobs.sql") as f:
                conn.execute(text(f.read()))
            conn.commit()
            print("✓ Migration completed")
```

## Migration History

| Date | File | Description |
|------|------|-------------|
| 2025-11-29 | `add_target_date_to_jobs.sql` | Add `target_date` column to `job_executions` table to track forecast target dates |

## Best Practices

1. **Always backup before migration**: `pg_dump ibb_transport > backup_$(date +%Y%m%d).sql`
2. **Test migrations locally first** before applying to production
3. **Migrations are idempotent**: They use `IF NOT EXISTS` to avoid errors on re-run
4. **Never delete migration files**: Keep migration history for reference

## Rollback

If needed, manually rollback the target_date migration:

```sql
ALTER TABLE job_executions DROP COLUMN IF EXISTS target_date;
DROP INDEX IF EXISTS idx_job_executions_target_date;
```
