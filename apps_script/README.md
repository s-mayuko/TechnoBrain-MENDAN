# Google Apps Script - セットアップ手順

## 概要

スプレッドシート上で3ソース（Porters/音声AI/手入力）のデータをマージし、Webhook送信するためのGASコード。

## セットアップ

### 1. スプレッドシートの準備

1. 新しいGoogleスプレッドシートを作成
2. シート名を `merge_ui` に変更
3. 以下の構造でヘッダーを設定（1行目）:

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 項目名 | Porters採用 | Porters値 | 音声採用 | 音声抽出値 | 手入力採用 | 手入力値 | 採用ソース | 採用値 | confidence | evidence | 送信日時 | 送信結果 |

4. 2行目に一括採用チェックボックスを設定:
   - C2, E2, G2 にチェックボックスを挿入
   - B2, D2, F2 は空白のまま

5. 3行目以降にデータ行を追加:
   - B, D, F列にチェックボックスを挿入

### 2. GASの設定

1. スプレッドシートで「拡張機能」→「Apps Script」を開く
2. `Code.gs` の内容をコピー＆ペースト
3. 「プロジェクトの設定」でスクリプトプロパティを追加:

| プロパティ名 | 値 |
|---|---|
| `CLOUD_RUN_BASE_URL` | Cloud RunのURL（例: `https://mendan-api-xxxxx.run.app`） |
| `INTERNAL_API_KEY` | Cloud Runとの認証キー |
| `RECORD_ID` | （任意）レコードID |

### 3. Webアプリとしてデプロイ（Zapier連携用）

1. 「デプロイ」→「新しいデプロイ」
2. 種類: 「ウェブアプリ」
3. 次のユーザーとして実行: 「自分」
4. アクセスできるユーザー: 「全員」（Zapierからのアクセス用）
5. デプロイURLをZapierのWebhook URLに設定

## シート構造

### merge_ui シート

```
行1: ヘッダー
行2: 一括採用チェックボックス（C2/E2/G2）
行3〜: データ行
```

### 列の役割

- **A列**: 項目名（例: 生年月日、氏名など）
- **B列**: Porters採用チェック（チェックボックス）
- **C列**: Porters値
- **D列**: 音声採用チェック（チェックボックス）
- **E列**: 音声抽出値（Claude APIで抽出）
- **F列**: 手入力採用チェック（チェックボックス）
- **G列**: 手入力値
- **H列**: 採用ソース（自動）
- **I列**: 採用値（自動）
- **J列**: confidence（音声抽出時）
- **K列**: evidence（音声抽出時）
- **L列**: 送信日時
- **M列**: 送信結果

### config シート（任意）

フィールドマッピング用:

| A | B | C | D | E |
|---|---|---|---|---|
| label | key | type | required | validation |
| 生年月日 | birth_date | date | TRUE | |
| 氏名 | name | string | TRUE | |

## 機能

### メニュー「データ統合」

- **マージしてWebhook送信**: チェック状態に従ってマージし、Webhook送信
- **Porters取得 → C列反映**: Porters APIからデータ取得（要Cloud Run実装）
- **音声処理 → E列反映**: 音声ファイルを処理してE列に反映

### 排他制御

- **行レベル**: B/D/F列は同一行で1つだけON
- **一括採用**: C2/E2/G2で列全体を一括ON/OFF（他はOFF）

### Zapier Webhook

`doPost()` でZapierからのリクエストを受信:

```json
{
  "gcs_uri": "gs://bucket/audio.wav",
  "record_id": "12345",
  "metadata": {
    "ca_name": "田中太郎",
    "slack_mention_id": "U12345678"
  }
}
```

## トラブルシューティング

### onEditが動作しない

- シンプルトリガーは手動編集時のみ動作
- スクリプトからの変更では発火しない

### 権限エラー

- 「拡張機能」→「Apps Script」→「トリガー」でトリガーを確認
- 必要に応じて再認証

### Cloud Run接続エラー

- Script Propertiesの `CLOUD_RUN_BASE_URL` を確認
- Cloud Runが起動しているか確認
