# 運用マニュアル

最終更新: 2026-01-28

## 📋 目次

1. [日常監視](#日常監視)
2. [メトリクス確認](#メトリクス確認)
3. [アラート設定](#アラート設定)
4. [トラブルシューティング](#トラブルシューティング)
5. [定期メンテナンス](#定期メンテナンス)
6. [コスト管理](#コスト管理)
7. [バックアップとリストア](#バックアップとリストア)
8. [運用チェックリスト](#運用チェックリスト)

---

## 👀 日常監視

### 監視項目

| 項目 | 確認内容 | 正常値 | 確認頻度 |
|-----|---------|-------|---------|
| **Cloud Run** | リクエスト数 | 異常な増加なし | 毎日 |
| **Cloud Run** | エラー率 | <5% | 毎日 |
| **Cloud Run** | レスポンスタイム | <60秒 | 毎日 |
| **GCS** | ストレージ使用量 | 予算内 | 週次 |
| **Speech-to-Text** | API使用量 | 予算内 | 週次 |
| **Claude API** | API使用量 | 予算内 | 週次 |
| **スプレッドシート** | データ反映 | 正常 | 毎日 |

---

### 日次チェックスクリプト

```bash
#!/bin/bash
# daily-check.sh

echo "=== 日次監視チェック ==="
echo "実行日時: $(date)"
echo ""

# 1. Cloud Runの状態確認
echo "### Cloud Run Status"
gcloud run services describe mendan-api \
  --region=asia-northeast1 \
  --format="value(status.conditions[0].status,status.url)"

# 2. 過去24時間のエラーログ
echo ""
echo "### Error Logs (Last 24h)"
ERROR_COUNT=$(gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='severity>=ERROR AND timestamp>='"$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)"'"' \
  --limit=1000 \
  --format=json | jq '. | length')

echo "エラー数: ${ERROR_COUNT}"

if [ "$ERROR_COUNT" -gt 10 ]; then
  echo "⚠️  エラーが多発しています！"
fi

# 3. GCSストレージ使用量
echo ""
echo "### GCS Storage Usage"
gcloud storage du --summarize gs://technobrain-mendan-audio/

# 4. 過去24時間の処理件数
echo ""
echo "### Processed Requests (Last 24h)"
REQUEST_COUNT=$(gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='textPayload:"Processing audio" AND timestamp>='"$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)"'"' \
  --limit=1000 \
  --format=json | jq '. | length')

echo "処理件数: ${REQUEST_COUNT}"

echo ""
echo "=== チェック完了 ==="
```

**実行:**
```bash
chmod +x daily-check.sh
./daily-check.sh
```

**cron設定（毎朝9時）:**
```bash
0 9 * * * /path/to/daily-check.sh >> /var/log/daily-check.log 2>&1
```

---

## 📊 メトリクス確認

### Cloud Runメトリクス

```bash
# リクエスト数（過去24時間）
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"
    AND resource.labels.service_name="mendan-api"' \
  --interval-start-time="$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --interval-end-time="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --format=json

# レスポンスタイム
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_latencies"
    AND resource.labels.service_name="mendan-api"' \
  --interval-start-time="$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --interval-end-time="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --format=json

# コンテナインスタンス数
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/instance_count"
    AND resource.labels.service_name="mendan-api"' \
  --interval-start-time="$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --interval-end-time="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --format=json
```

### Cloud Console でメトリクス確認

1. https://console.cloud.google.com/run/detail/asia-northeast1/mendan-api/metrics
2. 以下のグラフを確認:
   - **Request count**: リクエスト数の推移
   - **Request latency**: レスポンスタイムの分布
   - **Container instance count**: インスタンス数
   - **CPU utilization**: CPU使用率
   - **Memory utilization**: メモリ使用率

---

## 🔔 アラート設定

### Cloud Monitoringアラートポリシー

#### 1. エラー率が5%を超えた場合

```bash
# Notification Channel作成（Email）
gcloud alpha monitoring channels create \
  --display-name="Operations Team" \
  --type=email \
  --channel-labels=email_address=ops@example.com

# Channel ID取得
CHANNEL_ID=$(gcloud alpha monitoring channels list \
  --filter='displayName="Operations Team"' \
  --format='value(name)')

# アラートポリシー作成
gcloud alpha monitoring policies create \
  --notification-channels="${CHANNEL_ID}" \
  --display-name="Cloud Run Error Rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-display-name="Error rate exceeds 5%" \
  --condition-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="mendan-api"
    AND metric.type="run.googleapis.com/request_count"
    AND metric.labels.response_code_class="5xx"'
```

#### 2. レスポンスタイムが60秒を超えた場合

```bash
gcloud alpha monitoring policies create \
  --notification-channels="${CHANNEL_ID}" \
  --display-name="Cloud Run Latency > 60s" \
  --condition-threshold-value=60000 \
  --condition-threshold-duration=60s \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-display-name="Latency exceeds 60 seconds" \
  --condition-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="mendan-api"
    AND metric.type="run.googleapis.com/request_latencies"'
```

#### 3. Slackアラート（Webhook）

```python
# alert_to_slack.py
import requests
import sys

SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

def send_alert(title, message):
    payload = {
        "text": f"🚨 *{title}*",
        "attachments": [
            {
                "color": "danger",
                "text": message,
                "footer": "TechnoBrain MENDAN Monitoring",
                "ts": int(time.time())
            }
        ]
    }
    
    response = requests.post(SLACK_WEBHOOK_URL, json=payload)
    response.raise_for_status()
    print("✅ Alert sent to Slack")

if __name__ == "__main__":
    title = sys.argv[1] if len(sys.argv) > 1 else "Alert"
    message = sys.argv[2] if len(sys.argv) > 2 else "No details"
    send_alert(title, message)
```

**使用例:**
```bash
python alert_to_slack.py "Cloud Run Error" "Error rate: 12%"
```

---

## 🔧 トラブルシューティング

### よくある問題と解決策

#### 問題1: Cloud Runが503エラーを返す

**症状:**
```
HTTP 503 Service Unavailable
```

**原因:**
1. コンテナの起動失敗
2. メモリ不足
3. タイムアウト

**確認:**
```bash
# ログ確認
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='severity>=ERROR' \
  --limit=50

# リソース使用状況確認
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/memory/utilizations"
    AND resource.labels.service_name="mendan-api"' \
  --interval-start-time="$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --interval-end-time="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

**解決策:**
```bash
# メモリ増量
gcloud run services update mendan-api \
  --region=asia-northeast1 \
  --memory=1Gi

# タイムアウト延長
gcloud run services update mendan-api \
  --region=asia-northeast1 \
  --timeout=600s
```

---

#### 問題2: Speech-to-Textがタイムアウトする

**症状:**
```
Timeout waiting for speech recognition
```

**原因:**
- 音声ファイルが長すぎる（>60分）
- 音声形式が不正

**確認:**
```bash
# 音声ファイル確認
gcloud storage ls -L gs://technobrain-mendan-audio/audio/problem-file.wav

# ファイルダウンロードして確認
gcloud storage cp gs://technobrain-mendan-audio/audio/problem-file.wav ./
ffprobe -i problem-file.wav
```

**解決策:**
- 音声を分割する
- 正しい形式に変換する（16kHz, モノラル）

---

#### 問題3: Claude APIのレート制限

**症状:**
```
429 Too Many Requests
rate_limit_error
```

**原因:**
- Claude APIの使用量制限超過

**確認:**
```bash
# Anthropic APIの使用状況を確認（Anthropic Consoleで）
# https://console.anthropic.com/
```

**解決策:**
1. **短期対策**: リクエスト頻度を下げる
2. **恒久対策**: プラン変更、リトライロジック追加

```python
# extract_schema.py に追加
import time
from anthropic import RateLimitError

async def extract_fields_with_retry(transcript, labels, metadata, max_retries=3):
    """
    指数バックオフリトライ
    """
    for attempt in range(max_retries):
        try:
            return await extract_fields_from_transcript(transcript, labels, metadata)
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise
            
            wait_time = 2 ** attempt  # 1s, 2s, 4s
            logger.warning(f"Rate limit hit, retrying in {wait_time}s...")
            time.sleep(wait_time)
```

---

#### 問題4: スプレッドシートに反映されない

**症状:**
- E列が空のまま

**原因:**
1. Sheets APIの権限不足
2. シートIDが間違っている
3. A列（ラベル）が空

**確認:**
```bash
# Cloud Runログ確認
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter='textPayload:"write_audio_results"' \
  --limit=20
```

**解決策:**
```bash
# サービスアカウント確認
export SA_EMAIL=$(gcloud run services describe mendan-api \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.serviceAccountName)")

echo "Service Account: ${SA_EMAIL}"

# スプレッドシートの共有設定で ${SA_EMAIL} に編集権限を付与
```

---

## 🗓️ 定期メンテナンス

### 日次タスク

- [ ] エラーログ確認
- [ ] リクエスト数確認
- [ ] スプレッドシートのデータ品質確認

### 週次タスク

- [ ] GCSストレージ使用量確認
- [ ] API使用量確認（Speech-to-Text, Claude）
- [ ] コスト確認
- [ ] 古いログの削除（90日以上）

```bash
# 古いGCSファイル削除（90日以上）
gcloud storage rm -r gs://technobrain-mendan-audio/audio/$(date -d '90 days ago' +%Y%m%d)*
```

### 月次タスク

- [ ] セキュリティパッチ適用
- [ ] 依存関係更新
- [ ] バックアップ確認
- [ ] アラート設定レビュー
- [ ] コスト最適化レビュー

### 四半期タスク

- [ ] APIキーローテーション
- [ ] IAM権限レビュー
- [ ] ドキュメント更新
- [ ] 運用改善提案

---

## 💰 コスト管理

### コスト構成

| サービス | 月額目安 | 内訳 |
|---------|---------|------|
| **Cloud Run** | $10-50 | リクエスト数、CPU/メモリ時間 |
| **GCS** | $5-20 | ストレージ、転送量 |
| **Speech-to-Text** | $20-100 | 音声処理時間（$0.006/分） |
| **Claude API** | $50-200 | トークン数（Input/Output） |
| **Sheets API** | 無料 | 制限内 |
| **Secret Manager** | <$1 | アクセス数 |
| **Cloud Logging** | $5-10 | ログ量 |
| **合計** | **$90-381** | |

---

### コスト監視

```bash
# 現在の請求額確認
gcloud billing accounts list
gcloud billing projects describe technobrain-mendan

# Cloud Console で詳細確認
# https://console.cloud.google.com/billing/
```

### 予算アラート設定

```bash
# 予算作成（月額$300）
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="TechnoBrain MENDAN Monthly Budget" \
  --budget-amount=300 \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

### コスト削減策

1. **Cloud Run**: 最小インスタンス数を0に
   ```bash
   gcloud run services update mendan-api \
     --region=asia-northeast1 \
     --min-instances=0
   ```

2. **GCS**: ライフサイクルポリシーで古いファイルを削除

3. **Speech-to-Text**: 短い音声はcacheを活用

4. **Claude API**: プロンプトを最適化してトークン数削減

---

## 💾 バックアップとリストア

### スプレッドシートバックアップ

```bash
# バックアップスクリプト（weekly-backup.sh）
#!/bin/bash

SHEET_ID="YOUR_SPREADSHEET_ID"
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d)

# スプレッドシートをCSVエクスポート
# （Apps Scriptまたは手動）

echo "✅ Backup completed: ${DATE}"
```

**Apps Script バックアップ:**
```javascript
function weeklyBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('merge_ui');
  
  // Google Driveにコピー
  const folder = DriveApp.getFolderById('BACKUP_FOLDER_ID');
  const timestamp = Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd_HHmmss');
  const filename = `merge_ui_backup_${timestamp}`;
  
  ss.copy(filename);
  const file = DriveApp.getFilesByName(filename).next();
  folder.addFile(file);
  
  Logger.log('✅ Backup created: ' + filename);
}

// トリガー設定: 毎週日曜 0:00
```

---

### GCSバックアップ

```bash
# 別リージョンにバックアップ
gcloud storage rsync -r \
  gs://technobrain-mendan-audio/audio/ \
  gs://technobrain-mendan-audio-backup/audio/

# または別バケットにコピー
gcloud storage cp -r \
  gs://technobrain-mendan-audio/audio/ \
  gs://technobrain-mendan-audio-backup/audio/
```

---

### リストア手順

#### スプレッドシートリストア

1. Google Drive でバックアップファイルを開く
2. 「ファイル」→「コピーを作成」
3. 元のスプレッドシートと置き換え

#### GCSリストア

```bash
# バックアップから復元
gcloud storage cp -r \
  gs://technobrain-mendan-audio-backup/audio/FILE.wav \
  gs://technobrain-mendan-audio/audio/
```

---

## ✅ 運用チェックリスト

### 日次チェック

- [ ] エラーログ確認（`gcloud run services logs read`）
- [ ] リクエスト数確認
- [ ] スプレッドシートのデータ正常性確認

### 週次チェック

- [ ] ストレージ使用量確認
- [ ] API使用量確認
- [ ] コスト確認
- [ ] バックアップ実行

### 月次チェック

- [ ] セキュリティパッチ適用
- [ ] 依存関係更新
- [ ] IAM権限レビュー
- [ ] 運用レポート作成

### 四半期チェック

- [ ] APIキーローテーション
- [ ] アラート設定レビュー
- [ ] ドキュメント更新
- [ ] パフォーマンスチューニング

---

## 📚 関連ドキュメント

- [SECURITY-GUIDE.md](./SECURITY-GUIDE.md) - セキュリティ設定
- [E2E-TEST-GUIDE.md](./E2E-TEST-GUIDE.md) - テスト手順
- [AUDIO-WEBHOOK-GUIDE.md](./AUDIO-WEBHOOK-GUIDE.md) - 全体設定

---

## 📞 緊急連絡先

| 役割 | 担当者 | 連絡先 |
|-----|-------|-------|
| システム管理者 | （記入） | （記入） |
| 開発担当 | （記入） | （記入） |
| GCP管理者 | （記入） | （記入） |
| エスカレーション先 | （記入） | （記入） |

---

## 📝 運用ログ

| 日付 | 作業内容 | 担当者 | 備考 |
|-----|---------|-------|------|
| 2026-01-28 | 初期セットアップ | | |
| | | | |

---

**運用準備が完了しました！本番運用を開始してください。** 🎉
