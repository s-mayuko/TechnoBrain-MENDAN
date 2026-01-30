/**
 * デモ用スプレッドシート初期化スクリプト
 * 
 * 実行方法:
 * 1. スプレッドシートを開く
 * 2. 「拡張機能」→「Apps Script」
 * 3. このファイルの内容をコピー＆ペースト
 * 4. 「setupDemoSheet」関数を実行
 */

/**
 * デモ用スプレッドシートをセットアップ
 */
function setupDemoSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 既存のmerge_uiシートを削除して新規作成
  let sheet = ss.getSheetByName('merge_ui');
  if (sheet) {
    ss.deleteSheet(sheet);
  }
  sheet = ss.insertSheet('merge_ui');
  
  Logger.log('📋 デモシートのセットアップを開始します...');
  
  // 1. ヘッダー行を設定
  setupHeaders(sheet);
  
  // 2. A列に項目名を入力
  setupLabels(sheet);
  
  // 3. チェックボックス列（B/D/F）を設定
  setupCheckboxes(sheet);
  
  // 4. 初期値設定（Portersにチェック）
  setInitialChecks(sheet);
  
  // 5. 条件付き書式を設定
  setupConditionalFormatting(sheet);
  
  // 6. ウィンドウ固定
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  
  // 7. 列幅調整
  adjustColumnWidths(sheet);
  
  // 8. セル保護（C列・E列を読み取り専用に）
  protectColumns(sheet);
  
  Logger.log('✅ セットアップ完了！');
  SpreadsheetApp.getUi().alert('デモシートのセットアップが完了しました！');
}

/**
 * ヘッダー行を設定
 */
function setupHeaders(sheet) {
  const headers = [
    '項目名',           // A
    'Porters採用',      // B
    'Porters値',        // C
    '音声採用',         // D
    '音声抽出値',       // E
    '手入力採用',       // F
    '手入力値',         // G
    '採用ソース',       // H
    '採用値',           // I
    'confidence',      // J
    'evidence',        // K
    '送信日時',         // L
    '送信結果',         // M
    '送信済フラグ',     // N
    '送信ID'            // O
  ];
  
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#4A86E8');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  
  Logger.log('✅ ヘッダー設定完了');
}

/**
 * A列に項目名を入力
 */
