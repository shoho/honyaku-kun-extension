// ===== 定数 =====
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const LANG = {
  auto: { code: "auto", label: "✨ 自動判定", short: "🌐 自動", name: "" },
  ja: { code: "ja", label: "🇯🇵 日本語", short: "🇯🇵 日本語", name: "Japanese" },
  en: { code: "en", label: "🇺🇸 English", short: "🇺🇸 English", name: "English" },
};

// ニュアンス（トーン）— 絵文字/ラベル/説明/翻訳指示を1か所で定義（チップはここから描画）
const TONES = {
  chat: {
    emoji: "💬",
    label: "チャット",
    title: "長くせず簡潔に。改行や箇条書きは控えめ",
    instruction:
      "Write it as a quick chat/instant-message reply. Keep it short and concise — " +
      "do not pad it out. Avoid unnecessary line breaks, and do NOT use bullet points or lists.",
  },
  colleague: {
    emoji: "🤝",
    label: "同僚",
    title: "同僚へのメール。かしこまりすぎない",
    instruction:
      "Write it as an email to a coworker. Keep it relaxed and friendly — " +
      "do not use overly formal or stiff expressions.",
  },
  boss: {
    emoji: "🙇",
    label: "上司",
    title: "上司・初対面へのメール。丁寧すぎず清潔感",
    instruction:
      "Write it as an email to a manager or someone you are meeting for the first time. " +
      "Be polite and clean/professional, but not overly stiff or excessively formal.",
  },
  general: {
    emoji: "✉️",
    label: "一般",
    title: "取引先・社外など一般の相手へのメール。丁寧で礼儀正しいビジネス文体",
    instruction:
      "Write it as a standard polite email to a general recipient you do not know well " +
      "(for example a customer or an external business contact). Use clean, courteous, " +
      "businesslike language — polite and approachable, but not overly stiff or formal.",
  },
  article: {
    emoji: "📰",
    label: "記事",
    title: "記事・ニュース。段落を保ち、忠実で読みやすい中立的な文体",
    instruction:
      "Translate it as an article or news piece. Render it as clear, readable prose and " +
      "faithfully translate the entire content. Keep the original paragraph structure and line breaks. " +
      "Use a neutral, journalistic tone — not a casual chat style and without email-style greetings.",
  },
};
// 翻訳モードのトーン（先頭＝既定。TONES の部分集合・並び替え）
const TRANSLATE_TONE_KEYS = ["general", "chat", "colleague", "boss", "article"];

// 添削モードのシーン（一般／チャット／メール）。chat/mail は距離感5段階つき
const PROOF_SCENES = {
  general: {
    emoji: "✨",
    label: "一般",
    title: "場面を限定せず、自然で読みやすい文章に整える",
    instruction:
      "Polish it into natural, clear, and generally appropriate {lang}, " +
      "without assuming a specific medium or relationship.",
    levels: false,
  },
  chat: {
    emoji: "💬",
    label: "チャット",
    title: "チャット向け。相手との距離感を5段階で選べます",
    instruction:
      "Rewrite it as a chat / instant message: conversational and concise, " +
      "minimal line breaks, and no email-style greetings or sign-offs.",
    levels: true,
  },
  mail: {
    emoji: "✉️",
    label: "メール",
    title: "メール向け。相手との距離感を5段階で選べます",
    instruction:
      "Rewrite it as an email, with a greeting and closing appropriate to the relationship.",
    levels: true,
  },
};

// チャット/メールの相手との距離感（5段階。既定は中央＝一般）
const PROOF_LEVELS = [
  {
    emoji: "😎",
    label: "ごく親しい",
    title: "後輩やすごく仲がいい同僚・友人",
    instruction:
      "Audience: a junior or a very close colleague/friend. Use a very casual, warm, " +
      "friendly register — relaxed and informal wording is welcome.",
  },
  {
    emoji: "🙂",
    label: "親しい",
    title: "会ったことがある比較的知っている同僚・友人",
    instruction:
      "Audience: a colleague/friend you already know fairly well. " +
      "Use a casual but considerate register.",
  },
  {
    emoji: "😐",
    label: "一般",
    title: "会ったこともない同僚やお客さん（一般）",
    instruction:
      "Audience: someone you have not met (a general colleague or customer). " +
      "Use a neutral, polite register.",
  },
  {
    emoji: "🙇",
    label: "上司・お客様",
    title: "上司やお客さま",
    instruction:
      "Audience: a manager or a customer. Use a polite, respectful register.",
  },
  {
    emoji: "🎩",
    label: "役員・要人",
    title: "相当偉い人やお客さんの偉い人",
    instruction:
      "Audience: a senior executive or a VIP client. " +
      "Use a highly formal, deferential register.",
  },
];
const DEFAULT_PROOF_LEVEL = 2; // 一般

