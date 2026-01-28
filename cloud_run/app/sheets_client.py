"""
Google Sheets API クライアント
スプレッドシートの読み書き操作
"""
import logging
from typing import Optional, List, Dict, Any

import gspread
from google.oauth2 import service_account
from google.auth import default

from .settings import get_settings

logger = logging.getLogger(__name__)


class SheetsClient:
    """Google Sheets操作クライアント"""
    
    def __init__(self):
        self._client: Optional[gspread.Client] = None
        self._settings = get_settings()
    
    def _get_client(self) -> gspread.Client:
        """gspreadクライアントを取得（遅延初期化）"""
        if self._client is None:
            try:
                # Cloud Run環境ではデフォルト認証を使用
                credentials, project = default(
                    scopes=['https://www.googleapis.com/auth/spreadsheets']
                )
                self._client = gspread.authorize(credentials)
                logger.info("Sheets client initialized with default credentials")
            except Exception as e:
                logger.error(f"Failed to initialize Sheets client: {e}")
                raise
        return self._client
    
    def get_sheet(self, sheet_id: str, sheet_name: str) -> gspread.Worksheet:
        """ワークシートを取得"""
        client = self._get_client()
        spreadsheet = client.open_by_key(sheet_id)
        return spreadsheet.worksheet(sheet_name)
    
    def get_labels(self, sheet_id: str, sheet_name: str) -> List[str]:
        """A列のラベル一覧を取得（行3以降）"""
        sheet = self.get_sheet(sheet_id, sheet_name)
        
        # A列の全データを取得
        col_values = sheet.col_values(1)  # 1-indexed
        
        # 行3以降を返す（index 2以降）
        start_idx = self._settings.DATA_START_ROW - 1
        labels = col_values[start_idx:] if len(col_values) > start_idx else []
        
        # 空文字を除外
        return [label for label in labels if label]
    
    def get_label_row_map(self, sheet_id: str, sheet_name: str) -> Dict[str, int]:
        """ラベルと行番号のマッピングを取得"""
        sheet = self.get_sheet(sheet_id, sheet_name)
        col_values = sheet.col_values(1)
        
        label_map = {}
        start_row = self._settings.DATA_START_ROW
        
        for i, label in enumerate(col_values[start_row - 1:], start=start_row):
            if label:
                label_map[label] = i
        
        return label_map
    
    def write_audio_results(
        self,
        sheet_id: str,
        sheet_name: str,
        results: Dict[str, Dict[str, Any]]
    ) -> int:
        """
        音声抽出結果をE列（＋J/K列）に書き込み
        
        Args:
            sheet_id: スプレッドシートID
            sheet_name: シート名
            results: {label: {value, confidence, evidence}} 形式の辞書
        
        Returns:
            更新した行数
        """
        sheet = self.get_sheet(sheet_id, sheet_name)
        label_row_map = self.get_label_row_map(sheet_id, sheet_name)
        
        updates = []
        updated_count = 0
        
        for label, data in results.items():
            if label not in label_row_map:
                logger.warning(f"Label not found in sheet: {label}")
                continue
            
            row = label_row_map[label]
            
            # E列（音声抽出値）
            value = data.get('value', '')
            if value is not None:
                updates.append({
                    'range': f'E{row}',
                    'values': [[str(value) if value else '']]
                })
            
            # J列（confidence）
            confidence = data.get('confidence')
            if confidence is not None:
                updates.append({
                    'range': f'J{row}',
                    'values': [[confidence]]
                })
            
            # K列（evidence）
            evidence = data.get('evidence', '')
            if evidence:
                updates.append({
                    'range': f'K{row}',
                    'values': [[evidence]]
                })
            
            updated_count += 1
        
        # バッチ更新
        if updates:
            sheet.batch_update(updates)
            logger.info(f"Updated {updated_count} rows in sheet")
        
        return updated_count
    
    def write_porters_results(
        self,
        sheet_id: str,
        sheet_name: str,
        results: Dict[str, str]
    ) -> int:
        """
        Portersデータをc列に書き込み
        
        Args:
            sheet_id: スプレッドシートID
            sheet_name: シート名
            results: {label: value} 形式の辞書
        
        Returns:
            更新した行数
        """
        sheet = self.get_sheet(sheet_id, sheet_name)
        label_row_map = self.get_label_row_map(sheet_id, sheet_name)
        
        updates = []
        updated_count = 0
        
        for label, value in results.items():
            if label not in label_row_map:
                logger.warning(f"Label not found in sheet: {label}")
                continue
            
            row = label_row_map[label]
            updates.append({
                'range': f'C{row}',
                'values': [[str(value) if value else '']]
            })
            updated_count += 1
        
        # バッチ更新
        if updates:
            sheet.batch_update(updates)
            logger.info(f"Updated {updated_count} rows with Porters data")
        
        return updated_count


# シングルトンインスタンス
_sheets_client: Optional[SheetsClient] = None


def get_sheets_client() -> SheetsClient:
    """SheetsClientのシングルトンインスタンスを取得"""
    global _sheets_client
    if _sheets_client is None:
        _sheets_client = SheetsClient()
    return _sheets_client
