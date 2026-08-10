import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Message,
  Space,
  Tag,
  Typography,
} from "@arco-design/web-react";
import { IconLock } from "@arco-design/web-react/icon";
import { useSearchParams } from "react-router-dom";
import { mcpOAuthApi } from "../../api/mcp-oauth";

const { Title, Paragraph, Text } = Typography;
const scopeDescriptions: Record<string, string> = {
  "problems:read": "读取你对公开题目的完成状态",
  "submissions:read": "读取你自己的公开题提交摘要（不返回源代码正文）",
};

export default function McpAuthorizePage() {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const scopes = useMemo(
    () =>
      (params.get("scope") || "problems:read submissions:read")
        .split(/\s+/)
        .filter(Boolean),
    [params],
  );

  const decide = async (approved: boolean) => {
    setLoading(true);
    try {
      const body: Record<string, string | boolean> = { approved };
      for (const key of [
        "response_type",
        "client_id",
        "redirect_uri",
        "code_challenge",
        "code_challenge_method",
        "resource",
        "scope",
        "state",
      ]) {
        const value = params.get(key);
        if (value !== null) body[key] = value;
      }
      const result = await mcpOAuthApi.authorize(body);
      window.location.assign(result.redirect_uri);
    } catch (error: unknown) {
      const message =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "授权请求无效或已失效";
      Message.error(message);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title heading={3}>
              <IconLock /> 授权 ETLOJ Remote MCP
            </Title>
            <Paragraph>
              MCP 客户端{" "}
              <Text code>{params.get("client_id") || "未知客户端"}</Text>{" "}
              请求以你的身份读取以下学习数据。
            </Paragraph>
          </div>
          <Space direction="vertical" style={{ width: "100%" }}>
            {scopes.map((scope) => (
              <Card key={scope} size="small">
                <Tag color="arcoblue">{scope}</Tag>
                <span style={{ marginLeft: 12 }}>
                  {scopeDescriptions[scope] || "未知权限"}
                </span>
              </Card>
            ))}
          </Space>
          <Paragraph type="secondary">
            授权令牌只绑定到 ETLOJ 个人 MCP
            地址；客户端不能选择其他用户。你可撤销令牌，访问令牌过期后需刷新或重新授权。
          </Paragraph>
          <Space style={{ justifyContent: "flex-end", width: "100%" }}>
            <Button disabled={loading} onClick={() => decide(false)}>
              拒绝
            </Button>
            <Button
              type="primary"
              loading={loading}
              onClick={() => decide(true)}
            >
              允许访问
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
