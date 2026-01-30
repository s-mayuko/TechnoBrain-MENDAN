# TechnoBrain-MENDAN

## プロジェクト概要

スプレッドシート上で3ソース（Porters/音声AI/手入力）のデータをマージし、Webhook送信するシステム。

### 主要機能

**データマージ・送信:**
- ✅ **スプレッドシートUI**: 排他チェック、一括採用、空欄警告
- ✅ **マージ・送信**: チェック状態に応じてマージし、Webhook送信
- ✅ **バリデーション**: 必須項目、型チェック、正規表現対応
- ✅ **二重送信防止**: 送信済フラグ、idempotency key

**音声処理（Webhook受信）:**
- ✅ **音声処理パイプライン**: GCS音声 → Speech-to-Text → Claude抽出 → E列反映
- ✅ **Webhook受信**: Zapier等からGCS URIを受信して自動処理
- ✅ **メタデータ連携**: CA名、Slack IDなどを抽出時に活用

**セキュリティ・運用:**
- ✅ **監査ログ**: 詳細な送信履歴記録
- ✅ **エラー通知**: Slack連携
- ✅ **ログマスキング**: 個人情報保護

### DoD達成状況

- **PoC完了定義**: ✅ 全て達成
- **本番完了定義**: 🟢 主要項目達成（67%）

詳細は [DOD-STATUS.md](./DOD-STATUS.md) を参照。

## GCPプロジェクト
- プロジェクトID: technobrain-mendan

## リポジトリ情報
- **GitHub**: https://github.com/s-mayuko/TechnoBrain-MENDAN
- **GCPプロジェクトID**: technobrain-mendan
- **プロジェクト番号**: 251107091138

## クイックスタート

### PoC（5分で動かす）

**最速で動作確認したい場合:**
1. [POC-QUICKSTART.md](./POC-QUICKSTART.md) を参照
2. スプレッドシート作成 → GAS設定 → 動作確認

### デモ用スプレッドシート（NEW）

**お客様向けデモ用に100項目の詳細シートを作成:**

- 📋 [DEMO-SHEET-SETUP.md](./DEMO-SHEET-SETUP.md) - デモシート自動生成ガイド
- 📄 [apps_script/SetupDemoSheet.gs](./apps_script/SetupDemoSheet.gs) - 自動生成スクリプト

**機能:**
- ✅ 100項目自動入力（氏名、学歴、職歴、スキル等）
- ✅ 条件付き書式（チェック状態・採用ソースで色分け）
- ✅ 初期値設定（Portersにチェック）
- ✅ サンプルデータ追加機能

**所要時間:** 3分でデモ用シート完成

### 音声Webhook機能（NEW）

**音声データをWebhookで受信して自動処理する場合:**

#### 📚 完全ドキュメントセット

| ドキュメント | 内容 | 対象読者 |
|------------|------|---------|
| 📊 [AUDIO-WEBHOOK-STATUS.md](./AUDIO-WEBHOOK-STATUS.md) | 実装状況サマリー | **最初に読む** |
| 📖 [AUDIO-WEBHOOK-GUIDE.md](./AUDIO-WEBHOOK-GUIDE.md) | 全体セットアップガイド | 初回セットアップ |
| 🔄 [ZAPIER-WORKFLOW-GUIDE.md](./ZAPIER-WORKFLOW-GUIDE.md) | Zapier設定詳細（3つの方法） | Zapier設定時 |
| 📤 [AUDIO-UPLOAD-METHODS.md](./AUDIO-UPLOAD-METHODS.md) | 音声アップロード方法（5つの方法） | ファイル管理者 |
| 🧪 [E2E-TEST-GUIDE.md](./E2E-TEST-GUIDE.md) | エンドツーエンドテスト | テスト実施時 |
| 🔒 [SECURITY-GUIDE.md](./SECURITY-GUIDE.md) | セキュリティ設定 | セキュリティ担当 |
| 🛠️ [OPERATIONS-MANUAL.md](./OPERATIONS-MANUAL.md) | 運用マニュアル | 運用担当 |

**クイックステータス:**
- ✅ コア実装: 100%完了（GAS + Cloud Run）
- ⚠️ GCP設定: 60%（バケット作成・API有効化が必要）
- ❌ Zapier連携: 未設定

**推奨セットアップフロー:**
1. 📊 [STATUS](./AUDIO-WEBHOOK-STATUS.md) で現状確認
2. 📖 [GUIDE](./AUDIO-WEBHOOK-GUIDE.md) でGCS・GAS設定
3. 🔄 [ZAPIER](./ZAPIER-WORKFLOW-GUIDE.md) でワークフロー設定
4. 🧪 [TEST](./E2E-TEST-GUIDE.md) で動作確認
5. 🔒 [SECURITY](./SECURITY-GUIDE.md) でセキュリティ強化
6. 🛠️ [OPERATIONS](./OPERATIONS-MANUAL.md) で運用開始

**所要時間**: 約2-3時間で本番準備完了

### 本番セットアップ

**完全な本番環境を構築する場合:**

1. **GCP設定** - [gcp-setup.md](./gcp-setup.md) を参照
2. **Cloud Run デプロイ** - [cloud_run/README.md](./cloud_run/README.md) を参照
3. **GAS設定** - [apps_script/README.md](./apps_script/README.md) を参照
4. **configシート設定** - [CONFIG-SHEET-GUIDE.md](./CONFIG-SHEET-GUIDE.md) を参照

### 必要な環境
- Google Cloud SDK
- Python 3.11+ (Cloud Run用)
- Googleアカウント（スプレッドシート用）

### 有効化済み・必要なGCP API

**基本機能:**
- Cloud Resource Manager API
- Cloud Build API
- Cloud Run Admin API
- Cloud Storage API
- Artifact Registry API
- Secret Manager API

**音声Webhook機能（追加必要）:**
- Speech-to-Text API（`gcloud services enable speech.googleapis.com`）
- Sheets API（自動有効化）

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
