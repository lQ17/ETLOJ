import { useState, useEffect } from "react";
import { Table, Card, Button, Input, Space, Popconfirm, Message, Tag, Switch, Upload, Modal, Typography, Tooltip } from "@arco-design/web-react";
import { problemApi } from "../../../api/problem";

export default function ManageProblems({ onEdit }: { onEdit?: (id: number) => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importResultVisible, setImportResultVisible] = useState(false);

  const fetchData = async (current = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const res = await problemApi.list({ page: current, pageSize, keyword });
      setData((res as any).items);
      setPagination({ current: (res as any).page, pageSize: (res as any).pageSize, total: (res as any).total });
    } catch (e) {
      Message.error("获取题目列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = () => fetchData(1, pagination.pageSize);

  const togglePublic = async (id: number, isPublic: boolean) => {
    try {
      await problemApi.update(id, { isPublic });
      Message.success("状态更新成功");
      fetchData();
    } catch (e) {
      Message.error("状态更新失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await problemApi.delete(id);
      Message.success("删除成功");
      fetchData();
    } catch (e) {
      Message.error("删除失败");
    }
  };

  const handleExport = async (slugs: string[]) => {
    try {
      const res: any = slugs.length > 0
        ? await problemApi.exportProblems(slugs)
        : await problemApi.exportAllProblems();
      const blob = new Blob([res], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "problems-export.zip";
      a.click();
      URL.revokeObjectURL(url);
      Message.success("导出成功");
    } catch {
      Message.error("导出失败");
    }
  };

  const handleExportSelected = () => {
    const selectedSlugs = data
      .filter((item) => selectedKeys.includes(item.id))
      .map((item) => item.slug);
    handleExport(selectedSlugs);
  };

  const handleExportAll = () => {
    handleExport([]);
  };

  const handleImport = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      Message.error("文件大小不能超过 100MB");
      return;
    }
    setImporting(true);
    try {
      const res: any = await problemApi.importProblems(file);
      setImportResult(res);
      setImportResultVisible(true);
      if (res.imported > 0) fetchData();
    } catch (err: any) {
      Message.error(err?.message || "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 80 },
    { title: "题号", dataIndex: "slug", width: 120 },
    { title: "标题", dataIndex: "title" },
    {
      title: "难度",
      dataIndex: "difficulty",
      render: (val: string) => {
        const color = val === "EASY" ? "green" : val === "MEDIUM" ? "orange" : "red";
        const text = val === "EASY" ? "简单" : val === "MEDIUM" ? "中等" : "困难";
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: "分数", dataIndex: "score", width: 70,
      render: (v: number) => v ?? 0,
    },
    {
      title: "公开状态",
      dataIndex: "isPublic",
      render: (val: boolean, record: any) => (
        <Switch checked={val} onChange={(checked) => togglePublic(record.id, checked)} />
      )
    },
    {
      title: "操作",
      render: (_, record: any) => (
        <Space>
          <Button type="text" size="small" onClick={() => onEdit && onEdit(record.id)}>编辑</Button>
          <Popconfirm title="确认删除该题目及其所有提交记录？" onOk={() => handleDelete(record.id)}>
            <Button type="text" status="danger" size="small">删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input.Search
            placeholder="搜索题号或标题..."
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
            allowClear
          />
          <Button
            type="primary"
            disabled={selectedKeys.length === 0}
            onClick={handleExportSelected}
          >
            批量导出{selectedKeys.length > 0 ? `（${selectedKeys.length}题）` : ""}
          </Button>
          <Button onClick={handleExportAll}>导出全部</Button>
          <Upload
            autoUpload={false}
            showUploadList={false}
            accept=".zip"
            onChange={(fileList) => {
              const file = fileList[0]?.originFile;
              if (file) handleImport(file);
            }}
          >
            <Button type="primary" status="success" loading={importing}>导入题目</Button>
          </Upload>
          <Tooltip
            content={
              <div style={{ maxWidth: 360, lineHeight: 1.8 }}>
                <div>此入口仅支持本 OJ 格式的导入，如需导入第三方数据，请前往第三方导入页面。</div>
                <div style={{ marginTop: 8, fontWeight: 600 }}>导入格式要求：</div>
                <div>上传一个 <Typography.Text code>.zip</Typography.Text> 压缩包，结构如下：</div>
                <pre style={{ margin: "6px 0", fontSize: 12, lineHeight: 1.6 }}>
{`problems.zip
├── P1001/
│   ├── problem.json   // 题目元信息
│   ├── problem.md     // 题目描述（Markdown）
│   └── testcases/
│       ├── 1.in       // 第1组输入
│       ├── 1.out      // 第1组期望输出
│       ├── 2.in
│       └── 2.out
├── P1002/
│   └── ...`}
                </pre>
                <div style={{ fontWeight: 600 }}>problem.json 格式：</div>
                <pre style={{ margin: "6px 0", fontSize: 12, lineHeight: 1.6 }}>
{`{
  "slug": "P1001",
  "title": "题目标题",
  "difficulty": "EASY",   // EASY | MEDIUM | HARD
  "score": 1,             // 可选，默认按难度
  "timeLimit": 1000,      // 毫秒，默认 1000
  "memoryLimit": 256      // MB，默认 256
}`}
                </pre>
                <div>• 题号（slug）即文件夹名，重复的将被跳过</div>
                <div>• 测试用例编号须从 1 连续递增</div>
              </div>
            }
          >
            <Typography.Text type="secondary" style={{ fontSize: 12, cursor: "help" }}>如何导入</Typography.Text>
          </Tooltip>
        </Space>
      </div>
      <Table
        loading={loading}
        columns={columns}
        data={data}
        rowKey="id"
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys: any[]) => setSelectedKeys(keys),
        }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onChange: (page, pageSize) => fetchData(page, pageSize)
        }}
      />
      <Modal
        title="导入结果"
        visible={importResultVisible}
        onCancel={() => setImportResultVisible(false)}
        footer={<Button onClick={() => setImportResultVisible(false)}>关闭</Button>}
      >
        {importResult && (
          <div>
            <p>成功导入：<Tag color="green">{importResult.imported}</Tag> 题</p>
            <p>跳过（已存在）：<Tag color="orange">{importResult.skipped?.length ?? 0}</Tag> 题</p>
            {importResult.skipped?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  已存在的题号：{importResult.skipped.join("、")}
                </Typography.Text>
              </div>
            )}
            {importResult.errors?.length > 0 && (
              <div>
                <p style={{ color: "var(--color-danger-6)" }}>错误：</p>
                {importResult.errors.map((err: string, i: number) => (
                  <p key={i} style={{ fontSize: 12, color: "var(--color-text-3)" }}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