function setupLabels(sheet) {
  const labels = [
    '氏名',
    '生年月日(年齢)',
    '婚姻',
    '住所(都道府県)',
    '住所詳細',
    '自宅種別',
    '配偶者',
    '扶養人数',
    '子供（人数）',
    '子供（扶養人数）',
    '配偶者扶養',
    '所属学会',
    '著書論文',
    '海外生活',
    '海外出張',
    'Ｕターン都道府県',
    '現在年収 [円]',
    '現：月給',
    '現：残業',
    '現：手当',
    '現：賞与',
    '現：賞与回数',
    '月平均残業時間',
    'アプライ済み企業',
    '希望会社名',
    '希望雇用形態',
    '希望業種　詳細',
    '希望職種　詳細',
    '希望年収 [万円]',
    '希望職位',
    '希望転職時期(テキスト)',
    '希望勤務地',
    '希望勤務地２',
    '希望勤務地３',
    '転勤',
    'やりたい仕事',
    '転職回数',
    '現在の就業状況',
    '直近職歴(業種)',
    '直近職歴（勤務地）',
    '直近職歴(入社年月)',
    '直近職歴(退社年月)',
    '直近職歴(雇用形態)',
    '現在の雇用形態',
    '直近職歴(配属部署)',
    '直近職歴(ポジション)',
    '直近職歴(仕事内容)',
    '専門分野',
    '経験業種',
    '前の職歴(会社名)',
    '前の職歴(業種)',
    '前の職歴(入社年月)',
    '前の職歴(退社年月)',
    '前の職歴(雇用形態)',
    '前の職歴（退職理由）',
    '前の職歴(仕事内容)',
    '前々の職歴(会社名)',
    '前々の職歴(入社年月)',
    '前々の職歴(退社年月)',
    '前々の職歴(雇用形態)',
    '前々の職歴（退職理由）',
    '前々の職歴(仕事内容)',
    '主経験（言語）',
    '主経験（OS）',
    '主経験（DB）',
    '主経験（パッケージ・ツール）',
    '主経験（ネットワーク）',
    '主経験（デザイン）',
    '保有資格・スキル',
    '資格（情報系－情報処理）',
    '資格（その他）',
    '英語レベル（会話）',
    '英語レベル（読解）',
    '英語レベル（作文）',
    'TOEFL取得年',
    'TOEFL',
    'TOEIC取得年',
    'TOEIC',
    '英語のその他の資格',
    'その他の言語・備考',
    '転職理由',
    '最終学歴(学校区分)',
    '最終学歴(学校名)',
    '最終学歴(入学年月)',
    '最終学歴(卒業年月)',
    '最終学歴　修了種類',
    '学歴➀',
    '入学年月日➀',
    '卒業年月日➀',
    '修了種類➀',
    '学歴②',
    '入学年月日②',
    '卒業年月日②',
    '修了種類②',
    '学歴③',
    '入学年月日③',
    '卒業年月日③',
    '修了種類③',
    '海外学位',
    '学歴備考',
    '電話番号',
    'メールアドレス'
  ];
  
  // 2行目から項目名を入力（1行目はヘッダー）
  const startRow = 2;
  const labelRange = sheet.getRange(startRow, 1, labels.length, 1);
  const labelValues = labels.map(label => [label]);
  labelRange.setValues(labelValues);
  
  Logger.log('✅ 項目名入力完了（' + labels.length + '項目）');
}

/**
 * チェックボックス列（B/D/F）を設定
 */
function setupCheckboxes(sheet) {
  const lastRow = sheet.getLastRow();
  
  // B列（Porters採用）
  const rangeB = sheet.getRange(2, 2, lastRow - 1, 1);
  rangeB.insertCheckboxes();
  
  // D列（音声採用）
  const rangeD = sheet.getRange(2, 4, lastRow - 1, 1);
  rangeD.insertCheckboxes();
  
  // F列（手入力採用）
  const rangeF = sheet.getRange(2, 6, lastRow - 1, 1);
  rangeF.insertCheckboxes();
  
  Logger.log('✅ チェックボックス設定完了');
}

/**
 * 初期値設定（Portersにチェック）
 */
function setInitialChecks(sheet) {
  const lastRow = sheet.getLastRow();
  
  // B列（Porters採用）を全てTRUEに設定
  const rangeB = sheet.getRange(2, 2, lastRow - 1, 1);
  const values = [];
  for (let i = 0; i < lastRow - 1; i++) {
    values.push([true]);
  }
  rangeB.setValues(values);
  
  // H列（採用ソース）を「porters」に設定
  const rangeH = sheet.getRange(2, 8, lastRow - 1, 1);
  const sourceValues = [];
  for (let i = 0; i < lastRow - 1; i++) {
    sourceValues.push(['porters']);
  }
  rangeH.setValues(sourceValues);
  
  Logger.log('✅ 初期値設定完了（Portersにチェック）');
}

/**
 * 条件付き書式を設定
 */
