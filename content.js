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
  
  // メインコンテナに依存せず、document全体から取得
  const userMessages = Array.from(document.querySelectorAll('[data-testid="user-message"]'));
  
  // ツールブロックと思考ブロックを先に収集
  const toolBlocks = [];
  const thinkingBlocks = [];
  
  const allButtons = Array.from(document.querySelectorAll('button'));
  
  // ツール名ボタンを探す
  const toolButtons = allButtons.filter(btn => {
    const text = btn.textContent.trim();
    return text.match(/^[a-z_]+:[a-z_]+$|^ask_|^web_search|^web_fetch|_search$|_fetch$/i) &&
           !text.includes('Geminiの意見');
  });
  
  // 思考ボタンを探す（開いた状態：「思考プロセス」、閉じた状態：要約テキスト）
  const thinkingButtons = allButtons.filter(btn => {
    if (btn.textContent.includes('思考プロセス') || btn.textContent.includes('じっくり考え')) {
      return true;
    }
    if (btn.classList.contains('group/row') || btn.className.includes('group/row')) {
      const summarySpan = btn.querySelector('span.text-text-300');
      const container = btn.closest('div.rounded-lg');
      if (summarySpan && container && container.className.includes('ease-out')) {
        return true;
      }
    }
    return false;
  });
  
  toolButtons.forEach(btn => {
    const container = btn.closest('div.w-full.flex.flex-col') || btn.closest('div.w-full');
    if (container && !toolBlocks.some(tb => tb.element === container)) {
      toolBlocks.push({
        element: container,
        toolName: btn.textContent.trim()
      });
    }
  });
  
  // 思考ブロックを収集（rounded-lgコンテナを特定）
  thinkingButtons.forEach(btn => {
    const container = btn.closest('div.rounded-lg');
    if (container && container.className.includes('ease-out') && 
        !thinkingBlocks.some(tb => tb.element === container)) {
      thinkingBlocks.push({
        element: container
      });
    }
  });
  
  // 思考ブロックコンテナのリストを作成
  const thinkingContainers = thinkingBlocks.map(tb => tb.element);
  
  // Assistantメッセージを取得（思考ブロック内のものは除外）
  const assistantMessages = Array.from(document.querySelectorAll('.standard-markdown')).filter(el => {
    // 思考ブロックコンテナ内かチェック
    for (const container of thinkingContainers) {
      if (container.contains(el)) {
        return false; // 思考ブロック内なので除外
      }
    }
    return true;
  });
  
  console.log(`Found: ${userMessages.length} user messages, ${assistantMessages.length} assistant messages, ${toolBlocks.length} tool blocks, ${thinkingBlocks.length} thinking blocks`);
  
  // すべての要素をDOM順序でソート
  const allMessages = [
    ...userMessages.map(el => ({element: el, type: 'user'})),
    ...assistantMessages.map(el => ({element: el, type: 'assistant'})),
    ...toolBlocks.map(tb => ({element: tb.element, type: 'tool', toolName: tb.toolName})),
    ...thinkingBlocks.map(tb => ({element: tb.element, type: 'thinking'}))
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
    } else if (item.type === 'tool') {
      messages.push({
        role: `Tool: ${item.toolName}`,
        content: processToolBlock(item.element),
        images: []
      });
    } else if (item.type === 'thinking') {
      messages.push({
        role: 'Assistant Thinking',
        content: processThinkingBlock(item.element),
        images: []
      });
    }
  }
  
  console.log(`[Claude Session Exporter] Collected ${messages.length} messages`);
  return messages;
}

// ツールブロックを処理
function processToolBlock(element) {
  const codes = element.querySelectorAll('code');
  const result = [];
  
  codes.forEach((code, index) => {
    const text = code.textContent.trim();
    if (text) {
      // 最初のcodeはリクエスト、次はレスポンス
      const label = index === 0 ? '**リクエスト:**' : '**レスポンス:**';
      result.push(`${label}\n\n\`\`\`\n${text}\n\`\`\``);
    }
  });
  
  return result.join('\n\n');
}

// 思考ブロックを処理
function processThinkingBlock(element) {
  // 思考ブロック内の .standard-markdown か .font-claude-response-body を取得
  const markdown = element.querySelector('.standard-markdown');
  if (markdown) {
    return processAssistantMessage(markdown);
  }
  
  // .standard-markdown がない場合はテキスト要素を取得
  const textElements = element.querySelectorAll('.font-claude-response-body');
  if (textElements.length > 0) {
    return Array.from(textElements).map(el => el.textContent.trim()).join('\n\n');
  }
  
  // フォールバック：ボタンとcodeを除外してテキスト取得
  const clone = element.cloneNode(true);
  clone.querySelectorAll('button, code, pre').forEach(el => el.remove());
  
  let text = clone.textContent.trim();
  text = text.replace(/^思考プロセス/, '').replace(/^じっくり考え.*?\n/, '').trim();
  // 「リクエスト」「レスポンス」などのラベルも除外
  text = text.replace(/\u30ea\u30af\u30a8\u30b9\u30c8.*$/s, '').trim();
  
  return text;
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
