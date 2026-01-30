/**
 * TechnoBrain-MENDAN - Google Apps Script
 * スプレッドシートマージ・Webhook送信システム
 */

// ============================================
// 定数定義
// ============================================
const SHEET_NAME = 'merge_ui';
const CONFIG_SHEET_NAME = 'config';

// 列番号（1-indexed）
const COL = {
  LABEL: 1,           // A列: 項目名
  PORTERS_CHECK: 2,   // B列: Porters採用チェック
  PORTERS_VAL: 3,     // C列: Porters値
  AUDIO_CHECK: 4,     // D列: 音声採用チェック
  AUDIO_VAL: 5,       // E列: 音声抽出値
  MANUAL_CHECK: 6,    // F列: 手入力採用チェック
  MANUAL_VAL: 7,      // G列: 手入力値
  // 補助列（任意）
  SOURCE: 8,          // H列: 採用ソース
  MERGED_VAL: 9,      // I列: 採用値
  CONFIDENCE: 10,     // J列: confidence
  EVIDENCE: 11,       // K列: evidence
  SENT_AT: 12,        // L列: 送信日時
  RESULT: 13,         // M列: 送信結果
  SENT_FLAG: 14,      // N列: 送信済フラグ
  SENT_ID: 15         // O列: 送信ID（idempotency key）
};

// 一括採用チェックボックスの位置（行2）
const BULK_CHECK_ROW = 2;
const BULK_CHECK_COLS = {
  PORTERS: 3,  // C2
  AUDIO: 5,    // E2
  MANUAL: 7    // G2
};

// データ開始行
const DATA_START_ROW = 3;

// ============================================
// メニュー追加
// ============================================
// 注意: SetupDemoSheet.gs と統合する場合、この onOpen() はコメントアウトしてください
// SetupDemoSheet.gs の統合版 onOpen() を使用してください
/*
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('データ統合')
    .addItem('マージしてWebhook送信', 'mergeAndSend')
    .addSeparator()
    .addItem('Porters取得 → C列反映', 'importPorters')
    .addItem('音声処理 → E列反映', 'processAudio')
    .addToUi();
}
*/

// ============================================
// 排他制御（onEdit）
// ============================================
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) return;
  
  const range = e.range;
  const row = range.getRow();
  const col = range.getColumn();
  const value = e.value;
  
  // 一括採用チェック（行2のC2/E2/G2）
  if (row === BULK_CHECK_ROW) {
    handleBulkCheck(sheet, col, value);
    return;
  }
  
  // 行レベル排他（B/D/F列、行3以降）
  if (row >= DATA_START_ROW) {
    handleRowExclusive(sheet, row, col, value);
  }
}

/**
 * 一括採用チェック処理
 */
