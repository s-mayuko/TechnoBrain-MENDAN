# エンドツーエンドテスト詳細手順書

最終更新: 2026-01-28

## 📋 目次

1. [概要](#概要)
2. [テスト環境準備](#テスト環境準備)
3. [テストシナリオ](#テストシナリオ)
4. [シナリオ1: 手動テスト（curl）](#シナリオ1-手動テストcurl)
5. [シナリオ2: Zapierテスト](#シナリオ2-zapierテスト)
6. [シナリオ3: 負荷テスト](#シナリオ3-負荷テスト)
7. [結果確認方法](#結果確認方法)
8. [デバッグフロー](#デバッグフロー)
9. [自動化テストスクリプト](#自動化テストスクリプト)

---

## 📖 概要

音声Webhook機能の全体フローをエンドツーエンドでテストします。

### テスト対象範囲

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│   GCS   │───▶│   GAS   │───▶│Cloud Run│───▶│ Speech  │───▶│ Sheets  │
│ Upload  │    │Webhook  │    │/process │    │to-Text  │    │  E列    │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
                                     │
                                     ▼
                               ┌─────────┐
                               │ Claude  │
                               │  API    │
                               └─────────┘
```

### テストレベル

| レベル | 範囲 | 所要時間 | 頻度 |
|-------|------|---------|------|
| **単体テスト** | 各コンポーネント個別 | 5分 | 毎回変更後 |
| **統合テスト** | GAS→Cloud Run | 10分 | 機能追加時 |
| **E2Eテスト** | 全フロー | 20分 | デプロイ前 |
| **負荷テスト** | 同時実行 | 30分 | 本番前 |

---

## ✅ テスト環境準備

### 前提条件チェックリスト

```bash
# 1. GCSバケット確認
gcloud storage buckets describe gs://technobrain-mendan-audio

# 2. Cloud Run確認
gcloud run services describe mendan-api --region=asia-northeast1

# 3. GAS WebアプリURL確認（Apps Script UIで確認）
# 例: https://script.google.com/macros/s/AKfycby.../exec

# 4. スプレッドシート確認（ブラウザで開く）
# merge_ui シートが存在し、A列にラベルがあることを確認
```

### テストデータ準備

#### 1. サンプル音声ファイル作成

**方法A: テキスト読み上げツールで作成**

```bash
# Google Text-to-Speech API使用
echo "私の名前は山田太郎です。生年月日は1990年5月15日です。電話番号は03-1234-5678です。" > test_script.txt

gcloud services enable texttospeech.googleapis.com

gcloud ml speech synthesize --text="私の名前は山田太郎です。生年月日は1990年5月15日です。" \
  --language=ja-JP \
  --output=test-audio-001.wav
```

**方法B: 既存の音声ファイルを使用**

```bash
# 16kHz, モノラルに変換
ffmpeg -i input.mp3 -ar 16000 -ac 1 test-audio-001.wav
```

**方法C: サイレント音声（最小テスト）**

```bash
# 5秒のサイレント音声
ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 5 -ar 16000 -ac 1 test-silent.wav
```

#### 2. GCSにアップロード

```bash
# テスト音声をアップロード
gcloud storage cp test-audio-001.wav gs://technobrain-mendan-audio/audio/test/

# URI確認
echo "gs://technobrain-mendan-audio/audio/test/test-audio-001.wav"
```

---

## 🎯 テストシナリオ

### シナリオ一覧

| ID | シナリオ名 | 目的 | 期待結果 |
|----|-----------|------|---------|
| **T1** | 正常系 - 基本フロー | 全体動作確認 | E列に値が反映される |
| **T2** | 異常系 - 存在しないGCS URI | エラーハンドリング | エラーレスポンス |
| **T3** | 異常系 - 不正な音声形式 | フォーマット検証 | エラーログ |
| **T4** | 境界値 - 空音声 | エッジケース | transcriptが空 |
| **T5** | 境界値 - 長時間音声 | タイムアウト確認 | 10分以内に完了 |
| **T6** | セキュリティ - 不正APIキー | 認証確認 | 401エラー |
| **T7** | 統合 - Zapier経由 | Zapier動作確認 | T1と同じ |
| **T8** | 負荷 - 同時10件 | スケーラビリティ | すべて成功 |

---

## 🔬 シナリオ1: 手動テスト（curl）

### テスト目的

GAS WebhookエンドポイントをcurlでPOSTし、全フローが正常に動作することを確認します。

---

### Step 1: GAS Webhookを直接呼び出し

```bash
# 環境変数設定
export GAS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycby.../exec"
export GCS_URI="gs://technobrain-mendan-audio/audio/test/test-audio-001.wav"

# テスト実行
curl -X POST "${GAS_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "gcs_uri": "'"${GCS_URI}"'",
    "record_id": "E2E-TEST-001",
    "metadata": {
      "ca_name": "テスト太郎",
      "slack_mention_id": "U12345678",
      "test_scenario": "T1",
      "test_timestamp": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'"
    }
  }'
```

**期待される出力:**
```json
{
  "status": "ok"
}
```

**所要時間:** 30秒〜2分（音声の長さによる）

---

### Step 2: スプレッドシート確認

1. ブラウザでスプレッドシートを開く
2. `merge_ui` シートを確認
3. **E列**（音声抽出値）に値が入っているか確認
4. **J列**（confidence）に値があるか確認
5. **K列**（evidence）に抽出根拠があるか確認

**期待される結果例:**

| A列（項目名） | E列（音声抽出値） | J列（confidence） | K列（evidence） |
|------------|---------------|----------------|---------------|
| 氏名 | 山田太郎 | high | "transcript: '私の名前は山田太郎です'" |
| 生年月日 | 1990/05/15 | high | "transcript: '生年月日は1990年5月15日です'" |
| 電話番号 | 03-1234-5678 | medium | "transcript: '電話番号は03-1234-5678です'" |

---

### Step 3: Cloud Runログ確認

```bash
# 最新ログ（50件）
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --limit=50

# 特定のrecord_idで検索
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter="E2E-TEST-001" \
  --limit=20

# エラーログのみ
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter="severity>=ERROR" \
  --limit=20
```

**期待されるログ:**
```
Processing audio: gs://technobrain-mendan-audio/audio/test/test-audio-001.wav
Transcription completed: 85 characters
Extraction completed: 3 fields
```

---

### Step 4: 結果判定

| チェック項目 | 期待値 | 実際の値 | 結果 |
|------------|-------|---------|------|
| curlレスポンス | `{"status":"ok"}` | | ✅/❌ |
| E列に値あり | ✅ | | ✅/❌ |
| J列に値あり | ✅ | | ✅/❌ |
| K列に値あり | ✅ | | ✅/❌ |
| Cloud Runログ正常 | ✅ | | ✅/❌ |
| エラーなし | ✅ | | ✅/❌ |

---

## 🔄 シナリオ2: Zapierテスト

### 前提条件

- Zapier Zapが作成済み（[ZAPIER-WORKFLOW-GUIDE.md](./ZAPIER-WORKFLOW-GUIDE.md)参照）

---

### Step 1: Zapier Trigger手動実行

1. Zapier Dashboard: https://zapier.com/app/zaps
2. 該当Zapを選択
3. 右上「Test」ボタンをクリック
4. テストデータを選択（または手動入力）
5. 「Test & Continue」をクリック

---

### Step 2: 各ステップの出力確認

#### Action 1（GCSアップロード）の出力

**期待される出力:**
```json
{
  "gcs_uri": "gs://technobrain-mendan-audio/audio/20260128_143052_abc123_test.wav",
  "file_name": "test.wav",
  "uploaded_at": "20260128_143052"
}
```

#### Action 2（GAS Webhook）の出力

**期待される出力:**
```json
{
  "status": "ok"
}
```

---

### Step 3: Zapier History確認

1. Zapier Dashboard → 「Zap History」
2. 最新の実行を確認
3. ステータスが「Success」であることを確認
4. 各ステップの詳細を展開して確認

---

### Step 4: 結果判定

| チェック項目 | 期待値 | 実際の値 | 結果 |
|------------|-------|---------|------|
| Triggerが発火 | ✅ | | ✅/❌ |
| Action 1成功 | ✅ | | ✅/❌ |
| Action 2成功 | ✅ | | ✅/❌ |
| Zap History: Success | ✅ | | ✅/❌ |
| スプレッドシート反映 | ✅ | | ✅/❌ |

---

## ⚡ シナリオ3: 負荷テスト

### テスト目的

同時に複数のリクエストを送信し、システムがスケールすることを確認します。

---

### Step 1: 負荷テストスクリプト作成

```bash
# load-test.sh
#!/bin/bash

GAS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycby.../exec"
CONCURRENT=10  # 同時実行数

# 並列実行
for i in $(seq 1 $CONCURRENT); do
  (
    RECORD_ID="LOAD-TEST-$(printf "%03d" $i)"
    echo "Starting: ${RECORD_ID}"
    
    curl -X POST "${GAS_WEBHOOK_URL}" \
      -H "Content-Type: application/json" \
      -d '{
        "gcs_uri": "gs://technobrain-mendan-audio/audio/test/test-audio-001.wav",
        "record_id": "'"${RECORD_ID}"'",
        "metadata": {"test": "load", "index": '"$i"'}
      }' \
      -o "result-${i}.json" \
      -w "\n%{http_code}\n" \
      -s
    
    echo "Completed: ${RECORD_ID}"
  ) &
done

# すべて完了を待つ
wait

echo "All tests completed"

# 結果確認
echo "=== Results ==="
for i in $(seq 1 $CONCURRENT); do
  echo "Test ${i}: $(cat result-${i}.json)"
done
```

**実行:**
```bash
chmod +x load-test.sh
./load-test.sh
```

---

### Step 2: Cloud Monitoringで確認

```bash
# Cloud Runのメトリクスを確認
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"' \
  --format=json

# またはコンソールで確認
# https://console.cloud.google.com/run/detail/asia-northeast1/mendan-api/metrics
```

**確認項目:**
- リクエスト数: 10件が処理されたか
- レスポンスタイム: 平均・最大値
- エラー率: 0%であるか
- インスタンス数: 自動的にスケールしたか

---

### Step 3: 結果判定

| チェック項目 | 期待値 | 実際の値 | 結果 |
|------------|-------|---------|------|
| すべて200 OK | 10/10 | | ✅/❌ |
| エラーなし | 0 | | ✅/❌ |
| 平均レスポンスタイム | <60秒 | | ✅/❌ |
| 最大レスポンスタイム | <120秒 | | ✅/❌ |
| スプレッドシート反映 | 10件 | | ✅/❌ |

---

## 🔍 結果確認方法

### 1. スプレッドシート確認

```javascript
// Apps Script で最新行を取得
function getLatestResults() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('merge_ui');
  const lastRow = sheet.getLastRow();
  
  // E列（音声抽出値）を取得
  const values = sheet.getRange(3, 5, lastRow - 2, 1).getValues();
  
  // 空でない行をカウント
  const filled = values.filter(row => row[0] !== '').length;
  
  Logger.log(`Total rows: ${lastRow - 2}, Filled: ${filled}`);
}
```

---

### 2. Cloud Runログ分析

```bash
# 成功したリクエスト数
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='textPayload:"Extraction completed"' \
  --limit=100 \
  | grep "Extraction completed" \
  | wc -l

# エラー数
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='severity>=ERROR' \
  --limit=100 \
  | wc -l

# 平均処理時間（手動で計算）
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='textPayload:"Starting audio pipeline"' \
  --limit=10
```

---

### 3. GCS確認

```bash
# アップロードされたファイル一覧
gcloud storage ls gs://technobrain-mendan-audio/audio/test/

# ファイル数
gcloud storage ls gs://technobrain-mendan-audio/audio/test/ | wc -l

# 総サイズ
gcloud storage du gs://technobrain-mendan-audio/audio/test/
```

---

## 🐛 デバッグフロー

### エラー発生時の調査手順

```
┌─────────────────┐
│ エラー発生      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ どこでエラー?   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────┐   ┌─────┐
│ GAS │   │Cloud│
│Webhook│   │Run  │
└──┬──┘   └──┬──┘
   │         │
   ▼         ▼
[Step A]  [Step B]
```

---

### Step A: GAS Webhookエラー

```javascript
// Apps Script →「実行数」→ 最近の実行を確認

// よくあるエラー:
// 1. CLOUD_RUN_BASE_URLが未設定
// 2. JSON.parse エラー
// 3. UrlFetchApp.fetch タイムアウト
```

**デバッグコマンド:**
```bash
# GAS Webアプリに直接curlでテスト
curl -X POST "${GAS_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -v

# レスポンスヘッダーとボディを確認
```

---

### Step B: Cloud Runエラー

```bash
# エラーログを確認
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='severity>=ERROR' \
  --limit=20

# 特定のエラーで検索
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='textPayload:"Permission denied"' \
  --limit=10
```

**よくあるエラー:**

| エラーメッセージ | 原因 | 解決策 |
|---------------|------|-------|
| `403 Permission denied` | IAM権限不足 | サービスアカウントに権限付与 |
| `404 Not found` | GCS URIが存在しない | GCSバケット確認 |
| `Invalid API key` | API Key不一致 | 環境変数確認 |
| `Timeout` | 処理時間超過 | タイムアウト延長 |

---

## 🤖 自動化テストスクリプト

### Python統合テストスクリプト

```python
#!/usr/bin/env python3
"""
E2E自動テストスクリプト
"""
import requests
import time
import sys
from datetime import datetime

# 設定
GAS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycby.../exec"
TEST_GCS_URI = "gs://technobrain-mendan-audio/audio/test/test-audio-001.wav"

def run_test(test_id, gcs_uri, metadata=None):
    """
    単一テスト実行
    """
    print(f"🧪 Running Test: {test_id}")
    
    payload = {
        "gcs_uri": gcs_uri,
        "record_id": test_id,
        "metadata": metadata or {}
    }
    
    start_time = time.time()
    
    try:
        response = requests.post(
            GAS_WEBHOOK_URL,
            json=payload,
            timeout=120
        )
        
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            if result.get("status") == "ok":
                print(f"✅ Test {test_id}: PASSED ({elapsed:.2f}s)")
                return True, elapsed
            else:
                print(f"❌ Test {test_id}: FAILED - Unexpected response: {result}")
                return False, elapsed
        else:
            print(f"❌ Test {test_id}: FAILED - HTTP {response.status_code}")
            print(f"   Response: {response.text}")
            return False, elapsed
    
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ Test {test_id}: FAILED - Exception: {e}")
        return False, elapsed


def run_all_tests():
    """
    全テスト実行
    """
    print("=" * 60)
    print("🚀 Starting E2E Tests")
    print("=" * 60)
    
    tests = [
        {
            "id": "E2E-NORMAL-001",
            "gcs_uri": TEST_GCS_URI,
            "metadata": {"scenario": "normal"}
        },
        {
            "id": "E2E-METADATA-001",
            "gcs_uri": TEST_GCS_URI,
            "metadata": {
                "ca_name": "テスト太郎",
                "slack_mention_id": "U12345678",
                "test": True
            }
        }
    ]
    
    results = []
    
    for test in tests:
        success, elapsed = run_test(
            test["id"],
            test["gcs_uri"],
            test.get("metadata")
        )
        results.append((test["id"], success, elapsed))
        
        # 次のテストまで待機（Cloud Runのコールドスタート回避）
        time.sleep(2)
    
    # サマリー
    print("\n" + "=" * 60)
    print("📊 Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    for test_id, success, elapsed in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_id}: {status} ({elapsed:.2f}s)")
    
    print(f"\nTotal: {passed}/{total} passed")
    print("=" * 60)
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
```

**実行:**
```bash
chmod +x e2e-test.py
python3 e2e-test.py
```

---

## 📊 テストレポート

### テンプレート

```markdown
# E2Eテスト結果レポート

**実施日時:** 2026-01-28 14:30:00  
**実施者:** 山田太郎  
**環境:** 本番環境

## テスト結果サマリー

| 項目 | 結果 |
|-----|------|
| 総テスト数 | 8 |
| 成功 | 7 |
| 失敗 | 1 |
| 成功率 | 87.5% |
| 平均レスポンスタイム | 45.3秒 |

## 詳細結果

### T1: 正常系 - 基本フロー
- **結果:** ✅ PASSED
- **所要時間:** 42.1秒
- **備考:** すべて正常

### T2: 異常系 - 存在しないGCS URI
- **結果:** ❌ FAILED
- **所要時間:** 5.2秒
- **エラー:** HTTP 500
- **原因:** GCS 404エラーのハンドリング不足
- **対策:** エラーハンドリング追加

## 問題点と対策

1. **T2失敗**: GCS 404エラーのハンドリング不足
   - 対策: `audio_pipeline.py` にエラーハンドリング追加

## 次回テスト計画

- T2の修正確認
- 長時間音声テスト追加
```

---

## 📚 関連ドキュメント

- [AUDIO-WEBHOOK-GUIDE.md](./AUDIO-WEBHOOK-GUIDE.md) - セットアップ全体
- [ZAPIER-WORKFLOW-GUIDE.md](./ZAPIER-WORKFLOW-GUIDE.md) - Zapier設定
- [SECURITY-GUIDE.md](./SECURITY-GUIDE.md) - セキュリティテスト
- [OPERATIONS-MANUAL.md](./OPERATIONS-MANUAL.md) - 本番運用

---

**テストが完了したら、次は [SECURITY-GUIDE.md](./SECURITY-GUIDE.md) でセキュリティを強化してください！**
