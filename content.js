// Content script - SEQUENTIAL VERSION
console.log('[Claude Session Exporter] Sequential Version Loaded');

// Listen for export commands from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'export') {
    exportSession()
      .then(result => sendResponse({success: true, message: result}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
});

async function exportSession() {
  try {
    let title = 'claude-session';
    const titleElement = document.querySelector('title');
    if (titleElement && titleElement.textContent) {
      title = titleElement.textContent.replace('- Claude', '').trim();
    }
    
    // ファイル名に使えない文字を置換
    title = title.replace(/[<>:"/\\|?*]/g, '-').substring(0, 100).trim() || 'claude-session';
    const filename = `${title}_session.md`;
    
    const messages = await collectMessages();
    
    if (messages.length === 0) {
      throw new Error('No messages found. Please make sure you are on a Claude.ai conversation page.');
    }
    
    let markdown = `# ${title}\n\n`;
    markdown += `*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`;
    
    for (const msg of messages) {
      markdown += `## ${msg.role}\n\n`;
      if (msg.content) {
        markdown += msg.content + '\n\n';
      }
      if (msg.images && msg.images.length > 0) {
        markdown += `*[画像: ${msg.images.length}件あり]*\n\n`;
      }
      markdown += '---\n\n';
    }
    
    const blob = new Blob([markdown], {type: 'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'download',
        downloads: [
          {
            url: url,
            filename: filename  // フォルダなし、ファイル名のみ
          }
        ]
      }, response => {
        URL.revokeObjectURL(url);
        if (response && response.success) {
          const imageCount = messages.reduce((count, msg) => count + (msg.images ? msg.images.length : 0), 0);
          resolve(`${filename} (${messages.length} messages${imageCount > 0 ? `, ${imageCount} images noted` : ''})`);
        } else {
          reject(new Error(response ? response.error : 'Download failed'));
        }
      });
    });
    
  } catch (error) {
    console.error('[Claude Session Exporter] Error:', error);
    throw error;
  }
}

