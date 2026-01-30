# セキュリティ設定ガイド

最終更新: 2026-01-28

## 📋 目次

1. [セキュリティ概要](#セキュリティ概要)
2. [GAS Webアプリのセキュリティ](#gas-webアプリのセキュリティ)
3. [Cloud Runのセキュリティ](#cloud-runのセキュリティ)
4. [GCSのセキュリティ](#gcsのセキュリティ)
5. [API認証強化](#api認証強化)
6. [ログとモニタリング](#ログとモニタリング)
7. [インシデント対応](#インシデント対応)
8. [セキュリティチェックリスト](#セキュリティチェックリスト)

---

## 🔒 セキュリティ概要

### 現状のセキュリティレベル

| コンポーネント | 現状 | リスク | 推奨レベル |
|-------------|------|-------|----------|
| **GAS Webアプリ** | 🟡 公開（全員） | 中 | 🟢 認証付き |
| **Cloud Run** | 🟢 Internal API Key | 低 | 🟢 維持 |
| **GCS** | 🟢 IAM制御 | 低 | 🟢 維持 |
| **Secret Manager** | 🟢 暗号化 | 低 | 🟢 維持 |
| **ログマスキング** | 🟢 実装済み | 低 | 🟢 維持 |

### セキュリティ脅威モデル

```
┌─────────────┐
│ 攻撃者      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ GAS Webhook │ ← 【脅威1】不正なリクエスト
│(公開URL)    │ ← 【脅威2】DDoS攻撃
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Cloud Run  │ ← 【脅威3】不正なAPIキー
│             │ ← 【脅威4】大量リクエスト
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     GCS     │ ← 【脅威5】不正アクセス
│   (音声)    │ ← 【脅威6】データ漏洩
└─────────────┘
```

---

## 🛡️ GAS Webアプリのセキュリティ

### 現状の問題点

```javascript
// 現状: 誰でもアクセス可能
function doPost(e) {
  // ❌ 認証なし
  const data = JSON.parse(e.postData.contents);
  // ...
}
```

**リスク:**
- 誰でもWebhookエンドポイントを呼び出せる
- 不正なデータを送信される可能性
- DoS攻撃のリスク

---

### 対策1: カスタムトークン認証

#### Step 1: Script Propertiesにトークン設定

Apps Script →「プロジェクトの設定」→「スクリプトプロパティ」

| プロパティ名 | 値 |
|------------|---|
| `WEBHOOK_SECRET_TOKEN` | `ランダムな文字列（32文字以上推奨）` |

**トークン生成:**
```bash
# ランダムなトークン生成
openssl rand -hex 32

# 出力例: a1b2c3d4e5f6...（64文字）
```

#### Step 2: Code.gs に認証ロジック追加

```javascript
function doPost(e) {
  try {
    // 認証チェック
    if (!verifyWebhookToken(e)) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', message: 'Unauthorized' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 既存の処理
    const data = JSON.parse(e.postData.contents);
    
    if (data.gcs_uri) {
      processAudioFromWebhook(data);
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Webhook認証
 */
function verifyWebhookToken(e) {
  const props = PropertiesService.getScriptProperties();
  const secretToken = props.getProperty('WEBHOOK_SECRET_TOKEN');
  
  if (!secretToken) {
    Logger.log('⚠️ WEBHOOK_SECRET_TOKEN not configured');
    return true; // トークン未設定の場合はスキップ（開発用）
  }
  
  // ヘッダーからトークン取得
  const headers = e.parameter;
  const providedToken = headers['X-Webhook-Token'] || e.parameter.token;
  
  // または、JSONボディから取得
  let bodyToken = null;
  try {
    const data = JSON.parse(e.postData.contents);
    bodyToken = data.webhook_token;
  } catch (err) {
    // JSONパース失敗
  }
  
  const token = providedToken || bodyToken;
  
  if (!token) {
    Logger.log('❌ No token provided');
    return false;
  }
  
  if (token !== secretToken) {
    Logger.log('❌ Invalid token');
    return false;
  }
  
  Logger.log('✅ Token verified');
  return true;
}
```

#### Step 3: Zapierでトークンを送信

**Webhooks by Zapier設定:**

**Headers:**
```
X-Webhook-Token: {{YOUR_SECRET_TOKEN}}
```

または **Data** に含める:
```json
{
  "gcs_uri": "...",
  "webhook_token": "{{YOUR_SECRET_TOKEN}}",
  "record_id": "..."
}
```

---

### 対策2: IPアドレス制限

```javascript
/**
 * IPアドレス制限
 */
function verifyIpAddress(e) {
  // ⚠️ GASではクライアントIPを直接取得できない
  // Zapierからのリクエストのみ許可する場合は、
  // User-Agentで判定（完全ではない）
  
  const userAgent = e.parameter.userAgent || '';
  
  // Zapierの場合
  if (userAgent.includes('Zapier')) {
    return true;
  }
  
  Logger.log('⚠️ Non-Zapier request: ' + userAgent);
  return false; // 厳格にする場合
}
```

**制限事項:**
- GASはクライアントIPを直接取得できない
- User-Agentは偽装可能
- ⚠️ 完全な制限は困難

---

### 対策3: レート制限

```javascript
/**
 * レート制限（同じrecord_idの重複送信防止）
 */
function checkRateLimit(recordId) {
  const cache = CacheService.getScriptCache();
  const key = 'rate_limit_' + recordId;
  
  // 既に処理中か確認
  const existing = cache.get(key);
  if (existing) {
    Logger.log('❌ Rate limit: ' + recordId + ' already processing');
    return false;
  }
  
  // 10分間ロック
  cache.put(key, 'processing', 600);
  return true;
}

function doPost(e) {
  try {
    if (!verifyWebhookToken(e)) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', message: 'Unauthorized' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = JSON.parse(e.postData.contents);
    
    // レート制限チェック
    if (!checkRateLimit(data.record_id)) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', message: 'Rate limit exceeded' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (data.gcs_uri) {
      processAudioFromWebhook(data);
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

## 🔐 Cloud Runのセキュリティ

### 現状の実装

```python
# main.py
def verify_api_key(
    x_internal_api_key: Optional[str] = Header(None),
    settings: Settings = Depends(get_settings)
) -> bool:
    if not settings.INTERNAL_API_KEY:
        logger.warning("INTERNAL_API_KEY is not set")
        return True
    
    if x_internal_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return True
```

**評価:** 🟢 Good（現状のままでOK）

---

### 推奨設定

#### 1. HTTPS強制

```bash
# Cloud RunはデフォルトでHTTPSのみ
# 確認
gcloud run services describe mendan-api \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].ports[0].protocol)"

# 出力: HTTP2 または h2c（HTTP/2）
```

#### 2. INTERNAL_API_KEYローテーション

```bash
# 新しいキー生成
NEW_API_KEY=$(openssl rand -hex 32)

# Cloud Run更新
gcloud run services update mendan-api \
  --region=asia-northeast1 \
  --set-env-vars="INTERNAL_API_KEY=${NEW_API_KEY}"

# GAS Script Properties更新
# Apps Script →「プロジェクトの設定」で INTERNAL_API_KEY を新しい値に更新
```

**推奨頻度:** 90日ごと

#### 3. IAM権限の最小化

```bash
# 現在のIAMポリシー確認
gcloud run services get-iam-policy mendan-api \
  --region=asia-northeast1

# 不要な権限を削除
# 例: allUsersを削除（内部アクセスのみにする場合）
gcloud run services remove-iam-policy-binding mendan-api \
  --region=asia-northeast1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

---

## 🗄️ GCSのセキュリティ

### 推奨設定

#### 1. バケットの公開アクセス禁止

```bash
# Uniform bucket-level accessを有効化（推奨）
gcloud storage buckets update gs://technobrain-mendan-audio \
  --uniform-bucket-level-access

# 公開アクセス防止
gcloud storage buckets update gs://technobrain-mendan-audio \
  --no-public-access-prevention
```

#### 2. オブジェクトのライフサイクル設定

```json
// lifecycle.json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 90,
          "matchesPrefix": ["audio/"]
        }
      },
      {
        "action": {
          "type": "SetStorageClass",
          "storageClass": "ARCHIVE"
        },
        "condition": {
          "age": 30,
          "matchesPrefix": ["audio/"]
        }
      }
    ]
  }
}
```

```bash
# 適用
gcloud storage buckets update gs://technobrain-mendan-audio \
  --lifecycle-file=lifecycle.json
```

**効果:**
- 30日後: Archiveストレージクラスに移動（コスト削減）
- 90日後: 自動削除（GDPR対応）

#### 3. バージョニング有効化

```bash
# バージョニング有効化（誤削除対策）
gcloud storage buckets update gs://technobrain-mendan-audio \
  --versioning
```

#### 4. 監査ログ有効化

```bash
# Data Accessログを有効化
gcloud projects add-iam-policy-binding technobrain-mendan \
  --member="serviceAccount:mendan-api@technobrain-mendan.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

# Cloud Consoleで設定
# IAM & Admin → Audit Logs → Cloud Storage → Data Read/Write を有効化
```

---

## 🔑 API認証強化

### Secret Managerのセキュリティ

#### 1. シークレットのバージョン管理

```bash
# 現在のバージョン確認
gcloud secrets versions list anthropic-api-key

# 新しいバージョン追加
echo -n "NEW_API_KEY_VALUE" | gcloud secrets versions add anthropic-api-key --data-file=-

# 古いバージョンを無効化
gcloud secrets versions disable 1 --secret=anthropic-api-key
```

#### 2. シークレットへのアクセス監査

```bash
# Secret Managerのアクセスログを確認
gcloud logging read \
  'resource.type="secretmanager.googleapis.com/Secret"
   AND protoPayload.methodName="google.cloud.secretmanager.v1.SecretManagerService.AccessSecretVersion"' \
  --limit=50 \
  --format=json
```

---

## 📊 ログとモニタリング

### ログレベル設定

```python
# settings.py
import os

LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')

# main.py
import logging

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

```bash
# Cloud Run環境変数設定
gcloud run services update mendan-api \
  --region=asia-northeast1 \
  --set-env-vars="LOG_LEVEL=WARNING"
```

---

### セキュリティアラート設定

#### 1. Cloud Monitoringアラート作成

```bash
# アラートポリシー作成（例: 5xx エラー率）
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud Run 5xx Error Rate" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=60s \
  --condition-display-name="5xx error rate > 5%" \
  --condition-filter='resource.type="cloud_run_revision"
    AND metric.type="run.googleapis.com/request_count"
    AND metric.labels.response_code_class="5xx"'
```

#### 2. Slack通知設定

```python
# webhook_sender.py に追加
async def send_security_alert(message: str):
    """
    セキュリティアラートをSlackに送信
    """
    slack_url = get_secret("security-alert-slack-webhook")
    
    payload = {
        "text": f"🔒 [SECURITY ALERT] {message}",
        "username": "Security Bot"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(slack_url, json=payload, timeout=10)
        response.raise_for_status()
```

---

### 監査ログの検索

```bash
# 不正なAPIキーでのアクセスを検索
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND textPayload:"Invalid API key"' \
  --limit=100 \
  --format=json

# GCSへの不正アクセスを検索
gcloud logging read \
  'resource.type="gcs_bucket"
   AND protoPayload.status.code!=0' \
  --limit=100
```

---

## 🚨 インシデント対応

### インシデント対応フロー

```
┌──────────────┐
│ アラート検知  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 影響範囲確認  │ ← ログ、メトリクス確認
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 緊急対応      │ ← APIキー無効化、アクセス遮断
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 根本原因調査  │ ← ログ分析、ポストモーテム
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 恒久対策実施  │ ← コード修正、設定変更
└──────────────┘
```

---

### 緊急対応コマンド

#### 1. Cloud Runを一時停止

```bash
# トラフィックを0%に（サービス停止）
gcloud run services update-traffic mendan-api \
  --region=asia-northeast1 \
  --to-revisions=LATEST=0
```

#### 2. APIキー無効化

```bash
# INTERNAL_API_KEYを一時的に変更
gcloud run services update mendan-api \
  --region=asia-northeast1 \
  --set-env-vars="INTERNAL_API_KEY=DISABLED"
```

#### 3. GCSアクセス遮断

```bash
# サービスアカウントの権限を一時削除
gcloud storage buckets remove-iam-policy-binding gs://technobrain-mendan-audio \
  --member="serviceAccount:mendan-api@technobrain-mendan.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

---

### ポストモーテムテンプレート

```markdown
# インシデントレポート

**日時:** 2026-01-28 15:30 - 16:00  
**影響:** Cloud Run 503エラー  
**重大度:** P2（中）

## タイムライン

- 15:30: アラート検知
- 15:35: 影響範囲確認
- 15:40: Cloud Run再起動
- 16:00: 復旧完了

## 根本原因

Speech-to-Text APIのレート制限超過

## 恒久対策

1. レート制限監視アラート追加
2. 指数バックオフリトライ実装
3. キャッシング導入検討

## 学んだこと

- レート制限監視の重要性
- リトライロジックの必要性
```

---

## ✅ セキュリティチェックリスト

### デプロイ前

- [ ] **GAS**: WEBHOOK_SECRET_TOKEN設定済み
- [ ] **GAS**: トークン認証ロジック実装済み
- [ ] **Cloud Run**: INTERNAL_API_KEY設定済み
- [ ] **Cloud Run**: IAM権限が最小化されている
- [ ] **GCS**: Uniform bucket-level access有効
- [ ] **GCS**: ライフサイクルポリシー設定済み
- [ ] **Secret Manager**: 全シークレット登録済み
- [ ] **ログマスキング**: 個人情報がマスクされることを確認
- [ ] **監査ログ**: 有効化されている
- [ ] **アラート**: 設定済み

### 本番運用中（月次）

- [ ] **APIキー**: ローテーション実施（90日ごと）
- [ ] **ログ**: 不正アクセスがないか確認
- [ ] **IAM**: 不要な権限がないか確認
- [ ] **GCS**: 不要なファイルを削除
- [ ] **Secret Manager**: 古いバージョンを無効化
- [ ] **監査**: アクセスログをレビュー
- [ ] **依存関係**: セキュリティパッチ適用

---

## 📚 関連ドキュメント

- [OPERATIONS-MANUAL.md](./OPERATIONS-MANUAL.md) - 運用マニュアル
- [E2E-TEST-GUIDE.md](./E2E-TEST-GUIDE.md) - セキュリティテスト
- [AUDIO-WEBHOOK-GUIDE.md](./AUDIO-WEBHOOK-GUIDE.md) - 全体設定

---

**セキュリティ設定完了後、[OPERATIONS-MANUAL.md](./OPERATIONS-MANUAL.md) で運用準備をしてください！**
