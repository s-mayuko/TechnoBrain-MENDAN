"""
音声処理パイプライン
GCS音声 → Speech-to-Text → Claude抽出 → シート書き込み
"""
import logging
from typing import Optional, Dict, Any

from google.cloud import speech_v1 as speech
from google.cloud import storage

from .settings import get_settings
from .sheets_client import get_sheets_client
from .extract_schema import extract_fields_from_transcript
from .log_utils import safe_log_dict

logger = logging.getLogger(__name__)


async def process_audio_pipeline(
    sheet_id: str,
    sheet_name: str,
    gcs_uri: str,
    language_code: str = "ja-JP",
    record_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    音声処理パイプライン
    
    Args:
        sheet_id: スプレッドシートID
        sheet_name: シート名
        gcs_uri: 音声ファイルのGCS URI (gs://bucket/path/to/file.wav)
        language_code: 言語コード
        record_id: レコードID
        metadata: メタデータ（CA名、SlackメンションID等）
    
    Returns:
        処理結果
    """
    settings = get_settings()
    sheets_client = get_sheets_client()
    
    logger.info(f"Starting audio pipeline for: {gcs_uri}")
    
    # 1. A列のラベル一覧を取得
    labels = sheets_client.get_labels(sheet_id, sheet_name)
    if not labels:
        raise ValueError("No labels found in sheet")
    
    logger.info(f"Found {len(labels)} labels in sheet")
    
    # 2. Speech-to-Textで文字起こし
    transcript = await transcribe_audio(gcs_uri, language_code)
    logger.info(f"Transcription completed: {len(transcript)} characters")
    
    # 3. Claude APIで項目抽出
    extracted = await extract_fields_from_transcript(
        transcript=transcript,
        labels=labels,
        metadata=metadata
    )
    logger.info(f"Extraction completed: {len(extracted)} fields")
    logger.debug(f"Extracted data (masked): {safe_log_dict(extracted)}")
    
    # 4. シートに書き込み
    updated_count = sheets_client.write_audio_results(
        sheet_id=sheet_id,
        sheet_name=sheet_name,
        results=extracted
    )
    
    return {
        "record_id": record_id,
        "transcript_length": len(transcript),
        "extracted_fields": len(extracted),
        "updated_rows": updated_count,
        "metadata": metadata
    }


async def transcribe_audio(gcs_uri: str, language_code: str = "ja-JP") -> str:
    """
    Google Speech-to-Text APIで音声を文字起こし
    
    Args:
        gcs_uri: GCS URI (gs://bucket/path/to/file.wav)
        language_code: 言語コード
    
    Returns:
        文字起こしテキスト
    """
    logger.info(f"Transcribing audio: {gcs_uri}")
    
    client = speech.SpeechClient()
    
    # 音声ファイルの設定
    audio = speech.RecognitionAudio(uri=gcs_uri)
    
    # 認識設定
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,  # 必要に応じて調整
        language_code=language_code,
        enable_automatic_punctuation=True,
        model="default",
        # 長い音声の場合
        enable_word_time_offsets=False,
    )
    
    # 長時間音声の場合はlong_running_recognize
    # 短い音声の場合はrecognize
    try:
        # まず短い音声として試行
        response = client.recognize(config=config, audio=audio)
    except Exception as e:
        logger.info(f"Trying long_running_recognize: {e}")
        # 長い音声の場合
        operation = client.long_running_recognize(config=config, audio=audio)
        response = operation.result(timeout=600)  # 10分タイムアウト
    
    # 結果を結合
    transcript_parts = []
    for result in response.results:
        if result.alternatives:
            transcript_parts.append(result.alternatives[0].transcript)
    
    transcript = ' '.join(transcript_parts)
    
    if not transcript:
        logger.warning("No transcript generated from audio")
    
    return transcript


def get_audio_duration(gcs_uri: str) -> float:
    """
    音声ファイルの長さを取得（秒）
    
    Note: 実際の実装では音声ファイルのメタデータから取得
    """
    # TODO: 実際の音声長さを取得する実装
    return 0.0


async def download_audio_from_gcs(gcs_uri: str) -> bytes:
    """
    GCSから音声ファイルをダウンロード
    
    Args:
        gcs_uri: GCS URI (gs://bucket/path/to/file.wav)
    
    Returns:
        音声ファイルのバイトデータ
    """
    # gs://bucket/path/to/file.wav を分解
    if not gcs_uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS URI: {gcs_uri}")
    
    parts = gcs_uri[5:].split("/", 1)
    if len(parts) != 2:
        raise ValueError(f"Invalid GCS URI format: {gcs_uri}")
    
    bucket_name = parts[0]
    blob_name = parts[1]
    
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_name)
    
    return blob.download_as_bytes()
