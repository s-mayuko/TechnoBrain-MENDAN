"""
ログユーティリティ - 個人情報マスキング
"""
import re
from typing import Any, Dict


def mask_sensitive_data(data: Any, depth: int = 0) -> Any:
    """
    ログ出力用に個人情報をマスキング
    
    Args:
        data: マスキング対象のデータ
        depth: 再帰の深さ（無限再帰防止）
    
    Returns:
        マスキング済みデータ
    """
    if depth > 10:  # 深すぎる再帰を防止
        return "[MAX_DEPTH]"
    
    if isinstance(data, dict):
        masked = {}
        for key, value in data.items():
            if is_sensitive_field(key):
                masked[key] = mask_value(value, key)
            else:
                masked[key] = mask_sensitive_data(value, depth + 1)
        return masked
    
    elif isinstance(data, list):
        return [mask_sensitive_data(item, depth + 1) for item in data]
    
    elif isinstance(data, str):
        # 文字列内の個人情報パターンをマスキング
        return mask_patterns_in_string(data)
    
    else:
        return data


def is_sensitive_field(field_name: str) -> bool:
    """
    フィールド名から個人情報かどうかを判定
    
    Args:
        field_name: フィールド名
    
    Returns:
        個人情報の場合True
    """
    sensitive_keywords = [
        'name', '氏名', '名前', 'fullname', 'full_name',
        'email', 'mail', 'メール',
        'phone', 'tel', '電話', 'telephone',
        'address', '住所', 'addr',
        'birth', '生年月日', '誕生日',
        'password', 'passwd', 'pwd', 'パスワード',
        'id_number', 'license', 'マイナンバー',
        'card', 'クレジット',
    ]
    
    field_lower = field_name.lower()
    return any(keyword in field_lower for keyword in sensitive_keywords)


def mask_value(value: Any, field_name: str = "") -> str:
    """
    値をマスキング
    
    Args:
        value: マスキング対象の値
        field_name: フィールド名（マスキング方法の判定に使用）
    
    Returns:
        マスキングされた文字列
    """
    if value is None:
        return None
    
    value_str = str(value)
    
    # 空文字や短い値はそのまま
    if len(value_str) <= 1:
        return value_str
    
    # メールアドレス
    if '@' in value_str:
        parts = value_str.split('@')
        if len(parts) == 2:
            local = parts[0]
            domain = parts[1]
            masked_local = local[0] + '***' if len(local) > 0 else '***'
            return f"{masked_local}@{domain}"
    
    # 電話番号パターン
    if re.match(r'^[\d\-\+\(\)]+$', value_str):
        return value_str[:3] + '****' + value_str[-2:] if len(value_str) > 5 else '****'
    
    # デフォルト: 最初の1文字 + *** + 最後の1文字
    if len(value_str) <= 3:
        return '***'
    
    return value_str[0] + '***' + value_str[-1]


def mask_patterns_in_string(text: str) -> str:
    """
    文字列内の個人情報パターンをマスキング
    
    Args:
        text: マスキング対象の文字列
    
    Returns:
        マスキング済み文字列
    """
    # メールアドレスパターン
    text = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        lambda m: mask_value(m.group(0)),
        text
    )
    
    # 電話番号パターン（日本）
    text = re.sub(
        r'\b0\d{1,4}-\d{1,4}-\d{4}\b',
        lambda m: m.group(0)[:3] + '****' + m.group(0)[-4:],
        text
    )
    
    # 郵便番号パターン
    text = re.sub(
        r'\b\d{3}-\d{4}\b',
        '***-****',
        text
    )
    
    return text


def safe_log_dict(data: Dict[str, Any], max_length: int = 500) -> str:
    """
    辞書をログ出力用に安全な文字列に変換
    
    Args:
        data: 辞書データ
        max_length: 最大文字数
    
    Returns:
        マスキング・切り詰めされた文字列
    """
    masked = mask_sensitive_data(data)
    result = str(masked)
    
    if len(result) > max_length:
        result = result[:max_length] + "... (truncated)"
    
    return result
