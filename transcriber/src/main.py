import json
import os
import shutil
from pathlib import Path
from typing import Optional, Union

import magic
import redis
import ulid
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from rq import Queue

from .transcription import process_transcription

# Application settings
UPLOAD_DIR = Path(os.getenv("GESHI_UPLOAD_DIR", "tmp/uploads"))
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)
MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024  # 1GiB
REDIS_TTL = 60 * 60 * 24  # 24 hours (seconds)

# Redis connection settings
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Connect to Redis
redis_conn = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
queue = Queue(connection=redis_conn)

app = FastAPI(
    title="Transcriber API",
    description="API for transcribing audio files to text",
    version="0.1.0",
)


# Model definitions
class TranscribeRequest(BaseModel):
    request_id: str


class TranscribeResponse(BaseModel):
    status: str
    text: Optional[str] = None
    error: Optional[str] = None
    expires_at: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str


@app.get("/")
async def root():
    return {"message": "Transcriber API"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/transcribe", status_code=202, response_model=TranscribeRequest)
async def transcribe_audio(
    file: UploadFile = File(...), language: str = Form("ja"), model: str = Form("base")
):
    """
    Upload an audio file for transcription
    """
    # Check file
    if not file.filename:
        raise HTTPException(
            status_code=400, detail={"error": "unsupported file format"}
        )

    # Check file format
    mime_type = magic.from_buffer(file.file.read(1024), mime=True)
    if mime_type != "audio/x-wav":
        raise HTTPException(
            status_code=400, detail={"error": "unsupported file format"}
        )

    # Check file size (estimated from headers)
    content_length = int(file.headers.get("content-length", 0))
    if content_length > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail={"error": "file too large"})

    # Generate request ID
    request_id = str(ulid.ULID())

    # Create upload directory
    upload_path = UPLOAD_DIR / request_id
    upload_path.mkdir(exist_ok=True)

    # Save the file
    file_path = upload_path / file.filename
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Save initial status to Redis
    redis_conn.setex(
        f"transcription:{request_id}", REDIS_TTL, json.dumps({"status": "pending"})
    )

    # Enqueue RQ job
    queue.enqueue(process_transcription, request_id, str(file_path), language, model)

    return {"request_id": request_id}


@app.get(
    "/transcribe/{request_id}",
    response_model=Union[TranscribeResponse, ErrorResponse],
    responses={
        200: {"model": TranscribeResponse},
        404: {"model": ErrorResponse},
        500: {"model": ErrorResponse},
    },
)
async def get_transcription(request_id: str):
    """
    Get transcription result
    """
    # Get result from Redis
    result = redis_conn.get(f"transcription:{request_id}")

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
        transcription_result = json.loads(result_str)
        return transcription_result
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "internal server error"})


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
