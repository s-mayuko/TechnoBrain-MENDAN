# プロジェクト指示

## プロジェクト基本情報
- **プロジェクト名**: TechnoBrain-MENDAN
- **GCPプロジェクトID**: technobrain-mendan
- **リージョン**: asia-northeast1
- **ランタイム**: Node.js 18

## 開発方針
- すべての回答は日本語で簡潔に
- 既存ファイルの編集を優先、新規作成は最小限に
- GCP関連の作業では常にプロジェクトIDとリージョンを確認
- 機密情報（サービスアカウントキー等）は絶対にコミットしない

## よく使うコマンド
```bash
# GCP認証確認
gcloud config get-value project

# App Engineデプロイ
gcloud app deploy

# ログ確認
gcloud app logs tail -s default
```

## 重要なファイル
- @gcp-setup.md - GCP環境設定の詳細手順
- @GITHUB-SECRETS-SETUP.md - CI/CD用のSecret設定
- @app.yaml - App Engine設定
- @.github/workflows/gcp-deploy.yml - デプロイワークフロー

## 参照用ドキュメント
開発時は以下のドキュメントを参照：
- GCP: https://cloud.google.com/docs
- Node.js v18: https://nodejs.org/docs/latest-v18.x/api/
- GitHub Actions: https://docs.github.com/ja/actions
- Cursor Rules: https://cursor.com/ja/docs/context/rules
