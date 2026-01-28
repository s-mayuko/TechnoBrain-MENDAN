# Cursorルール設定ガイド

このディレクトリには、TechnoBrain-MENDANプロジェクト用のCursorルールが含まれています。

## 作成されたルール

### 1. gcp-operations.mdc（常に適用）
**用途**: GCP運用のベストプラクティスと標準コマンド

**含まれる内容**:
- プロジェクト情報（ID、リージョン、ゾーン）
- 認証手順
- 有効化済みAPI一覧
- コスト管理のガイドライン
- セキュリティベストプラクティス
- デプロイ前チェックリスト
- よく使うコマンド集
- トラブルシューティング

### 2. cursor-workflow.mdc（常に適用）
**用途**: Cursorでの効率的な開発ワークフロー

**含まれる内容**:
- コード編集の原則
- コミュニケーションスタイル（日本語、簡潔）
- ファイル参照方法（@記法）
- コード引用の正しい形式
- 問題解決のアプローチ
- Git操作のガイドライン

### 3. github-actions.mdc（特定ファイルに適用）
**適用対象**: `.github/workflows/**/*.yml`, `.github/workflows/**/*.yaml`

**含まれる内容**:
- ワークフロー設計原則
- 必須のGitHub Secrets
- GCP認証パターン
- デプロイステップの標準パターン
- セキュリティチェックリスト

### 4. nodejs-standards.mdc（特定ファイルに適用）
**適用対象**: `**/*.js`, `**/*.ts`, `**/package.json`, `**/tsconfig.json`

**含まれる内容**:
- Node.js 18の設定
- コーディング規約
- 非同期処理のベストプラクティス
- 環境変数管理
- エラーハンドリング
- GCP統合時の注意点

### 5. documentation.mdc（特定ファイルに適用）
**適用対象**: `**/*.md`, `**/README.md`

**含まれる内容**:
- Markdown記法の標準
- README.mdの必須セクション
- ドキュメント更新タイミング
- @Docs参照用リンク集（GCP、GitHub、Node.js、Cursor）

## ルールの適用タイプ

### Always Apply（常に適用）
- `gcp-operations.mdc`
- `cursor-workflow.mdc`

これらのルールはすべてのチャットセッションで自動的に適用されます。

### Apply to Specific Files（特定ファイルに適用）
- `github-actions.mdc` → GitHub Actionsファイル
- `nodejs-standards.mdc` → JavaScript/TypeScript/package.json
- `documentation.mdc` → Markdownファイル

これらのルールは、指定したファイルパターンに一致するファイルを編集する際に自動的に適用されます。

## ルールの確認方法

### Cursor Settings から確認
1. `Cursor Settings`（Ctrl+Shift+J または Cmd+,）を開く
2. `Rules, Commands`セクションに移動
3. `Project Rules`に作成したルールが表示される

### ルールの編集
各`.mdc`ファイルを直接編集することでルールを更新できます。

### ルールの一時的な無効化
Cursor Settingsから、個別のルールを一時的にオフにすることができます。

## チャットでの使用方法

### @ でファイルを参照
```
@gcp-setup.md を参照してGCP認証の手順を教えてください
```

### @ でルールを手動適用
ルールを手動で適用したい場合：
```
@gcp-operations GCPにデプロイする手順を教えてください
```

### 複数のファイル/ルールを同時参照
```
@gcp-setup.md @app.yaml を参照して、App Engineの設定を確認してください
```

## AGENTS.md との関係

プロジェクトルートの `AGENTS.md` は、より簡潔な指示を提供します。

- **AGENTS.md**: シンプルで一般的な指示
- **.cursor/rules/*.mdc**: 詳細で構造化されたルール

両方が併用され、状況に応じて適切な指示が適用されます。

## ベストプラクティス

1. **ルールは簡潔に**: 500行以内に収める
2. **具体例を含める**: コマンドやコード例を示す
3. **参照を活用**: ファイル内容をコピーせず、@で参照
4. **定期的に更新**: プロジェクトの変更に合わせてルールも更新
5. **Gitで管理**: チーム全体で共有

## トラブルシューティング

### ルールが適用されない場合
1. Cursor Settingsでルールが有効になっているか確認
2. ファイルパターン（globs）が正しいか確認
3. Cursorを再起動してみる

### ルールが多すぎる場合
- 不要なルールを削除または無効化
- ルールの内容を統合して簡潔にする

## 更新履歴
- 2026-01-28: 初期ルールセット作成
  - GCP運用ルール
  - Cursorワークフロールール
  - GitHub Actionsルール
  - Node.js標準ルール
  - ドキュメント標準ルール
