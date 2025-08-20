// Background script for handling downloads
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    handleDownload(request.downloads[0])
      .then(() => sendResponse({success: true}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true; // Keep message channel open for async
  }
});

async function handleDownload(download) {
  try {
    // Markdownファイルをダウンロード
    await chrome.downloads.download({
      url: download.url,
      filename: download.filename,
      saveAs: true
    });
    return true;
  } catch (error) {
    console.error('[Claude Session Exporter] Failed to download:', error);
    throw error;
  }
}