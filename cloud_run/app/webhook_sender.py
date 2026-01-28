"""
Webhook送信モジュール
Secret ManagerからURL/Tokenを取得し、Webhookへ送信
"""
import logging
from typing import Dict, Any, Optional

import httpx
from google.cloud import secretmanager

from .settings import get_settings
from .log_utils import safe_log_dict

logger = logging.getLogger(__name__)


def get_secret(secret_name: str) -> str:
    """Secret Managerからシークレットを取得"""
    settings = get_settings()
    
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{settings.GCP_PROJECT}/secrets/{secret_name}/versions/latest"
    
    try:
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        logger.error(f"Failed to get secret {secret_name}: {e}")
        raise


async def send_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Webhookへペイロードを送信
    
    Args:
        payload: 送信するJSONペイロード
    
    Returns:
        送信結果
    """
    settings = get_settings()
    
    # 監査ログ用情報
    record_id = payload.get('record_id', 'unknown')
    idempotency_key = payload.get('idempotency_key', 'none')
    field_count = len(payload.get('fields', []))
    
    logger.info(
        f"[AUDIT] Webhook send initiated - "
        f"record_id={record_id}, "
        f"idempotency_key={idempotency_key}, "
        f"fields_count={field_count}"
    )
    
    # Secret ManagerからURL/Tokenを取得
    webhook_url = get_secret(settings.WEBHOOK_URL_SECRET_NAME)
    
    # Tokenは任意
    webhook_token: Optional[str] = None
    try:
        webhook_token = get_secret(settings.WEBHOOK_TOKEN_SECRET_NAME)
    except Exception:
        logger.info("Webhook token not configured, proceeding without auth")
    
    logger.info(f"Sending webhook to: {webhook_url[:50]}...")
    logger.debug(f"Payload (masked): {safe_log_dict(payload)}")
    
    # ヘッダー設定
    headers = {
        "Content-Type": "application/json"
    }
    
    if webhook_token:
        # Bearer tokenまたはカスタムヘッダー
        if webhook_token.startswith("Bearer "):
            headers["Authorization"] = webhook_token
        else:
            headers["Authorization"] = f"Bearer {webhook_token}"
    
    # HTTPリクエスト送信
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers
            )
            
            response_body = ""
            try:
                response_body = response.text[:500]  # 最初の500文字
            except Exception:
                pass
            
            result = {
                "status_code": response.status_code,
                "success": response.is_success,
                "response_preview": response_body
            }
            
            if response.is_success:
                logger.info(
                    f"[AUDIT] Webhook sent successfully - "
                    f"record_id={record_id}, "
                    f"status={response.status_code}, "
                    f"idempotency_key={idempotency_key}"
                )
            else:
                logger.warning(
                    f"[AUDIT] Webhook failed - "
                    f"record_id={record_id}, "
                    f"status={response.status_code}, "
                    f"idempotency_key={idempotency_key}, "
                    f"error={response_body[:200]}"
                )
            
            return result
            
        except httpx.TimeoutException:
            logger.error(
                f"[AUDIT] Webhook timeout - "
                f"record_id={record_id}, "
                f"idempotency_key={idempotency_key}"
            )
            return {
                "status_code": 0,
                "success": False,
                "error": "Request timed out"
            }
        except httpx.RequestError as e:
            logger.error(
                f"[AUDIT] Webhook error - "
                f"record_id={record_id}, "
                f"idempotency_key={idempotency_key}, "
                f"error={str(e)}"
            )
            return {
                "status_code": 0,
                "success": False,
                "error": str(e)
            }


async def send_slack_notification(
    message: str,
    channel: Optional[str] = None,
    mention_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Slack通知を送信（Webhook経由）
    
    Args:
        message: 送信メッセージ
        channel: チャンネル（任意）
        mention_id: メンションするユーザーID（任意）
    
    Returns:
        送信結果
    """
    # メンション追加
    if mention_id:
        message = f"<@{mention_id}> {message}"
    
    payload = {
        "text": message
    }
    
    if channel:
        payload["channel"] = channel
    
    # Slack Webhook URLを取得（別のシークレット名を使用する場合は調整）
    settings = get_settings()
    
    try:
        slack_webhook_url = get_secret("slack-webhook-url")
    except Exception:
        logger.warning("Slack webhook URL not configured")
        return {"success": False, "error": "Slack webhook not configured"}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.post(
                slack_webhook_url,
                json=payload
            )
            
            return {
                "status_code": response.status_code,
                "success": response.is_success
            }
            
        except Exception as e:
            logger.error(f"Slack notification error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