// 翻訳結果が空のときのプレースホルダ（HTML 側と重複させない単一の定義）
const OUTPUT_PLACEHOLDER = "💭 ここに翻訳結果が表示されます";

// 出力トークン上限に達したとき（長文）の案内。userFacing はそのまま表示する印
const TOO_LONG_MESSAGE =
  "テキストが長すぎて出力の上限に達しました。短く分けてお試しください。✂️";
function tooLongError() {
  const e = new Error(TOO_LONG_MESSAGE);
  e.userFacing = true; // translate 側で「翻訳に失敗しました」を付けずそのまま出す
  return e;
}

// 2言語間の「反対の言語」を返す（ja↔en）
const opposite = (lang) => (lang === "ja" ? "en" : "ja");

// 翻訳 / 校正（同一言語）の2モードの表示文言を1か所に集約
const MODES = {
  translate: { action: "翻訳する", busy: "翻訳中…", title: "🎉 翻訳結果", placeholder: "✈️ 翻訳中…" },
  proofread: { action: "添削する", busy: "添削中…", title: "✍️ 添削・校正結果", placeholder: "✍️ 添削中…" },
};

// 方向ピルの巡回順
const CYCLE_ORDER = ["auto", "en", "ja"];

// ポップアップウィンドウとして開かれているか（?window=1）と、元のサイドパネルのウィンドウID
const URL_PARAMS = new URLSearchParams(location.search);
const IS_POPOUT = URL_PARAMS.get("window") === "1";
const OWNER_WINDOW_ID = Number(URL_PARAMS.get("owner")) || null;

// ===== 状態 =====
const state = {
  task: "translate", // "translate"（翻訳） | "proofread"（添削・校正）
  source: "auto", // "auto" | "ja" | "en"
  target: "auto", // "auto"(=元の反対) | "ja" | "en"
  tone: "general", // 翻訳モードのトーン（TONES のキー）
  proofScene: "general", // 添削モードのシーン（PROOF_SCENES のキー）
  proofLevel: DEFAULT_PROOF_LEVEL, // 添削モードの距離感（PROOF_LEVELS の添字）
  lastResult: null, // 直近の結果 {translation, keyExpressions, alternatives, notes}（引き継ぎ用）
  nativeLang: "ja", // 母国語（学習メモの解説に使う言語）"ja" | "en"
  apiKey: "",
  model: DEFAULT_MODEL,
  busy: false,
};

// ===== DOM =====
const $ = (id) => document.getElementById(id);
const els = {
  translateView: $("translateView"),
  settingsView: $("settingsView"),
  settingsBtn: $("settingsBtn"),
  backBtn: $("backBtn"),
  sourceLang: $("sourceLang"),
  targetLang: $("targetLang"),
  swapBtn: $("swapBtn"),
  popoutBtn: $("popoutBtn"),
  taskTabs: $("taskTabs"),
  toneSelect: $("toneSelect"),
  proofLevels: $("proofLevels"),
  inputText: $("inputText"),
  outputText: $("outputText"),
  translateBtn: $("translateBtn"),
  copyBtn: $("copyBtn"),
  resultTitle: $("resultTitle"),
  targetLabel: $("targetLabel"),
  errorBox: $("errorBox"),
  insightsPanel: $("insightsPanel"),
  insightList: $("insightList"),
  apiKeyInput: $("apiKeyInput"),
  modelInput: $("modelInput"),
  nativeLangSelect: $("nativeLangSelect"),
  saveSettingsBtn: $("saveSettingsBtn"),
  settingsMsg: $("settingsMsg"),
  btnLabel: document.querySelector("#translateBtn .btn-label"),
  btnEmoji: document.querySelector("#translateBtn .btn-emoji"),
  spinner: document.querySelector("#translateBtn .spinner"),
};

// API キーを正規化（全角→半角・空白/制御文字を除去）
// 日本語 IME で入力された全角英数は HTTP ヘッダーに使えないため必須
function sanitizeKey(key) {
  return (key || "")
    .normalize("NFKC") // 全角英数を半角へ
    .replace(/\s+/g, "") // 空白・改行を除去
    .replace(/[^\x21-\x7E]/g, ""); // 残った非 ASCII を除去
}

