from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(
    title="Transcriber API",
    description="音声ファイルから文字起こしを行うAPI",
    version="0.1.0",
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切に制限する
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# モデル定義
class TranscriptionResponse(BaseModel):
    id: str
    text: str
    duration: float
    created_at: str


@app.get("/")
async def root():
    return {"message": "Transcriber API"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    音声ファイルをアップロードして文字起こしを行う
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="ファイルが提供されていません")

    # ここに実際の文字起こし処理を実装
    # 現在はダミーレスポンスを返す
    return {
        "id": "sample-id-123",
        "text": "これはサンプルの文字起こしテキストです。",
        "duration": 30.5,
        "created_at": "2025-04-11T12:00:00Z",
    }


@app.get("/api/transcriptions", response_model=List[TranscriptionResponse])
async def get_transcriptions():
    """
    文字起こし結果の一覧を取得する
    """
    # ここに実際のデータベース検索処理を実装
    # 現在はダミーデータを返す
    return [
        {
            "id": "sample-id-123",
            "text": "これはサンプルの文字起こしテキストです。",
            "duration": 30.5,
            "created_at": "2025-04-11T12:00:00Z",
        }
    ]


@app.get("/api/transcriptions/{transcription_id}", response_model=TranscriptionResponse)
async def get_transcription(transcription_id: str):
    """
    特定の文字起こし結果を取得する
    """
    # ここに実際のデータベース検索処理を実装
    # 現在はダミーデータを返す
    return {
        "id": transcription_id,
        "text": "これはサンプルの文字起こしテキストです。",
        "duration": 30.5,
        "created_at": "2025-04-11T12:00:00Z",
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
