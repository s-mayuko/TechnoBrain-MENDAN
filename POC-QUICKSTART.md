# PoC クイックスタート（5分で動かす）

## 概要

このガイドでは、TechnoBrain-MENDANシステムの基本動作を確認するための最短手順を説明します。

## 前提条件

- GCPプロジェクト `technobrain-mendan` へのアクセス権
- Google Cloud SDK インストール済み
- Googleアカウント（スプレッドシート作成用）

---

## Step 1: スプレッドシート作成（2分）

### 1-1. 新規スプレッドシート作成

1. [Google Sheets](https://sheets.google.com) を開く
2. 「空白」で新規スプレッドシート作成
3. シート名を `merge_ui` に変更（下部のタブを右クリック→「名前を変更」）

### 1-2. ヘッダー設定（1行目）

以下をA1〜M1にコピー:

```
項目名	Porters採用	Porters値	音声採用	音声抽出値	手入力採用	手入力値	採用ソース	採用値	confidence	evidence	送信日時	送信結果
```

### 1-3. 一括採用チェックボックス（2行目）

- C2, E2, G2 を選択 → 挿入 → チェックボックス

### 1-4. サンプルデータ（3行目以降）

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| 氏名 | □ | 山田太郎 | □ | | □ | |
| 生年月日 | □ | 1990/01/01 | □ | | □ | |
| 電話番号 | □ | 090-1234-5678 | □ | | □ | |
| 希望年収 | □ | | □ | | □ | 500万円 |

**チェックボックスの挿入方法:**
- B3:B6, D3:D6, F3:F6 を選択 → 挿入 → チェックボックス

---

## Step 2: GAS設定（2分）

### 2-1. Apps Scriptを開く

1. スプレッドシートで「拡張機能」→「Apps Script」
2. `Code.gs` の内容を全て削除
3. `apps_script/Code.gs` の内容をコピー＆ペースト
4. 保存（Ctrl+S）

### 2-2. Script Properties設定

1. 左メニュー「プロジェクトの設定」（歯車アイコン）
2. 下部「スクリプト プロパティ」→「スクリプト プロパティを追加」
3. 以下を追加:

| プロパティ | 値 |
|------------|-----|
| CLOUD_RUN_BASE_URL | （後で設定、まずは空でOK） |
| INTERNAL_API_KEY | test-key-123 |

### 2-3. 動作確認（排他制御）

1. スプレッドシートに戻る
2. ページをリロード
3. B3（氏名のPorters採用）をON → 自動でD3, F3がOFFになることを確認
4. D3をON → B3がOFFになることを確認

---

## Step 3: 手入力で送信テスト（1分）

### 3-1. 手入力データ設定

1. G4（希望年収の手入力）に「500万円」と入力
2. F4（希望年収の手入力採用）をON

### 3-2. マージテスト（Cloud Run未接続時）

1. メニュー「データ統合」→「マージしてWebhook送信」
2. 初回は認証ダイアログが表示される → 許可
3. Cloud Run未設定の場合はエラー → **これはOK（接続確認）**

### 3-3. ローカルテスト（Cloud Run接続前）

Cloud Run未接続でも、以下を確認できればPoC成立:
- [x] 排他制御が動作する
- [x] メニューが表示される
- [x] 空欄警告が表示される（チェックONで値が空の場合）

---

## Step 4: Cloud Run デプロイ（追加手順）

Cloud Runを使う場合の手順です。

### 4-1. Secret Manager設定

```bash
# Anthropic APIキー（テスト用にダミー可）
echo -n "sk-ant-test-key" | gcloud secrets create anthropic-api-key --data-file=-

# Webhook URL（テスト用: webhook.siteなどを使用）
echo -n "https://webhook.site/your-unique-id" | gcloud secrets create webhook-url --data-file=-
```

### 4-2. Cloud Runデプロイ

```bash
cd cloud_run
gcloud run deploy mendan-api \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GCP_PROJECT=technobrain-mendan,INTERNAL_API_KEY=test-key-123"
```

### 4-3. GAS設定更新

デプロイ後に表示されるURLを `CLOUD_RUN_BASE_URL` に設定:
```
https://mendan-api-xxxxx-an.a.run.app
```

---

## テストシナリオ

### シナリオ1: 手入力のみで送信

1. G列に手入力値を入力
2. F列をON
3. 「データ統合」→「マージしてWebhook送信」
4. **期待結果**: Webhookにデータが送信される

### シナリオ2: 音声抽出を採用して送信

1. E列に値が入っている状態（音声処理後）
2. D列をON
3. 「データ統合」→「マージしてWebhook送信」
4. **期待結果**: E列の値がWebhookに送信される

### シナリオ3: 一括採用

1. C2（Porters一括）をON
2. **期待結果**: C列に値がある行のB列が全てON、D/F列は全てOFF

---

## トラブルシューティング

### Q: メニューが表示されない

A: ページをリロードするか、Apps Scriptで `onOpen` を手動実行

### Q: 「権限が必要です」エラー

A: Apps Scriptで「実行」→「onOpen」を1回実行し、認証を許可

### Q: Cloud Run接続エラー

A: 以下を確認:
1. `CLOUD_RUN_BASE_URL` が正しいか
2. Cloud Runがデプロイされているか
3. `INTERNAL_API_KEY` が一致しているか

---

## 次のステップ

PoC確認後:

1. **Webhook先の設定**: 実際の送信先URLをSecret Managerに登録
2. **音声処理テスト**: /process_audio エンドポイントの動作確認
3. **Porters連携**: API仕様確定後に実装

詳細は以下を参照:
- `apps_script/README.md` - GAS詳細設定
- `cloud_run/README.md` - Cloud Run詳細設定
