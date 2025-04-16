import json
import os
from typing import Optional, Union

import redis
import ulid
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from rq import Queue

from .summarization import process_summarization

# Application settings
REDIS_TTL = 60 * 60 * 24  # 24 hours (seconds)

# Redis connection settings
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Connect to Redis
redis_conn = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
queue = Queue(connection=redis_conn)

app = FastAPI(
    title="Summarizer API",
    description="API for text summarization",
    version="0.1.0",
)

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Should be properly restricted in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Model definitions
class SummarizeRequest(BaseModel):
    text: str
    strength: int = Field(..., ge=1, le=5, description="Summarization strength (1-5)")


class SummarizeResponse(BaseModel):
    request_id: str


class SummarizeStatusResponse(BaseModel):
    status: str
    summary: Optional[str] = None
    error: Optional[str] = None
    expires_at: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str


@app.get("/")
async def root():
    return {"message": "Summarizer API"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/summarize", status_code=202, response_model=SummarizeResponse)
async def summarize_text(request: SummarizeRequest):
    """
    Register a job to summarize text
    """
    if not request.text:
        raise HTTPException(status_code=400, detail={"error": "invalid input"})

    # Generate request ID
    request_id = str(ulid.ULID())

    # Save initial status to Redis
    redis_conn.setex(
        f"summarize:{request_id}", REDIS_TTL, json.dumps({"status": "pending"})
    )

    # Enqueue RQ job
    queue.enqueue(process_summarization, request_id, request.text, request.strength)

    return {"request_id": request_id}


@app.get(
    "/summarize/{request_id}",
    response_model=Union[SummarizeStatusResponse, ErrorResponse],
    response_model_exclude_none=True,
    responses={
        200: {"model": SummarizeStatusResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def get_summarization(request_id: str):
    """
    Get summarization result
    """
    # Get result from Redis
    result = redis_conn.get(f"summarize:{request_id}")

    if not result:
        raise HTTPException(status_code=404, detail={"error": "request not found"})

    try:
        # Parse string as JSON
        if isinstance(result, str):
            result_str = result
        elif isinstance(result, bytes):
            result_str = result.decode("utf-8")
        else:
            raise ValueError("Unexpected result type")

        # Convert JSON to dictionary
        summarization_result = json.loads(result_str)
        return summarization_result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal server error"})


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
