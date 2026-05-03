import { useState } from "react";
import {
  Typography, Form, Input, Select, Button, Card, Message, Space, InputNumber, Tag,
} from "@arco-design/web-react";
import Editor from "@monaco-editor/react";
import { problemApi } from "../../api/problem";
import { useAuthStore } from "../../stores/auth";

export default function AdminProblemsPage() {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState(`# P1001 A + B Problem\n\n## 题目描述\n\n输入两个整数 $a$ 和 $b$，输出它们的和。\n\n## 输入格式\n\n一行两个整数 $a, b$。\n\n## 输出格式\n\n一行一个整数。\n\n## 输入输出样例 #1\n\n### 输入 #1\n\n\`\`\`\n1 2\n\`\`\`\n\n### 输出 #1\n\n\`\`\`\n3\n\`\`\`\n\n## 说明/提示\n\n$-10^9 \\leq a, b \\leq 10^9$\n`);

  const [testInput, setTestInput] = useState("");
  const [testOutput, setTestOutput] = useState("");

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await problemApi.create({
        slug: values.slug,
        title: values.title,
        difficulty: values.difficulty,
        timeLimit: values.timeLimit,
        memoryLimit: values.memoryLimit,
        tags: values.tags ? values.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
        markdown,
      });
      Message.success("题目创建成功");
      setMode("list");
    } catch (err: any) {
      Message.error(err?.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Typography.Title heading={4}>题目管理</Typography.Title>

      {mode === "list" ? (
        <Button type="primary" onClick={() => setMode("create")} style={{ marginBottom: 16 }}>
          创建题目
        </Button>
      ) : (
        <Button onClick={() => setMode("list")} style={{ marginBottom: 16 }}>
          返回列表
        </Button>
      )}

      {mode === "create" && (
        <Card>
          <Form layout="vertical" onSubmit={handleSubmit}>
            <Form.Item field="slug" label="题号" rules={[{ required: true }]}>
              <Input placeholder="如 P1001" />
            </Form.Item>
            <Form.Item field="title" label="标题" rules={[{ required: true }]}>
              <Input placeholder="题目标题" />
            </Form.Item>
            <Form.Item field="difficulty" label="难度" initialValue="EASY">
              <Select>
                <Select.Option value="EASY">简单</Select.Option>
                <Select.Option value="MEDIUM">中等</Select.Option>
                <Select.Option value="HARD">困难</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item field="timeLimit" label="时间限制 (ms)" initialValue={1000}>
              <InputNumber min={100} max={10000} />
            </Form.Item>
            <Form.Item field="memoryLimit" label="内存限制 (MB)" initialValue={256}>
              <InputNumber min={16} max={1024} />
            </Form.Item>
            <Form.Item field="tags" label="标签（逗号分隔）">
              <Input placeholder="如: 排序, 贪心" />
            </Form.Item>

            <Form.Item label="题面内容 (Markdown + LaTeX)">
              <div style={{ border: "1px solid var(--color-border)", borderRadius: 4, overflow: "hidden" }}>
                <Editor
                  height="400px"
                  language="markdown"
                  value={markdown}
                  onChange={(v) => setMarkdown(v || "")}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
              </div>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建题目
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
}
