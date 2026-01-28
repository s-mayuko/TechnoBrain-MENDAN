"""
Claude API を使用した項目抽出
文字起こしテキストから指定されたラベルに対応する値を抽出
"""
import json
import logging
from typing import List, Dict, Any, Optional

import anthropic
from google.cloud import secretmanager

from .settings import get_settings

logger = logging.getLogger(__name__)


def get_anthropic_api_key() -> str:
    """Secret ManagerからAnthropic APIキーを取得"""
    settings = get_settings()
    
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{settings.GCP_PROJECT}/secrets/{settings.ANTHROPIC_API_KEY_SECRET_NAME}/versions/latest"
    
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")


async def extract_fields_from_transcript(
    transcript: str,
    labels: List[str],
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Claude APIを使用してトランスクリプトから項目を抽出
    
    Args:
        transcript: 文字起こしテキスト
        labels: 抽出する項目のラベル一覧
        metadata: メタデータ（CA名、SlackメンションID等）
    
    Returns:
        {label: {value, confidence, evidence}} 形式の辞書
    """
    settings = get_settings()
    
    if not transcript:
        logger.warning("Empty transcript provided")
        return {}
    
    # APIキーを取得
    api_key = get_anthropic_api_key()
    
    # Claudeクライアント初期化
    client = anthropic.Anthropic(api_key=api_key)
    
    # プロンプト作成
    prompt = create_extraction_prompt(transcript, labels, metadata)
    
    logger.info(f"Sending extraction request to Claude ({settings.CLAUDE_MODEL})")
    
    # Claude API呼び出し
    message = client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )
    
    # レスポンス解析
    response_text = message.content[0].text
    
    # JSONを抽出
    extracted = parse_extraction_response(response_text, labels)
    
    return extracted


def create_extraction_prompt(
    transcript: str,
    labels: List[str],
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """抽出用プロンプトを作成"""
    
    labels_json = json.dumps(labels, ensure_ascii=False, indent=2)
    
    metadata_info = ""
    if metadata:
        metadata_info = f"""
## メタデータ（参考情報）
```json
{json.dumps(metadata, ensure_ascii=False, indent=2)}
```
"""
    
    prompt = f"""あなたは面談記録から情報を抽出するエキスパートです。
以下の文字起こしテキストから、指定された項目の情報を抽出してください。

## 抽出する項目
```json
{labels_json}
```
{metadata_info}
## 文字起こしテキスト
```
{transcript}
```

## 出力形式
以下のJSON形式で出力してください。各項目について：
- value: 抽出した値（見つからない場合はnull）
- confidence: 確信度（0.0〜1.0）
- evidence: 値の根拠となるテキストの一部（短く）

```json
{{
  "項目名1": {{
    "value": "抽出した値",
    "confidence": 0.85,
    "evidence": "テキストから引用..."
  }},
  "項目名2": {{
    "value": null,
    "confidence": 0.0,
    "evidence": ""
  }}
}}
```

## 注意事項
1. 必ずJSON形式で出力してください
2. テキストに明確な情報がない場合は value を null にしてください
3. 推測や幻覚は避け、テキストに基づいた抽出のみ行ってください
4. confidence は、値の確実性を0.0〜1.0で表現してください
5. evidence は、値の根拠となる発話の一部を短く引用してください

JSONのみを出力してください（説明文は不要）。
"""
    
    return prompt


def parse_extraction_response(
    response_text: str,
    labels: List[str]
) -> Dict[str, Dict[str, Any]]:
    """Claude APIのレスポンスを解析"""
    
    # JSONブロックを抽出
    json_text = response_text.strip()
    
    # ```json ... ``` で囲まれている場合は中身を取り出す
    if json_text.startswith("```"):
        lines = json_text.split("\n")
        # 最初と最後の```行を除去
        json_lines = []
        in_json = False
        for line in lines:
            if line.startswith("```"):
                in_json = not in_json
                continue
            if in_json:
                json_lines.append(line)
        json_text = "\n".join(json_lines)
    
    try:
        extracted = json.loads(json_text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response: {e}")
        logger.error(f"Response text: {response_text[:500]}")
        return {}
    
    # ラベルに存在するもののみフィルタリング
    result = {}
    for label in labels:
        if label in extracted:
            data = extracted[label]
            result[label] = {
                "value": data.get("value"),
                "confidence": data.get("confidence", 0.0),
                "evidence": data.get("evidence", "")
            }
    
    return result


async def extract_single_field(
    transcript: str,
    label: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    単一の項目を抽出（軽量版）
    
    Args:
        transcript: 文字起こしテキスト
        label: 抽出する項目のラベル
        metadata: メタデータ
    
    Returns:
        {value, confidence, evidence} 形式の辞書
    """
    results = await extract_fields_from_transcript(
        transcript=transcript,
        labels=[label],
        metadata=metadata
    )
    
    return results.get(label, {"value": None, "confidence": 0.0, "evidence": ""})
