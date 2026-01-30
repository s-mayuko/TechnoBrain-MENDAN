# 音声ファイルアップロード方法ガイド

最終更新: 2026-01-28

## 📋 目次

1. [概要](#概要)
2. [方法1: gcloudコマンド](#方法1-gcloudコマンド)
3. [方法2: GCS Console（ブラウザ）](#方法2-gcs-consoleブラウザ)
4. [方法3: Python SDK](#方法3-python-sdk)
5. [方法4: Node.js SDK](#方法4-nodejs-sdk)
6. [方法5: gsutil](#方法5-gsutil)
7. [音声ファイル形式変換](#音声ファイル形式変換)
8. [ベストプラクティス](#ベストプラクティス)

---

## 📖 概要

音声ファイルをGCSにアップロードする5つの方法を詳しく解説します。

### 比較表

| 方法 | 難易度 | 用途 | 速度 | 一括処理 |
|-----|-------|------|------|---------|
| **gcloud** | 🟢 簡単 | CLI作業 | ⚡ 高速 | ✅ |
| **GCS Console** | 🟢 簡単 | 単発アップロード | 🐢 普通 | ❌ |
| **Python SDK** | 🟡 中級 | 自動化 | ⚡ 高速 | ✅ |
| **Node.js SDK** | 🟡 中級 | 自動化 | ⚡ 高速 | ✅ |
| **gsutil** | 🟢 簡単 | 大量ファイル | ⚡⚡ 最速 | ✅ |

---

## 🚀 方法1: gcloudコマンド

### 概要

Google Cloud SDKの `gcloud storage` コマンドでアップロードします。

**メリット:**
- ✅ シンプルで直感的
- ✅ ワイルドカード対応
- ✅ 再帰的アップロード対応
- ✅ 進捗表示

**インストール:**
```bash
# Google Cloud SDKがインストール済みか確認
gcloud version

# 未インストールの場合
# Windows: https://cloud.google.com/sdk/docs/install
# Mac: brew install google-cloud-sdk
# Linux: curl https://sdk.cloud.google.com | bash
```

---

### 基本的な使い方

#### 単一ファイルアップロード

```bash
# ローカルファイル → GCS
gcloud storage cp ./audio/sample.wav gs://technobrain-mendan-audio/audio/

# 完了後の出力例:
# Copying file://./audio/sample.wav to gs://technobrain-mendan-audio/audio/sample.wav
# Completed files 1/1 | 5.2MiB/5.2MiB
```

#### 複数ファイル一括アップロード

```bash
# ワイルドカード使用
gcloud storage cp ./audio/*.wav gs://technobrain-mendan-audio/audio/

# 特定の拡張子のみ
gcloud storage cp ./audio/*.{wav,mp3,flac} gs://technobrain-mendan-audio/audio/
```

#### ディレクトリごとアップロード（再帰的）

```bash
# -r オプションでディレクトリ全体
gcloud storage cp -r ./audio/ gs://technobrain-mendan-audio/audio/

# サブディレクトリ構造も維持される
# ./audio/2024/01/file.wav → gs://.../audio/2024/01/file.wav
```

---

### 高度なオプション

#### 並列アップロード（高速化）

```bash
# --parallel オプション（デフォルト: 4スレッド）
gcloud storage cp -r ./audio/ gs://technobrain-mendan-audio/audio/ \
  --parallel

# スレッド数を指定（最大16）
gcloud storage cp -r ./audio/ gs://technobrain-mendan-audio/audio/ \
  --parallel \
  --thread-count=8
```

#### 上書き防止

```bash
# 既存ファイルをスキップ（--no-clobber）
gcloud storage cp ./audio/*.wav gs://technobrain-mendan-audio/audio/ \
  --no-clobber

# 既存ファイルがあればスキップ、なければアップロード
```

#### メタデータ付きアップロード

```bash
# Content-Type指定
gcloud storage cp ./audio/sample.wav gs://technobrain-mendan-audio/audio/ \
  --content-type=audio/wav

# カスタムメタデータ
gcloud storage cp ./audio/sample.wav gs://technobrain-mendan-audio/audio/ \
  --custom-metadata=uploader=manual,date=2026-01-28
```

#### 圧縮転送

```bash
# gzipで圧縮してアップロード（転送量削減）
gcloud storage cp ./audio/sample.wav gs://technobrain-mendan-audio/audio/ \
  --gzip-in-flight=wav,mp3,flac
```

---

### トラブルシューティング

#### エラー: 「Permission denied」

```bash
# 認証確認
gcloud auth list

# 再認証
gcloud auth login

# プロジェクト確認
gcloud config get-value project

# プロジェクト設定
gcloud config set project technobrain-mendan
```

#### エラー: 「Bucket not found」

```bash
# バケット一覧確認
gcloud storage buckets list

# バケット作成
gcloud storage buckets create gs://technobrain-mendan-audio \
  --location=asia-northeast1
```

---

## 🌐 方法2: GCS Console（ブラウザ）

### 手順

1. **GCS Consoleを開く**
   - https://console.cloud.google.com/storage
   - プロジェクト: `technobrain-mendan` を選択

2. **バケットを選択**
   - `technobrain-mendan-audio` をクリック

3. **フォルダを開く**
   - `audio/` フォルダをクリック

4. **ファイルアップロード**
   - 「UPLOAD FILES」ボタンをクリック
   - ファイル選択ダイアログでファイルを選択
   - または、ドラッグ＆ドロップ

5. **アップロード完了確認**
   - リストにファイルが表示される
   - GCS URIをコピー: `gs://technobrain-mendan-audio/audio/filename.wav`

---

### メリット・デメリット

**メリット:**
- ✅ コマンドライン不要
- ✅ 視覚的にわかりやすい
- ✅ ファイルのプレビュー可能

**デメリット:**
- ❌ 大量ファイルには不向き
- ❌ 自動化不可
- ❌ スクリプトから実行不可

---

## 🐍 方法3: Python SDK

### セットアップ

```bash
# ライブラリインストール
pip install google-cloud-storage

# 認証（ローカル開発）
gcloud auth application-default login
```

---

### 基本的なアップロード

```python
from google.cloud import storage
import os

def upload_audio(local_path, bucket_name='technobrain-mendan-audio', gcs_folder='audio'):
    """
    音声ファイルをGCSにアップロード
    
    Args:
        local_path: ローカルファイルパス
        bucket_name: GCSバケット名
        gcs_folder: GCS内のフォルダ
    
    Returns:
        GCS URI
    """
    # クライアント作成
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    # ファイル名取得
    file_name = os.path.basename(local_path)
    gcs_path = f"{gcs_folder}/{file_name}"
    
    # Blob作成
    blob = bucket.blob(gcs_path)
    
    # アップロード
    blob.upload_from_filename(local_path)
    
    # GCS URI
    gcs_uri = f"gs://{bucket_name}/{gcs_path}"
    print(f"✅ Uploaded: {gcs_uri}")
    
    return gcs_uri


# 実行例
if __name__ == '__main__':
    upload_audio('./audio/sample.wav')
    # 出力: ✅ Uploaded: gs://technobrain-mendan-audio/audio/sample.wav
```

---

### 一括アップロード

```python
import os
from google.cloud import storage

def upload_directory(local_dir, bucket_name='technobrain-mendan-audio', gcs_folder='audio'):
    """
    ディレクトリ内のすべての音声ファイルをアップロード
    """
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    uploaded = []
    
    for root, dirs, files in os.walk(local_dir):
        for file in files:
            # 音声ファイルのみ
            if file.endswith(('.wav', '.mp3', '.flac', '.m4a')):
                local_path = os.path.join(root, file)
                
                # 相対パス維持
                rel_path = os.path.relpath(local_path, local_dir)
                gcs_path = f"{gcs_folder}/{rel_path}"
                
                # アップロード
                blob = bucket.blob(gcs_path)
                blob.upload_from_filename(local_path)
                
                gcs_uri = f"gs://{bucket_name}/{gcs_path}"
                print(f"✅ {gcs_uri}")
                uploaded.append(gcs_uri)
    
    print(f"\n📊 Total: {len(uploaded)} files uploaded")
    return uploaded


# 実行例
upload_directory('./audio')
```

---

### 進捗表示付きアップロード

```python
from google.cloud import storage
from tqdm import tqdm
import os

def upload_with_progress(local_path, bucket_name='technobrain-mendan-audio', gcs_folder='audio'):
    """
    進捗バー付きアップロード
    """
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    file_name = os.path.basename(local_path)
    gcs_path = f"{gcs_folder}/{file_name}"
    blob = bucket.blob(gcs_path)
    
    # ファイルサイズ取得
    file_size = os.path.getsize(local_path)
    
    # 進捗バー作成
    with tqdm(total=file_size, unit='B', unit_scale=True, desc=file_name) as pbar:
        def callback(bytes_transferred):
            pbar.update(bytes_transferred - pbar.n)
        
        # アップロード（コールバック付き）
        with open(local_path, 'rb') as f:
            blob.upload_from_file(f, rewind=True, callback=callback)
    
    gcs_uri = f"gs://{bucket_name}/{gcs_path}"
    print(f"✅ {gcs_uri}")
    return gcs_uri


# 実行例
upload_with_progress('./audio/large-file.wav')
# 出力: large-file.wav: 100%|██████████| 52.3M/52.3M [00:12<00:00, 4.20MB/s]
```

---

### メタデータ付きアップロード

```python
from google.cloud import storage
from datetime import datetime

def upload_with_metadata(local_path, bucket_name='technobrain-mendan-audio', gcs_folder='audio'):
    """
    メタデータ付きアップロード
    """
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    file_name = os.path.basename(local_path)
    gcs_path = f"{gcs_folder}/{file_name}"
    blob = bucket.blob(gcs_path)
    
    # メタデータ設定
    blob.metadata = {
        'uploaded_by': 'python-sdk',
        'uploaded_at': datetime.now().isoformat(),
        'original_path': local_path,
        'file_type': 'audio'
    }
    
    # Content-Type設定
    blob.content_type = 'audio/wav'
    
    # アップロード
    blob.upload_from_filename(local_path)
    
    print(f"✅ Uploaded with metadata: gs://{bucket_name}/{gcs_path}")
    print(f"   Metadata: {blob.metadata}")
    
    return f"gs://{bucket_name}/{gcs_path}"
```

---

## 🟢 方法4: Node.js SDK

### セットアップ

```bash
# ライブラリインストール
npm install @google-cloud/storage

# 認証（ローカル開発）
gcloud auth application-default login
```

---

### 基本的なアップロード

```javascript
// upload-audio.js
const { Storage } = require('@google-cloud/storage');
const path = require('path');

const storage = new Storage();
const bucketName = 'technobrain-mendan-audio';
const gcsFolder = 'audio';

async function uploadAudio(localPath) {
  const bucket = storage.bucket(bucketName);
  const fileName = path.basename(localPath);
  const gcsPath = `${gcsFolder}/${fileName}`;
  
  // アップロード
  await bucket.upload(localPath, {
    destination: gcsPath,
    metadata: {
      contentType: 'audio/wav'
    }
  });
  
  const gcsUri = `gs://${bucketName}/${gcsPath}`;
  console.log(`✅ Uploaded: ${gcsUri}`);
  
  return gcsUri;
}

// 実行例
uploadAudio('./audio/sample.wav')
  .then(uri => console.log('Done:', uri))
  .catch(err => console.error('Error:', err));
```

---

### 一括アップロード

```javascript
const { Storage } = require('@google-cloud/storage');
const fs = require('fs').promises;
const path = require('path');

const storage = new Storage();

async function uploadDirectory(localDir, bucketName = 'technobrain-mendan-audio', gcsFolder = 'audio') {
  const bucket = storage.bucket(bucketName);
  
  // ディレクトリ内のファイル一覧取得
  const files = await fs.readdir(localDir);
  
  // 音声ファイルのみフィルタ
  const audioFiles = files.filter(f => 
    f.endsWith('.wav') || f.endsWith('.mp3') || f.endsWith('.flac')
  );
  
  // 並列アップロード
  const uploadPromises = audioFiles.map(async (file) => {
    const localPath = path.join(localDir, file);
    const gcsPath = `${gcsFolder}/${file}`;
    
    await bucket.upload(localPath, {
      destination: gcsPath
    });
    
    const gcsUri = `gs://${bucketName}/${gcsPath}`;
    console.log(`✅ ${gcsUri}`);
    return gcsUri;
  });
  
  const results = await Promise.all(uploadPromises);
  console.log(`\n📊 Total: ${results.length} files uploaded`);
  
  return results;
}

// 実行
uploadDirectory('./audio')
  .catch(console.error);
```

---

### ストリームアップロード

```javascript
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

async function uploadWithStream(localPath, bucketName = 'technobrain-mendan-audio', gcsFolder = 'audio') {
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);
  
  const fileName = path.basename(localPath);
  const gcsPath = `${gcsFolder}/${fileName}`;
  const file = bucket.file(gcsPath);
  
  // 書き込みストリーム作成
  const writeStream = file.createWriteStream({
    metadata: {
      contentType: 'audio/wav'
    }
  });
  
  // 読み込みストリーム作成
  const readStream = fs.createReadStream(localPath);
  
  return new Promise((resolve, reject) => {
    readStream
      .pipe(writeStream)
      .on('error', reject)
      .on('finish', () => {
        const gcsUri = `gs://${bucketName}/${gcsPath}`;
        console.log(`✅ Uploaded: ${gcsUri}`);
        resolve(gcsUri);
      });
  });
}

// 実行
uploadWithStream('./audio/sample.wav')
  .catch(console.error);
```

---

## ⚡ 方法5: gsutil

### 概要

`gsutil` は大量ファイル転送に最適化されたコマンドラインツールです。

**特徴:**
- ⚡⚡ 最速（並列転送、マルチスレッド）
- ✅ 差分同期（rsync風）
- ✅ 再開可能

---

### セットアップ

```bash
# gsutilはGoogle Cloud SDKに含まれています
# 確認
gsutil version

# 設定
gsutil config
```

---

### 基本的な使い方

#### 単一ファイル

```bash
gsutil cp ./audio/sample.wav gs://technobrain-mendan-audio/audio/
```

#### 複数ファイル（並列転送）

```bash
# -m オプションで並列転送（高速）
gsutil -m cp ./audio/*.wav gs://technobrain-mendan-audio/audio/

# スレッド数指定
gsutil -o "GSUtil:parallel_thread_count=16" -m cp ./audio/*.wav gs://technobrain-mendan-audio/audio/
```

#### ディレクトリ同期（rsync風）

```bash
# rsyncコマンド（差分のみアップロード）
gsutil -m rsync -r ./audio/ gs://technobrain-mendan-audio/audio/

# 削除も同期（ローカルにないファイルをGCSから削除）
gsutil -m rsync -r -d ./audio/ gs://technobrain-mendan-audio/audio/
```

---

### 高度なオプション

#### 並列転送設定

```bash
# .boto設定ファイルを編集
gsutil config

# または環境変数で設定
export GSUtil:parallel_thread_count=16
export GSUtil:parallel_process_count=4
```

#### 再開可能なアップロード

```bash
# 大きなファイルは自動的にチャンク分割してアップロード
# 途中で中断しても再開可能
gsutil cp -L upload.log ./audio/large-file.wav gs://technobrain-mendan-audio/audio/

# 再開
gsutil cp -L upload.log ./audio/large-file.wav gs://technobrain-mendan-audio/audio/
```

#### 圧縮転送

```bash
# gzip圧縮してアップロード
gsutil cp -Z ./audio/sample.wav gs://technobrain-mendan-audio/audio/
```

---

## 🎵 音声ファイル形式変換

### ffmpegを使った変換

```bash
# ffmpegインストール確認
ffmpeg -version

# MP3 → WAV変換（16kHz, モノラル）
ffmpeg -i input.mp3 -ar 16000 -ac 1 output.wav

# M4A → WAV変換
ffmpeg -i input.m4a -ar 16000 -ac 1 output.wav

# FLAC → WAV変換
ffmpeg -i input.flac -ar 16000 -ac 1 output.wav

# 一括変換（シェルスクリプト）
for file in *.mp3; do
  ffmpeg -i "$file" -ar 16000 -ac 1 "${file%.mp3}.wav"
done
```

---

### Pythonでの変換

```python
import subprocess
import os

def convert_to_wav(input_path, output_path=None, sample_rate=16000):
    """
    音声ファイルをWAV形式に変換
    
    Args:
        input_path: 入力ファイルパス
        output_path: 出力ファイルパス（Noneの場合は自動生成）
        sample_rate: サンプルレート（Hz）
    """
    if output_path is None:
        base = os.path.splitext(input_path)[0]
        output_path = f"{base}_converted.wav"
    
    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-ar', str(sample_rate),
        '-ac', '1',  # モノラル
        '-y',  # 上書き
        output_path
    ]
    
    subprocess.run(cmd, check=True)
    print(f"✅ Converted: {output_path}")
    
    return output_path


# 実行例
convert_to_wav('./audio/sample.mp3')
```

---

## 📊 ベストプラクティス

### ファイル命名規則

```bash
# 推奨: タイムスタンプ + ユニークID + 説明
20260128_143052_abc123_customer-call.wav

# Python実装例
from datetime import datetime
import uuid

def generate_filename(original_name):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    safe_name = original_name.replace(' ', '_').replace('/', '_')
    return f"{timestamp}_{unique_id}_{safe_name}"

print(generate_filename('customer call.wav'))
# 出力: 20260128_143052_a1b2c3d4_customer_call.wav
```

---

### フォルダ構造

```
gs://technobrain-mendan-audio/
├── audio/
│   ├── 2026/
│   │   ├── 01/
│   │   │   ├── 20260128_143052_abc123_call.wav
│   │   │   └── 20260128_150230_def456_call.wav
│   │   └── 02/
│   └── archive/
├── processed/
└── temp/
```

---

### メタデータ活用

```python
from google.cloud import storage
from datetime import datetime

def upload_with_rich_metadata(local_path, metadata_dict):
    """
    豊富なメタデータ付きでアップロード
    """
    client = storage.Client()
    bucket = client.bucket('technobrain-mendan-audio')
    
    blob = bucket.blob(f"audio/{os.path.basename(local_path)}")
    
    # メタデータ
    blob.metadata = {
        'uploaded_at': datetime.now().isoformat(),
        'uploader': metadata_dict.get('uploader', 'unknown'),
        'customer_id': metadata_dict.get('customer_id'),
        'call_duration': str(metadata_dict.get('duration_seconds')),
        'language': metadata_dict.get('language', 'ja-JP'),
        'source': metadata_dict.get('source', 'manual')
    }
    
    blob.upload_from_filename(local_path)
    
    return f"gs://{bucket.name}/{blob.name}"

# 実行例
upload_with_rich_metadata('./audio/call.wav', {
    'uploader': 'system',
    'customer_id': 'CUST-12345',
    'duration_seconds': 180,
    'source': 'zapier'
})
```

---

### セキュリティ

```bash
# 1. アップロードしたファイルをすぐに削除（ローカル）
gcloud storage cp ./audio/sensitive.wav gs://technobrain-mendan-audio/audio/
rm ./audio/sensitive.wav

# 2. オブジェクトのライフサイクル設定（自動削除）
# lifecycle.json
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}

# 適用
gcloud storage buckets update gs://technobrain-mendan-audio \
  --lifecycle-file=lifecycle.json

# 3. 暗号化
gcloud storage cp ./audio/sample.wav gs://technobrain-mendan-audio/audio/ \
  --encryption-key=<YOUR_KEY>
```

---

## 📚 関連ドキュメント

- [ZAPIER-WORKFLOW-GUIDE.md](./ZAPIER-WORKFLOW-GUIDE.md) - Zapierからのアップロード
- [AUDIO-WEBHOOK-GUIDE.md](./AUDIO-WEBHOOK-GUIDE.md) - 全体フロー
- [E2E-TEST-GUIDE.md](./E2E-TEST-GUIDE.md) - テスト手順

---

## 🆘 トラブルシューティング

### アップロード失敗

```bash
# 1. 認証確認
gcloud auth list

# 2. 権限確認
gcloud storage buckets get-iam-policy gs://technobrain-mendan-audio

# 3. ファイル存在確認
ls -lh ./audio/sample.wav

# 4. バケット存在確認
gcloud storage buckets describe gs://technobrain-mendan-audio
```

### 遅いアップロード

```bash
# 並列転送を有効化
gsutil -m cp ./audio/*.wav gs://technobrain-mendan-audio/audio/

# またはgcloudで
gcloud storage cp ./audio/*.wav gs://technobrain-mendan-audio/audio/ \
  --parallel \
  --thread-count=16
```

---

**アップロード方法を選択したら、次は [E2E-TEST-GUIDE.md](./E2E-TEST-GUIDE.md) でテストしてください！**
