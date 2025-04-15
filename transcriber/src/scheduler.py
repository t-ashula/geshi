import logging
import os
import shutil
from pathlib import Path

import redis
from rq_scheduler import Scheduler  # type: ignore

# Logging configuration
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("scheduler")

# Redis connection settings
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Upload directory
UPLOAD_DIR = Path("uploads")

# Connect to Redis
conn = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)


# Cleanup job
def cleanup_uploads():
    logger.info("Starting cleanup job")

    # Exit if uploads directory doesn't exist
    if not UPLOAD_DIR.exists():
        logger.info("Upload directory does not exist")
        return

    # Check files in uploads directory
    for item in UPLOAD_DIR.iterdir():
        if item.is_dir():
            request_id = item.name
            # Delete if key doesn't exist in Redis
            if not conn.exists(f"transcription:{request_id}"):
                logger.info(f"Deleting unnecessary directory: {request_id}")
                try:
                    shutil.rmtree(item)
                except Exception as e:
                    logger.error(f"Failed to delete directory: {e}")

    logger.info("Cleanup job completed")


if __name__ == "__main__":
    # Initialize scheduler
    scheduler = Scheduler(connection=conn)

    # Clear existing jobs
    for job in scheduler.get_jobs():
        scheduler.cancel(job)

    # Schedule cleanup job (run daily at midnight)
    scheduler.cron("0 0 * * *", func=cleanup_uploads, id="cleanup_uploads")

    logger.info("Scheduler started")

    # Run scheduler
    scheduler.run()