// ===== 言語判定 =====
function detectLang(text) {
  // ひらがな・カタカナ・漢字を含めば日本語とみなす
  return /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/.test(text)
    ? "ja"
    : "en";
}

// モード・言語設定から元/先を解決する
// 翻訳: from=元言語, to=先言語 ／ 校正: from=to=対象言語（同一言語を整える）
function resolveDirection(text) {
  const lang = state.source === "auto" ? detectLang(text) : state.source;
  if (state.task === "proofread") return { from: lang, to: lang };
  const to = state.target === "auto" ? opposite(lang) : state.target;
  return { from: lang, to };
}

// テキストエリアを内容に合わせて自動で高さ調整（上限あり）
// 長文時に入力欄が伸びすぎて結果欄を潰さないよう、画面の約3割で頭打ちにする
function autoGrow(el) {
  el.style.height = "auto";
  const max = Math.max(120, Math.round(window.innerHeight * 0.3));
  const capped = el.scrollHeight > max;
  el.style.height = (capped ? max : el.scrollHeight) + "px";
  el.style.overflowY = capped ? "auto" : "hidden";
}

// ===== UI 更新 =====
function renderTask() {
  els.taskTabs.querySelectorAll(".task-tab").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.task === state.task);
  });
  const proof = state.task === "proofread";
  // 校正モードは言語を1つだけ選ぶので、入れ替え・先言語ピルは隠す
  els.swapBtn.hidden = proof;
  els.targetLang.hidden = proof;
  els.inputText.placeholder = proof
    ? "添削・校正したいテキストを入力…"
    : "翻訳したいテキストを入力…";
  renderDirection();
  renderStyleControls(); // 翻訳=トーン、添削=シーン＋距離感
}

function setTask(task) {
  if (task !== "translate" && task !== "proofread") return;
  state.task = task;
  renderTask();
}

function renderDirection() {
  els.sourceLang.textContent = LANG[state.source].label;
  els.targetLang.textContent = LANG[state.target].short;
  // 結果ラベル: 校正は対象言語、翻訳は先言語（auto は地球儀。実言語は実行時に確定）
  const labelKey = state.task === "proofread" ? state.source : state.target;
  els.targetLabel.textContent =
    labelKey === "auto" ? "🌐" : LANG[labelKey].short;
  if (!state.busy) els.btnLabel.textContent = MODES[state.task].action;
}

// 方向ピル（source/target 共通）を次の言語へ巡回
function cycleDirection(side) {
  const cur = state[side];
  state[side] = CYCLE_ORDER[(CYCLE_ORDER.indexOf(cur) + 1) % CYCLE_ORDER.length];
  renderDirection();
}

// チップ列を描画する汎用ヘルパー（items: {key,emoji,label,title}[]）
function renderChips(container, items, activeKey) {
  container.innerHTML = items
    .map(
      (it) =>
        `<button class="tone-btn${it.key === activeKey ? " is-active" : ""}" ` +
        `data-chip="${it.key}" title="${it.title}">` +
        `<span class="tone-emoji">${it.emoji}</span>${it.label}</button>`
    )
    .join("");
}

// 既存チップの選択だけを更新（再生成しない）
function markActive(container, key) {
  container.querySelectorAll(".tone-btn").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.chip === key)
  );
}

// キー配列＋定義オブジェクトから renderChips 用の items を作る
const keysToChips = (keys, defs) => keys.map((key) => ({ key, ...defs[key] }));

// チップコンテナのクリックを委譲して data-chip を fn に渡す
function onChipClick(container, fn) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".tone-btn");
    if (btn) fn(btn.dataset.chip);
  });
}

// モードに応じてスタイル選択 UI を描画する
function renderStyleControls() {
  if (state.task === "proofread") {
    // シーン（一般／チャット／メール）
    renderChips(els.toneSelect, keysToChips(Object.keys(PROOF_SCENES), PROOF_SCENES), state.proofScene);
    // チャット/メールのときだけ距離感5段階を表示
    const withLevels = PROOF_SCENES[state.proofScene].levels;
    els.proofLevels.hidden = !withLevels;
    if (withLevels) {
      const levels = PROOF_LEVELS.map((lv, i) => ({ key: String(i), ...lv }));
      renderChips(els.proofLevels, levels, String(state.proofLevel));
    }
  } else {
    renderChips(els.toneSelect, keysToChips(TRANSLATE_TONE_KEYS, TONES), state.tone);
    els.proofLevels.hidden = true;
  }
}