function setupConditionalFormatting(sheet) {
  const lastRow = sheet.getLastRow();
  
  // 既存の条件付き書式をクリア
  sheet.clearConditionalFormatRules();
  
  const rules = [];
  
  // ルール1: B列=TRUE → B列・C列が薄い緑
  const ruleB = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B2=TRUE')
    .setBackground('#D9EAD3')  // 薄い緑
    .setRanges([sheet.getRange(2, 2, lastRow - 1, 2)])  // B2:C列
    .build();
  rules.push(ruleB);
  
  // ルール2: D列=TRUE → D列・E列が薄い黄色
  const ruleD = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$D2=TRUE')
    .setBackground('#FFF2CC')  // 薄い黄色
    .setRanges([sheet.getRange(2, 4, lastRow - 1, 2)])  // D2:E列
    .build();
  rules.push(ruleD);
  
  // ルール3: F列=TRUE → F列・G列が薄い青
  const ruleF = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$F2=TRUE')
    .setBackground('#CFE2F3')  // 薄い青
    .setRanges([sheet.getRange(2, 6, lastRow - 1, 2)])  // F2:G列
    .build();
  rules.push(ruleF);
  
  // ルール4: H列の値によって色分け
  // H列 = "porters" → 緑色
  const ruleHPorters = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('porters')
    .setBackground('#B6D7A8')  // 緑色
    .setRanges([sheet.getRange(2, 8, lastRow - 1, 1)])  // H列
    .build();
  rules.push(ruleHPorters);
  
  // H列 = "audio" → 黄色
  const ruleHAudio = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('audio')
    .setBackground('#FFE599')  // 黄色
    .setRanges([sheet.getRange(2, 8, lastRow - 1, 1)])  // H列
    .build();
  rules.push(ruleHAudio);
  
  // H列 = "manual" → 青色
  const ruleHManual = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('manual')
    .setBackground('#9FC5E8')  // 青色
    .setRanges([sheet.getRange(2, 8, lastRow - 1, 1)])  // H列
    .build();
  rules.push(ruleHManual);
  
  // すべてのルールを適用
  sheet.setConditionalFormatRules(rules);
  
  Logger.log('✅ 条件付き書式設定完了（' + rules.length + 'ルール）');
}

/**
 * 列幅を調整
 */
function adjustColumnWidths(sheet) {
  sheet.setColumnWidth(1, 200);  // A列: 項目名
  sheet.setColumnWidth(2, 100);  // B列: Porters採用
  sheet.setColumnWidth(3, 150);  // C列: Porters値
  sheet.setColumnWidth(4, 100);  // D列: 音声採用
  sheet.setColumnWidth(5, 150);  // E列: 音声抽出値
  sheet.setColumnWidth(6, 100);  // F列: 手入力採用
  sheet.setColumnWidth(7, 150);  // G列: 手入力値
  sheet.setColumnWidth(8, 120);  // H列: 採用ソース
  sheet.setColumnWidth(9, 150);  // I列: 採用値
  sheet.setColumnWidth(10, 100); // J列: confidence
  sheet.setColumnWidth(11, 250); // K列: evidence
  sheet.setColumnWidth(12, 150); // L列: 送信日時
  sheet.setColumnWidth(13, 100); // M列: 送信結果
  sheet.setColumnWidth(14, 100); // N列: 送信済フラグ
  sheet.setColumnWidth(15, 200); // O列: 送信ID
  
  Logger.log('✅ 列幅調整完了');
}

/**
 * C列・E列を保護（読み取り専用に設定）
 * 
 * @param {boolean} strictMode - true: 完全ロック, false: 警告のみ（デフォルト）
 */
