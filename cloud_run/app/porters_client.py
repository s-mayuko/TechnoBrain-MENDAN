"""
Porters API クライアント
Portersからレコードデータを取得

Note: 現在はstub実装。Porters API仕様が確定次第、実装を追加。
"""
import logging
from typing import Dict, Any, Optional

from .settings import get_settings
from .sheets_client import get_sheets_client

logger = logging.getLogger(__name__)


class PortersClient:
    """Porters APIクライアント（stub）"""
    
    def __init__(self):
        self._settings = get_settings()
    
    async def get_record(self, record_id: str) -> Dict[str, Any]:
        """
        Portersからレコードを取得
        
        Args:
            record_id: PortersのレコードID
        
        Returns:
            レコードデータ
        
        Note:
            現在はモック実装。実際のAPI呼び出しは未実装。
        """
        logger.info(f"[STUB] Fetching Porters record: {record_id}")
        
        # モックデータを返す
        # TODO: 実際のPorters API呼び出しを実装
        return {
            "record_id": record_id,
            "data": {
                "氏名": "山田 太郎",
                "生年月日(年齢)": "1990/01/01（35）",
                "電話番号": "090-1234-5678",
                "メールアドレス": "yamada@example.com",
                "現住所": "東京都渋谷区...",
                "最寄り駅": "渋谷駅",
                "最終学歴": "○○大学 工学部",
                "現職/前職": "株式会社○○",
                "希望職種": "エンジニア",
                "希望年収": "500万円〜"
            },
            "_mock": True
        }
    
    async def update_record(
        self, 
        record_id: str, 
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Portersのレコードを更新
        
        Args:
            record_id: PortersのレコードID
            data: 更新データ
        
        Returns:
            更新結果
        
        Note:
            現在はモック実装。
        """
        logger.info(f"[STUB] Updating Porters record: {record_id}")
        
        # TODO: 実際のPorters API呼び出しを実装
        return {
            "success": True,
            "record_id": record_id,
            "_mock": True
        }


# シングルトンインスタンス
_porters_client: Optional[PortersClient] = None


def get_porters_client() -> PortersClient:
    """PortersClientのシングルトンインスタンスを取得"""
    global _porters_client
    if _porters_client is None:
        _porters_client = PortersClient()
    return _porters_client


async def import_porters_data(
    sheet_id: str,
    sheet_name: str,
    porters_record_id: str
) -> Dict[str, Any]:
    """
    PortersデータをスプレッドシートのC列にインポート
    
    Args:
        sheet_id: スプレッドシートID
        sheet_name: シート名
        porters_record_id: PortersのレコードID
    
    Returns:
        インポート結果
    """
    porters_client = get_porters_client()
    sheets_client = get_sheets_client()
    
    logger.info(f"Importing Porters data for record: {porters_record_id}")
    
    # Portersからデータ取得
    record = await porters_client.get_record(porters_record_id)
    
    if not record or "data" not in record:
        raise ValueError(f"No data found for Porters record: {porters_record_id}")
    
    porters_data = record["data"]
    
    # シートに書き込み
    updated_count = sheets_client.write_porters_results(
        sheet_id=sheet_id,
        sheet_name=sheet_name,
        results=porters_data
    )
    
    return {
        "record_id": porters_record_id,
        "updated_rows": updated_count,
        "is_mock": record.get("_mock", False)
    }
