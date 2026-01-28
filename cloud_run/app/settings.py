"""
設定モジュール - 環境変数と設定値の管理
"""
import os
from functools import lru_cache


class Settings:
    """アプリケーション設定"""
    
    # GCP設定
    GCP_PROJECT: str = os.getenv("GCP_PROJECT", "technobrain-mendan")
    
    # 認証
    INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "")
    
    # Anthropic Claude API
    ANTHROPIC_API_KEY_SECRET_NAME: str = os.getenv(
        "ANTHROPIC_API_KEY_SECRET_NAME", 
        "anthropic-api-key"
    )
    CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
    
    # Webhook
    WEBHOOK_URL_SECRET_NAME: str = os.getenv(
        "WEBHOOK_URL_SECRET_NAME", 
        "webhook-url"
    )
    WEBHOOK_TOKEN_SECRET_NAME: str = os.getenv(
        "WEBHOOK_TOKEN_SECRET_NAME", 
        "webhook-token"
    )
    
    # Speech-to-Text
    SPEECH_LANGUAGE_CODE: str = os.getenv("SPEECH_LANGUAGE_CODE", "ja-JP")
    
    # シート設定
    DEFAULT_SHEET_NAME: str = "merge_ui"
    DATA_START_ROW: int = 3
    
    # 列番号（0-indexed for gspread）
    COL_LABEL: int = 0        # A列
    COL_PORTERS_CHECK: int = 1
    COL_PORTERS_VAL: int = 2
    COL_AUDIO_CHECK: int = 3
    COL_AUDIO_VAL: int = 4    # E列
    COL_MANUAL_CHECK: int = 5
    COL_MANUAL_VAL: int = 6
    COL_SOURCE: int = 7
    COL_MERGED_VAL: int = 8
    COL_CONFIDENCE: int = 9   # J列
    COL_EVIDENCE: int = 10    # K列


@lru_cache()
def get_settings() -> Settings:
    """設定インスタンスを取得（キャッシュ）"""
    return Settings()