function protectColumns(sheet, strictMode = false) {
  const lastRow = sheet.getLastRow();
  
  // C列（Porters値）を保護
  const rangeC = sheet.getRange(2, 3, lastRow - 1, 1);  // C2:C{lastRow}
  const protectionC = rangeC.protect().setDescription('Porters値（自動入力専用）');
  
  if (strictMode) {
    // 完全ロック: スクリプト以外は編集不可
    protectionC.setWarningOnly(false);
    // 編集者を削除（スクリプト実行者のみ編集可能）
    const me = Session.getEffectiveUser();
    protectionC.addEditor(me);
    protectionC.removeEditors(protectionC.getEditors());
    if (protectionC.canDomainEdit()) {
      protectionC.setDomainEdit(false);
    }
  } else {
    // 警告のみ: 編集可能だが警告が出る
    protectionC.setWarningOnly(true);
  }
  
  // E列（音声抽出値）を保護
  const rangeE = sheet.getRange(2, 5, lastRow - 1, 1);  // E2:E{lastRow}
  const protectionE = rangeE.protect().setDescription('音声抽出値（自動入力専用）');
  
  if (strictMode) {
    protectionE.setWarningOnly(false);
    const me = Session.getEffectiveUser();
    protectionE.addEditor(me);
    protectionE.removeEditors(protectionE.getEditors());
    if (protectionE.canDomainEdit()) {
      protectionE.setDomainEdit(false);
    }
  } else {
    protectionE.setWarningOnly(true);
  }
  
  const mode = strictMode ? '完全ロック' : '警告モード';
  Logger.log(`✅ セル保護設定完了（C列・E列: ${mode}）`);
}

/**
 * C列・E列を完全ロック（手動編集不可）
 */
function protectColumnsStrict() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('merge_ui');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('merge_uiシートが見つかりません');
    return;
  }
  
  protectColumns(sheet, true);
  SpreadsheetApp.getUi().alert('C列・E列を完全ロックしました\n（手動編集不可）');
}

/**
 * セル保護を解除
 */
function removeProtections() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('merge_ui');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('merge_uiシートが見つかりません');
    return;
  }
  
  // すべての保護を解除
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (let i = 0; i < protections.length; i++) {
    protections[i].remove();
  }
  
  Logger.log('✅ セル保護を解除しました');
  SpreadsheetApp.getUi().alert('セル保護を解除しました');
}

/**
 * サンプルデータを追加（テスト用）
 */
function addSampleData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('merge_ui');
  
  if (!sheet) {
    SpreadsheetApp.getUi().alert('merge_uiシートが見つかりません。先にsetupDemoSheet()を実行してください。');
    return;
  }
  
  // 3行目にサンプルデータを追加（氏名）
  sheet.getRange(2, 3).setValue('山田太郎');  // C2: Porters値
  sheet.getRange(2, 5).setValue('山田太郎');  // E2: 音声抽出値
  sheet.getRange(2, 10).setValue('high');    // J2: confidence
  sheet.getRange(2, 11).setValue('transcript: "私の名前は山田太郎です"');  // K2: evidence
  
  // 4行目にサンプルデータを追加（生年月日）
  sheet.getRange(3, 3).setValue('1990/01/01');  // C3: Porters値
  sheet.getRange(3, 5).setValue('1990/03/03');  // E3: 音声抽出値
  sheet.getRange(3, 10).setValue('high');       // J3: confidence
  sheet.getRange(3, 11).setValue('transcript: "1990年3月3日生まれです"');  // K3: evidence
  
  // 5行目にサンプルデータを追加（電話番号）
  sheet.getRange(4, 3).setValue('090-1234-5678');  // C4: Porters値
  sheet.getRange(4, 5).setValue('090-1234-5678');  // E4: 音声抽出値
  sheet.getRange(4, 10).setValue('medium');        // J4: confidence
  sheet.getRange(4, 11).setValue('transcript: "電話番号は090の1234の5678です"');  // K4: evidence
  
  // 6行目にサンプルデータを追加（年収）
  sheet.getRange(5, 3).setValue('500万円');  // C5: Porters値
  sheet.getRange(5, 7).setValue('600万円');  // G5: 手入力値
  sheet.getRange(5, 2).setValue(false);      // B5: Portersのチェックを外す
  sheet.getRange(5, 6).setValue(true);       // F5: 手入力にチェック
  sheet.getRange(5, 8).setValue('manual');   // H5: 採用ソース
  
  Logger.log('✅ サンプルデータ追加完了');
  SpreadsheetApp.getUi().alert('サンプルデータを追加しました！');
}

/**
 * メニューを追加
 * 
 * 注意: Code.gs と統合する場合は、どちらか一方のonOpen()のみを有効にしてください
 */
