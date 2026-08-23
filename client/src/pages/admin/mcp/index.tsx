import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  InputNumber,
  Message,
  Space,
  Typography,
} from "@arco-design/web-react";
import { IconRefresh, IconSettings } from "@arco-design/web-react/icon";
import {
  mcpAdminApi,
  type McpRateLimitConfig,
} from "../../../api/mcp-admin";

interface McpRateLimitFormValues {
  globalRateLimitMax: number;
  globalRateLimitWindowSeconds: number;
  adminWriteRateLimitMax: number;
  adminWriteRateLimitWindowSeconds: number;
}

const LIMITS = {
  globalRateLimitMax: { min: 1, max: 100_000 },
  windowSeconds: { min: 1, max: 86_400 },
  adminWriteRateLimitMax: { min: 1, max: 10_000 },
} as const;

function isValidPositiveInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function toFormValues(config: McpRateLimitConfig): McpRateLimitFormValues {
  return {
    globalRateLimitMax: config.globalRateLimitMax,
    globalRateLimitWindowSeconds: config.globalRateLimitWindowMs / 1000,
    adminWriteRateLimitMax: config.adminWriteRateLimitMax,
    adminWriteRateLimitWindowSeconds:
      config.adminWriteRateLimitWindowMs / 1000,
  };
}

function secondsToMilliseconds(seconds: number): number {
  return Math.round(seconds * 1000);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function AdminMcpPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRateLimits = useCallback(async () => {
    setLoading(true);
    try {
      const config = await mcpAdminApi.getRateLimits();
      form.setFieldsValue(toFormValues(config));
    } catch (error) {
      Message.error(getErrorMessage(error, "加载 MCP 配额设置失败"));
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    let active = true;
    const loadInitialRateLimits = async () => {
      try {
        const config = await mcpAdminApi.getRateLimits();
        if (active) form.setFieldsValue(toFormValues(config));
      } catch (error) {
        if (active) {
          Message.error(getErrorMessage(error, "加载 MCP 配额设置失败"));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialRateLimits();
    return () => {
      active = false;
    };
  }, [form]);

  const handleSubmit = async (values: McpRateLimitFormValues) => {
    const globalWindowMs = secondsToMilliseconds(
      values.globalRateLimitWindowSeconds,
    );
    const adminWriteWindowMs = secondsToMilliseconds(
      values.adminWriteRateLimitWindowSeconds,
    );
    const config: McpRateLimitConfig = {
      globalRateLimitMax: values.globalRateLimitMax,
      globalRateLimitWindowMs: globalWindowMs,
      adminWriteRateLimitMax: values.adminWriteRateLimitMax,
      adminWriteRateLimitWindowMs: adminWriteWindowMs,
    };

    const countsAreValid =
      isValidPositiveInteger(config.globalRateLimitMax) &&
      config.globalRateLimitMax <= LIMITS.globalRateLimitMax.max &&
      isValidPositiveInteger(config.adminWriteRateLimitMax) &&
      config.adminWriteRateLimitMax <= LIMITS.adminWriteRateLimitMax.max;
    const windowsAreValid =
      isValidPositiveInteger(globalWindowMs) &&
      globalWindowMs >= LIMITS.windowSeconds.min * 1000 &&
      globalWindowMs <= LIMITS.windowSeconds.max * 1000 &&
      isValidPositiveInteger(adminWriteWindowMs) &&
      adminWriteWindowMs >= LIMITS.windowSeconds.min * 1000 &&
      adminWriteWindowMs <= LIMITS.windowSeconds.max * 1000;
    if (!countsAreValid || !windowsAreValid) {
      Message.warning("请检查配额范围；窗口时长最多支持 24 小时");
      return;
    }

    setSaving(true);
    try {
      const updated = await mcpAdminApi.updateRateLimits(config);
      form.setFieldsValue(toFormValues(updated));
      Message.success("MCP 配额设置已更新");
    } catch (error) {
      Message.error(getErrorMessage(error, "更新 MCP 配额设置失败"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "24px 0", maxWidth: 760 }}>
      <Card
        title={
          <Space>
            <IconSettings />
            <span>MCP 配额设置</span>
          </Space>
        }
        extra={
          <Button
            type="text"
            icon={<IconRefresh />}
            loading={loading}
            onClick={() => void loadRateLimits()}
          >
            刷新
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          调整 MCP 接口的全局请求配额和管理员测试数据写入配额。修改保存后立即对新请求生效。
        </Typography.Paragraph>

        <Form
          form={form}
          layout="vertical"
          onSubmit={handleSubmit}
          disabled={loading || saving}
        >
          <Form.Item
            field="globalRateLimitMax"
            label="全局请求次数上限"
            extra="每个客户端 IP 在全局窗口内允许的 MCP HTTP 请求数。"
            rules={[{ required: true, message: "请输入全局请求次数上限" }]}
          >
            <InputNumber
              min={LIMITS.globalRateLimitMax.min}
              max={LIMITS.globalRateLimitMax.max}
              precision={0}
              step={1}
              style={{ width: 240 }}
            />
          </Form.Item>

          <Form.Item
            field="globalRateLimitWindowSeconds"
            label="全局窗口时长"
            extra="按客户端 IP 统计；支持 1 秒至 24 小时，可精确到毫秒。"
            rules={[{ required: true, message: "请输入全局窗口时长" }]}
          >
            <InputNumber
              min={LIMITS.windowSeconds.min}
              max={LIMITS.windowSeconds.max}
              precision={3}
              step={1}
              suffix="秒"
              style={{ width: 240 }}
            />
          </Form.Item>

          <Form.Item
            field="adminWriteRateLimitMax"
            label="管理员写入次数上限"
            extra="每个管理员账号在管理员写入窗口内允许的新增或删除测试数据次数。"
            rules={[{ required: true, message: "请输入管理员写入次数上限" }]}
          >
            <InputNumber
              min={LIMITS.adminWriteRateLimitMax.min}
              max={LIMITS.adminWriteRateLimitMax.max}
              precision={0}
              step={1}
              style={{ width: 240 }}
            />
          </Form.Item>

          <Form.Item
            field="adminWriteRateLimitWindowSeconds"
            label="管理员写入窗口时长"
            extra="按管理员账号统计；支持 1 秒至 24 小时，可精确到毫秒。"
            rules={[{ required: true, message: "请输入管理员写入窗口时长" }]}
          >
            <InputNumber
              min={LIMITS.windowSeconds.min}
              max={LIMITS.windowSeconds.max}
              precision={3}
              step={1}
              suffix="秒"
              style={{ width: 240 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
