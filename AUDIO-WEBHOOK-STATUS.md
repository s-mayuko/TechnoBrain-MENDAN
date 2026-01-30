# 音声Webhook機能 - 実装状況サマリー

最終更新: 2026-01-28

## 🎯 クイックステータス

| カテゴリ | 状態 | 進捗率 |
|---------|------|-------|
| **コア実装** | ✅ 完了 | 100% |
| **GCP設定** | ⚠️ 要設定 | 60% |
| **Zapier連携** | ❌ 未設定 | 0% |
| **テスト** | ❌ 未実施 | 0% |

**総合進捗: 65%**

---

## ✅ 実装完了（コーディング済み）

### 1. GAS側 - Webhook受信機能
**ファイル**: `apps_script/Code.gs`

```javascript
// ✅ Zapierからのリクエスト受信
function doPost(e) { ... }

// ✅ Cloud Runへのデータ転送
function processAudioFromWebhook(data) { ... }

// ✅ 認証ヘッダー付きPOST
function sendToCloudRun(endpoint, payload) { ... }
```

**実装内容:**
- ✅ JSON形式でWebhook受信
- ✅ `gcs_uri`, `record_id`, `metadata` のパース
- ✅ Cloud Run `/process_audio` エンドポイント呼び出し
- ✅ エラーハンドリング

---

### 2. Cloud Run側 - 音声処理パイプライン
**ファイル**: `cloud_run/app/`

```python
# ✅ APIエンドポイント (main.py)
@app.post("/process_audio")
async def process_audio(request: ProcessAudioRequest, ...): ...

# ✅ 処理パイプライン (audio_pipeline.py)
async def process_audio_pipeline(
    sheet_id, sheet_name, gcs_uri, language_code, record_id, metadata
): ...

# ✅ 文字起こし
async def transcribe_audio(gcs_uri, language_code): ...

# ✅ Claude抽出 (extract_schema.py)
async def extract_fields_from_transcript(transcript, labels, metadata): ...

# ✅ シート書き込み (sheets_client.py)
def write_audio_results(sheet_id, sheet_name, results): ...
```

**処理フロー:**
1. GCS URIから音声データ取得
2. Speech-to-Text APIで文字起こし
3. Claude APIで項目抽出（JSON形式）
4. スプレッドシートE/J/K列に書き込み

**実装内容:**
- ✅ Speech-to-Text API連携（短音声・長音声対応）
- ✅ Claude API連携（構造化抽出）
- ✅ Google Sheets API連携
- ✅ 認証（Internal API Key）
- ✅ ログマスキング（個人情報保護）
- ✅ エラーハンドリング
- ✅ タイムアウト設定（長音声: 10分）

---

## ⚠️ 要設定（コードは完成、設定作業が必要）

### 1. GAS Webアプリデプロイ - 🔴 必須

**現状**: コードは完成、デプロイURLがまだない

**必要な作業**:
1. Apps Scriptで「デプロイ」→「新しいデプロイ」
2. 種類: ウェブアプリ
3. アクセス権限: `全員`（Zapier用）
4. デプロイURLを取得（例: `https://script.google.com/macros/s/.../exec`）

**所要時間**: 2分