function onOpen_SetupDemo() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('デモシート設定')
    .addItem('🔧 デモシート初期化', 'setupDemoSheet')
    .addItem('📝 サンプルデータ追加', 'addSampleData')
    .addSeparator()
    .addItem('ℹ️ ヘルプ', 'showHelp')
    .addToUi();
}

/**
 * Code.gs と統合したonOpen()
 * 
 * 使い方:
 * 1. この関数を有効にする（関数名を onOpen に変更）
 * 2. Code.gs の onOpen() をコメントアウト
 * 3. SetupDemoSheet.gs の onOpen_SetupDemo() は無効のまま
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // データ統合メニュー（Code.gs）
  ui.createMenu('データ統合')
    .addItem('マージしてWebhook送信', 'mergeAndSend')
    .addSeparator()
    .addItem('Porters取得 → C列反映', 'importPorters')
    .addItem('音声処理 → E列反映', 'processAudio')
    .addToUi();
  
  // デモシート設定メニュー（SetupDemoSheet.gs）
  ui.createMenu('デモシート設定')
    .addItem('🔧 デモシート初期化', 'setupDemoSheet')
    .addItem('📝 サンプルデータ追加', 'addSampleData')
    .addSeparator()
    .addSubMenu(ui.createMenu('🔒 セル保護')
      .addItem('完全ロック（C・E列）', 'protectColumnsStrict')
      .addItem('保護解除', 'removeProtections'))
    .addSeparator()
    .addItem('ℹ️ ヘルプ', 'showHelp')
    .addToUi();
}

/**
 * ヘルプを表示
 */
function showHelp() {
  const html = HtmlService.createHtmlOutput(`
    <h2>デモシート設定ヘルプ</h2>
    <h3>使い方</h3>
    <ol>
      <li><b>デモシート初期化</b>: merge_uiシートを作成し、100項目のラベルと条件付き書式を設定します</li>
      <li><b>サンプルデータ追加</b>: テスト用のサンプルデータを追加します</li>
      <li><b>セル保護</b>: C列・E列を保護して手動編集を防ぎます</li>
    </ol>
    
    <h3>条件付き書式ルール</h3>
    <ul>
      <li>B列（Porters採用）= TRUE → B・C列が<span style="background:#D9EAD3;">薄い緑</span></li>
      <li>D列（音声採用）= TRUE → D・E列が<span style="background:#FFF2CC;">薄い黄色</span></li>
      <li>F列（手入力採用）= TRUE → F・G列が<span style="background:#CFE2F3;">薄い青</span></li>
      <li>H列:
        <ul>
          <li>"porters" → <span style="background:#B6D7A8;">緑色</span></li>
          <li>"audio" → <span style="background:#FFE599;">黄色</span></li>
          <li>"manual" → <span style="background:#9FC5E8;">青色</span></li>
        </ul>
      </li>
    </ul>
    
    <h3>排他制御</h3>
    <ul>
      <li>B・D・F列は同一行で1つのみチェック可能</li>
      <li>チェックを変更すると他のチェックが自動でOFFになります</li>
      <li>H列（採用ソース）が自動で更新されます</li>
    </ul>
    
    <h3>セル保護</h3>
    <ul>
      <li><b>警告モード（デフォルト）</b>: C列・E列を編集しようとすると警告が出ますが、編集は可能です</li>
      <li><b>完全ロック</b>: C列・E列の手動編集が完全に不可になります（スクリプトからは編集可能）</li>
      <li>保護を解除したい場合は「セル保護」→「保護解除」を実行してください</li>
    </ul>
    
    <h3>初期状態</h3>
    <ul>
      <li>B列（Porters採用）がすべてチェックON</li>
      <li>H列（採用ソース）が「porters」</li>
      <li>C列・E列が保護されています（警告モード）</li>
    </ul>
  `)
    .setWidth(650)
    .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'ヘルプ');
}
