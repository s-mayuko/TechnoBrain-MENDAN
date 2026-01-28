# TechnoBrain-MENDAN

## プロジェクト概要
TechnoBrain-MENDANプロジェクト

## GCPプロジェクト
- プロジェクトID: technobrain-mendan

## リポジトリ情報
- **GitHub**: https://github.com/s-mayuko/TechnoBrain-MENDAN
- **GCPプロジェクトID**: technobrain-mendan
- **プロジェクト番号**: 251107091138

## セットアップ

### 必要な環境
- Node.js
- Google Cloud SDK
- Git

### 開始方法
```bash
# リポジトリのクローン
git clone https://github.com/s-mayuko/TechnoBrain-MENDAN.git
cd TechnoBrain-MENDAN

# GCP認証
gcloud auth login
gcloud config set project technobrain-mendan

# GCP接続確認（Linux/Mac）
bash check-gcp-connection.sh
```

### 有効化済みのGCP API
- Cloud Resource Manager API
- Cloud Build API
- Cloud Run Admin API
- Cloud Storage API
- Artifact Registry API

詳細なGCP設定については、`gcp-setup.md` を参照してください。

## ライセンス
MIT
