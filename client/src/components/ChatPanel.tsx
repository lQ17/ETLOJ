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
import { vs, vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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

/** 距底部小于此值视为「贴底」，流式输出时自动跟随 */
const NEAR_BOTTOM_PX = 96;

interface ChatPanelProps {
  problemId: number;
  currentCode: string;
  problemTitle: string;
  problemDifficulty: string;
  currentLanguage: string;
}

const quickActions = [
  { icon: <IconBulb />, label: '解题思路', message: '请给我这道题的解题思路提示，不要直接给答案', description: '获取当前题目的解题思路与算法提示（不直接给答案）。适合看懂题目后长时间没有思路的时候使用。' },
  { icon: <IconThunderbolt />, label: '检查代码', message: '请帮我检查当前代码中可能存在的问题', description: 'AI获取并分析当前编辑器实时代码。适合自己无法排查到bug或边界逻辑错误时使用。' },
  { icon: <IconClockCircle />, label: '优化建议', message: '请分析我代码的时间复杂度，有什么优化方向？', description: '分析代码的时间与空间复杂度，提供优化方向。适合题目出现TLE、MLE，又不知道如何优化时使用。' },
  { icon: <IconRefresh />, label: '分析错误', message: '请帮我分析最近一次提交的错误原因', description: 'AI获取最后一次提交的评测结果，定位 WA/RE/TLE 等错误的原因。适合提交后出现无法分析出的错误时使用。' },
];

function codeComponent(problemDifficulty: string, isDark: boolean) {
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
          style={isDark ? vscDarkPlus : vs}
          language={match[1]}
          PreTag="div"
          customStyle={{
            margin: 0,
            background: isDark ? 'var(--color-bg-1)' : '#ffffff',
            borderRadius: 0,
            padding: '12px 16px',
            fontSize: '14px'
          }}
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

function renderMessageParts(text: string, problemDifficulty: string, isStreaming: boolean, isDark: boolean) {
  const parts = text.split(/(<think>[\s\S]*?<\/think>)/);
  const hasOpenThink = isStreaming && text.includes('<think>') && !text.includes('</think>');

  return parts.map((part, i) => {
    const thinkMatch = part.match(/^<think>([\s\S]*?)<\/think>$/);
    if (thinkMatch) {
      return (
        <details key={i} className="ai-think-block">
          <summary className="ai-think-summary">思考过程</summary>
          <div className="ai-think-content">{thinkMatch[1].trim()}</div>
        </details>
      );
    }

    if (hasOpenThink && part.startsWith('<think>') && !part.includes('</think>')) {
      const thinking = part.replace(/^<think>\n?/, '');
      return (
        <details key={i} className="ai-think-block" open>
          <summary className="ai-think-summary">正在思考...</summary>
          <div className="ai-think-content">{thinking}</div>
        </details>
      );
    }

    if (!part.trim()) return null;
    return (
      <ReactMarkdown
        key={i}
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{ code: codeComponent(problemDifficulty, isDark) }}
      >
        {part}
      </ReactMarkdown>
    );
  });
}

export default function ChatPanel({ problemId, currentCode, problemTitle, problemDifficulty, currentLanguage }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  /** 用户是否贴在底部；上滑查看历史时为 false，不再强行滚底 */
  const stickToBottomRef = useRef(true);
  /** 下一请求是否为「重新生成」（写入 transport body） */
  const regenerateRef = useRef(false);

  const [remaining, setRemaining] = useState<{ remaining: number; limit: number; unlimited: boolean } | null>(null);
  const [input, setInput] = useState('');
  const [promptConfigs, setPromptConfigs] = useState<{ id: number; name: string; isActive: boolean }[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<number | undefined>(undefined);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return document.body.getAttribute('arco-theme') === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const currentTheme = document.body.getAttribute('arco-theme') === 'dark' ? 'dark' : 'light';
      setTheme(currentTheme);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['arco-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const token = localStorage.getItem('token') || '';

  const latestRef = useRef({ currentCode, currentLanguage, selectedPromptId } as any);
  latestRef.current = { currentCode, currentLanguage, selectedPromptId };

  const {
    messages,
    setMessages,
    sendMessage,
    regenerate,
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
        regenerate: regenerateRef.current || undefined,
      }),
    }),
    onError: (err) => {
      regenerateRef.current = false;
      Message.error(err.message || 'AI 服务暂时不可用');
    },
    onFinish: () => {
      regenerateRef.current = false;
      loadRemaining();
    },
  });

  const isLoading = status === 'streaming' || status === 'submitted';
  const quotaExhausted = remaining !== null && remaining.remaining === 0 && !remaining.unlimited;

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
        // 载入历史后滚到底部
        stickToBottomRef.current = true;
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

  // 智能滚动：仅在贴底时跟随；用户上滑阅读历史时不打断
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance <= NEAR_BOTTOM_PX;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading, error]);

  const doSend = (text: string) => {
    if (!text.trim() || isLoading || quotaExhausted) return;
    stickToBottomRef.current = true;
    regenerateRef.current = false;
    sendMessage({ text });
    setInput('');
  };

  const handleRegenerate = async () => {
    if (isLoading || quotaExhausted) return;
    const hasUser = messages.some((m) => m.role === 'user');
    if (!hasUser) {
      Message.warning('没有可重新生成的对话');
      return;
    }
    stickToBottomRef.current = true;
    regenerateRef.current = true;
    try {
      await regenerate();
    } catch {
      regenerateRef.current = false;
    }
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

  const getMessageText = (m: typeof messages[number]): string => {
    if (m.parts && m.parts.length > 0) {
      return m.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
    }
    return '';
  };

  // 最后一条「有内容」的助手消息可显示重新生成
  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && getMessageText(messages[i])) {
        return messages[i].id;
      }
    }
    return null;
  })();

  const canRegenerate =
    !isLoading &&
    !quotaExhausted &&
    messages.some((m) => m.role === 'user');

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
        onScroll={handleScroll}
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
          </div>
        )}

        {messages.map((m) => {
          const text = getMessageText(m);
          if (!text) return null;
          const isLastAssistant = m.role === 'assistant' && m.id === lastAssistantId;
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 4,
              }}
            >
              <div
                className={m.role === 'user' ? 'ai-chat-bubble-user' : 'ai-chat-bubble-assistant'}
              >
                {m.role === 'user' ? (
                  <span>{text}</span>
                ) : (
                  <div className="problem-markdown ai-chat-message" style={{ fontSize: 14 }}>
                    {renderMessageParts(
                      text,
                      problemDifficulty,
                      isLoading && m.id === messages[messages.length - 1].id,
                      theme === 'dark'
                    )}
                  </div>
                )}
              </div>
              {isLastAssistant && canRegenerate && (
                <Button
                  type="text"
                  size="mini"
                  icon={<IconRefresh />}
                  onClick={handleRegenerate}
                  style={{ color: 'var(--color-text-3)', padding: '0 4px' }}
                >
                  重新生成
                </Button>
              )}
            </div>
          );
        })}

        {isLoading && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="ai-chat-bubble-assistant" style={{ fontSize: 14 }}>
              <span className="ai-typing-indicator">思考中</span>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--color-danger-light-1)', color: 'var(--color-danger)',
            fontSize: 13, textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <span>⚠️ {error.message || 'AI 服务暂时不可用，请稍后重试'}</span>
            {canRegenerate && (
              <Button
                size="mini"
                type="outline"
                status="danger"
                icon={<IconRefresh />}
                onClick={handleRegenerate}
              >
                重试
              </Button>
            )}
          </div>
        )}
      </div>

      {/* 快捷操作与代码关联状态栏 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 16px 8px 16px',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-fill-1)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--color-text-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-success)',
              boxShadow: '0 0 4px var(--color-success)',
            }} />
            <span>已实时关联当前编辑器代码 ({currentLanguage})</span>
          </div>
          {currentCode?.trim() ? (
            <span>约 {currentCode.length} 字符</span>
          ) : (
            <span style={{ color: 'var(--color-warning)' }}>当前编辑器无代码</span>
          )}
        </div>

        <div
          className="ai-chat-quick-actions"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 2,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {quickActions.map((action, i) => (
            <Tooltip
              key={i}
              content={action.description}
              triggerProps={{ className: 'ai-chat-tooltip' }}
            >
              <Button
                size="mini"
                type="secondary"
                shape="round"
                icon={action.icon}
                disabled={isLoading || quotaExhausted}
                style={{
                  flexShrink: 0,
                  fontSize: 12,
                  padding: '2px 10px',
                  background: 'var(--color-fill-2)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
                onClick={() => handleQuickAction(action.message)}
              >
                {action.label}
              </Button>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* 输入区 */}
      <form
        onSubmit={handleFormSubmit}
        style={{
          display: 'flex', gap: 8, padding: '8px 16px 12px 16px',
          alignItems: 'flex-end',
          flexShrink: 0,
        }}
      >
        <Input.TextArea
          value={input}
          onChange={setInput}
          onKeyDown={handleKeyDown}
          placeholder={quotaExhausted
            ? '今日使用次数已用完，明天再来吧...'
            : '描述你遇到的问题...（Shift+Enter 换行）'}
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{
            flex: 1, resize: 'none', borderRadius: 12,
            fontFamily: 'inherit', fontSize: 14,
          }}
          disabled={quotaExhausted}
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
            disabled={!input.trim() || quotaExhausted}
            style={{ flexShrink: 0 }}
          />
        )}
      </form>
    </div>
  );
}
