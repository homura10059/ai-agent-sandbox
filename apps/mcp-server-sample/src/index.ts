#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * テキスト要約のためのシンプルなアルゴリズム
 * 1. テキストを文に分割
 * 2. 各文の重要度をスコアリング
 * 3. スコアの高い文を選択して要約を生成
 */
class TextSummarizer {
  /**
   * テキストを要約する
   * @param text 要約するテキスト
   * @param maxSentences 要約に含める最大文数
   * @returns 要約されたテキスト
   */
  summarize(text: string, maxSentences = 3): string {
    // テキストを文に分割
    const sentences = this.splitIntoSentences(text);
    
    if (sentences.length <= maxSentences) {
      return text; // 文の数が指定された最大数以下の場合は全文を返す
    }
    
    // 単語の頻度を計算
    const wordFrequency = this.calculateWordFrequency(text);
    
    // 各文のスコアを計算
    const sentenceScores = sentences.map((sentence, index) => {
      const score = this.scoreSentence(sentence, wordFrequency, index, sentences.length);
      return { sentence, score, index };
    });
    
    // スコアの高い順に文を選択
    const topSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .sort((a, b) => a.index - b.index); // 元の順序に戻す
    
    // 選択された文を結合して要約を生成
    return topSentences.map(item => item.sentence).join(' ');
  }
  
  /**
   * テキストを文に分割する
   */
  private splitIntoSentences(text: string): string[] {
    // 簡単な文分割（ピリオド、疑問符、感嘆符で分割）
    return text
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .filter(sentence => sentence.trim().length > 0);
  }
  
  /**
   * テキスト内の単語の頻度を計算する
   */
  private calculateWordFrequency(text: string): Map<string, number> {
    const words = text.toLowerCase()
      .replace(/[.,!?;:()\[\]{}'"]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    const frequency = new Map<string, number>();
    
    for (const word of words) {
      const count = frequency.get(word) || 0;
      frequency.set(word, count + 1);
    }
    
    return frequency;
  }
  
  /**
   * 文のスコアを計算する
   * @param sentence スコアリングする文
   * @param wordFrequency 単語の頻度マップ
   * @param index 文のインデックス
   * @param totalSentences 全文の数
   */
  private scoreSentence(
    sentence: string, 
    wordFrequency: Map<string, number>,
    index: number,
    totalSentences: number
  ): number {
    // 単語の頻度に基づくスコア
    const words = sentence.toLowerCase()
      .replace(/[.,!?;:()\[\]{}'"]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    let frequencyScore = 0;
    for (const word of words) {
      frequencyScore += wordFrequency.get(word) || 0;
    }
    
    // 文の長さに基づくスコア（短すぎる文や長すぎる文は重要度を下げる）
    const lengthScore = Math.min(words.length, 20) / 20;
    
    // 文の位置に基づくスコア（冒頭と結論部分の文は重要度を上げる）
    const positionScore = 
      index === 0 || index === totalSentences - 1 ? 1.5 : 
      index < totalSentences * 0.2 || index > totalSentences * 0.8 ? 1.2 : 
      1.0;
    
    // 総合スコア
    return (frequencyScore * 0.5 + lengthScore * 0.3) * positionScore;
  }
}

/**
 * MCPサーバーの実装
 */
class TextProcessingServer {
  private server: Server;
  private summarizer: TextSummarizer;

  constructor() {
    this.server = new Server(
      {
        name: 'text-processing-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.summarizer = new TextSummarizer();
    
    this.setupToolHandlers();
    
    // エラーハンドリング
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * ツールハンドラーの設定
   */
  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'summarize_text',
          description: 'テキストを要約するツール',
          inputSchema: {
            type: 'object',
            properties: {
              text: {
                type: 'string',
                description: '要約するテキスト',
              },
              max_sentences: {
                type: 'number',
                description: '要約に含める最大文数（デフォルト: 3）',
                minimum: 1,
                maximum: 10,
              },
            },
            required: ['text'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'summarize_text') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      const args = request.params.arguments as {
        text?: string;
        max_sentences?: number;
      };
      
      if (typeof args !== 'object' || args === null || typeof args.text !== 'string') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid arguments: text parameter is required and must be a string'
        );
      }

      const maxSentences = typeof args.max_sentences === 'number' 
        ? Math.min(Math.max(1, args.max_sentences), 10) 
        : 3;

      try {
        const summary = this.summarizer.summarize(args.text, maxSentences);
        
        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error summarizing text: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * サーバーを実行する
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Text Processing MCP server running on stdio');
  }
}

// サーバーのインスタンスを作成して実行
const server = new TextProcessingServer();
server.run().catch(console.error);
