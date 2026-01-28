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

## Cursor AI開発環境

このプロジェクトは、Cursor AIエディタ用のルールとコンテキストが設定されています。

### プロジェクトルール
`.cursor/rules/` ディレクトリに以下のルールが設定されています：

- **gcp-operations.mdc**: GCP運用のベストプラクティス（常に適用）
- **cursor-workflow.mdc**: Cursorでの効率的な開発ワークフロー（常に適用）
- **github-actions.mdc**: CI/CDのベストプラクティス（GitHub Actionsファイルに適用）
- **nodejs-standards.mdc**: Node.js開発標準（JS/TSファイルに適用）
- **documentation.mdc**: ドキュメント作成標準（Markdownファイルに適用）

詳細は `.cursor/rules/README.md` を参照してください。

### AI開発の使い方

#### @ でファイルを参照
```
@gcp-setup.md を参照してGCP認証の手順を教えてください
```

#### @ でドキュメントを参照
Cursorに組み込まれた公式ドキュメントを参照可能：
- `@Docs` で最新のGCP、Node.js、GitHub Actionsのドキュメントを検索

#### プロジェクト指示
`AGENTS.md` に基本的なプロジェクト指示が記載されています。

## ライセンス
MIT
