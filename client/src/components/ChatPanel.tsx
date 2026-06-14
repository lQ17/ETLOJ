import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { Button, Input, Tag, Tooltip, Message, Select } from '@arco-design/web-react';
import { IconSend, IconDelete, IconBulb, IconThunderbolt, IconClockCircle, IconRefresh } from '@arco-design/web-react/icon';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import { aiApi } from '../api/ai';

SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('c', c);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);

interface ChatPanelProps {
  problemId: number;
  currentCode: string;
  problemTitle: string;
  problemDifficulty: string;
  currentLanguage: string;
}

const quickActions = [
  { icon: <IconBulb />, label: '解题思路', message: '请给我这道题的解题思路提示，不要直接给答案' },
  { icon: <IconThunderbolt />, label: '检查代码', message: '请帮我检查当前代码中可能存在的问题' },
  { icon: <IconClockCircle />, label: '优化建议', message: '请分析我代码的时间复杂度，有什么优化方向？' },
  { icon: <IconRefresh />, label: '分析错误', message: '请帮我分析最近一次提交的错误原因' },
];

function codeComponent(problemDifficulty: string) {
  return function CodeBlock({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const isLowDifficulty = ['IRON', 'BRONZE', 'SILVER'].includes(problemDifficulty);

    return !inline && match ? (
      <div
        onCopy={(e) => {
          if (isLowDifficulty) {
            e.preventDefault();
            Message.warning('当前难度不允许复制 AI 提供的代码哦，请自己手敲～');
          }
        }}
        onClick={() => {
          if (isLowDifficulty) {
            Message.warning('当前难度不允许复制 AI 提供的代码哦，请自己手敲～');
          }
        }}
        style={isLowDifficulty ? { userSelect: 'none', WebkitUserSelect: 'none', cursor: 'not-allowed' } : {}}
      >
        <SyntaxHighlighter
          style={vs}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, background: '#ffffff', borderRadius: 0, padding: '12px 16px', fontSize: '14px' }}
          codeTagProps={{ style: { fontSize: '14px', fontFamily: '"Consolas", monospace' } }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };
}

function renderMessageParts(text: string, problemDifficulty: string, isStreaming: boolean) {
  const parts = text.split(/(<think>[\s\S]*?<\/think>)/);
  const hasOpenThink = isStreaming && text.includes('<think>') && !text.includes('</think>');

  return parts.map((part, i) => {
    // 完整的 think 块
    const thinkMatch = part.match(/^<think>([\s\S]*?)<\/think>$/);
    if (thinkMatch) {
      return (
        <details key={i} className="ai-think-block">
          <summary className="ai-think-summary">思考过程</summary>
          <div className="ai-think-content">{thinkMatch[1].trim()}</div>
        </details>
      );
    }

    // 流式接收中未闭合的 think 块
    if (hasOpenThink && part.startsWith('<think>') && !part.includes('</think>')) {
      const thinking = part.replace(/^<think>\n?/, '');
      return (
        <details key={i} className="ai-think-block" open>
          <summary className="ai-think-summary">正在思考...</summary>
          <div className="ai-think-content">{thinking}</div>
        </details>
      );
    }

    // 普通文本
    if (!part.trim()) return null;
    return (
      <ReactMarkdown
        key={i}
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{ code: codeComponent(problemDifficulty) }}
      >
        {part}
      </ReactMarkdown>
    );
  });
}

