# GCP接続設定ガイド

## 前提条件
- Google Cloud SDKがインストールされていること
- GCPプロジェクト `technobrain-mendan` が作成されていること

## 初期設定

### 1. GCP認証
```bash
# GCPにログイン
gcloud auth login

# アプリケーションのデフォルト認証情報を設定
gcloud auth application-default login
```

### 2. プロジェクトの設定
```bash
# プロジェクトを設定
gcloud config set project technobrain-mendan

# 現在の設定を確認
gcloud config list
```

### 3. 必要なAPIの有効化
```bash
# Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# Cloud Run API (必要な場合)
gcloud services enable run.googleapis.com

# Cloud Storage API
gcloud services enable storage-api.googleapis.com

# Cloud Functions API (必要な場合)
gcloud services enable cloudfunctions.googleapis.com

# Artifact Registry API
gcloud services enable artifactregistry.googleapis.com
```

### 4. サービスアカウントの作成（オプション）
```bash
# サービスアカウントを作成
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Service Account"

# サービスアカウントにロールを付与
gcloud projects add-iam-policy-binding technobrain-mendan \
    --member="serviceAccount:github-actions@technobrain-mendan.iam.gserviceaccount.com" \
    --role="roles/editor"

# キーファイルを作成（注意: このファイルは .gitignore に含まれています）
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=github-actions@technobrain-mendan.iam.gserviceaccount.com
```

## GitHub Actions との連携

### GitHub Secretsに追加する情報
1. `GCP_PROJECT_ID`: technobrain-mendan
2. `GCP_SA_KEY`: service-account-key.json の内容（Base64エンコード）

```bash
# サービスアカウントキーをBase64エンコード
cat service-account-key.json | base64
```

## よく使うコマンド

```bash
# プロジェクト情報の確認
gcloud projects describe technobrain-mendan

# 有効なAPIの一覧
gcloud services list --enabled

# リージョンとゾーンの設定
gcloud config set compute/region asia-northeast1
gcloud config set compute/zone asia-northeast1-a
```

## トラブルシューティング

### 認証エラーが発生する場合
```bash
# 認証情報をクリア
gcloud auth revoke

# 再度ログイン
gcloud auth login
gcloud auth application-default login
```

### プロジェクトが見つからない場合
```bash
# アクセス可能なプロジェクト一覧を確認
gcloud projects list
```
