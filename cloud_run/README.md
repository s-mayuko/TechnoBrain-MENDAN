# Cloud Run API - セットアップ手順

## 概要

TechnoBrain-MENDAN システムのバックエンドAPI。

- **音声処理**: GCS音声 → Speech-to-Text → Claude抽出 → シート書き込み
- **Webhook送信**: マージされたデータを外部システムへ送信
- **Portersインポート**: Portersからデータ取得（stub実装）

## 前提条件

- Google Cloud SDK インストール済み
- Docker インストール済み（ローカルテスト用）
- GCPプロジェクト `technobrain-mendan` へのアクセス権

## GCP APIの有効化

```bash
# 必要なAPIを有効化
gcloud services enable speech.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sheets.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

## Secret Managerの設定

### 1. Anthropic APIキー

```bash
echo -n "sk-ant-your-api-key" | \
  gcloud secrets create anthropic-api-key --data-file=-
```

### 2. Webhook URL

```bash
echo -n "https://your-webhook-endpoint.com/api" | \
  gcloud secrets create webhook-url --data-file=-
```

### 3. Webhook Token（任意）

```bash
echo -n "Bearer your-token" | \
  gcloud secrets create webhook-token --data-file=-
```

### 4. Slack Webhook URL（任意）

```bash
echo -n "https://hooks.slack.com/services/xxx/xxx/xxx" | \
  gcloud secrets create slack-webhook-url --data-file=-
```

## サービスアカウントの設定

### 1. Cloud Run用サービスアカウント作成

```bash
gcloud iam service-accounts create mendan-api-sa \
    --display-name="MENDAN API Service Account"
```

### 2. 権限付与

```bash
# Secret Manager アクセス
gcloud projects add-iam-policy-binding technobrain-mendan \
    --member="serviceAccount:mendan-api-sa@technobrain-mendan.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Speech-to-Text
gcloud projects add-iam-policy-binding technobrain-mendan \
    --member="serviceAccount:mendan-api-sa@technobrain-mendan.iam.gserviceaccount.com" \
    --role="roles/speech.client"

# Cloud Storage 読み取り
gcloud projects add-iam-policy-binding technobrain-mendan \
    --member="serviceAccount:mendan-api-sa@technobrain-mendan.iam.gserviceaccount.com" \
    --role="roles/storage.objectViewer"
```

### 3. スプレッドシート共有

対象スプレッドシートを以下のメールアドレスで共有:
```
mendan-api-sa@technobrain-mendan.iam.gserviceaccount.com
```

## デプロイ

### Cloud Runへデプロイ

```bash
cd cloud_run

# ソースからデプロイ
gcloud run deploy mendan-api \
  --source . \
  --region asia-northeast1 \
  --service-account mendan-api-sa@technobrain-mendan.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT=technobrain-mendan"
```

### 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|----------|
| `GCP_PROJECT` | GCPプロジェクトID | `technobrain-mendan` |
| `INTERNAL_API_KEY` | 内部API認証キー | （なし） |
| `ANTHROPIC_API_KEY_SECRET_NAME` | APIキーのSecret名 | `anthropic-api-key` |
| `CLAUDE_MODEL` | 使用するClaudeモデル | `claude-sonnet-4-20250514` |
| `WEBHOOK_URL_SECRET_NAME` | Webhook URLのSecret名 | `webhook-url` |
| `WEBHOOK_TOKEN_SECRET_NAME` | Webhook TokenのSecret名 | `webhook-token` |

## APIエンドポイント

### GET /health

ヘルスチェック

```bash
curl https://mendan-api-xxx.run.app/health
```

### POST /process_audio

音声処理

```bash
curl -X POST https://mendan-api-xxx.run.app/process_audio \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Key: your-key" \
  -d '{
    "sheet_id": "your-sheet-id",
    "sheet_name": "merge_ui",
    "gcs_uri": "gs://bucket/audio.wav",
    "language_code": "ja-JP",
    "metadata": {
      "ca_name": "田中太郎",
      "slack_mention_id": "U12345678"
    }
  }'
```

### POST /import_porters

Portersデータインポート

```bash
curl -X POST https://mendan-api-xxx.run.app/import_porters \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Key: your-key" \
  -d '{
    "sheet_id": "your-sheet-id",
    "sheet_name": "merge_ui",
    "porters_record_id": "12345"
  }'
```

### POST /send_webhook

Webhook送信

```bash
curl -X POST https://mendan-api-xxx.run.app/send_webhook \
  -H "Content-Type: application/json" \
  -H "X-Internal-Api-Key: your-key" \
  -d '{
    "record_id": "12345",
    "merged_at": "2026-01-28T12:00:00+09:00",
    "fields": [
      {
        "label": "氏名",
        "source": "audio",
        "value": "山田太郎"
      }
    ]
  }'
```

## ローカル開発

### 仮想環境セットアップ

```bash
cd cloud_run
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### ローカル実行

```bash
# 環境変数設定（Linux/Mac）
export GCP_PROJECT=technobrain-mendan
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# 起動
uvicorn app.main:app --reload --port 8080
```

### Dockerでローカル実行

```bash
cd cloud_run

# ビルド
docker build -t mendan-api .

# 実行
docker run -p 8080:8080 \
  -e GCP_PROJECT=technobrain-mendan \
  -v /path/to/credentials.json:/app/credentials.json \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
  mendan-api
```

## トラブルシューティング

### Secret Manager アクセスエラー

```
Permission denied on resource project technobrain-mendan
```

→ サービスアカウントに `roles/secretmanager.secretAccessor` が付与されているか確認

### Speech-to-Text エラー

```
Audio data is too long
```

→ 長い音声ファイルの場合、`long_running_recognize` が使用されます。タイムアウト設定を確認

### シート書き込みエラー

```
Insufficient Permission
```

→ サービスアカウントのメールアドレスでスプレッドシートが共有されているか確認

## 次のステップ

1. [ ] Porters API連携の実装（API仕様確定後）
2. [ ] Slack通知機能の強化
3. [ ] エラーハンドリングの改善
4. [ ] ログ/モニタリングの設定