export default function ChatPanel({ problemId, currentCode, problemTitle, problemDifficulty, currentLanguage }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [remaining, setRemaining] = useState<{ remaining: number; limit: number; unlimited: boolean } | null>(null);
  const [input, setInput] = useState('');
  const [promptConfigs, setPromptConfigs] = useState<{ id: number; name: string; isActive: boolean }[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<number | undefined>(undefined);

  // 获取 token
  const token = localStorage.getItem('token') || '';

  const latestRef = useRef({ currentCode, currentLanguage, selectedPromptId } as any);
  latestRef.current = { currentCode, currentLanguage, selectedPromptId };

  // v3 API: 使用 TextStreamChatTransport 匹配后端的 pipeTextStreamToResponse
  const {
    messages,
    setMessages,
    sendMessage,
    stop,
    status,
    error,
  } = useChat({
    transport: new TextStreamChatTransport({
      api: '/api/ai/chat',
      headers: { Authorization: `Bearer ${token}` },
      body: () => ({
        problemId,
        currentCode: latestRef.current.currentCode,
        language: latestRef.current.currentLanguage,
        promptConfigId: latestRef.current.selectedPromptId,
      }),
    }),
    onError: (err) => {
      Message.error(err.message || 'AI 服务暂时不可用');
    },
    onFinish: () => {
      loadRemaining();
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  const loadRemaining = async () => {
    try {
      const data: any = await aiApi.getRemaining();
      setRemaining(data);
    } catch { /* ignore */ }
  };

  const loadHistory = async () => {
    try {
      const data: any = await aiApi.getHistory(problemId);
      if (Array.isArray(data) && data.length > 0) {
        setMessages(
          data.map((msg: any, index: number) => ({
            id: `hist-${index}`,
            role: msg.role,
            parts: [{ type: 'text' as const, text: msg.content }],
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load chat history', err);
    }
  };

  useEffect(() => {
    loadRemaining();
    loadHistory();
    aiApi.getPromptConfigs().then((res: any) => {
      setPromptConfigs(res);
      const active = res.find((c: any) => c.isActive);
      if (active) setSelectedPromptId(active.id);
    }).catch(() => {});
  }, [problemId]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const doSend = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage({ text });
    setInput('');
  };

  const handleQuickAction = (message: string) => {
    doSend(message);
  };

  const handleClear = async () => {
    try {
      await aiApi.clearHistory(problemId);
      setMessages([]);
      Message.success('对话已清空');
    } catch (err: any) {
      Message.error(err.response?.data?.message || '清空失败');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSend(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend(input);
    }
  };

  // 提取消息文本内容（v3 的 message 使用 parts 结构）
  const getMessageText = (m: typeof messages[number]): string => {
    if (m.parts && m.parts.length > 0) {
      return m.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
    }
    return '';
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%',
    }}>
      {/* 顶栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>🤖 AI 助手</span>
          <Tag size="small" color="arcoblue">{problemTitle}</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {promptConfigs.length > 1 && (
            <Select
              size="small"
              value={selectedPromptId}
              onChange={(v) => setSelectedPromptId(v)}
              style={{ width: 130 }}
              placeholder="选择提示词"
            >
              {promptConfigs.map(c => (
                <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
              ))}
            </Select>
          )}
          {remaining && !remaining.unlimited && (
            <Tooltip content={`每日限额 ${remaining.limit} 次`}>
              <Tag
                size="small"
                color={remaining.remaining > 10 ? 'green' : remaining.remaining > 0 ? 'orange' : 'red'}
              >
                剩余 {remaining.remaining} 次
              </Tag>
            </Tooltip>
          )}
          {messages.length > 0 && (
            <Button type="text" size="mini" icon={<IconDelete />} onClick={handleClear}>
              清空
            </Button>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div
        ref={scrollRef}
        className="ai-chat-scroll"
        style={{
          flex: 1, overflow: 'auto', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
          }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>🤖</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                你好！我是你的 AI 解题助手
              </div>
              <div style={{ color: 'var(--color-text-3)', fontSize: 14 }}>
                我会根据你的代码和提交记录给出针对性的提示
              </div>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
              width: '100%', maxWidth: 400,
            }}>
              {quickActions.map((action, i) => (
                <Button
                  key={i}
                  type="outline"
                  size="small"
                  icon={action.icon}
                  style={{
                    justifyContent: 'flex-start', height: 40,
                    borderRadius: 8, paddingLeft: 12,
                  }}
                  onClick={() => handleQuickAction(action.message)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const text = getMessageText(m);
          if (!text) return null;
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user'
                    ? 'var(--color-primary-light-1)'
                    : 'var(--color-fill-2)',
                  color: m.role === 'user' ? '#374151' : undefined,
                  fontSize: 14,
                  lineHeight: 1.7,
                  wordBreak: 'break-word',
                }}
              >
                {m.role === 'user' ? (
                  <span>{text}</span>
                ) : (
                  <div className="problem-markdown ai-chat-message" style={{ fontSize: 14 }}>
                    {renderMessageParts(text, problemDifficulty, isLoading && m.id === messages[messages.length - 1].id)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
              background: 'var(--color-fill-2)', fontSize: 14,
            }}>
              <span className="ai-typing-indicator">思考中</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--color-danger-light-1)', color: 'var(--color-danger)',
            fontSize: 13, textAlign: 'center',
          }}>
            ⚠️ {error.message || 'AI 服务暂时不可用，请稍后重试'}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <form
        onSubmit={handleFormSubmit}
        style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          borderTop: '1px solid var(--color-border)',
          alignItems: 'flex-end',
          flexShrink: 0,
        }}
      >
        <Input.TextArea
          value={input}
          onChange={setInput}
          onKeyDown={handleKeyDown}
          placeholder={remaining && remaining.remaining === 0 && !remaining.unlimited
            ? '今日使用次数已用完，明天再来吧...'
            : '描述你遇到的问题...（Shift+Enter 换行）'}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{
            flex: 1, resize: 'none', borderRadius: 12,
            fontFamily: 'inherit', fontSize: 14,
          }}
          disabled={remaining !== null && remaining.remaining === 0 && !remaining.unlimited}
        />
        {isLoading ? (
          <Button
            type="primary"
            status="warning"
            shape="circle"
            onClick={() => stop()}
            style={{ flexShrink: 0 }}
          >
            ■
          </Button>
        ) : (
          <Button
            type="primary"
            shape="circle"
            htmlType="submit"
            icon={<IconSend />}
            disabled={!input.trim() || (remaining !== null && remaining.remaining === 0 && !remaining.unlimited)}
            style={{ flexShrink: 0 }}
          />
        )}
      </form>
    </div>
  );
}
