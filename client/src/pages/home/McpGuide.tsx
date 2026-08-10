import { useState } from "react";
import { Button, Message, Typography } from "@arco-design/web-react";
import {
  IconCheck,
  IconCode,
  IconCopy,
  IconQuestionCircle,
  IconRobot,
} from "@arco-design/web-react/icon";

const { Title, Paragraph, Text } = Typography;

const MCP_URL = "https://etloj.space/mcp";
const PRIVATE_MCP_URL = "https://etloj.space/mcp/private";
const MCP_CONFIG = `{
  "mcpServers": {
    "etloj": {
      "url": "${MCP_URL}"
    },
    "etloj-personal": {
      "url": "${PRIVATE_MCP_URL}"
    }
  }
}`;

function HighlightedJsonLine({ line }: { line: string }) {
  const tokens = line
    .split(/("(?:\\.|[^"\\])*"|[{}[\],:])/g)
    .filter(Boolean);
  return tokens.map((token, index) => {
    if (/^"/.test(token)) {
      const nextToken = tokens
        .slice(index + 1)
        .find((candidate) => candidate.trim());
      return (
        <span
          key={index}
          className={
            nextToken === ":" ? "mcp-code-key" : "mcp-code-string"
          }
        >
          {token}
        </span>
      );
    }
    if (/^[{}[\],:]$/.test(token)) {
      return (
        <span key={index} className="mcp-code-punctuation">
          {token}
        </span>
      );
    }
    return token;
  });
}

const AGENT_INSTALL_PROMPT =
  "请帮我将 ETLOJ Remote MCP 接入当前 Agent 客户端。公开只读地址是 https://etloj.space/mcp；如需读取我的学习进度，请使用支持 OAuth 的登录地址 https://etloj.space/mcp/private。传输方式使用 Streamable HTTP。请完成连接和工具验证，并在浏览器授权时提醒我确认。";

const useCases = [
  {
    title: "制定刷题路线",
    prompt:
      "使用 ETLOJ MCP 查看当前有哪些算法标签，然后推荐 5 道适合学习二分查找的入门题，并说明推荐顺序。",
  },
  {
    title: "分析一道题目",
    prompt:
      "使用 ETLOJ MCP 读取题目「题目编号或 slug」，帮我整理输入输出、数据范围和解题突破口，但先不要直接给出完整代码。",
  },
  {
    title: "制定个人学习计划",
    prompt:
      "使用 ETLOJ MCP 读取一个公开题单，再查询我对其中题目的完成状态和近期提交，按未尝试、已尝试未通过、已通过整理下一周学习计划。",
  },
];

const tools = [
  ["list_tags", "查看公开题目使用的标签及题目数量"],
  ["search_problems", "按关键词、难度和标签搜索公开题目"],
  ["get_problem", "读取题面、难度、标签和运行限制"],
  ["get_problem_markdown", "获取题目的原始 Markdown 内容"],
  ["list_problem_lists", "搜索公开题单（隐藏题不影响计数）"],
  ["get_problem_list", "读取公开题单中的公开题目"],
  ["get_my_problem_status", "登录后查询自己的题目三态进度"],
  ["list_my_submissions", "登录后分页查询自己的提交摘要"],
  ["get_submission", "登录后读取自己的最小化提交详情"],
];

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    Message.success(successMessage);
  } catch {
    Message.error("复制失败，请手动复制");
  }
}