**手順詳細**: [AUDIO-WEBHOOK-GUIDE.md - Step 2](./AUDIO-WEBHOOK-GUIDE.md#step-2-gas-webアプリデプロイ)

---

### 2. GCSバケット作成 - 🔴 必須

**現状**: 音声ファイル保存先のGCSバケットが未作成

**必要な作業**:
```bash
# バケット作成
gcloud storage buckets create gs://technobrain-mendan-audio \
  --project=technobrain-mendan \
  --location=asia-northeast1

# Cloud Runサービスアカウントに読み取り権限付与
export SERVICE_ACCOUNT=$(gcloud run services describe mendan-api \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.serviceAccountName)")

gcloud storage buckets add-iam-policy-binding gs://technobrain-mendan-audio \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectViewer"
```

**所要時間**: 3分

**手順詳細**: [AUDIO-WEBHOOK-GUIDE.md - Step 1](./AUDIO-WEBHOOK-GUIDE.md#step-1-gcsバケット作成音声ファイル保存用)

---

### 3. Speech-to-Text API有効化 - 🔴 必須

**現状**: APIが未有効化の可能性

**必要な作業**:
```bash
gcloud services enable speech.googleapis.com
```

**所要時間**: 1分

---

## ❌ 未実装（新規作業が必要）

### 1. Zapierワークフロー設定 - 🔴 必須

**現状**: Zapier側の設定が完全に未着手

**必要な作業**:
1. Zapier新規Zap作成
2. Trigger設定（例: Slack, Google Drive, etc.）
3. Action設定（Webhooks by Zapier）
   - URL: GAS WebアプリURL
   - Payload: `{"gcs_uri": "...", "record_id": "...", "metadata": {...}}`
4. テスト実行

**課題**:
- 音声ファイルをGCSにアップロードする方法が未定
  - **Option A**: Zapier Code by Zapier（Python）でGCS SDK使用
  - **Option B**: Cloud Functionsで専用アップロードAPIを作成
  - **Option C**: 事前アップロード（手動またはスクリプト）

**所要時間**: 30分〜1時間

**手順詳細**: [AUDIO-WEBHOOK-GUIDE.md - Step 5](./AUDIO-WEBHOOK-GUIDE.md#step-5-zapierワークフロー設定)

---

### 2. エンドツーエンドテスト - 🟡 推奨

**現状**: 全体動作テストが未実施

**必要な作業**:
1. テスト音声ファイルをGCSにアップロード
2. curlでGAS Webhookを呼び出し
3. Cloud Runログ確認
4. スプレッドシート確認

**所要時間**: 15分

**手順詳細**: [AUDIO-WEBHOOK-GUIDE.md - 動作確認](./AUDIO-WEBHOOK-GUIDE.md#動作確認)

---

### 3. エラーハンドリング強化 - 🟡 推奨

**現状**: 基本的なエラーハンドリングのみ

**追加推奨項目**:
- [ ] 自動リトライ（Speech-to-Text失敗時）
- [ ] 処理完了時のSlack通知
- [ ] 異常検知アラート（Cloud Monitoring）
- [ ] レート制限対応（Claude API）

---

## 📋 セットアップチェックリスト

### 前提条件（既に完了）
- [x] Cloud Runデプロイ済み
- [x] GASコード配置済み
- [x] Secret Manager設定済み
- [x] スプレッドシート準備済み

### これから実施（必須）
- [ ] **GAS Webアプリデプロイ** ← ⏱️ 2分
- [ ] **GCSバケット作成** ← ⏱️ 3分
- [ ] **Speech-to-Text API有効化** ← ⏱️ 1分
- [ ] **GAS Script Properties確認**（CLOUD_RUN_BASE_URL, INTERNAL_API_KEY）
- [ ] **手動テスト実行**（curl） ← ⏱️ 5分
- [ ] **Zapierワークフロー設定** ← ⏱️ 30分
- [ ] **エンドツーエンドテスト** ← ⏱️ 15分

**必須作業の合計所要時間: 約1時間**

---

## 🚀 次にやるべきこと

### 今すぐできること（優先度順）

1. **GCSバケット作成**
   ```bash
   gcloud storage buckets create gs://technobrain-mendan-audio \
     --project=technobrain-mendan --location=asia-northeast1
   ```

2. **Speech-to-Text API有効化**
   ```bash
   gcloud services enable speech.googleapis.com
   ```

3. **GAS Webアプリデプロイ**
   - Apps Script →「デプロイ」→「新しいデプロイ」
   - URLをコピー

4. **手動テスト**
   ```bash
   # テスト音声をアップロード
   gcloud storage cp sample.wav gs://technobrain-mendan-audio/audio/test.wav
   
   # Webhook呼び出し
   curl -X POST "[GAS WebアプリURL]" \
     -H "Content-Type: application/json" \
     -d '{"gcs_uri":"gs://technobrain-mendan-audio/audio/test.wav","record_id":"TEST-001"}'
   ```

5. **結果確認**
   - スプレッドシートのE列を確認
   - Cloud Runログを確認

---

## 📁 関連ファイル

| ファイル | 説明 |
|---------|------|
| **AUDIO-WEBHOOK-GUIDE.md** | 完全セットアップガイド（本体） |
| **AUDIO-WEBHOOK-STATUS.md** | 実装状況サマリー（本ファイル） |
| **apps_script/Code.gs** | GAS実装コード（doPost等） |
| **cloud_run/app/main.py** | Cloud Run APIエンドポイント |
| **cloud_run/app/audio_pipeline.py** | 音声処理パイプライン |
| **cloud_run/app/extract_schema.py** | Claude抽出ロジック |
| **POC-QUICKSTART.md** | 基本セットアップ（マージ機能） |

---

## 🎓 アーキテクチャ概要

```
外部トリガー         Webhook受信          処理実行              データ保存
─────────────────────────────────────────────────────────────────────────
                                                                          
┌─────────┐         ┌─────────┐         ┌─────────┐         ┌─────────┐
│ Zapier  │────────▶│   GAS   │────────▶│Cloud Run│────────▶│ Sheets  │
│         │  POST   │ doPost()│  POST   │/process │  Write  │  E/J/K  │
└─────────┘         └─────────┘         │ _audio  │         └─────────┘
     │                                   └─────────┘               
     │                                        │                    
     ▼                                        ▼                    
┌─────────┐                            ┌─────────┐               
│   GCS   │───────────────────────────▶│Speech to│               
│  Audio  │         Read               │  Text   │               
└─────────┘                            └─────────┘               
                                             │                    
                                             ▼                    
                                       ┌─────────┐               
                                       │ Claude  │               
                                       │   API   │               
                                       └─────────┘               
```

---

## ❓ FAQ

**Q: コードは完成しているのに、なぜ動かないの？**

A: コード実装は100%完了していますが、以下の設定作業が必要です:
- GAS Webアプリのデプロイ（WebhookのURL発行）
- GCSバケットの作成（音声ファイル保存先）
- Zapierの設定（Webhook送信元）

**Q: 最短で動かすにはどうすればいい？**

A: 以下の順で実施してください（合計15分）:
1. GCSバケット作成（3分）
2. Speech-to-Text API有効化（1分）
3. GAS Webアプリデプロイ（2分）
4. 手動テスト（9分）

**Q: Zapier以外のトリガーは使える？**

A: はい。GAS `doPost()` はHTTP POSTを受け付けるため、以下も可能です:
- Cloud Scheduler（定期実行）
- Cloud Functions（イベント駆動）
- 手動curl（テスト用）
- 他のWebhook送信サービス

**Q: 音声ファイルのアップロード方法は？**

A: 以下の方法があります:
1. **gcloudコマンド**: `gcloud storage cp audio.wav gs://bucket/audio/`
2. **GCS Console**: ブラウザでアップロード
3. **Zapier Code**: Python/Node.jsでプログラム的にアップロード
4. **Cloud Functions**: 専用アップロードAPIを作成

---

**🎯 次のステップ**: [AUDIO-WEBHOOK-GUIDE.md](./AUDIO-WEBHOOK-GUIDE.md) の手順に従ってセットアップを完了してください。
