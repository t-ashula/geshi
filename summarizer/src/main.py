from typing import List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Summarizer API",
    description="テキストの要約を行うAPI",
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
class SummarizeRequest(BaseModel):
    text: str
    max_length: Optional[int] = 200


class SummaryResponse(BaseModel):
    id: str
    original_text: str
    summary: str
    created_at: str


@app.get("/")
async def root():
    return {"message": "Summarizer API"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/summarize", response_model=SummaryResponse)
async def summarize_text(request: SummarizeRequest):
    """
    テキストを要約する
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="テキストが提供されていません")

    # ここに実際の要約処理を実装
    # 現在はダミーレスポンスを返す
    return {
        "id": "sample-id-456",
        "original_text": request.text,
        "summary": f"これは「{request.text[:30]}...」の要約です。",
        "created_at": "2025-04-11T12:00:00Z",
    }


@app.get("/api/summaries", response_model=List[SummaryResponse])
async def get_summaries():
    """
    要約結果の一覧を取得する
    """
    # ここに実際のデータベース検索処理を実装
    # 現在はダミーデータを返す
    return [
        {
            "id": "sample-id-456",
            "original_text": "これは長いテキストの例です。要約されると短くなります。",
            "summary": "これは長いテキストの要約です。",
            "created_at": "2025-04-11T12:00:00Z",
        }
    ]


@app.get("/api/summaries/{summary_id}", response_model=SummaryResponse)
async def get_summary(summary_id: str):
    """
    特定の要約結果を取得する
    """
    # ここに実際のデータベース検索処理を実装
    # 現在はダミーデータを返す
    return {
        "id": summary_id,
        "original_text": "これは長いテキストの例です。要約されると短くなります。",
        "summary": "これは長いテキストの要約です。",
        "created_at": "2025-04-11T12:00:00Z",
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