export default function McpGuide() {
  const [showTools, setShowTools] = useState(false);

  return (
    <section className="mcp-guide" aria-labelledby="mcp-guide-title">
      <div className="mcp-guide-heading">
        <div>
          <div className="mcp-guide-eyebrow">
            <IconRobot /> Remote MCP
          </div>
          <Title id="mcp-guide-title" heading={2} className="mcp-guide-title">
            让你的 Agent 连接 ETLOJ 题库
          </Title>
          <Paragraph className="mcp-guide-subtitle">
            匿名连接可搜索公开题库与题单；OAuth
            登录后还可安全读取你自己的学习进度。
          </Paragraph>
        </div>
        <div className="mcp-guide-status">
          <span className="mcp-guide-status-dot" />
          公开只读 · 个人数据需授权
        </div>
      </div>

      <div className="mcp-guide-agent-install">
        <div className="mcp-guide-agent-install-icon">
          <IconRobot />
        </div>
        <div className="mcp-guide-agent-install-content">
          <div className="mcp-guide-agent-install-label">
            最快方式 · 交给 Agent
          </div>
          <strong>把下面这句话直接发给你的 Agent</strong>
          <p>“{AGENT_INSTALL_PROMPT}”</p>
        </div>
        <Button
          className="mcp-guide-agent-install-copy"
          type="primary"
          icon={<IconCopy />}
          onClick={() => copyText(AGENT_INSTALL_PROMPT, "自动接入提示词已复制")}
        >
          复制接入提示词
        </Button>
      </div>

      <div className="mcp-guide-connect-grid">
        <div className="mcp-guide-card">
          <div className="mcp-guide-card-title">
            <span className="mcp-guide-card-icon">
              <IconCode />
            </span>
            通用接入方法
          </div>
          <ol className="mcp-guide-steps">
            <li>
              <span>1</span>
              <div>
                <strong>打开 MCP 设置</strong>
                <small>在你的 Agent 或客户端中找到 MCP / 工具设置。</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>新增远程服务</strong>
                <small>名称填写 ETLOJ，传输方式选择 Streamable HTTP。</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>填写服务地址</strong>
                <small>保存配置，然后刷新或重新连接工具列表。</small>
              </div>
            </li>
          </ol>

          <div className="mcp-guide-url-row">
            <code>{MCP_URL}</code>
            <Button
              type="text"
              size="small"
              icon={<IconCopy />}
              aria-label="复制 MCP 服务地址"
              onClick={() => copyText(MCP_URL, "MCP 地址已复制")}
            >
              复制
            </Button>
          </div>
        </div>

        <div className="mcp-guide-card mcp-guide-config-card">
          <div className="mcp-guide-card-title">
            <span className="mcp-guide-card-icon">
              <IconCode />
            </span>
            常见配置示例
          </div>
          <div className="mcp-guide-code-wrap">
            <div className="mcp-guide-code-toolbar">
              <div className="mcp-guide-code-file">
                <IconCode />
                <span>settings.json</span>
                <span className="mcp-guide-code-badge">JSON</span>
              </div>
              <Button
                className="mcp-guide-copy-config"
                type="text"
                size="small"
                icon={<IconCopy />}
                aria-label="复制 MCP 配置"
                onClick={() => copyText(MCP_CONFIG, "配置已复制")}
              >
                复制
              </Button>
            </div>
            <pre>
              <code aria-label="ETLOJ MCP JSON 配置示例">
                {MCP_CONFIG.split("\n").map((line, index) => (
                  <span className="mcp-guide-code-line" key={index}>
                    <span className="mcp-guide-code-line-number">
                      {index + 1}
                    </span>
                    <span className="mcp-guide-code-line-content">
                      <HighlightedJsonLine line={line} />
                    </span>
                  </span>
                ))}
              </code>
            </pre>
          </div>
          <Text className="mcp-guide-note">
            公开地址无需 API Key。个人地址要求客户端支持 MCP OAuth；连接后会打开
            ETLOJ 登录与授权页，令牌无需手工复制。
          </Text>
          <button
            type="button"
            className="mcp-guide-tools-toggle"
            aria-expanded={showTools}
            onClick={() => setShowTools((value) => !value)}
          >
            {showTools ? "收起工具列表" : "查看当前可用工具"}
            <span aria-hidden="true">{showTools ? "−" : "+"}</span>
          </button>
          {showTools && (
            <div className="mcp-guide-tools">
              {tools.map(([name, description]) => (
                <div key={name} className="mcp-guide-tool">
                  <code>{name}</code>
                  <span>{description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mcp-guide-examples-heading">
        <div>
          <Title heading={3}>接入后，可以这样问</Title>
          <Paragraph>
            直接描述目标，Agent 会自行选择并调用合适的 ETLOJ 工具。
          </Paragraph>
        </div>
      </div>

      <div className="mcp-guide-examples">
        {useCases.map((item, index) => (
          <article key={item.title} className="mcp-guide-example">
            <div className="mcp-guide-example-meta">
              <span>用例 {index + 1}</span>
              <strong>{item.title}</strong>
            </div>
            <blockquote>“{item.prompt}”</blockquote>
            <Button
              type="text"
              size="small"
              icon={<IconCopy />}
              onClick={() => copyText(item.prompt, "示例提问已复制")}
            >
              复制提问
            </Button>
          </article>
        ))}
      </div>

      <div className="mcp-guide-agent-tip">
        <div className="mcp-guide-tip-icon">
          <IconQuestionCircle />
        </div>
        <div>
          <strong>不知道下一步怎么用？直接问你的 Agent</strong>
          <p>
            “我已经接入 ETLOJ MCP，请检查它提供的工具，并告诉我可以如何使用。”
          </p>
        </div>
        <Button
          className="mcp-guide-tip-copy"
          icon={<IconCheck />}
          onClick={() =>
            copyText(
              "我已经接入 ETLOJ MCP，请检查它提供的工具，并告诉我可以如何使用。",
              "提问已复制",
            )
          }
        >
          复制这句话
        </Button>
      </div>
    </section>
  );
}
