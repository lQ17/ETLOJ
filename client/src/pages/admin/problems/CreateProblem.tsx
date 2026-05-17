import { useState, useEffect } from "react";
import {
  Form, Input, Select, Button, Card, Message, Space, InputNumber, Grid, Table, Modal, Upload, Typography, Checkbox, Tag
} from "@arco-design/web-react";
import MDEditor from "@uiw/react-md-editor";
import Editor from "@monaco-editor/react";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { problemApi } from "../../../api/problem";
import { tagApi } from "../../../api/tag";
import { DIFFICULTY_VALUES, DIFFICULTY_CONFIG } from "../../../constants/difficulty";

const Row = Grid.Row;
const Col = Grid.Col;

interface TestCase {
  id: string;
  name: string;
  input: string;
  output: string;
}

interface CreateProblemProps {
  problemId?: number | null;
  onFinish?: () => void;
}

export default function CreateProblem({ problemId, onFinish }: CreateProblemProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState(`## 题目描述\n\n输入两个整数 $a$ 和 $b$，输出它们的和。\n\n## 输入格式\n\n一行两个整数 $a, b$。\n\n## 输出格式\n\n一行一个整数。\n\n## 输入输出样例 #1\n\n### 输入 #1\n\n\`\`\`\n1 2\n\`\`\`\n\n### 输出 #1\n\n\`\`\`\n3\n\`\`\`\n\n## 说明/提示\n\n$-10^9 \\leq a, b \\leq 10^9$\n`);

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);
  const [batchUploadVisible, setBatchUploadVisible] = useState(false);
  const [batchFiles, setBatchFiles] = useState<any[]>([]);
  const [processingBatch, setProcessingBatch] = useState(false);

  // 标签相关状态
  const [allTags, setAllTags] = useState<any[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagSearchKeyword, setTagSearchKeyword] = useState("");

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

          const tcRes: any = await problemApi.getTestcases(problemId);
          if (tcRes && tcRes.length > 0) {
            setTestCases(tcRes.map((tc: any, i: number) => ({
              id: Date.now().toString() + "_" + i,
              name: `测试点 ${i + 1}`,
              input: tc.input || "",
              output: tc.expectedOutput || tc.output || ""
            })));
          } else {
            setTestCases([]);
          }
        } catch (e) {
          Message.error("加载题目信息失败");
        } finally {
          setLoading(false);
        }
      };
      load();
    } else {
      form.resetFields();
      setMarkdown(`## 题目描述\n\n输入两个整数 $a$ 和 $b$，输出它们的和。\n\n## 输入格式\n\n一行两个整数 $a, b$。\n\n## 输出格式\n\n一行一个整数。\n\n## 输入输出样例 #1\n\n### 输入 #1\n\n\`\`\`\n1 2\n\`\`\`\n\n### 输出 #1\n\n\`\`\`\n3\n\`\`\`\n\n## 说明/提示\n\n$-10^9 \\leq a, b \\leq 10^9$\n`);
      setTestCases([]);
    }
  }, [problemId, form]);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.readAsText(file);
    });
  };

  const processBatchFiles = async (autoSort: boolean, parsedList: { num: number, in?: File, out?: File }[]) => {
    setProcessingBatch(true);
    try {
      const newCases: TestCase[] = [];
      for (let i = 0; i < parsedList.length; i++) {
        const item = parsedList[i];
        const index = autoSort ? i + 1 : item.num;
        
        const inContent = item.in ? await readFileAsText(item.in) : "";
        const outContent = item.out ? await readFileAsText(item.out) : "";
        
        newCases.push({
          id: Date.now().toString() + "_" + index,
          name: `测试点 ${index}`,
          input: inContent,
          output: outContent,
        });
      }
      setTestCases(prev => [...prev, ...newCases]);
      Message.success(`成功导入 ${newCases.length} 个测试节点`);
    } finally {
      setProcessingBatch(false);
      setBatchUploadVisible(false);
      setBatchFiles([]);
    }
  };

  const handleBatchUploadConfirm = () => {
    const files = batchFiles.map(f => f.originFile).filter(Boolean) as File[];
    if (files.length === 0) {
      Message.warning("请选择或拖入文件");
      return;
    }

    // 限制单次最多上传200个文件
    if (files.length > 200) {
      Message.error("单次最多上传200个文件 (即 100 组 .in/.out)");
      return;
    }

    // 限制单个文件大小不大于30MB
    const MAX_SIZE = 30 * 1024 * 1024;
    const seenNames = new Set<string>();

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        Message.error(`文件 ${file.name} 超过 30MB 限制`);
        return;
      }
      if (seenNames.has(file.name)) {
        Message.error(`检测到重复的文件名: ${file.name}，请检查后重新上传`);
        return;
      }
      seenNames.add(file.name);
    }
    
    const filePairs = new Map<number, { num: number, in?: File, out?: File }>();
    
    files.forEach(file => {
      const match = file.name.match(/^(\d+)\.(in|out)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const type = match[2].toLowerCase() as "in" | "out";
        if (!filePairs.has(num)) {
          filePairs.set(num, { num });
        }
        filePairs.get(num)![type] = file;
      }
    });

    const parsedList = Array.from(filePairs.values()).sort((a, b) => a.num - b.num);
    
    if (parsedList.length === 0) {
      Message.error("没有找到符合命名的文件 (如 1.in, 1.out)");
      return;
    }

    // 限制最终生成的测试节点数量
    if (parsedList.length > 100) {
      Message.error("单次最多导入 100 个测试节点 (1.in/1.out 到 100.in/100.out)");
      return;
    }
    
    let isContinuous = true;
    for (let i = 0; i < parsedList.length; i++) {
      if (parsedList[i].num !== i + 1) {
        isContinuous = false;
        break;
      }
    }
    
    if (!isContinuous) {
      Modal.confirm({
        title: "节点标号不连续",
        content: "节点标号不连续，系统可自动重命名排序，但可能会与题面效果不一致。是否自动重命名并重新排序？",
        okText: "自动排序",
        cancelText: "取消",
        onOk: () => processBatchFiles(true, parsedList),
      });
    } else {
      processBatchFiles(false, parsedList);
    }
  };

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
        if (testCases.length > 0) {
          await problemApi.saveTestcases(
            problemId,
            testCases.map((tc) => ({ input: tc.input, output: tc.output }))
          );
        }
        Message.success("题目及测试节点修改成功");
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

  const handleAddTestCase = () => {
    const newCase = { id: Date.now().toString(), name: `测试点 ${testCases.length + 1}`, input: "", output: "" };
    setTestCases([...testCases, newCase]);
  };

  const handleDeleteTestCase = (id: string) => {
    setTestCases(testCases.filter(t => t.id !== id));
  };

  const handleUploadTestCase = (file: File, id: string, type: "input" | "output") => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setTestCases(testCases.map(t => t.id === id ? { ...t, [type]: text } : t));
      Message.success(`${file.name} 上传成功`);
    };
    reader.readAsText(file);
    return false; // Prevent default upload
  };

  const openEditModal = (record: TestCase) => {
    setEditingTestCase(record);
    setModalVisible(true);
  };

  const saveEditModal = () => {
    if (editingTestCase) {
      setTestCases(testCases.map(t => t.id === editingTestCase.id ? editingTestCase : t));
    }
    setModalVisible(false);
  };

  const columns = [
    { title: "测试点名称", dataIndex: "name" },
    { 
      title: "输入", 
      render: (_: any, record: TestCase) => (
        <Space>
          <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 100 }}>
            {record.input ? "已上传" : "未上传"}
          </Typography.Text>
          <Upload
            autoUpload={false}
            showUploadList={false}
            accept=".in"
            beforeUpload={(file) => handleUploadTestCase(file, record.id, "input")}
          >
            <Button size="small">上传 .in</Button>
          </Upload>
        </Space>
      )
    },
    {
      title: "输出",
      render: (_: any, record: TestCase) => (
        <Space>
          <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 100 }}>
            {record.output ? "已上传" : "未上传"}
          </Typography.Text>
          <Upload
            autoUpload={false}
            showUploadList={false}
            accept=".out"
            beforeUpload={(file) => handleUploadTestCase(file, record.id, "output")}
          >
            <Button size="small">上传 .out</Button>
          </Upload>
        </Space>
      )
    },
    {
      title: "操作",
      render: (_: any, record: TestCase) => (
        <Space>
          <Button type="text" onClick={() => openEditModal(record)}>修改</Button>
          <Button type="text" status="danger" onClick={() => handleDeleteTestCase(record.id)}>删除</Button>
        </Space>
      )
    }
  ];

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
              remarkPlugins: [remarkMath],
              rehypePlugins: [rehypeKatex],
            }}
          />
        </div>

        <Typography.Title heading={6}>测试节点</Typography.Title>
        <div style={{ marginBottom: 24 }}>
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={handleAddTestCase} type="outline">添加测试节点</Button>
            <Button onClick={() => setBatchUploadVisible(true)} type="primary">一键导入测试数据</Button>
          </Space>
          <Table data={testCases} columns={columns} pagination={false} rowKey="id" />
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

      <Modal
        title="修改测试节点"
        visible={modalVisible}
        onOk={saveEditModal}
        onCancel={() => setModalVisible(false)}
        autoFocus={false}
        focusLock={true}
        style={{ width: 800 }}
      >
        {editingTestCase && (
          <Row gutter={16}>
            <Col span={12}>
              <Typography.Text bold>输入</Typography.Text>
              <div style={{ border: "1px solid var(--color-border)", borderRadius: 4, marginTop: 8 }}>
                <Editor
                  height="300px"
                  language="plaintext"
                  value={editingTestCase.input}
                  onChange={(val: string | undefined) => setEditingTestCase({ ...editingTestCase, input: val || "" })}
                  options={{ minimap: { enabled: false }, wordWrap: "on" }}
                />
              </div>
            </Col>
            <Col span={12}>
              <Typography.Text bold>输出</Typography.Text>
              <div style={{ border: "1px solid var(--color-border)", borderRadius: 4, marginTop: 8 }}>
                <Editor
                  height="300px"
                  language="plaintext"
                  value={editingTestCase.output}
                  onChange={(val: string | undefined) => setEditingTestCase({ ...editingTestCase, output: val || "" })}
                  options={{ minimap: { enabled: false }, wordWrap: "on" }}
                />
              </div>
            </Col>
          </Row>
        )}
      </Modal>

      <Modal
        title="一键导入测试数据"
        visible={batchUploadVisible}
        onOk={handleBatchUploadConfirm}
        onCancel={() => {
          setBatchUploadVisible(false);
          setBatchFiles([]);
        }}
        confirmLoading={processingBatch}
      >
        <Upload
          drag
          multiple
          autoUpload={false}
          showUploadList={false}
          fileList={batchFiles}
          onChange={(fileList) => setBatchFiles(fileList)}
          tip={
            <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', marginTop: 8, color: 'var(--color-text-3)' }}>
              一键导入测试数据可批量上传文件，文件命名需要从1.in, 1.out开始，单个文件大小不大于30MB，单次最多上传200个文件(1.in/1.out到100.in/100.out)
            </div>
          }
        />
        
        {/* 完全自定义的文件列表，没有任何库内置的 progress 或 status div */}
        {batchFiles.length > 0 && (
          <div style={{ marginTop: 16, maxHeight: 200, overflow: 'auto' }}>
            {batchFiles.map((file) => (
              <div key={file.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-fill-2)', borderRadius: 4, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', maxWidth: '85%', overflow: 'hidden' }}>
                  {/* 绿色对勾图标 */}
                  <svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8, color: '#52c41a', flexShrink: 0, display: 'block' }}>
                    <path d="M43 11L16.875 37L5 25.1818" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <Typography.Text ellipsis style={{ margin: 0, lineHeight: '14px', display: 'block' }}>{file.name}</Typography.Text>
                </div>
                <Button 
                  type="text" 
                  size="mini" 
                  status="danger" 
                  icon={
                    <svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 10V44H39V10H9Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
                      <path d="M20 20V33" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M28 20V33" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 10H44" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 10L19.289 4H28.711L32 10H16Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
                    </svg>
                  }
                  onClick={() => setBatchFiles(prev => prev.filter(item => item.uid !== file.uid))}
                />
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 标签选择弹窗 */}
      <Modal
        title="选择标签"
        visible={tagModalVisible}
        onCancel={() => setTagModalVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setSelectedTagIds([])}>清空</Button>
            <Button type="primary" onClick={() => setTagModalVisible(false)}>确定</Button>
          </Space>
        }
        style={{ width: 500 }}
      >
        <Input.Search
          placeholder="搜索标签..."
          value={tagSearchKeyword}
          onChange={setTagSearchKeyword}
          style={{ marginBottom: 16 }}
          allowClear
        />
        <div style={{ maxHeight: 400, overflow: "auto" }}>
          {(() => {
            const filtered = allTags
              .filter(t => !tagSearchKeyword || t.name.includes(tagSearchKeyword))
              .sort((a, b) => a.name.localeCompare(b.name, "zh"));
            if (filtered.length === 0) {
              return <Typography.Text type="secondary">暂无标签，请先在标签管理中创建</Typography.Text>;
            }
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 16px" }}>
                {filtered.map(tag => (
                  <div key={tag.id}>
                    <Checkbox
                      checked={selectedTagIds.includes(tag.id)}
                      onChange={(checked) => {
                        if (checked) {
                          setSelectedTagIds([...selectedTagIds, tag.id]);
                        } else {
                          setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id));
                        }
                      }}
                    >
                      <Tag style={{ marginRight: 4 }}>{tag.name}</Tag>
                    </Checkbox>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Modal>
    </Card>
  );
}