function handleBulkCheck(sheet, col, value) {
  if (value !== 'TRUE' && value !== true) return;
  
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return;
  
  let targetCheckCol, targetValCol, otherBulkCols;
  
  if (col === BULK_CHECK_COLS.PORTERS) {
    // C2: Porters一括
    targetCheckCol = COL.PORTERS_CHECK;
    targetValCol = COL.PORTERS_VAL;
    otherBulkCols = [BULK_CHECK_COLS.AUDIO, BULK_CHECK_COLS.MANUAL];
  } else if (col === BULK_CHECK_COLS.AUDIO) {
    // E2: 音声一括
    targetCheckCol = COL.AUDIO_CHECK;
    targetValCol = COL.AUDIO_VAL;
    otherBulkCols = [BULK_CHECK_COLS.PORTERS, BULK_CHECK_COLS.MANUAL];
  } else if (col === BULK_CHECK_COLS.MANUAL) {
    // G2: 手入力一括
    targetCheckCol = COL.MANUAL_CHECK;
    targetValCol = COL.MANUAL_VAL;
    otherBulkCols = [BULK_CHECK_COLS.PORTERS, BULK_CHECK_COLS.AUDIO];
  } else {
    return;
  }
  
  // 他の一括チェックをOFF
  otherBulkCols.forEach(c => {
    sheet.getRange(BULK_CHECK_ROW, c).setValue(false);
  });
  
  // 対象列のチェックを一括ON、他の列をOFF
  const numRows = lastRow - DATA_START_ROW + 1;
  
  // B/D/F列を全てFALSE
  sheet.getRange(DATA_START_ROW, COL.PORTERS_CHECK, numRows, 1).setValue(false);
  sheet.getRange(DATA_START_ROW, COL.AUDIO_CHECK, numRows, 1).setValue(false);
  sheet.getRange(DATA_START_ROW, COL.MANUAL_CHECK, numRows, 1).setValue(false);
  
  // 対象列の値が空でない行のみTRUE
  const values = sheet.getRange(DATA_START_ROW, targetValCol, numRows, 1).getValues();
  const checkValues = values.map(row => [row[0] !== '' && row[0] !== null]);
  sheet.getRange(DATA_START_ROW, targetCheckCol, numRows, 1).setValues(checkValues);
  
  // H列（採用ソース）を一括更新
  let source = '';
  if (col === BULK_CHECK_COLS.PORTERS) {
    source = 'porters';
  } else if (col === BULK_CHECK_COLS.AUDIO) {
    source = 'audio';
  } else if (col === BULK_CHECK_COLS.MANUAL) {
    source = 'manual';
  }
  
  if (source) {
    const sourceValues = checkValues.map(row => [row[0] ? source : '']);
    sheet.getRange(DATA_START_ROW, COL.SOURCE, numRows, 1).setValues(sourceValues);
  }
}

/**
 * 行レベル排他制御
 */
function handleRowExclusive(sheet, row, col, value) {
  if (value !== 'TRUE' && value !== true) return;
  
  const checkCols = [COL.PORTERS_CHECK, COL.AUDIO_CHECK, COL.MANUAL_CHECK];
  if (!checkCols.includes(col)) return;
  
  // 他のチェック列をFALSE
  checkCols.forEach(c => {
    if (c !== col) {
      sheet.getRange(row, c).setValue(false);
    }
  });
  
  // H列（採用ソース）を自動更新
  updateSourceColumn(sheet, row, col);
}

/**
 * H列（採用ソース）を自動更新
 */
function updateSourceColumn(sheet, row, checkedCol) {
  let source = '';
  
  if (checkedCol === COL.PORTERS_CHECK) {
    source = 'porters';
  } else if (checkedCol === COL.AUDIO_CHECK) {
    source = 'audio';
  } else if (checkedCol === COL.MANUAL_CHECK) {
    source = 'manual';
  }
  
  if (source) {
    sheet.getRange(row, COL.SOURCE).setValue(source);
  }
}

