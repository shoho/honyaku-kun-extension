// アイコンクリックでサイドパネルを開く設定
chrome.runtime.onInstalled.addListener(() => {
  // 右クリックメニュー: 選択テキストを翻訳くんで開く
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "「%s」を翻訳くんで翻訳",
    contexts: ["selection"],
  });
});

// ツールバーアイコンをクリックしたらサイドパネルを開く
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

// 右クリックメニューから翻訳
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "translate-selection" && info.selectionText) {
    // 選択テキストを保存してからパネルを開く（パネル側が読み取って翻訳する）
    await chrome.storage.local.set({ pendingText: info.selectionText });
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
