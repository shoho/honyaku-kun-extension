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
const DEFAULT_TONE = "chat";

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
  proofread: { action: "校正する", busy: "校正中…", title: "✨ 校正結果", placeholder: "✨ 校正中…" },
};
const modeKey = (from, to) => (from === to ? "proofread" : "translate");

// 方向ピルの巡回順
const CYCLE_ORDER = ["auto", "en", "ja"];

// ===== 状態 =====
const state = {
  source: "auto", // "auto" | "ja" | "en"
  target: "auto", // "auto"(=元の反対) | "ja" | "en"
  tone: DEFAULT_TONE, // TONES のキー（chat/colleague/boss/general/article）
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
  toneSelect: $("toneSelect"),
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

// source/target 設定から元・先を解決する（from===to なら校正モード相当）
function resolveDirection(text) {
  const from = state.source === "auto" ? detectLang(text) : state.source;
  const to = state.target === "auto" ? opposite(from) : state.target;
  return { from, to };
}

// 操作前のモード推定（元・先が確定して一致していれば校正、autoを含めば翻訳扱い）
function pendingMode() {
  return state.source !== "auto" && state.source === state.target
    ? "proofread"
    : "translate";
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
function renderDirection() {
  els.sourceLang.textContent = LANG[state.source].label;
  els.targetLang.textContent = LANG[state.target].short;
  // 結果ラベルは自動時は地球儀、確定時は対象言語の国旗（実言語は翻訳時に確定）
  els.targetLabel.textContent =
    state.target === "auto" ? "🌐" : LANG[state.target].short;
  if (!state.busy) els.btnLabel.textContent = MODES[pendingMode()].action;
}

// 方向ピル（source/target 共通）を次の言語へ巡回
function cycleDirection(side) {
  const cur = state[side];
  state[side] = CYCLE_ORDER[(CYCLE_ORDER.indexOf(cur) + 1) % CYCLE_ORDER.length];
  renderDirection();
}

// TONES を単一の真実としてチップを描画する
function renderToneButtons() {
  els.toneSelect.innerHTML = Object.entries(TONES)
    .map(
      ([key, t]) =>
        `<button class="tone-btn" data-tone="${key}" title="${t.title}">` +
        `<span class="tone-emoji">${t.emoji}</span>${t.label}</button>`
    )
    .join("");
}

function renderTone() {
  els.toneSelect.querySelectorAll(".tone-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tone === state.tone);
  });
}

function setTone(tone) {
  if (!TONES[tone]) return;
  state.tone = tone;
  renderTone();
  chrome.storage.local.set({ tone });
}

function swapDirection() {
  [state.source, state.target] = [state.target, state.source];
  renderDirection();
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
    : MODES[pendingMode()].action;
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

// 翻訳/校正タスクの system instruction を組み立てる
// （Gemini ベストプラクティス: タスク=system / データ=user、制約は末尾・肯定形・簡潔）
function buildSystemInstruction(from, to) {
  const fromName = LANG[from].name;
  const toName = LANG[to].name;
  const toneInstruction = (TONES[state.tone] || TONES[DEFAULT_TONE]).instruction;

  // 両モード共通の保持ルール
  const preserve =
    `Keep names, numbers, URLs, code, @mentions, and emoji unchanged. ` +
    `Preserve the line breaks and paragraph structure.`;

  // from===to: 同じ言語 → 翻訳ではなくネイティブ表現への校正
  const mainTask =
    from === to
      ? `You are an expert ${toName} editor and a language tutor for a Japanese-speaking user.\n\n` +
        `1) translation: Proofread and rewrite the user's ${toName} text into natural, native-sounding ${toName}. ` +
        `Fix grammar, word choice, and awkward phrasing while preserving the original meaning and intent.\n` +
        `Style to aim for:\n${toneInstruction}\n` +
        `${preserve} ` +
        `Put ONLY the corrected ${toName} text in this field — no labels, quotes, or notes.`
      : `You are an expert ${fromName}-to-${toName} translator and a language tutor for a Japanese-speaking user.\n\n` +
        `1) translation: Translate the user's text from ${fromName} to ${toName}, preserving meaning, intent, and nuance.\n` +
        `Tone for the translation:\n${toneInstruction}\n` +
        `Write natural, fluent ${toName} with clear everyday words. ${preserve} ` +
        `Put ONLY the translated text in this field — no labels, quotes, or notes.`;

  return (
    mainTask +
    `\n\n2) Learning notes, written in Japanese for the user:\n` +
    `- keyExpressions: characteristic or genuinely useful expressions worth remembering. ` +
    `Each bullet like "表現 — 日本語での意味やニュアンス".\n` +
    `- alternatives: other natural ways to express the same thing.\n` +
    `- notes: any other helpful commentary (nuance, grammar, register, what was improved, cultural points).\n\n` +
    `Rules (follow exactly):\n` +
    `- Write every learning-note bullet in Japanese, kept short.\n` +
    `- Provide about 3 learning bullets IN TOTAL across the three sections combined — not 3 per section. ` +
    `Distribute them however is most useful: they may all sit in one section (e.g. three keyExpressions), ` +
    `or be spread across sections. Put each bullet in whichever section fits best, and leave the other arrays empty.\n` +
    `- Pick only the most valuable insights; if there is genuinely nothing worth noting, all three arrays may be empty.\n` +
    `- Return JSON matching the provided schema.`
  );
}

// ===== Gemini API 呼び出し =====
async function callGemini(text, from, to) {
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
  const systemInstruction = { parts: [{ text: buildSystemInstruction(from, to) }] };
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
  const mode = modeKey(from, to);
  const m = MODES[mode];
  els.targetLabel.textContent = LANG[to].short;
  els.resultTitle.textContent = m.title;

  setBusy(true, mode);
  setOutput(m.placeholder);
  clearInsights();
  try {
    const result = await callGemini(text, from, to);
    setOutput(result.translation);
    renderInsights(result);
  } catch (e) {
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
  els.settingsMsg.hidden = true;
}
function closeSettings() {
  els.settingsView.hidden = true;
  els.translateView.hidden = false;
}
async function saveSettings() {
  const apiKey = sanitizeKey(els.apiKeyInput.value);
  const model = els.modelInput.value.trim() || DEFAULT_MODEL;
  state.apiKey = apiKey;
  state.model = model;
  await chrome.storage.local.set({ apiKey, model });
  els.settingsMsg.textContent = "保存しました。";
  els.settingsMsg.className = "settings-msg ok";
  els.settingsMsg.hidden = false;
  setTimeout(closeSettings, 700);
}

async function loadSettings() {
  const { apiKey, model, tone } = await chrome.storage.local.get([
    "apiKey",
    "model",
    "tone",
  ]);
  state.apiKey = apiKey || "";
  state.model = model || DEFAULT_MODEL;
  state.tone = TONES[tone] ? tone : DEFAULT_TONE;
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
  els.backBtn.addEventListener("click", closeSettings);
  els.saveSettingsBtn.addEventListener("click", saveSettings);
  els.sourceLang.addEventListener("click", () => cycleDirection("source"));
  els.targetLang.addEventListener("click", () => cycleDirection("target"));
  els.swapBtn.addEventListener("click", swapDirection);
  // チップは動的生成のためコンテナへ委譲
  els.toneSelect.addEventListener("click", (e) => {
    const btn = e.target.closest(".tone-btn");
    if (btn) setTone(btn.dataset.tone);
  });
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
    if (changes.pendingText && changes.pendingText.newValue) consumePendingText();
  });
}

// ===== 初期化 =====
(async function init() {
  await loadSettings();
  renderDirection();
  renderToneButtons();
  renderTone();
  bindEvents();
  setOutput("", true);
  await consumePendingText();
})();