// ============================================
// マージして送信
// ============================================
function mergeAndSend() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('シート "' + SHEET_NAME + '" が見つかりません');
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) {
    SpreadsheetApp.getUi().alert('データがありません');
    return;
  }
  
  // 二重送信チェック
  try {
    const sentFlagCell = sheet.getRange(DATA_START_ROW, COL.SENT_FLAG);
    const sentFlag = sentFlagCell.getValue();
    
    if (sentFlag === true || sentFlag === 'TRUE') {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        '二重送信警告',
        'このレコードは既に送信済みです。再送信しますか？',
        ui.ButtonSet.YES_NO
      );
      
      if (response !== ui.Button.YES) {
        SpreadsheetApp.getActiveSpreadsheet().toast('送信をキャンセルしました', '中止', 3);
        return;
      }
    }
  } catch (e) {
    // 列が存在しない場合はスキップ
  }
  
  // configシートからマッピング取得（存在すれば）
  const configMap = getConfigMap(ss);
  
  // データ読み込み
  const numRows = lastRow - DATA_START_ROW + 1;
  const dataRange = sheet.getRange(DATA_START_ROW, COL.LABEL, numRows, COL.MANUAL_VAL);
  const data = dataRange.getValues();
  
  // confidence/evidence列も取得（存在すれば）
  let confidenceData = [];
  let evidenceData = [];
  try {
    confidenceData = sheet.getRange(DATA_START_ROW, COL.CONFIDENCE, numRows, 1).getValues();
    evidenceData = sheet.getRange(DATA_START_ROW, COL.EVIDENCE, numRows, 1).getValues();
  } catch (e) {
    // 列が存在しない場合は空配列のまま
  }
  
  // マージ処理
  const fields = [];
  const sourceResults = [];
  const mergedResults = [];
  const emptyWarnings = []; // 空欄警告リスト
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const label = row[COL.LABEL - 1];
    const portersCheck = row[COL.PORTERS_CHECK - 1];
    const portersVal = row[COL.PORTERS_VAL - 1];
    const audioCheck = row[COL.AUDIO_CHECK - 1];
    const audioVal = row[COL.AUDIO_VAL - 1];
    const manualCheck = row[COL.MANUAL_CHECK - 1];
    const manualVal = row[COL.MANUAL_VAL - 1];
    
    let source = 'none';
    let value = '';
    let emptyWarning = false;
    
    if (portersCheck === true || portersCheck === 'TRUE') {
      source = 'porters';
      value = portersVal;
      if (!portersVal && portersVal !== 0) emptyWarning = true;
    } else if (audioCheck === true || audioCheck === 'TRUE') {
      source = 'audio';
      value = audioVal;
      if (!audioVal && audioVal !== 0) emptyWarning = true;
    } else if (manualCheck === true || manualCheck === 'TRUE') {
      source = 'manual';
      value = manualVal;
      if (!manualVal && manualVal !== 0) emptyWarning = true;
    }
    
    // 空欄警告を記録
    if (emptyWarning && label) {
      emptyWarnings.push(label);
    }
    
    sourceResults.push([source]);
    mergedResults.push([value]);
    
    if (source !== 'none' && label && !emptyWarning) {
      const field = {
        label: label,
        source: source,
        value: value
      };
      
      // configからkeyを取得
      if (configMap[label]) {
        field.key = configMap[label].key;
      }
      
      // confidence/evidence追加
      if (confidenceData[i] && confidenceData[i][0]) {
        field.confidence = confidenceData[i][0];
      }
      if (evidenceData[i] && evidenceData[i][0]) {
        field.evidence = evidenceData[i][0];
      }
      
      fields.push(field);
    }
  }
  
  // H/I列に結果を書き込み
  try {
    sheet.getRange(DATA_START_ROW, COL.SOURCE, numRows, 1).setValues(sourceResults);
    sheet.getRange(DATA_START_ROW, COL.MERGED_VAL, numRows, 1).setValues(mergedResults);
  } catch (e) {
    // 列が存在しない場合はスキップ
  }
  
  // 空欄警告を表示
  if (emptyWarnings.length > 0) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '警告: 以下の項目は採用チェックONですが値が空のため除外されます:\n' + emptyWarnings.join(', '),
      '空欄警告',
      10
    );
  }
  
  if (fields.length === 0) {
    SpreadsheetApp.getUi().alert('送信するフィールドがありません（チェックを確認してください）');
    return;
  }
  
  // バリデーション実行
  const validationErrors = validateFields(fields, configMap);
  if (validationErrors.length > 0) {
    SpreadsheetApp.getUi().alert(
      'バリデーションエラー:\n\n' + validationErrors.join('\n')
    );
    return;
  }
  
  // 送信ID生成（idempotency key）
  const sentId = generateSentId();
  
  // Payload作成
  const payload = {
    record_id: getRecordId(ss),
    merged_at: new Date().toISOString(),
    fields: fields,
    idempotency_key: sentId
  };
  
  // Cloud Runに送信
  try {
    const result = sendToCloudRun('/send_webhook', payload);
    
    // 結果をシートに書き込み
    const now = new Date().toISOString();
    const resultText = 'Status: ' + result.status;
    
    try {
      sheet.getRange(DATA_START_ROW, COL.SENT_AT).setValue(now);
      sheet.getRange(DATA_START_ROW, COL.RESULT).setValue(resultText);
      
      // 送信成功時に送信済フラグとIDを記録
      if (result.status >= 200 && result.status < 300) {
        sheet.getRange(DATA_START_ROW, COL.SENT_FLAG).setValue(true);
        sheet.getRange(DATA_START_ROW, COL.SENT_ID).setValue(sentId);
      }
    } catch (e) {
      // 列が存在しない場合はスキップ
    }
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Webhook送信完了: ' + result.status,
      '成功',
      5
    );
  } catch (e) {
    SpreadsheetApp.getUi().alert('送信エラー: ' + e.message);
    Logger.log('送信エラー: ' + e.toString());
  }
}

