"""
TechnoBrain-MENDAN Cloud Run API
FastAPI エントリーポイント
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field

from .settings import get_settings, Settings
from .audio_pipeline import process_audio_pipeline
from .webhook_sender import send_webhook, send_slack_notification
from .porters_client import import_porters_data
from .sheets_client import get_sheets_client

# ロギング設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="TechnoBrain-MENDAN API",
    description="スプレッドシートマージ・Webhook送信システム",
    version="1.0.0"
)


# ============================================
# リクエスト/レスポンスモデル
# ============================================

class ProcessAudioRequest(BaseModel):
    """音声処理リクエスト"""
    sheet_id: str = Field(..., description="スプレッドシートID")
    sheet_name: str = Field(default="merge_ui", description="シート名")
    gcs_uri: str = Field(..., description="音声ファイルのGCS URI")
    language_code: str = Field(default="ja-JP", description="言語コード")
    record_id: Optional[str] = Field(default=None, description="レコードID")
    metadata: Optional[dict] = Field(default=None, description="メタデータ（CA名、SlackメンションID等）")


class ImportPortersRequest(BaseModel):
    """Portersインポートリクエスト"""
    sheet_id: str = Field(..., description="スプレッドシートID")
    sheet_name: str = Field(default="merge_ui", description="シート名")
    porters_record_id: str = Field(..., description="PortersレコードID")


class SendWebhookRequest(BaseModel):
    """Webhook送信リクエスト"""
    record_id: Optional[str] = Field(default=None, description="レコードID")
    merged_at: str = Field(..., description="マージ日時")
    fields: list = Field(..., description="フィールドデータ")


class HealthResponse(BaseModel):
    """ヘルスチェックレスポンス"""
    status: str
    timestamp: str


class ProcessResponse(BaseModel):
    """処理結果レスポンス"""
    status: str
    message: str
    data: Optional[dict] = None


# ============================================
# 認証
# ============================================

def verify_api_key(
    x_internal_api_key: Optional[str] = Header(None),
    settings: Settings = Depends(get_settings)
) -> bool:
    """内部APIキー認証"""
    if not settings.INTERNAL_API_KEY:
        # キーが設定されていない場合はスキップ（開発用）
        logger.warning("INTERNAL_API_KEY is not set - skipping authentication")
        return True
    
    if x_internal_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return True


# ============================================
# エンドポイント
# ============================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """ヘルスチェック"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat()
    )


@app.post("/process_audio", response_model=ProcessResponse)
async def process_audio(
    request: ProcessAudioRequest,
    _: bool = Depends(verify_api_key),
    settings: Settings = Depends(get_settings)
):
    """
    音声処理エンドポイント
    
    1. GCSから音声ファイル取得
    2. Speech-to-Textで文字起こし
    3. Claude APIで項目抽出
    4. スプレッドシートのE列に書き込み
    """
    logger.info(f"Processing audio: {request.gcs_uri}")
    
    try:
        result = await process_audio_pipeline(
            sheet_id=request.sheet_id,
            sheet_name=request.sheet_name,
            gcs_uri=request.gcs_uri,
            language_code=request.language_code,
            record_id=request.record_id,
            metadata=request.metadata
        )
        
        return ProcessResponse(
            status="success",
            message="音声処理が完了しました",
            data=result
        )
        
    except Exception as e:
        logger.error(f"Audio processing error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/import_porters", response_model=ProcessResponse)
async def import_porters(
    request: ImportPortersRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Portersデータインポートエンドポイント
    
    Porters APIからデータ取得し、スプレッドシートのC列に書き込み
    """
    logger.info(f"Importing Porters data: {request.porters_record_id}")
    
    try:
        result = await import_porters_data(
            sheet_id=request.sheet_id,
            sheet_name=request.sheet_name,
            porters_record_id=request.porters_record_id
        )
        
        return ProcessResponse(
            status="success",
            message="Portersデータのインポートが完了しました",
            data=result
        )
        
    except Exception as e:
        logger.error(f"Porters import error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/send_webhook", response_model=ProcessResponse)
async def send_webhook_endpoint(
    request: SendWebhookRequest,
    _: bool = Depends(verify_api_key)
):
    """
    Webhook送信エンドポイント
    
    Secret ManagerからURL/Token取得し、Webhookへ送信
    """
    logger.info(f"Sending webhook for record: {request.record_id}")
    
    try:
        result = await send_webhook(
            payload=request.model_dump()
        )
        
        # 送信失敗時にSlack通知（任意）
        if not result.get("success", False):
            try:
                await send_slack_notification(
                    message=f"⚠️ Webhook送信エラー\n"
                            f"Record ID: {request.record_id}\n"
                            f"Status: {result.get('status_code', 'unknown')}\n"
                            f"Error: {result.get('error', result.get('response_preview', 'unknown'))[:200]}"
                )
            except Exception as slack_error:
                logger.warning(f"Slack notification failed: {slack_error}")
        
        return ProcessResponse(
            status="success",
            message="Webhook送信が完了しました",
            data=result
        )
        
    except Exception as e:
        logger.error(f"Webhook send error: {str(e)}")
        
        # 例外発生時もSlack通知を試行
        try:
            await send_slack_notification(
                message=f"🔥 Webhook送信で例外発生\n"
                        f"Record ID: {request.record_id}\n"
                        f"Error: {str(e)[:200]}"
            )
        except Exception:
            pass
        
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# アプリ起動時の処理
# ============================================

@app.on_event("startup")
async def startup_event():
    """アプリ起動時の初期化"""
    logger.info("TechnoBrain-MENDAN API starting up...")
    settings = get_settings()
    logger.info(f"GCP Project: {settings.GCP_PROJECT}")
    logger.info(f"Claude Model: {settings.CLAUDE_MODEL}")


@app.on_event("shutdown")
async def shutdown_event():
    """アプリ終了時のクリーンアップ"""
    logger.info("TechnoBrain-MENDAN API shutting down...")