// メッセージを収集
async function collectMessages() {
  const messages = [];
  
  // メインコンテナを取得
  const mainContainer = document.querySelector('div.flex-1.flex.flex-col.gap-3.px-4.max-w-3xl.mx-auto.w-full');
  if (!mainContainer) {
    console.error('[Claude Session Exporter] Main container not found');
    return messages;
  }
  
  // すべてのメッセージ要素を取得
  const userMessages = Array.from(mainContainer.querySelectorAll('[data-testid="user-message"]'));
  const assistantMessages = Array.from(mainContainer.querySelectorAll('.font-claude-response'))
    .filter(el => !el.querySelector('[data-testid="user-message"]'));
  
  console.log(`Found: ${userMessages.length} user messages, ${assistantMessages.length} assistant messages`);
  
  // すべての要素をDOM順序でソート
  const allMessages = [
    ...userMessages.map(el => ({element: el, type: 'user'})),
    ...assistantMessages.map(el => ({element: el, type: 'assistant'}))
  ];
  
  allMessages.sort((a, b) => {
    const pos = a.element.compareDocumentPosition(b.element);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
  
  // 各メッセージを処理
  for (const item of allMessages) {
    if (item.type === 'user') {
      messages.push({
        role: 'User',
        content: processUserMessage(item.element),
        images: extractImages(item.element)
      });
    } else if (item.type === 'assistant') {
      messages.push({
        role: 'Assistant',
        content: processAssistantMessage(item.element),
        images: extractImages(item.element)
      });
    }
  }
  
  console.log(`[Claude Session Exporter] Collected ${messages.length} messages`);
  return messages;
}

// ユーザーメッセージを処理
function processUserMessage(element) {
  const clone = element.cloneNode(true);
  
  // UI要素を削除
  removeUIElements(clone);
  
  // 画像とコードブロックを削除
  clone.querySelectorAll('img, picture, pre').forEach(el => el.remove());
  
  return htmlToMarkdown(clone);
}

// アシスタントメッセージを処理（コードブロックを正しい位置で維持）
function processAssistantMessage(element) {
  const result = [];
  
  // すべての子要素を順番に処理
  const processChildren = (parent) => {
    const children = Array.from(parent.childNodes);
    
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.trim();
        if (text) {
          result.push(text);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        // コードブロックのコンテナかチェック
        if (child.classList && child.classList.contains('relative') && 
            child.classList.contains('group/copy')) {
          // コードブロックを処理
          const pre = child.querySelector('pre.code-block__code');
          if (pre) {
            const codeText = (pre.textContent || pre.innerText || '').trim();
            if (codeText) {
              let language = '';
              const codeElement = pre.querySelector('code');
              if (codeElement && codeElement.className) {
                const langMatch = codeElement.className.match(/language-(\w+)/);
                if (langMatch) {
                  language = langMatch[1];
                }
              }
              result.push(`\n\n\`\`\`${language}\n${codeText}\n\`\`\`\n\n`);
            }
          }
        } else if (child.querySelector && child.querySelector('pre.code-block__code')) {
          // 子要素にコードブロックがある場合
          processChildren(child);
        } else {
          // 通常のテキスト要素
          const tagName = child.tagName ? child.tagName.toLowerCase() : '';
          
          // UIボタンなどをスキップ
          if (child.classList && (
            child.classList.contains('copy-button') ||
            child.classList.contains('toolbar') ||
            child.classList.contains('actions')
          )) {
            continue;
          }
          
          switch (tagName) {
            case 'p':
              const pText = processInlineElements(child);
              if (pText) result.push(pText + '\n\n');
              break;
            case 'ul':
            case 'ol':
              const listText = processList(child, tagName === 'ol');
              if (listText) result.push(listText + '\n');
              break;
            case 'blockquote':
              const quoteText = processBlockquote(child);
              if (quoteText) result.push(quoteText + '\n\n');
              break;
            case 'div':
              processChildren(child);
              break;
            default:
              const text = processInlineElements(child);
              if (text) result.push(text);
          }
        }
      }
    }
  };
  
  processChildren(element);
  
  return result.join('').trim();
}

// インライン要素を処理
function processInlineElements(element) {
  let text = '';
  
  const processNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      
      switch (tag) {
        case 'strong':
        case 'b':
          text += '**' + node.textContent + '**';
          break;
        case 'em':
        case 'i':
          text += '*' + node.textContent + '*';
          break;
        case 'code':
          if (!node.parentElement || node.parentElement.tagName.toLowerCase() !== 'pre') {
            text += '`' + node.textContent + '`';
          }
          break;
        case 'a':
          const href = node.getAttribute('href');
          if (href && !href.startsWith('javascript:')) {
            text += `[${node.textContent}](${href})`;
          } else {
            text += node.textContent;
          }
          break;
        default:
          for (const child of node.childNodes) {
            processNode(child);
          }
      }
    }
  };
  
  for (const child of element.childNodes) {
    processNode(child);
  }
  
  return text.trim();
}

// リストを処理
function processList(element, isOrdered) {
  const items = element.querySelectorAll(':scope > li');
  let result = '';
  
  items.forEach((li, index) => {
    const bullet = isOrdered ? `${index + 1}. ` : '* ';
    result += bullet + processInlineElements(li) + '\n';
  });
  
  return result;
}

// 引用を処理
function processBlockquote(element) {
  const lines = processInlineElements(element).split('\n');
  return lines.map(line => '> ' + line).join('\n');
}

// UI要素を削除
function removeUIElements(element) {
  const uiElements = element.querySelectorAll(
    'button, [class*="edit"], [class*="copy"], svg, [class*="toolbar"], ' +
    '[class*="actions"], [role="button"], [class*="hover"], [class*="tooltip"]'
  );
  uiElements.forEach(el => el.remove());
}

// HTML to Markdown（シンプル版）
function htmlToMarkdown(element) {
  let markdown = '';
  
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      let content = '';
      
      for (const child of node.childNodes) {
        content += processNode(child);
      }
      
      switch (tagName) {
        case 'p':
        case 'div':
          return content.trim() ? content + '\n\n' : '';
        case 'br':
          return '\n';
        default:
          return content;
      }
    }
    return '';
  }
  
  for (const child of element.childNodes) {
    markdown += processNode(child);
  }
  
  return markdown.replace(/\n{4,}/g, '\n\n\n').replace(/ +$/gm, '').trim();
}

// Extract images
function extractImages(element) {
  const images = [];
  const imgElements = element.querySelectorAll('img');
  
  imgElements.forEach(img => {
    if (img.src && img.src.includes('/api/') && img.src.includes('/files/')) {
      images.push(img.src);
    }
  });
  
  return images;
}

console.log('[Claude Session Exporter] Ready to export sessions');