// ============================================
// Porters取得（stub）
// ============================================
function importPorters() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordId = getRecordId(ss);
  
  if (!recordId) {
    SpreadsheetApp.getUi().alert('record_idが設定されていません');
    return;
  }
  
  try {
    const result = sendToCloudRun('/import_porters', {
      sheet_id: ss.getId(),
      sheet_name: SHEET_NAME,
      porters_record_id: recordId
    });
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Portersデータ取得完了',
      '成功',
      5
    );
  } catch (e) {
    SpreadsheetApp.getUi().alert('Porters取得エラー: ' + e.message);
  }
}

// ============================================
// 音声処理
// ============================================
function processAudio() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '音声処理',
    'GCS URIを入力してください（例: gs://bucket/audio.wav）:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  
  const gcsUri = response.getResponseText().trim();
  if (!gcsUri.startsWith('gs://')) {
    ui.alert('無効なGCS URI形式です');
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    const result = sendToCloudRun('/process_audio', {
      sheet_id: ss.getId(),
      sheet_name: SHEET_NAME,
      gcs_uri: gcsUri,
      language_code: 'ja-JP'
    });
    
    SpreadsheetApp.getActiveSpreadsheet().toast(
      '音声処理完了',
      '成功',
      5
    );
  } catch (e) {
    ui.alert('音声処理エラー: ' + e.message);
  }
}

// ============================================
// Zapier Webhook受信（doPost）
// ============================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // 音声データとメタデータを処理
    if (data.gcs_uri) {
      processAudioFromWebhook(data);
    }
    
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Webhookからの音声処理
 */