function persistStyle() {
  chrome.storage.local.set({
    tone: state.tone,
    proofScene: state.proofScene,
    proofLevel: state.proofLevel,
  });
}

// 翻訳トーン or 添削シーンの選択（#toneSelect のチップ）
function setStyle(key) {
  if (state.task === "proofread") {
    if (!PROOF_SCENES[key]) return;
    state.proofScene = key;
    renderStyleControls(); // シーンで距離感の表示が変わるため全体を再描画
  } else {
    if (!TRANSLATE_TONE_KEYS.includes(key)) return;
    state.tone = key;
    markActive(els.toneSelect, key); // 選択だけ更新
  }
  persistStyle();
}

// 添削モードの距離感（5段階）の選択
function setProofLevel(index) {
  const i = Number(index);
  if (!PROOF_LEVELS[i]) return;
  state.proofLevel = i;
  markActive(els.proofLevels, String(i)); // チップ構成は不変なので選択だけ更新
  persistStyle();
}

function swapDirection() {
  [state.source, state.target] = [state.target, state.source];
  renderDirection();
}

// 選択状態を検証して state へ適用（保存復元・引き継ぎ復元で共通利用。無効値は無視）
function applyValidatedSelection(sel = {}) {
  if (sel.task === "translate" || sel.task === "proofread") state.task = sel.task;
  if (LANG[sel.source]) state.source = sel.source;
  if (LANG[sel.target]) state.target = sel.target;
  if (TRANSLATE_TONE_KEYS.includes(sel.tone)) state.tone = sel.tone;
  if (PROOF_SCENES[sel.proofScene]) state.proofScene = sel.proofScene;
  if (PROOF_LEVELS[sel.proofLevel]) state.proofLevel = sel.proofLevel;
}

// 現在のセッション（選択・原文・結果）をスナップショットにする
function captureSession() {
  return {
    task: state.task,
    source: state.source,
    target: state.target,
    tone: state.tone,
    proofScene: state.proofScene,
    proofLevel: state.proofLevel,
    input: els.inputText.value,
    result: state.lastResult,
    resultTitle: els.resultTitle.textContent,
    targetLabel: els.targetLabel.textContent,
  };
}

// 別ウィンドウ/サイドパネルへ引き継ぐためのスナップショットを保存
function saveHandoff() {
  return chrome.storage.local.set({ handoff: captureSession() });
}

// 引き継ぎスナップショットがあれば復元する（消費後は削除）
async function restoreHandoff() {
  const { handoff } = await chrome.storage.local.get("handoff");
  if (!handoff) return false;
  await chrome.storage.local.remove("handoff");

  applyValidatedSelection(handoff);
  renderTask();

  // 原文
  els.inputText.value = handoff.input || "";
  autoGrow(els.inputText);

  // 結果＋学習ポイント
  if (handoff.result && handoff.result.translation) {
    state.lastResult = handoff.result;
    setOutput(handoff.result.translation);
    renderInsights(handoff.result);
    if (handoff.resultTitle) els.resultTitle.textContent = handoff.resultTitle;
    if (handoff.targetLabel) els.targetLabel.textContent = handoff.targetLabel;
  }
  return true;
}

// 同じ UI を独立したポップアップウィンドウで開き、元のサイドパネルは閉じる
async function openPopout() {
  const win = await chrome.windows.getCurrent();
  await saveHandoff(); // 現在の内容を引き継ぐ
  await chrome.windows.create({
    url: chrome.runtime.getURL(`sidepanel.html?window=1&owner=${win.id}`),
    type: "popup",
    width: 440,
    height: 760,
  });
  window.close(); // メインのサイドパネルを閉じる
}

// ポップアップから元のウィンドウのサイドパネルに戻す
function returnToSidePanel() {
  if (!OWNER_WINDOW_ID) return;
  saveHandoff(); // 内容を引き継ぐ（sidePanel.open はジェスチャ内で同期呼びするため await しない）
  chrome.sidePanel
    .open({ windowId: OWNER_WINDOW_ID })
    .then(() => window.close())
    .catch((e) => showError(`サイドパネルを開けませんでした: ${e.message}`));
}

