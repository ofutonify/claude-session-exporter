# Claude Session Exporter 

Export Claude.ai conversations as Markdown files

## Features

- ✅ Export entire session as Markdown file
- ✅ Preserve code blocks with correct positioning
- ✅ Maintain inline code, bold, italic and other formatting
- ✅ Convert lists and quotes to Markdown format
- ✅ Organize with timestamped folders
- ✅ Choose save location

## Installation

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the extracted folder (usually named `claude-session-exporter-main`)

## Usage

1. Open the conversation you want to save on Claude.ai
2. Click the extension icon
3. Click "Export as Markdown" button
4. Choose save location and download

## Output Format

```
Title_session.md
```

Example: `Claude Session Exporter - Technical Specs_session.md`

### Markdown File Contents
- User and assistant messages
- Code blocks with language specification
- Lists, quotes, links and other formatting
- Images noted as `*[Images: n items]*`

## Notes

- If Claude.ai's DOM structure changes, selector updates may be needed
- Selectors can be adjusted in the `collectMessages()` function in content.js

## Troubleshooting

If messages are not captured correctly:
1. Open Developer Tools with F12
2. Check the selectors for Claude.ai message elements
3. Update the relevant parts in content.js

## Credits

Developed with Claude (Anthropic) through collaborative debugging and iterative development.

---

Claude.aiの会話をMarkdown形式でエクスポートする拡張機能

## 機能

- ✅ セッション全体をMarkdownファイルとして保存
- ✅ コードブロックを正しい位置で保持
- ✅ インラインコード、太字、斜体などのフォーマットを保持
- ✅ リストや引用をMarkdown形式で再現
- ✅ タイムスタンプ付きフォルダで整理
- ✅ 保存場所を選択可能

## インストール方法

1. Chromeで `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. 解凍した `claude-session-exporter-main` フォルダを選択

## 使い方

1. Claude.aiで保存したい会話を開く
2. 拡張機能アイコンをクリック
3. 「Export as Markdown」ボタンをクリック
4. 保存先を選択してダウンロード

## 出力形式

```
タイトル_session.md
```

例: `Claude Session Exporter - 技術仕様書_session.md`

### Markdownファイルの内容
- ユーザーとアシスタントのメッセージ
- コードブロック（言語指定付き）
- リスト、引用、リンクなどのフォーマット
- 画像がある場合は`*[画像: n件あり]*`と記載

## 注意事項

- Claude.aiのDOM構造が変更された場合、セレクタの更新が必要な場合があります
- content.jsの`collectMessages()`関数でセレクタを調整できます

## トラブルシューティング

メッセージが正しく取得できない場合：
1. F12で開発者ツールを開く
2. Claude.aiのメッセージ要素のセレクタを確認
3. content.jsの該当部分を更新

## クレジット

Developed with Claude (Anthropic) through collaborative debugging and iterative development.