function processAudioFromWebhook(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const payload = {
    sheet_id: ss.getId(),
    sheet_name: SHEET_NAME,
    gcs_uri: data.gcs_uri,
    language_code: 'ja-JP',
    record_id: data.record_id || '',
    metadata: data.metadata || {}
  };
  
  sendToCloudRun('/process_audio', payload);
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * フィールドのバリデーション
 * @param {Array} fields - フィールド配列
 * @param {Object} configMap - config設定マップ
 * @return {Array} エラーメッセージ配列
 */
function validateFields(fields, configMap) {
  const errors = [];
  
  // configMapが空の場合は最低限のチェックのみ
  if (Object.keys(configMap).length === 0) {
    // 値が空でないかチェック（基本）
    fields.forEach(field => {
      if (!field.value && field.value !== 0) {
        errors.push('❌ ' + field.label + ': 値が空です');
      }
    });
    return errors;
  }
  
  // configに基づくバリデーション
  fields.forEach(field => {
    const config = configMap[field.label];
    if (!config) {
      // configにない項目はスキップ
      return;
    }
    
    const value = field.value;
    
    // 必須チェック
    if (config.required && (!value && value !== 0)) {
      errors.push('❌ ' + field.label + ': 必須項目です');
      return;
    }
    
    // 値がない場合は以降のチェックをスキップ
    if (!value && value !== 0) return;
    
    // 型チェック
    const type = config.type || 'string';
    switch (type) {
      case 'int':
      case 'integer':
        if (!isInteger(value)) {
          errors.push('❌ ' + field.label + ': 整数を入力してください（現在値: ' + value + '）');
        }
        break;
        
      case 'number':
      case 'float':
        if (isNaN(parseFloat(value))) {
          errors.push('❌ ' + field.label + ': 数値を入力してください（現在値: ' + value + '）');
        }
        break;
        
      case 'date':
        if (!isValidDate(value)) {
          errors.push('❌ ' + field.label + ': 日付形式が正しくありません（現在値: ' + value + '）');
        }
        break;
        
      case 'email':
        if (!isValidEmail(value)) {
          errors.push('❌ ' + field.label + ': メールアドレス形式が正しくありません（現在値: ' + value + '）');
        }
        break;
    }
    
    // 正規表現バリデーション
    if (config.validation && config.validation.trim()) {
      try {
        const regex = new RegExp(config.validation);
        if (!regex.test(String(value))) {
          errors.push('❌ ' + field.label + ': 形式が正しくありません（パターン: ' + config.validation + '）');
        }
      } catch (e) {
        Logger.log('Invalid regex in config for ' + field.label + ': ' + e.toString());
      }
    }
  });
  
  // 必須項目の存在チェック（configにあってfieldsにない）
  Object.keys(configMap).forEach(label => {
    if (configMap[label].required) {
      const found = fields.some(f => f.label === label);
      if (!found) {
        errors.push('❌ ' + label + ': 必須項目が選択されていません');
      }
    }
  });
  
  return errors;
}

/**
 * 整数判定
 */
function isInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value);
  }
  const num = Number(String(value).replace(/,/g, ''));
  return !isNaN(num) && Number.isInteger(num);
}

/**
 * 日付形式判定
 */
function isValidDate(value) {
  // YYYY/MM/DD, YYYY-MM-DD などの形式を許容
  const datePatterns = [
    /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,
    /^\d{4}年\d{1,2}月\d{1,2}日$/
  ];
  
  return datePatterns.some(pattern => pattern.test(String(value)));
}

/**
 * メールアドレス形式判定
 */
function isValidEmail(value) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(String(value));
}

/**
 * configシートからマッピングを取得
 */
function getConfigMap(ss) {
  const configSheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!configSheet) return {};
  
  const lastRow = configSheet.getLastRow();
  if (lastRow < 2) return {};
  
  const data = configSheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const map = {};
  
  data.forEach(row => {
    const label = row[0];
    if (label) {
      map[label] = {
        key: row[1] || label,
        type: row[2] || 'string',
        required: row[3] === true || row[3] === 'TRUE',
        validation: row[4] || ''
      };
    }
  });
  
  return map;
}

/**
 * record_idを取得（Script Propertiesまたはシートから）
 */
function getRecordId(ss) {
  const props = PropertiesService.getScriptProperties();
  const recordId = props.getProperty('RECORD_ID');
  if (recordId) return recordId;
  
  // シートのA1セルから取得する場合など
  // 必要に応じてカスタマイズ
  return '';
}

/**
 * 送信ID生成（idempotency key）
 */
function generateSentId() {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2, 10);
  return timestamp + '-' + random;
}

/**
 * Cloud Runにリクエスト送信
 */
function sendToCloudRun(endpoint, payload) {
  const props = PropertiesService.getScriptProperties();
  const baseUrl = props.getProperty('CLOUD_RUN_BASE_URL');
  const apiKey = props.getProperty('INTERNAL_API_KEY');
  
  if (!baseUrl) {
    throw new Error('CLOUD_RUN_BASE_URLが設定されていません');
  }
  
  const url = baseUrl + endpoint;
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Internal-Api-Key': apiKey || ''
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  if (responseCode >= 400) {
    throw new Error('HTTP ' + responseCode + ': ' + responseText);
  }
  
  return {
    status: responseCode,
    body: JSON.parse(responseText)
  };
}
