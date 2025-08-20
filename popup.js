// Popup script - handles button clicks
document.getElementById('exportSession').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      {action: 'export'},
      (response) => {
        showStatus(response);
      }
    );
  });
});

function showStatus(response) {
  const statusDiv = document.getElementById('status');
  if (response && response.success) {
    statusDiv.className = 'success';
    statusDiv.textContent = `✓ Exported: ${response.message}`;
  } else {
    statusDiv.className = 'error';
    statusDiv.textContent = `✗ Error: ${response ? response.error : 'No response'}`;
  }
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}