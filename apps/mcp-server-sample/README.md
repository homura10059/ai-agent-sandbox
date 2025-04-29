# テキスト要約 MCP サーバーサンプル

このプロジェクトは、テキスト要約機能を提供するMCPサーバーのサンプル実装です。外部APIを使用せず、シンプルなアルゴリズムでテキスト要約を行います。

## 機能

- テキストを要約する `summarize_text` ツールを提供
- 文の重要度をスコアリングして要約を生成
- 要約に含める文の数をカスタマイズ可能

## 要約アルゴリズム

このサーバーは以下のシンプルなアルゴリズムでテキスト要約を行います：

1. テキストを文に分割
2. 各文の重要度をスコアリング
   - 単語の頻度に基づくスコア
   - 文の長さに基づくスコア
   - 文の位置に基づくスコア（冒頭と結論部分の文は重要度が高い）
3. スコアの高い文を選択して要約を生成

## インストール

```bash
# 依存関係のインストール
pnpm install
```

## ビルド

```bash
# TypeScriptのコンパイル
pnpm run build
```

## 実行

```bash
# ビルド済みのJavaScriptを実行
pnpm run start

# または開発モードで実行（TypeScriptを直接実行）
pnpm run dev
```

## MCPサーバーの設定

このMCPサーバーをClaudeで使用するには、以下の設定をMCP設定ファイルに追加します：

```json
{
  "mcpServers": {
    "text-summarizer": {
      "command": "node",
      "args": ["/path/to/mcp-server-sample/dist/index.js"],
      "env": {}
    }
  }
}
```

## 使用例

MCPサーバーが設定されると、Claudeは以下のようにテキスト要約ツールを使用できます：

```
<use_mcp_tool>
<server_name>text-summarizer</server_name>
<tool_name>summarize_text</tool_name>
<arguments>
{
  "text": "要約したいテキストをここに入力します。これは長い文章の例です。複数の文を含むテキストを入力すると、重要な文だけが抽出されて要約が生成されます。文の重要度は単語の頻度、文の長さ、文の位置などに基づいて計算されます。",
  "max_sentences": 2
}
</arguments>
</use_mcp_tool>
```

## ライセンス

ISC
