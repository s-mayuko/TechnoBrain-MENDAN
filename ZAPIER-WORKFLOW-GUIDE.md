# Zapierワークフロー設定ガイド

最終更新: 2026-01-28

## 📋 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [方法1: Code by Zapierでアップロード](#方法1-code-by-zapierでアップロード)
4. [方法2: Cloud Functionsでアップロード](#方法2-cloud-functionsでアップロード)
5. [方法3: 事前アップロード済み前提](#方法3-事前アップロード済み前提)
6. [テストとデバッグ](#テストとデバッグ)
7. [トラブルシューティング](#トラブルシューティング)

---

## 📖 概要

このガイドでは、Zapierから音声データをGASに送信するワークフローを設定します。

### 処理フロー

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Trigger │───▶│GCSアップ │───▶│  Webhook │───▶│   GAS    │
│ (Slack等)│    │ロード    │    │  POST    │    │  doPost()│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### 3つの実装方法

| 方法 | 難易度 | コスト | 推奨度 |
|-----|-------|-------|-------|
| **方法1: Code by Zapier** | 🟡 中 | 💰 低 | ⭐⭐⭐ おすすめ |
| **方法2: Cloud Functions** | 🔴 高 | 💰💰 中 | ⭐⭐ 本番向け |
| **方法3: 事前アップロード** | 🟢 低 | 💰 無料 | ⭐ テスト用 |

---

## ✅ 前提条件

### 必須
- [x] Zapierアカウント（Free or Paid）
- [x] GAS WebアプリURL（[AUDIO-WEBHOOK-GUIDE.md Step 2](./AUDIO-WEBHOOK-GUIDE.md#step-2-gas-webアプリデプロイ)で取得）
- [x] GCSバケット作成済み（[AUDIO-WEBHOOK-GUIDE.md Step 1](./AUDIO-WEBHOOK-GUIDE.md#step-1-gcsバケット作成音声ファイル保存用)）

### 確認コマンド

```bash
# 1. GASデプロイURL確認（Apps Script UI で確認）
# 例: https://script.google.com/macros/s/AKfycby.../exec

# 2. GCSバケット確認
gcloud storage buckets describe gs://technobrain-mendan-audio

# 3. Cloud Runエンドポイント確認
gcloud run services describe mendan-api \
  --region=asia-northeast1 \
  --format="value(status.url)"
```

---

## 🚀 方法1: Code by Zapierでアップロード

### 概要

Zapier内のPythonコードでGCSに直接アップロードします。

**メリット:**
- ✅ Zapier内で完結（外部サービス不要）
- ✅ 設定が比較的シンプル
- ✅ カスタマイズ可能

**デメリット:**
- ⚠️ Zapier PaidプランでCode by Zapierの実行時間制限あり
- ⚠️ GCPサービスアカウントキーの管理が必要

---

### Step 1-1: GCPサービスアカウント作成

```bash
# サービスアカウント作成
gcloud iam service-accounts create zapier-gcs-uploader \
  --display-name="Zapier GCS Uploader" \
  --description="Zapier用GCSアップロードサービスアカウント"

# 作成されたアカウントを確認
export SA_EMAIL="zapier-gcs-uploader@technobrain-mendan.iam.gserviceaccount.com"
echo "Service Account: ${SA_EMAIL}"

# GCSバケットへの書き込み権限を付与
gcloud storage buckets add-iam-policy-binding gs://technobrain-mendan-audio \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectCreator"

# サービスアカウントキーを生成（JSON）
gcloud iam service-accounts keys create ./zapier-gcs-key.json \
  --iam-account="${SA_EMAIL}"

# キーの内容を確認
cat ./zapier-gcs-key.json
```

**⚠️ セキュリティ注意:**
- `zapier-gcs-key.json` は機密情報です
- Gitにコミットしないでください
- 使用後は安全に保管し、不要になったら削除してください

---

### Step 1-2: Zapier新規Zap作成

1. Zapier にログイン: https://zapier.com/app/zaps
2. 「Create Zap」をクリック

---

### Step 1-3: Trigger設定

**例: Slackの添付ファイルをトリガーにする場合**

1. **Trigger App**: Slack
2. **Trigger Event**: New File
   - または: New Message Posted to Channel（添付ファイル付き）
3. **Account**: Slack接続
4. **Setup**:
   - **Channel**: 音声ファイルが投稿されるチャンネル（例: `#audio-submissions`）
   - **File Types**: `audio/*` または `audio/wav,audio/mp3`
5. **Test**: テストファイルを選択

**他のトリガー例:**
- **Google Drive**: New File in Folder
- **Dropbox**: New File in Folder
- **Webhooks by Zapier**: Catch Hook（外部システムから送信）

---

### Step 1-4: Action 1 - Code by Zapier（GCSアップロード）

1. **Action App**: Code by Zapier
2. **Action Event**: Run Python
3. **Setup**:

**Input Data:**
| Key | Value（Zapierの動的フィールド） |
|-----|------------------------------|
| `file_url` | Slack File URL（例: `{{151234__url_private}}`） |
| `file_name` | File Name（例: `{{151234__name}}`） |
| `gcs_bucket` | `technobrain-mendan-audio` |
| `gcs_credentials_json` | （Step 1-1でコピーしたJSON全体をペースト） |

**Code:**

```python
import json
import requests
from io import BytesIO
from datetime import datetime

# 入力データ
file_url = input_data['file_url']
file_name = input_data['file_name']
gcs_bucket = input_data['gcs_bucket']
gcs_credentials_json = input_data['gcs_credentials_json']

# ファイルをダウンロード
headers = {}
# Slackの場合はトークンが必要（Zapierが自動的に付与）
response = requests.get(file_url)
response.raise_for_status()
audio_data = response.content

# GCS用のファイル名を生成（タイムスタンプ付き）
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
safe_filename = file_name.replace(' ', '_').replace('/', '_')
gcs_path = f"audio/{timestamp}_{safe_filename}"

# GCS認証情報をパース
credentials_dict = json.loads(gcs_credentials_json)

# GCS SDKをインポート（Zapierには pre-installed）
try:
    from google.cloud import storage
    from google.oauth2 import service_account
except ImportError:
    # Zapier環境にない場合はREST APIで代替
    raise Exception("google-cloud-storage not available. Use REST API instead.")

# 認証情報からクライアント作成
credentials = service_account.Credentials.from_service_account_info(credentials_dict)
storage_client = storage.Client(credentials=credentials, project=credentials_dict['project_id'])

# アップロード
bucket = storage_client.bucket(gcs_bucket)
blob = bucket.blob(gcs_path)
blob.upload_from_string(audio_data, content_type='audio/wav')

# GCS URI生成
gcs_uri = f"gs://{gcs_bucket}/{gcs_path}"

# 出力（次のステップで使用）
output = {
    'gcs_uri': gcs_uri,
    'file_name': safe_filename,
    'file_size': len(audio_data),
    'uploaded_at': timestamp
}
```

**⚠️ Zapier環境の制限:**
- Zapier Freeプランでは Code by Zapier が使えません（Starterプラン以上が必要）
- 実行時間制限: 10秒（長いファイルの場合はタイムアウトの可能性）
- Python環境: 一部のライブラリのみ利用可能

**代替方法（REST API使用）:**

もし `google-cloud-storage` が使えない場合、GCS REST APIを使用:

```python
import json
import requests
import base64
from datetime import datetime

# 入力データ
file_url = input_data['file_url']
file_name = input_data['file_name']
gcs_bucket = input_data['gcs_bucket']
gcs_credentials_json = input_data['gcs_credentials_json']

# ファイルをダウンロード
response = requests.get(file_url)
response.raise_for_status()
audio_data = response.content

# ファイル名生成
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
safe_filename = file_name.replace(' ', '_').replace('/', '_')
gcs_path = f"audio/{timestamp}_{safe_filename}"

# OAuth2トークン取得（サービスアカウントキーから）
credentials_dict = json.loads(gcs_credentials_json)

# JWT作成してOAuth2トークン取得（簡略版）
# 本番ではgoogle-authライブラリ使用推奨
import time
import jwt

now = int(time.time())
payload = {
    'iss': credentials_dict['client_email'],
    'scope': 'https://www.googleapis.com/auth/devstorage.read_write',
    'aud': 'https://oauth2.googleapis.com/token',
    'exp': now + 3600,
    'iat': now
}

signed_jwt = jwt.encode(payload, credentials_dict['private_key'], algorithm='RS256')

# トークンリクエスト
token_response = requests.post(
    'https://oauth2.googleapis.com/token',
    data={
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': signed_jwt
    }
)
access_token = token_response.json()['access_token']

# GCS REST APIでアップロード
upload_url = f"https://storage.googleapis.com/upload/storage/v1/b/{gcs_bucket}/o?uploadType=media&name={gcs_path}"
upload_response = requests.post(
    upload_url,
    headers={
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'audio/wav'
    },
    data=audio_data
)
upload_response.raise_for_status()

# 出力
gcs_uri = f"gs://{gcs_bucket}/{gcs_path}"
output = {
    'gcs_uri': gcs_uri,
    'file_name': safe_filename,
    'uploaded_at': timestamp
}
```

4. **Test**: テスト実行して `gcs_uri` が出力されることを確認

---

### Step 1-5: Action 2 - Webhooks by Zapier（GAS呼び出し）

1. **Action App**: Webhooks by Zapier
2. **Action Event**: POST
3. **Setup**:

**URL:**
```
https://script.google.com/macros/s/AKfycby.../exec
```
（GAS WebアプリURLをペースト）

**Payload Type:** `json`

**Data:**
```json
{
  "gcs_uri": "{{output__gcs_uri}}",
  "record_id": "{{trigger__ts}}",
  "metadata": {
    "ca_name": "{{trigger__user_name}}",
    "slack_mention_id": "{{trigger__user_id}}",
    "original_filename": "{{trigger__name}}",
    "uploaded_at": "{{output__uploaded_at}}",
    "source": "zapier"
  }
}
```

**Headers:**
（任意: 認証が必要な場合）
```
Content-Type: application/json
```

4. **Test**: テスト実行

**期待されるレスポンス:**
```json
{
  "status": "ok"
}
```

---

### Step 1-6: Zap有効化

1. 「Publish Zap」をクリック
2. Zap名を設定（例: `Slack Audio to GCS → GAS Webhook`）
3. 「Turn on Zap」

---

## 🔧 方法2: Cloud Functionsでアップロード

### 概要

専用のCloud Functionsエンドポイントを作成し、Zapierからファイルをアップロードします。

**メリット:**
- ✅ Zapier側の設定がシンプル
- ✅ 実行時間制限が緩い（Cloud Functions: 最大540秒）
- ✅ 大容量ファイルに対応
- ✅ 認証情報をGCP側で管理（Zapierに保存不要）

**デメリット:**
- ⚠️ Cloud Functionsの追加コストが発生
- ⚠️ GCP設定が必要

---

### Step 2-1: Cloud Functions作成

#### functions/upload_audio/main.py

```python
import os
import json
from flask import Flask, request, jsonify
from google.cloud import storage
from datetime import datetime
import uuid

app = Flask(__name__)

# 環境変数
GCS_BUCKET = os.environ.get('GCS_BUCKET', 'technobrain-mendan-audio')

@app.route('/upload', methods=['POST'])
def upload_audio():
    """
    音声ファイルをGCSにアップロード
    
    Request:
        - multipart/form-data: file
        - または JSON: {"file_url": "https://...", "file_name": "audio.wav"}
    
    Response:
        {"gcs_uri": "gs://bucket/audio/file.wav", "uploaded_at": "..."}
    """
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(GCS_BUCKET)
        
        # multipart/form-dataの場合
        if 'file' in request.files:
            file = request.files['file']
            file_name = file.filename
            file_data = file.read()
        
        # JSONの場合（file_urlからダウンロード）
        elif request.is_json:
            data = request.get_json()
            file_url = data.get('file_url')
            file_name = data.get('file_name', 'audio.wav')
            
            # ファイルをダウンロード
            import requests
            response = requests.get(file_url)
            response.raise_for_status()
            file_data = response.content
        else:
            return jsonify({'error': 'No file provided'}), 400
        
        # GCS用のファイル名生成
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        safe_filename = file_name.replace(' ', '_').replace('/', '_')
        gcs_path = f"audio/{timestamp}_{unique_id}_{safe_filename}"
        
        # アップロード
        blob = bucket.blob(gcs_path)
        blob.upload_from_string(file_data, content_type='audio/wav')
        
        # GCS URI
        gcs_uri = f"gs://{GCS_BUCKET}/{gcs_path}"
        
        return jsonify({
            'gcs_uri': gcs_uri,
            'file_name': safe_filename,
            'file_size': len(file_data),
            'uploaded_at': timestamp,
            'unique_id': unique_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
```

#### functions/upload_audio/requirements.txt

```
Flask==3.0.0
google-cloud-storage==2.14.0
requests==2.31.0
```

---

### Step 2-2: Cloud Functionsデプロイ

```bash
# プロジェクト設定
gcloud config set project technobrain-mendan

# デプロイ（第2世代）
gcloud functions deploy upload-audio-to-gcs \
  --gen2 \
  --runtime=python311 \
  --region=asia-northeast1 \
  --source=./functions/upload_audio \
  --entry-point=app \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars="GCS_BUCKET=technobrain-mendan-audio" \
  --max-instances=10 \
  --timeout=120s \
  --memory=512MB

# URLを確認
gcloud functions describe upload-audio-to-gcs \
  --gen2 \
  --region=asia-northeast1 \
  --format="value(serviceConfig.uri)"

# 例: https://upload-audio-to-gcs-xxxxx-an.a.run.app
```

**⚠️ セキュリティ注意:**
- 上記は `--allow-unauthenticated` で公開しています
- 本番環境では認証を追加してください（API Key, OAuth2等）

---

### Step 2-3: Zapierワークフロー設定

#### Trigger
（方法1と同じ: Slack, Google Drive等）

#### Action 1: Webhooks by Zapier（Cloud Functionsへアップロード）

1. **Action App**: Webhooks by Zapier
2. **Action Event**: POST
3. **URL**: `https://upload-audio-to-gcs-xxxxx-an.a.run.app/upload`
4. **Payload Type**: `json`
5. **Data**:
```json
{
  "file_url": "{{trigger__url_private}}",
  "file_name": "{{trigger__name}}"
}
```
6. **Test**: 実行して `gcs_uri` が返ることを確認

#### Action 2: Webhooks by Zapier（GAS呼び出し）

（方法1の Step 1-5 と同じ）

**Data:**
```json
{
  "gcs_uri": "{{action1__gcs_uri}}",
  "record_id": "{{trigger__ts}}",
  "metadata": {
    "ca_name": "{{trigger__user_name}}",
    "slack_mention_id": "{{trigger__user_id}}",
    "uploaded_at": "{{action1__uploaded_at}}",
    "unique_id": "{{action1__unique_id}}"
  }
}
```

---

## 📦 方法3: 事前アップロード済み前提

### 概要

音声ファイルは別の手段でGCSにアップロード済みで、ZapierはGCS URIのみを送信します。

**メリット:**
- ✅ 最もシンプル
- ✅ Zapier無料プランで使用可能
- ✅ コスト最小

**デメリット:**
- ⚠️ 事前にGCSアップロードが必要
- ⚠️ 自動化には別のスクリプトが必要

---

### Step 3-1: 音声ファイルをGCSにアップロード

**手動アップロード:**
```bash
# 1. ローカルファイルからアップロード
gcloud storage cp ./audio/sample.wav gs://technobrain-mendan-audio/audio/

# 2. 複数ファイルを一括アップロード
gcloud storage cp ./audio/*.wav gs://technobrain-mendan-audio/audio/

# 3. ディレクトリごとアップロード
gcloud storage cp -r ./audio/ gs://technobrain-mendan-audio/
```

**自動アップロード（Python スクリプト）:**

```python
# upload_to_gcs.py
from google.cloud import storage
import sys
import os

def upload_audio(file_path, bucket_name='technobrain-mendan-audio'):
    """音声ファイルをGCSにアップロード"""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    # ファイル名
    file_name = os.path.basename(file_path)
    gcs_path = f"audio/{file_name}"
    
    # アップロード
    blob = bucket.blob(gcs_path)
    blob.upload_from_filename(file_path)
    
    # GCS URI
    gcs_uri = f"gs://{bucket_name}/{gcs_path}"
    print(f"Uploaded: {gcs_uri}")
    return gcs_uri

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python upload_to_gcs.py <audio_file>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    upload_audio(file_path)
```

**実行:**
```bash
python upload_to_gcs.py ./audio/sample.wav
# Output: Uploaded: gs://technobrain-mendan-audio/audio/sample.wav
```

---

### Step 3-2: Zapierワークフロー設定

#### Trigger
（方法1と同じ）

#### Action: Webhooks by Zapier（GAS呼び出しのみ）

**Data:**
```json
{
  "gcs_uri": "gs://technobrain-mendan-audio/audio/{{trigger__name}}",
  "record_id": "{{trigger__ts}}",
  "metadata": {
    "ca_name": "{{trigger__user_name}}",
    "slack_mention_id": "{{trigger__user_id}}",
    "note": "Pre-uploaded to GCS"
  }
}
```

**⚠️ 注意:**
- `gcs_uri` は手動で構築するため、ファイル名が一致している必要があります
- ファイル名に空白や特殊文字がある場合は正しく動作しない可能性があります

---

## 🧪 テストとデバッグ

### Zapierでのテスト

1. **Zap Editor** で各ステップの「Test」をクリック
2. 実際のデータで実行
3. 出力を確認

### 手動テスト（curl）

**Cloud Functions（方法2）のテスト:**
```bash
# JSONでファイルURLを送信
curl -X POST "https://upload-audio-to-gcs-xxxxx-an.a.run.app/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "file_url": "https://example.com/audio.wav",
    "file_name": "test-audio.wav"
  }'

# 期待される出力
# {"gcs_uri":"gs://technobrain-mendan-audio/audio/20260128_123456_abc123_test-audio.wav","uploaded_at":"20260128_123456",...}
```

**GAS Webhook（全方法共通）のテスト:**
```bash
curl -X POST "https://script.google.com/macros/s/AKfycby.../exec" \
  -H "Content-Type: application/json" \
  -d '{
    "gcs_uri": "gs://technobrain-mendan-audio/audio/test.wav",
    "record_id": "TEST-001",
    "metadata": {"test": true}
  }'

# 期待される出力
# {"status":"ok"}
```

### Zapierログ確認

1. Zapier Dashboard → 「Zap History」
2. 各実行の詳細を確認
3. エラーがある場合は「View Details」でスタックトレースを確認

### Cloud Runログ確認

```bash
# 最新ログ
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --limit=50

# 特定のrecord_idで検索
gcloud run services logs read mendan-api \
  --region=asia-northeast1 \
  --filter="TEST-001"
```

---

## 🔧 トラブルシューティング

### エラー: 「Zapier Code by Zapier - ImportError」

**原因:** Zapier環境に必要なPythonライブラリがインストールされていない

**解決策:**
1. REST API版のコードに切り替え（上記参照）
2. または方法2（Cloud Functions）に変更

---

### エラー: 「GCS 403 Forbidden」

**原因:** サービスアカウントに権限がない

**解決策:**
```bash
# サービスアカウントを確認
export SA_EMAIL="zapier-gcs-uploader@technobrain-mendan.iam.gserviceaccount.com"

# 権限を付与
gcloud storage buckets add-iam-policy-binding gs://technobrain-mendan-audio \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectCreator"
```

---

### エラー: 「GAS Webhook - HTTP 405 Method Not Allowed」

**原因:** GAS WebアプリがGETのみを受け付けている、または `doPost()` が定義されていない

**解決策:**
1. `Code.gs` に `doPost(e)` 関数があるか確認
2. WebアプリのデプロイバージョンがV2（最新）であることを確認
3. 再デプロイ

---

### エラー: 「Zapier - Timeout」

**原因:** Code by Zapier の実行時間が10秒を超えた

**解決策:**
1. ファイルサイズを確認（大きすぎる場合は方法2を使用）
2. タイムアウト時間を延長（Paid プランのみ）
3. Cloud Functions（方法2）に変更

---

### エラー: 「GCS URI is invalid」

**原因:** GCS URIの形式が正しくない

**解決策:**
- 正しい形式: `gs://bucket-name/path/to/file.wav`
- 間違った形式: `https://storage.googleapis.com/...`, `gcs://...`

Zapier出力を確認し、`gs://` で始まっているか確認

---

### デバッグTips

1. **Zapier History**: 各実行の詳細ログを確認
2. **GAS Logger**: `Logger.log()` でログ出力し、Apps Script の「実行数」で確認
3. **Cloud Run Logs**: `gcloud run services logs read` で確認
4. **GCS バケット確認**: ファイルが実際にアップロードされているか確認
   ```bash
   gcloud storage ls gs://technobrain-mendan-audio/audio/
   ```

---

## 📚 関連ドキュメント

- [AUDIO-WEBHOOK-GUIDE.md](./AUDIO-WEBHOOK-GUIDE.md) - 全体セットアップガイド
- [AUDIO-WEBHOOK-STATUS.md](./AUDIO-WEBHOOK-STATUS.md) - 実装状況
- [AUDIO-UPLOAD-METHODS.md](./AUDIO-UPLOAD-METHODS.md) - 音声アップロード方法詳細
- [apps_script/README.md](./apps_script/README.md) - GAS設定

---

## 🎯 次のステップ

Zapierワークフローが設定できたら:

1. ✅ [E2E-TEST-GUIDE.md](./E2E-TEST-GUIDE.md) でエンドツーエンドテスト
2. ✅ [SECURITY-GUIDE.md](./SECURITY-GUIDE.md) でセキュリティ強化
3. ✅ [OPERATIONS-MANUAL.md](./OPERATIONS-MANUAL.md) で運用設定

---

**設定完了後、必ずテストを実行してください！**
