# 音声データWebhook受信フロー - 完全ガイド

最終更新: 2026-01-28

## 📋 目次

1. [全体フロー図](#全体フロー図)
2. [実装状況](#実装状況)
3. [セットアップ手順](#セットアップ手順)
4. [動作確認](#動作確認)
5. [トラブルシューティング](#トラブルシューティング)

---

## 🔄 全体フロー図

```
┌─────────┐      ┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│ Zapier  │─────▶│ GAS Webapp  │─────▶│  Cloud Run   │─────▶│ Spreadsheet  │
│(Webhook)│      │  doPost()   │      │/process_audio│      │   E列反映    │
└─────────┘      └─────────────┘      └──────────────┘      └──────────────┘
    │                   │                      │
    │                   │                      ├──▶ Speech-to-Text
    │                   │                      │     (音声→テキスト)
    │                   │                      │
    │                   │                      ├──▶ Claude API
    │                   │                      │     (テキスト→JSON)
    │                   │                      │
    │                   │                      └──▶ Sheets API
    │                   │                            (E列書き込み)
    ▼                   ▼                      
 GCS音声              認証・転送              処理パイプライン
 アップロード          payload作成            実行
```

### データフロー

**Zapier → GAS**
```json
{
  "gcs_uri": "gs://your-bucket/audio/sample.wav",
  "record_id": "12345",
  "metadata": {
    "ca_name": "田中太郎",
    "slack_mention_id": "U12345678",
    "call_date": "2026-01-28"
  }
}
```

**GAS → Cloud Run**
```json
{
  "sheet_id": "1AbC...XyZ",
  "sheet_name": "merge_ui",
  "gcs_uri": "gs://your-bucket/audio/sample.wav",
  "language_code": "ja-JP",
  "record_id": "12345",
  "metadata": {
    "ca_name": "田中太郎",
    "slack_mention_id": "U12345678",
    "call_date": "2026-01-28"
  }
}
```

**Cloud Run → Spreadsheet**
- E列: 抽出された値（例: "1990/05/15"）
- J列: confidence（例: "high"）
- K列: evidence（例: "transcript: '1990年5月15日生まれです'"）

---

## ✅ 実装状況

### 完了している機能

| コンポーネント | 状態 | ファイル | 説明 |
|-------------|------|---------|------|
| **GAS Webhook受信** | ✅ | `apps_script/Code.gs:415` | `doPost()` でWebhook受信 |
| **GAS→Cloud Run連携** | ✅ | `apps_script/Code.gs:439` | `processAudioFromWebhook()` |
| **Cloud Run API** | ✅ | `cloud_run/app/main.py:106` | `/process_audio` エンドポイント |
| **Speech-to-Text** | ✅ | `cloud_run/app/audio_pipeline.py:82` | 音声→テキスト変換 |
| **Claude抽出** | ✅ | `cloud_run/app/extract_schema.py` | テキスト→JSON抽出 |
| **シート書き込み** | ✅ | `cloud_run/app/sheets_client.py` | E/J/K列更新 |
| **認証（API Key）** | ✅ | `cloud_run/app/main.py:77` | Internal API Key |
| **ログマスキング** | ✅ | `cloud_run/app/log_utils.py` | 個人情報保護 |

### 未完了・要設定の項目

| 項目 | 状態 | 優先度 | 説明 |
|-----|------|-------|------|
| **GAS Webアプリデプロイ** | ⚠️ 要設定 | 🔴 必須 | ZapierからアクセスできるURL発行 |
| **GCSバケット作成** | ⚠️ 要設定 | 🔴 必須 | 音声ファイル保存先 |
| **Zapierワークフロー** | ❌ 未作成 | 🔴 必須 | Webhook送信設定 |
| **エンドツーエンドテスト** | ❌ 未実施 | 🟡 推奨 | 全体動作確認 |
| **エラーハンドリング強化** | ⚠️ 部分実装 | 🟡 推奨 | リトライ・通知 |

---

## 🚀 セットアップ手順

### 前提条件

- ✅ Cloud Runデプロイ済み（`mendan-api`）
- ✅ GASコード配置済み（`apps_script/Code.gs`）
- ✅ Secret Manager設定済み（Anthropic API Key, Webhook URL/Token）
- ✅ スプレッドシート準備済み（`merge_ui` シート）

---

### Step 1: GCSバケット作成（音声ファイル保存用）

```bash
# バケット名を決定（例: technobrain-mendan-audio）
export BUCKET_NAME="technobrain-mendan-audio"

# バケット作成
gcloud storage buckets create gs://${BUCKET_NAME} \
  --project=technobrain-mendan \
  --location=asia-northeast1 \
  --uniform-bucket-level-access

# Cloud RunサービスアカウントにGCS読み取り権限を付与
export SERVICE_ACCOUNT=$(gcloud run services describe mendan-api \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.serviceAccountName)")

gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectViewer"
```

**確認:**
```bash
gcloud storage buckets describe gs://${BUCKET_NAME}
```

---

### Step 2: GAS Webアプリデプロイ

#### 2-1. Script Properties設定確認

スプレッドシートで「拡張機能」→「Apps Script」→「プロジェクトの設定」

| プロパティ名 | 値の例 | 必須 |
|------------|-------|------|
| `CLOUD_RUN_BASE_URL` | `https://mendan-api-251107091138.asia-northeast1.run.app` | ✅ |
| `INTERNAL_API_KEY` | `your-secret-key-here` | ✅ |
| `RECORD_ID` | （任意） | ❌ |

#### 2-2. Webアプリとしてデプロイ

1. Apps Scriptエディタで「デプロイ」→「新しいデプロイ」
2. 設定:
   - **種類**: ウェブアプリ
   - **説明**: `音声Webhook受信エンドポイント`
   - **次のユーザーとして実行**: `自分（your-email@example.com）`
   - **アクセスできるユーザー**: `全員`（⚠️ Zapierからアクセスするため必須）
3. 「デプロイ」をクリック
4. **WebアプリURL** をコピー（例: `https://script.google.com/macros/s/AKfycby.../exec`）

#### 2-3. デプロイURL確認

```bash
# URLをメモ帳などに保存
# 例: https://script.google.com/macros/s/AKfycby123.../exec
```

**⚠️ セキュリティ注意:**
- このURLは公開されます（Zapierがアクセスするため）
- `INTERNAL_API_KEY` で Cloud Run へのアクセスは保護されています
- より高度な認証が必要な場合は、GAS側でトークン検証を追加してください

---

### Step 3: 音声ファイルテストアップロード

```bash
# サンプル音声ファイルを作成（16kHz WAV形式）
# 実際の音声ファイルがある場合はそれを使用

# アップロード
gcloud storage cp sample.wav gs://${BUCKET_NAME}/audio/test-001.wav

# URIを確認
echo "gs://${BUCKET_NAME}/audio/test-001.wav"
```

**音声ファイル要件:**
- 形式: WAV, FLAC, MP3等
- サンプルレート: 16kHz推奨（8kHz〜48kHzサポート）
- チャンネル: モノラル推奨
- 最大長: 60分（長い場合は自動的にlong_running_recognizeを使用）

---

### Step 4: 手動テスト（Webhook呼び出し）

#### 4-1. curlでテスト

```bash
# GAS WebアプリURLを環境変数に設定
export GAS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycby.../exec"

# テストリクエスト送信
curl -X POST "${GAS_WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "gcs_uri": "gs://technobrain-mendan-audio/audio/test-001.wav",
    "record_id": "TEST-001",
    "metadata": {
      "ca_name": "テスト太郎",
      "slack_mention_id": "U12345678",
      "test_mode": true
    }
  }'
```

**期待されるレスポンス:**
```json
{
  "status": "ok"
}
```

#### 4-2. スプレッドシート確認

1. `merge_ui` シートを開く
2. **E列**に抽出された値が反映されているか確認
3. **J列**（confidence）と**K列**（evidence）も確認

#### 4-3. Cloud Runログ確認

```bash
# 最新ログを確認
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --limit=50

# 特定のrecord_idで検索
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter="TEST-001"
```

---

### Step 5: Zapierワークフロー設定

#### 5-1. Zapier新規Zap作成

1. **Trigger**: 
   - 例: Google Drive「New File in Folder」
   - または: Slack「New Message Posted to Channel」
   - または: Webhookを受信する他のサービス

2. **Action 1 - 音声ファイルをGCSにアップロード**:
   
   ⚠️ Zapierに「Google Cloud Storage」ネイティブアクションがない場合:
   
   **Option A: Cloud FunctionsでGCSアップロードAPIを作成**
   ```python
   # Cloud Functions HTTPエンドポイント
   # ZapierからファイルURLを受け取り、GCSにアップロード
   ```
   
   **Option B: Zapier Code by Zapier（Python）**
   ```python
   import requests
   from google.cloud import storage
   
   # ファイルをダウンロードしてGCSにアップロード
   ```
   
   **Option C: 事前アップロード済み前提**
   - ファイルは別途GCSにアップロード済み
   - ZapierはGCS URIのみを送信

3. **Action 2 - Webhooks by Zapier**:
   - **Action**: POST
   - **URL**: `{{GAS_WEBHOOK_URL}}`（Step 2-2でコピーしたURL）
   - **Payload Type**: JSON
   - **Data**:
     ```json
     {
       "gcs_uri": "gs://technobrain-mendan-audio/audio/{{file_name}}",
       "record_id": "{{unique_id}}",
       "metadata": {
         "ca_name": "{{ca_name}}",
         "slack_mention_id": "{{user_id}}",
         "source": "zapier"
       }
     }
     ```

4. **Test & Review**: Zapierのテスト機能で動作確認

#### 5-2. Zapier設定例（Slackトリガーの場合）

```
Trigger: Slack - New Message Posted to Channel
  Channel: #audio-submissions
  Trigger Type: New Message

Filter (Optional):
  Only continue if message contains file attachment

Action 1: Code by Zapier - Python
  Input:
    - file_url: {{trigger.file_url}}
    - file_name: {{trigger.file_name}}
  Code:
    # GCSアップロードロジック
    return {"gcs_uri": f"gs://technobrain-mendan-audio/audio/{file_name}"}

Action 2: Webhooks by Zapier - POST
  URL: [GAS Webapp URL]
  Payload:
    {
      "gcs_uri": "{{action1.gcs_uri}}",
      "record_id": "{{trigger.ts}}",
      "metadata": {
        "ca_name": "{{trigger.user_name}}",
        "slack_mention_id": "{{trigger.user_id}}"
      }
    }
```

---

## ✅ 動作確認

### 確認項目チェックリスト

- [ ] **GCS**: 音声ファイルがアップロードされている
- [ ] **GAS Webhook**: curlテストで `{"status":"ok"}` が返る
- [ ] **Cloud Run**: ログに `Processing audio:` が記録されている
- [ ] **Speech-to-Text**: ログに `Transcription completed:` が記録されている
- [ ] **Claude**: ログに `Extraction completed:` が記録されている
- [ ] **Spreadsheet**: E列に値が反映されている
- [ ] **Spreadsheet**: J列（confidence）、K列（evidence）に値がある
- [ ] **Zapier**: テスト実行が成功する

### エンドツーエンドテスト手順

```bash
# 1. テスト音声ファイルをGCSにアップロード
gcloud storage cp test-sample.wav gs://technobrain-mendan-audio/audio/e2e-test-001.wav

# 2. GAS Webhookを呼び出し
curl -X POST "https://script.google.com/macros/s/AKfycby.../exec" \
  -H "Content-Type: application/json" \
  -d '{
    "gcs_uri": "gs://technobrain-mendan-audio/audio/e2e-test-001.wav",
    "record_id": "E2E-TEST-001",
    "metadata": {
      "ca_name": "E2Eテスト",
      "test": true
    }
  }'

# 3. Cloud Runログ確認（30秒待機）
sleep 30
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter="E2E-TEST-001" \
  --limit=20

# 4. スプレッドシート確認
# ブラウザで merge_ui シートを開き、E/J/K列を確認
```

---

## 🔧 トラブルシューティング

### エラー: 「CLOUD_RUN_BASE_URLが設定されていません」

**原因**: GAS Script Propertiesが未設定

**解決策**:
1. Apps Script →「プロジェクトの設定」→「スクリプトプロパティ」
2. `CLOUD_RUN_BASE_URL` を追加
3. 値: `https://mendan-api-251107091138.asia-northeast1.run.app`

---

### エラー: 「Invalid API key」（Cloud Run）

**原因**: GASとCloud Runの `INTERNAL_API_KEY` が一致していない

**解決策**:
```bash
# 1. Cloud Runの環境変数を確認
gcloud run services describe mendan-api \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)"

# 2. GAS Script Propertiesを確認
# Apps Script →「プロジェクトの設定」で INTERNAL_API_KEY を確認

# 3. 一致していない場合、Cloud Runを更新
gcloud run services update mendan-api \
  --region=asia-northeast1 \
  --set-env-vars="INTERNAL_API_KEY=your-matching-key"
```

---

### エラー: 「Permission denied for GCS bucket」

**原因**: Cloud RunサービスアカウントがGCSバケットにアクセスできない

**解決策**:
```bash
# サービスアカウントを確認
export SERVICE_ACCOUNT=$(gcloud run services describe mendan-api \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.serviceAccountName)")

echo "Service Account: ${SERVICE_ACCOUNT}"

# GCSバケットに権限を付与
gcloud storage buckets add-iam-policy-binding gs://technobrain-mendan-audio \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectViewer"
```

---

### エラー: 「Speech-to-Text API not enabled」

**原因**: Speech-to-Text APIが未有効化

**解決策**:
```bash
gcloud services enable speech.googleapis.com
```

---

### エラー: 「No transcript generated from audio」

**原因**: 
1. 音声ファイルの形式が不正
2. 音声ファイルが空または破損
3. 音声ファイルに音声が含まれていない

**解決策**:
```bash
# 1. 音声ファイルをダウンロードして確認
gcloud storage cp gs://technobrain-mendan-audio/audio/test.wav ./test.wav

# 2. ファイル情報を確認（ffprobeなど）
ffprobe -i test.wav

# 3. 正しい形式に変換（ffmpeg）
ffmpeg -i input.mp3 -ar 16000 -ac 1 -c:a pcm_s16le output.wav
```

---

### エラー: 「Claude API rate limit exceeded」

**原因**: Anthropic APIのレート制限に達した

**解決策**:
1. APIキーのプランを確認（Free/Pro/Scale）
2. リクエスト頻度を制限
3. エラーハンドリング・リトライロジックを追加

---

### Webhook呼び出しが成功するがスプレッドシートに反映されない

**デバッグ手順**:

```bash
# 1. Cloud Runログで処理状況を確認
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --limit=100 | grep -i "error\|exception\|traceback"

# 2. GASログを確認
# Apps Script →「実行数」→ 最近の実行を確認

# 3. スプレッドシートIDが正しいか確認
# Code.gs: ss.getId() が正しいシートを指しているか
```

**よくある原因**:
- スプレッドシートIDが間違っている
- シート名が `merge_ui` でない
- A列（ラベル）が空
- Sheets APIの権限不足

---

## 📝 次のステップ

### 完了後の改善項目

1. **自動リトライ**: Cloud Run側でエラー時のリトライロジック追加
2. **通知強化**: 処理完了時のSlack通知
3. **バッチ処理**: 複数音声ファイルの一括処理
4. **監視ダッシュボード**: Cloud MonitoringでSLI/SLO設定
5. **コスト最適化**: Speech-to-TextとClaude APIの使用量監視

---

## 📚 関連ドキュメント

- [POC-QUICKSTART.md](./POC-QUICKSTART.md) - 基本セットアップ
- [CONFIG-SHEET-GUIDE.md](./CONFIG-SHEET-GUIDE.md) - configシート設定
- [apps_script/README.md](./apps_script/README.md) - GAS詳細
- [cloud_run/README.md](./cloud_run/README.md) - Cloud Run詳細
- [DOD-STATUS.md](./DOD-STATUS.md) - 実装状況

---

## 🆘 サポート

問題が解決しない場合:

1. Cloud Runログを確認: `gcloud run services logs read mendan-api --region=asia-northeast1 --limit=100`
2. GASログを確認: Apps Script →「実行数」
3. エラーメッセージをコピーして検索
4. 本ドキュメントの「トラブルシューティング」を確認
