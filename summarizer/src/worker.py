import logging
import os

import redis
from rq import Connection, Queue, Worker

# Logging configuration
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("worker")

# Redis connection settings
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Connect to Redis
conn = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

if __name__ == "__main__":
    logger.info("Starting summarizer worker...")
    # Start worker
    with Connection(conn):
        worker = Worker(Queue("default"))
        worker.work()
