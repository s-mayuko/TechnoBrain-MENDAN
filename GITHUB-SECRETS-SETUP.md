# GitHub Secrets 設定手順

サービスアカウントキーが作成されました。次にGitHubリポジトリにSecretsを設定します。

## 必要な情報

✅ サービスアカウントキーファイル: `service-account-key.json`
✅ GCPプロジェクトID: `technobrain-mendan`

---

## 方法1: GitHub WebUIで設定（推奨）

### 手順

1. **GitHubリポジトリにアクセス**
   - https://github.com/s-mayuko/TechnoBrain-MENDAN にアクセス

2. **Settings タブを開く**
   - リポジトリページの上部にある `Settings` タブをクリック

3. **Secrets and variables を開く**
   - 左サイドバーの `Security` セクションから
   - `Secrets and variables` → `Actions` を選択

4. **New repository secret をクリック**

5. **GCP_SA_KEY を追加**
   - Name: `GCP_SA_KEY`
   - Secret: 
     ```powershell
     # PowerShellでファイルの内容をコピー
     Get-Content service-account-key.json | Set-Clipboard
     ```
     上記コマンドを実行してクリップボードにコピーし、Secretフィールドに貼り付け
   - `Add secret` をクリック

6. **GCP_PROJECT_ID を追加**（オプション、ワークフローで既に設定済み）
   - Name: `GCP_PROJECT_ID`
   - Secret: `technobrain-mendan`
   - `Add secret` をクリック

---

## 方法2: GitHub CLIで設定（コマンドライン）

GitHub CLIがインストールされている場合は、以下のコマンドで設定できます：

```powershell
# GCP_SA_KEYを設定
Get-Content service-account-key.json | gh secret set GCP_SA_KEY

# GCP_PROJECT_IDを設定（オプション）
echo "technobrain-mendan" | gh secret set GCP_PROJECT_ID
```

---

## 設定の確認

### GitHub WebUIで確認
1. Settings → Secrets and variables → Actions
2. 以下のSecretsが表示されていることを確認：
   - ✅ `GCP_SA_KEY`
   - ✅ `GCP_PROJECT_ID`（設定した場合）

### GitHub CLIで確認
```bash
gh secret list
```

---

## セキュリティに関する注意事項

⚠️ **重要**: `service-account-key.json` ファイルには機密情報が含まれています

- ✅ このファイルは `.gitignore` に含まれているため、Gitにコミットされません
- ⚠️ このファイルを絶対に公開したり共有したりしないでください
- 💡 設定完了後は、ローカルのファイルを安全に保管するか削除することを推奨します

```powershell
# 設定完了後、ローカルファイルを削除する場合
Remove-Item service-account-key.json
```

---

## GitHub Actionsの動作確認

Secrets設定後、以下の方法でワークフローをテストできます：

### 方法1: コードをプッシュ
```bash
git add .
git commit -m "Test commit"
git push origin master
```

### 方法2: 手動でワークフローを実行
1. GitHubリポジトリの `Actions` タブを開く
2. `Deploy to GCP` ワークフローを選択
3. `Run workflow` ボタンをクリック
4. `Run workflow` を確認

---

## トラブルシューティング

### エラー: "Secrets not found"
- Secretsが正しく設定されているか確認
- Secret名が正確に `GCP_SA_KEY` になっているか確認（大文字小文字を区別）

### エラー: "Authentication failed"
- service-account-key.jsonの内容が完全にコピーされているか確認
- JSONファイルが破損していないか確認

### ワークフローが実行されない
- `.github/workflows/gcp-deploy.yml` ファイルが正しくプッシュされているか確認
- ワークフローのトリガー設定（on: push: branches）を確認
