import { useState, useEffect } from "react";
import {
  Form, Input, Select, Button, Card, Message, Space, InputNumber, Grid, Typography, Tag
} from "@arco-design/web-react";
import MDEditor from "@uiw/react-md-editor";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { problemApi } from "../../../api/problem";
import { tagApi } from "../../../api/tag";
import { DIFFICULTY_VALUES, DIFFICULTY_CONFIG } from "../../../constants/difficulty";
import { DEFAULT_MARKDOWN } from "./create/constants";
import type { TestCase } from "./create/constants";
import TestCaseManager from "./create/TestCaseManager";
import BatchUploadModal from "./create/BatchUploadModal";
import TagSelectorModal from "./create/TagSelectorModal";

const Row = Grid.Row;
const Col = Grid.Col;

interface CreateProblemProps {
  problemId?: number | null;
  onFinish?: () => void;
}

export default function CreateProblem({ problemId, onFinish }: CreateProblemProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  // 测试用例惰性加载状态
  const [testcasesLoaded, setTestcasesLoaded] = useState(false);
  const [testcasesDirty, setTestcasesDirty] = useState(false);
  const [testcaseCount, setTestcaseCount] = useState(0);

  const [batchUploadVisible, setBatchUploadVisible] = useState(false);

  // 标签相关状态
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagModalVisible, setTagModalVisible] = useState(false);

  // 加载标签列表
  useEffect(() => {
    tagApi.list().then((res: any) => setAllTags(res || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (problemId) {
      const load = async () => {
        setLoading(true);
        try {
          const res: any = await problemApi.getOne(problemId);
          const data = res;
          form.setFieldsValue({
            slug: data.slug,
            title: data.title,
            difficulty: data.difficulty,
            timeLimit: data.timeLimit,
            memoryLimit: data.memoryLimit,
            score: data.score,
          });
          setSelectedTagIds(data.tagIds || []);
          // 去掉第一行 # 标题（由 slug + title 自动生成）
          const md = (data.markdown || "").replace(/^#[^\n]*\n?/, "");
          setMarkdown(md);

          // 惰性加载：只记录测试用例数量，不加载内容
          setTestcaseCount(data.testcaseCount || 0);
          setTestcasesLoaded(false);
          setTestcasesDirty(false);
          setTestCases([]);
        } catch (e) {
          Message.error("加载题目信息失败");
        } finally {
          setLoading(false);
        }
      };
      load();
    } else {
      form.resetFields();
      setMarkdown(DEFAULT_MARKDOWN);
      setTestCases([]);
      setTestcasesLoaded(false);
      setTestcasesDirty(false);
      setTestcaseCount(0);
    }
  }, [problemId, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        title: values.title,
        difficulty: values.difficulty,
        timeLimit: values.timeLimit,
        memoryLimit: values.memoryLimit,
        tagIds: selectedTagIds,
        markdown,
      };
      if (values.score != null && values.score !== "") {
        payload.score = values.score;
      }

      if (problemId) {
        await problemApi.update(problemId, payload);
        // 只有测试用例被修改过才保存
        if (testcasesDirty && testCases.length > 0) {
          await problemApi.saveTestcases(
            problemId,
            testCases.map((tc) => ({ input: tc.input, output: tc.output }))
          );
        }
        Message.success(testcasesDirty ? "题目及测试节点修改成功" : "题目信息修改成功");
        if (onFinish) onFinish();
      } else {
        await problemApi.create({ ...payload, slug: values.slug } as any);
        if (testCases.length > 0) {
          await problemApi.saveTestcases(
            values.slug,
            testCases.map((tc) => ({ input: tc.input, output: tc.output }))
          );
        }
        Message.success("题目及测试节点创建成功");
        form.resetFields();
        setMarkdown("");
        setTestCases([]);
        setSelectedTagIds([]);
      }
    } catch (err: any) {
      Message.error(err?.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  // 加载测试用例（惰性加载）
  const handleLoadTestcases = async () => {
    if (!problemId) return;
    setLoading(true);
    try {
      const tcRes: any = await problemApi.getTestcases(problemId);
      if (tcRes && tcRes.length > 0) {
        setTestCases(tcRes.map((tc: any, i: number) => ({
          id: Date.now().toString() + "_" + i,
          name: `测试点 ${i + 1}`,
          input: tc.input || "",
          output: tc.expectedOutput || tc.output || ""
        })));
      }
      setTestcasesLoaded(true);
    } catch (e) {
      Message.error("加载测试用例失败");
    } finally {
      setLoading(false);
    }
  };

  // 包装 setTestCases 以标记 dirty 状态
  const handleTestCasesChange = (newTestCases: TestCase[] | ((prev: TestCase[]) => TestCase[])) => {
    setTestCases(newTestCases);
    setTestcasesDirty(true);
  };

  const handleBatchConfirm = (cases: TestCase[]) => {
    setTestCases(prev => [...prev, ...cases]);
    setTestcasesDirty(true);
    setBatchUploadVisible(false);
  };

  return (
    <Card>
      <Form form={form} layout="vertical" onSubmit={handleSubmit}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item field="slug" label="题号" rules={[{ required: true }]}>
              <Input placeholder="如 P1001" disabled={!!problemId} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item field="title" label="标题" rules={[{ required: true }]}>
              <Input placeholder="题目标题" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item field="difficulty" label="难度" initialValue="IRON">
              <Select>
                {DIFFICULTY_VALUES.map(d => (
                  <Select.Option key={d} value={d}>{DIFFICULTY_CONFIG[d].label}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item field="score" label="分数" extra="留空则按难度自动计算">
              <InputNumber placeholder="自动" min={0} max={270} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item field="timeLimit" label="时间限制 (ms)" initialValue={1000}>
              <InputNumber min={100} max={10000} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item field="memoryLimit" label="内存限制 (MB)" initialValue={256}>
              <InputNumber min={16} max={1024} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="标签">
              <div>
                <Button type="outline" onClick={() => setTagModalVisible(true)}>
                  选择标签 {selectedTagIds.length > 0 ? `（已选 ${selectedTagIds.length} 个）` : ""}
                </Button>
                {selectedTagIds.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {allTags
                      .filter(t => selectedTagIds.includes(t.id))
                      .map(t => (
                        <Tag key={t.id} style={{ marginRight: 4, marginBottom: 4 }}>{t.name}</Tag>
                      ))
                    }
                  </div>
                )}
              </div>
            </Form.Item>
          </Col>
        </Row>

        <div data-color-mode="light" style={{ marginBottom: 24 }}>
          <Typography.Text bold style={{ display: "block", marginBottom: 8 }}>题面内容</Typography.Text>
          <MDEditor
            value={markdown}
            onChange={(val) => setMarkdown(val || "")}
            preview="live"
            height={500}
            previewOptions={{
              remarkPlugins: [remarkMath, remarkGfm],
              rehypePlugins: [rehypeKatex],
            }}
          />
        </div>

        <Typography.Title heading={6}>测试节点</Typography.Title>
        <div style={{ marginBottom: 24 }}>
          {problemId && !testcasesLoaded ? (
            // 编辑模式：惰性加载测试用例
            <div style={{ padding: "16px 0" }}>
              <Space>
                <Typography.Text>
                  测试用例: {testcaseCount} 个
                </Typography.Text>
                <Button
                  type="outline"
                  onClick={handleLoadTestcases}
                  loading={loading}
                >
                  加载并编辑
                </Button>
              </Space>
            </div>
          ) : (
            // 创建模式 或 已加载测试用例
            <>
              <Space style={{ marginBottom: 16 }}>
                <Button onClick={() => setBatchUploadVisible(true)} type="primary">一键导入测试数据</Button>
              </Space>
              <TestCaseManager testCases={testCases} setTestCases={handleTestCasesChange} problemId={problemId} />
            </>
          )}
        </div>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {problemId ? "确认修改" : "确认并创建题目"}
          </Button>
          {problemId && (
            <Button style={{ marginLeft: 16 }} size="large" onClick={onFinish}>
              取消
            </Button>
          )}
        </Form.Item>
      </Form>

      <BatchUploadModal
        visible={batchUploadVisible}
        onClose={() => setBatchUploadVisible(false)}
        onConfirm={handleBatchConfirm}
      />

      <TagSelectorModal
        visible={tagModalVisible}
        onClose={() => setTagModalVisible(false)}
        allTags={allTags}
        selectedTagIds={selectedTagIds}
        onUpdate={setSelectedTagIds}
      />
    </Card>
  );
}