function showError(msg) {
  els.errorBox.textContent = msg;
  els.errorBox.hidden = false;
}
function clearError() {
  els.errorBox.hidden = true;
}

// busy 時はそのとき実行中のモード（mode）の文言、待機時は推定モードの操作ラベル
function setBusy(busy, mode) {
  state.busy = busy;
  els.translateBtn.disabled = busy;
  els.spinner.hidden = !busy;
  els.btnEmoji.hidden = busy;
  els.btnLabel.textContent = busy
    ? MODES[mode].busy
    : MODES[state.task].action;
}

function setOutput(text, isPlaceholder = false) {
  if (isPlaceholder) {
    const span = document.createElement("span");
    span.className = "placeholder";
    span.textContent = OUTPUT_PLACEHOLDER;
    els.outputText.replaceChildren(span);
    els.copyBtn.disabled = true;
  } else {
    els.outputText.textContent = text;
    els.copyBtn.disabled = !text;
  }
}

// 学習メモを描画（3種をまとめて1つの箇条書きに。空ならパネルごと隠す）
function renderInsights(result) {
  const items = [
    ...result.keyExpressions,
    ...result.alternatives,
    ...result.notes,
  ];
  els.insightList.replaceChildren(
    ...items.map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    })
  );
  els.insightsPanel.hidden = items.length === 0;
}

function clearInsights() {
  els.insightsPanel.hidden = true;
}

// 構造化出力のスキーマ（翻訳＋学習メモ3種）
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    translation: { type: "STRING" },
    keyExpressions: { type: "ARRAY", items: { type: "STRING" } },
    alternatives: { type: "ARRAY", items: { type: "STRING" } },
    notes: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["translation", "keyExpressions", "alternatives", "notes"],
  propertyOrdering: ["translation", "keyExpressions", "alternatives", "notes"],
};

// モードごとの文体指示を組み立てる
// 翻訳=トーン、添削=シーン（＋チャット/メールは相手との距離感）
function styleInstructionFor(mode, langName) {
  if (mode !== "proofread") return TONES[state.tone].instruction;
  const scene = PROOF_SCENES[state.proofScene];
  let s = scene.instruction.replaceAll("{lang}", langName);
  if (scene.levels) s += " " + PROOF_LEVELS[state.proofLevel].instruction;
  return s;
}

// 翻訳/校正タスクの system instruction を組み立てる
// （Gemini ベストプラクティス: タスク=system / データ=user、制約は末尾・肯定形・簡潔）
function buildSystemInstruction(from, to, mode) {
  const fromName = LANG[from].name;
  const toName = LANG[to].name;
  const styleInstruction = styleInstructionFor(mode, toName);

  // 両モード共通の保持ルール
  const preserve =
    `Keep names, numbers, URLs, code, @mentions, and emoji unchanged. ` +
    `Preserve the line breaks and paragraph structure.`;

  // 校正モード: 同じ言語のままネイティブ表現に整える
  const mainTask =
    mode === "proofread"
      ? `You are an expert ${toName} editor and a language tutor for a Japanese-speaking user.\n\n` +
        `1) translation: Proofread and rewrite the user's ${toName} text into natural, native-sounding ${toName}. ` +
        `Fix grammar, word choice, and awkward phrasing while preserving the original meaning and intent.\n` +
        `Style to aim for:\n${styleInstruction}\n` +
        `${preserve} ` +
        `Put ONLY the corrected ${toName} text in this field — no labels, quotes, or notes.`
      : `You are an expert ${fromName}-to-${toName} translator and a language tutor for a Japanese-speaking user.\n\n` +
        `1) translation: Translate the user's text from ${fromName} to ${toName}, preserving meaning, intent, and nuance.\n` +
        `Tone for the translation:\n${styleInstruction}\n` +
        `Write natural, fluent ${toName} with clear everyday words. ${preserve} ` +
        `Put ONLY the translated text in this field — no labels, quotes, or notes.`;

  // 添削はポイントを最大5つまで、翻訳は3つ程度
  const noteGuidance =
    mode === "proofread"
      ? `Provide up to 5 learning bullets IN TOTAL across the three sections combined (fewer is fine)`
      : `Provide about 3 learning bullets IN TOTAL across the three sections combined`;

  // 学習メモは母国語で書き、もう一方（学習対象）の言語の表現を解説する
  const nativeName = LANG[state.nativeLang].name;

  return (
    mainTask +
    `\n\n2) Learning notes for a native ${nativeName} speaker who is studying the other language. ` +
    `Write every note in ${nativeName}:\n` +
    `- keyExpressions: useful expressions worth remembering, taken from the language that is NOT ${nativeName} ` +
    `(the one being learned). Each bullet pairs that expression with a short ${nativeName} note on its meaning or nuance.\n` +
    `- alternatives: other natural ways to express the same thing.\n` +
    `- notes: any other helpful commentary (nuance, grammar, register, what was improved, cultural points).\n\n` +
    `Rules (follow exactly):\n` +
    `- Write every learning-note bullet in ${nativeName}, kept short.\n` +
    `- ${noteGuidance} — not that many per section. ` +
    `Distribute them however is most useful: they may all sit in one section, ` +
    `or be spread across sections. Put each bullet in whichever section fits best, and leave the other arrays empty.\n` +
    `- Pick only the most valuable insights; if there is genuinely nothing worth noting, all three arrays may be empty.\n` +
    `- Return JSON matching the provided schema.`
  );
}

