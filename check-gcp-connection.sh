#!/bin/bash

# GCP接続確認スクリプト

echo "======================================"
echo "GCP接続状態の確認"
echo "======================================"
echo ""

# 現在の認証状態を確認
echo "1. 認証状態の確認:"
gcloud auth list
echo ""

# プロジェクト設定を確認
echo "2. プロジェクト設定の確認:"
gcloud config get-value project
echo ""

# プロジェクト情報を表示
echo "3. プロジェクト情報:"
gcloud projects describe technobrain-mendan 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  プロジェクト 'technobrain-mendan' にアクセスできません"
    echo "   以下のコマンドで認証とプロジェクト設定を行ってください:"
    echo "   gcloud auth login"
    echo "   gcloud config set project technobrain-mendan"
else
    echo "✓ プロジェクトにアクセスできます"
fi
echo ""

# 有効なAPIの確認
echo "4. 有効なAPI（一部）:"
gcloud services list --enabled --filter="name:cloudbuild OR name:run OR name:storage" --format="table(name)" 2>/dev/null
echo ""

echo "======================================"
echo "確認完了"
echo "======================================"