// ===== Gemini API 呼び出し =====
async function callGemini(text, from, to, mode) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(state.model)}:generateContent`;

  const baseGenConfig = {
    // Gemini 3 系は temperature 1.0 を維持（下げるとループ/品質劣化）
    temperature: 1.0,
    // 長文（記事まるごと）でも訳文＋学習メモが収まるよう余裕を持たせる
    maxOutputTokens: 32768,
    // 翻訳＋学習メモを構造化 JSON で受け取る
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
  };

  // リクエスト不変部分は一度だけ組み立てる（再試行で作り直さない）
  const apiKey = sanitizeKey(state.apiKey);
  const systemInstruction = {
    parts: [{ text: buildSystemInstruction(from, to, mode) }],
  };
  const contents = [{ role: "user", parts: [{ text }] }];

  const post = (genConfig) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ systemInstruction, contents, generationConfig: genConfig }),
    });

  // 翻訳は深い推論が不要なので低レベル思考で低レイテンシ化（flash 系）
  let res = await post({
    ...baseGenConfig,
    thinkingConfig: { thinkingLevel: "low" },
  });
  // thinkingConfig 非対応モデルの場合は外して再試行
  if (!res.ok && res.status === 400) {
    res = await post(baseGenConfig);
  }

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const candidate = data?.candidates?.[0];
  const truncated = candidate?.finishReason === "MAX_TOKENS";
  const raw = candidate?.content?.parts
    ?.filter((p) => !p.thought) // 思考サマリは除外
    .map((p) => p.text || "")
    .join("")
    .trim();
  if (!raw) {
    if (truncated) throw tooLongError();
    throw new Error("翻訳結果を取得できませんでした。");
  }

  // 構造化 JSON をパース。上限で途中切れ（=不正な JSON）なら長文エラーで通知
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (truncated) throw tooLongError();
    parsed = { translation: raw }; // 上限以外の理由なら全文を訳文として扱う
  }
  const asList = (v) => (Array.isArray(v) ? v.filter((s) => s && s.trim()) : []);
  return {
    translation: (parsed.translation || "").trim() || raw,
    keyExpressions: asList(parsed.keyExpressions),
    alternatives: asList(parsed.alternatives),
    notes: asList(parsed.notes),
  };
}

// ===== 翻訳実行 =====
async function translate() {
  if (state.busy) return;
  clearError();
  const text = els.inputText.value.trim();
  if (!text) {
    els.inputText.focus();
    return;
  }
  if (!state.apiKey) {
    showError("Gemini API キーが未設定です。右上の設定から登録してください。");
    openSettings();
    return;
  }

  const { from, to } = resolveDirection(text);
  const mode = state.task;
  const m = MODES[mode];
  els.targetLabel.textContent = LANG[to].short;
  els.resultTitle.textContent = m.title;

  setBusy(true, mode);
  setOutput(m.placeholder);
  clearInsights();
  try {
    const result = await callGemini(text, from, to, mode);
    state.lastResult = result; // 別ウィンドウ引き継ぎ用に保持
    setOutput(result.translation);
    renderInsights(result);
  } catch (e) {
    state.lastResult = null;
    setOutput("", true);
    showError(e.userFacing ? e.message : `翻訳に失敗しました: ${e.message}`);
  } finally {
    setBusy(false);
  }
}

// ===== 設定 =====
function openSettings() {
  els.translateView.hidden = true;
  els.settingsView.hidden = false;
  els.apiKeyInput.value = state.apiKey;
  els.modelInput.value = state.model;
  els.nativeLangSelect.value = state.nativeLang;
  els.settingsMsg.hidden = true;
}
function closeSettings() {
  els.settingsView.hidden = true;
  els.translateView.hidden = false;
}
async function saveSettings() {
  const apiKey = sanitizeKey(els.apiKeyInput.value);
  const model = els.modelInput.value.trim() || DEFAULT_MODEL;
  const nativeLang = els.nativeLangSelect.value === "en" ? "en" : "ja";
  state.apiKey = apiKey;
  state.model = model;
  state.nativeLang = nativeLang;
  await chrome.storage.local.set({ apiKey, model, nativeLang });
  els.settingsMsg.textContent = "保存しました。";
  els.settingsMsg.className = "settings-msg ok";
  els.settingsMsg.hidden = false;
  setTimeout(closeSettings, 700);
}

async function loadSettings() {
  const { apiKey, model, nativeLang, tone, proofScene, proofLevel } =
    await chrome.storage.local.get([
      "apiKey",
      "model",
      "nativeLang",
      "tone",
      "proofScene",
      "proofLevel",
    ]);
  state.apiKey = apiKey || "";
  state.model = model || DEFAULT_MODEL;
  if (nativeLang === "ja" || nativeLang === "en") state.nativeLang = nativeLang;
  // 保存値を検証して復元（無効値は既定のまま）
  applyValidatedSelection({ tone, proofScene, proofLevel });
}

// 右クリックメニューから渡されたテキストを取り込む
async function consumePendingText() {
  const { pendingText } = await chrome.storage.local.get("pendingText");
  if (pendingText) {
    els.inputText.value = pendingText;
    autoGrow(els.inputText);
    await chrome.storage.local.remove("pendingText");
    translate();
  }
}

// ===== イベント =====
function bindEvents() {
  els.settingsBtn.addEventListener("click", openSettings);
  // ポップアップ時は「サイドパネルに戻す」、通常時は「別ウィンドウで開く」
  if (IS_POPOUT) {
    els.popoutBtn.textContent = "↩️";
    els.popoutBtn.title = "サイドパネルに戻す";
    els.popoutBtn.addEventListener("click", returnToSidePanel);
  } else {
    els.popoutBtn.addEventListener("click", openPopout);
  }
  els.backBtn.addEventListener("click", closeSettings);
  els.saveSettingsBtn.addEventListener("click", saveSettings);
  els.sourceLang.addEventListener("click", () => cycleDirection("source"));
  els.targetLang.addEventListener("click", () => cycleDirection("target"));
  els.swapBtn.addEventListener("click", swapDirection);
  els.taskTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".task-tab");
    if (btn) setTask(btn.dataset.task);
  });
  // チップ（動的生成）はコンテナへ委譲。data-chip を渡す
  onChipClick(els.toneSelect, setStyle);
  onChipClick(els.proofLevels, setProofLevel);
  els.translateBtn.addEventListener("click", translate);
  els.copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(els.outputText.textContent);
    els.copyBtn.textContent = "✅ コピー済み";
    setTimeout(() => (els.copyBtn.textContent = "📋 コピー"), 1200);
  });
  // 結果エリアで Ctrl/Cmd + A → 翻訳結果だけを全選択
  els.outputText.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      const range = document.createRange();
      range.selectNodeContents(els.outputText);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  els.inputText.addEventListener("input", () => autoGrow(els.inputText));
  els.inputText.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      translate();
    }
  });

  // 別タブで設定が変わったら反映
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.apiKey) state.apiKey = changes.apiKey.newValue || "";
    if (changes.model) state.model = changes.model.newValue || DEFAULT_MODEL;
    if (changes.nativeLang) state.nativeLang = changes.nativeLang.newValue || "ja";
    if (changes.pendingText && changes.pendingText.newValue) consumePendingText();
  });
}

// ===== 初期化 =====
(async function init() {
  await loadSettings();
  renderTask(); // タブ・言語・トーンをまとめて描画
  bindEvents();
  setOutput("", true);
  // 別ウィンドウ/サイドパネル切替で引き継いだ内容を復元。なければ右クリック取り込み
  const restored = await restoreHandoff();
  if (!restored) await consumePendingText();
})();
