import { useState, useEffect, useCallback } from "react";
import {
  Table, Tag, Space, Button, Input, Select, Modal, Message, Typography, Popconfirm,
} from "@arco-design/web-react";
import { IconSearch, IconRefresh, IconDelete } from "@arco-design/web-react/icon";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { submissionApi } from "../../api/submission";
import { useAuthStore } from "../../stores/auth";

const statusLabel: Record<string, string> = {
  PENDING: "等待中",
  JUDGING: "判题中",
  AC: "通过",
  WA: "答案错误",
  TLE: "超时",
  MLE: "内存超限",
  RE: "运行错误",
  CE: "编译错误",
  SE: "系统错误",
};
const statusColor: Record<string, string> = {
  PENDING: "gray", JUDGING: "blue", AC: "green",
  WA: "red", TLE: "orange", MLE: "orange",
  RE: "red", CE: "orange", SE: "red",
};
const langLabel: Record<string, string> = {
  c: "C", cpp: "C++", java: "Java", python: "Python",
};

function formatMemory(kb: number | null | undefined): string {
  if (kb == null) return "-";
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)}MB`;
  return `${kb}KB`;
}

function formatCodeSize(bytes: number | null | undefined): string {
  if (bytes == null) return "-";
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

export default function RecordsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  const [filterUsername, setFilterUsername] = useState("");
  const [filterProblemId, setFilterProblemId] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [codeContent, setCodeContent] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("cpp");
  const [codeLoading, setCodeLoading] = useState(false);

  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const params: any = { page: p, pageSize: ps };
      if (filterUsername) params.username = filterUsername;
      if (filterProblemId) params.problemId = +filterProblemId;
      if (filterKeyword) params.keyword = filterKeyword;
      if (filterStatus) params.status = filterStatus;
      const res: any = await submissionApi.list(params);
      setData(res.items);
      setTotal(res.total);
    } catch {
      Message.error("加载评测记录失败");
    } finally {
      setLoading(false);
    }
  }, [filterUsername, filterProblemId, filterKeyword, filterStatus, page, pageSize]);

  useEffect(() => { if (user) fetchData(1); }, [user]);

  const handleSearch = () => { setPage(1); fetchData(1); };

  const handleReset = async () => {
    setFilterUsername("");
    setFilterProblemId("");
    setFilterKeyword("");
    setFilterStatus(undefined);
    setPage(1);
    setPageSize(20);
    setLoading(true);
    try {
      const res: any = await submissionApi.list({ page: 1, pageSize: 20 });
      setData(res.items);
      setTotal(res.total);
    } catch {
      Message.error("加载评测记录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleViewCode = async (record: any) => {
    setCodeLoading(true);
    setCodeModalVisible(true);
    setCodeContent("");
    try {
      const res: any = await submissionApi.getOne(record.id);
      if (res.code) {
        setCodeContent(res.code);
        setCodeLanguage(record.language === "cpp" ? "cpp" : record.language === "c" ? "c" : record.language === "java" ? "java" : "python");
      } else {
        setCodeContent("// 无权查看此代码");
      }
    } catch {
      setCodeContent("// 加载代码失败");
    } finally {
      setCodeLoading(false);
    }
  };

  const canViewCode = (record: any) => {
    if (!user) return false;
    return record.user?.id === user.id || user.role === "TEACHER" || user.role === "ADMIN";
  };

  const columns: any[] = [
    {
      title: "用户名", dataIndex: ["user", "username"], width: 100,
    },
    {
      title: "评测状态", width: 140,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Tag color={statusColor[record.status]} size="small">
            {statusLabel[record.status] || record.status}
          </Tag>
          {record.score != null && (
            <span style={{ fontSize: 12, color: record.score === 100 ? "var(--color-success)" : "var(--color-text-3)" }}>
              {record.score}分
            </span>
          )}
        </Space>
      ),
    },
    {
      title: "题号/题目", width: 220,
      render: (_: any, record: any) => (
        <Typography.Text
          style={{ cursor: "pointer", color: "#3b82f6" }}
          onClick={() => navigate(`/problems/${record.problem?.slug}`)}
        >
          {record.problem?.slug} {record.problem?.title}
        </Typography.Text>
      ),
    },
    {
      title: "评测时间", dataIndex: "createdAt", width: 170,
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
    {
      title: "运行时间", dataIndex: "timeUsed", width: 90,
      render: (v: number | null) => v != null ? `${v}ms` : "-",
    },
    {
      title: "内存", dataIndex: "memoryUsed", width: 100,
      render: (v: number | null) => formatMemory(v),
    },
    {
      title: "代码大小", dataIndex: "codeSize", width: 90,
      render: (v: number | null) => formatCodeSize(v),
    },
    {
      title: "语言", dataIndex: "language", width: 80,
      render: (v: string) => <Tag size="small">{langLabel[v] || v}</Tag>,
    },
    {
      title: "操作", width: 100, fixed: "right" as const,
      render: (_: any, record: any) => (
        <Button
          type="text"
          size="mini"
          disabled={!canViewCode(record)}
          onClick={() => handleViewCode(record)}
        >
          查看代码
        </Button>
      ),
    },
  ];

  if (!authLoading && !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center" }}>
          <Typography.Title heading={4} style={{ marginBottom: 8 }}>评测记录</Typography.Title>
          <Typography.Paragraph style={{ color: "var(--color-muted)", marginBottom: 24 }}>
            登录后即可查看评测记录
          </Typography.Paragraph>
          <Button type="primary" size="large" onClick={() => navigate("/login")}>
            去登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Typography.Title heading={4} style={{ marginBottom: 16 }}>评测记录</Typography.Title>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="用户名"
          value={filterUsername}
          onChange={setFilterUsername}
          style={{ width: 140 }}
          onPressEnter={handleSearch}
        />
        <Input
          placeholder="题号"
          value={filterProblemId}
          onChange={setFilterProblemId}
          style={{ width: 100 }}
          onPressEnter={handleSearch}
        />
        <Input
          placeholder="题目标题"
          value={filterKeyword}
          onChange={setFilterKeyword}
          style={{ width: 160 }}
          onPressEnter={handleSearch}
        />
        <Select
          placeholder="评测状态"
          value={filterStatus}
          onChange={setFilterStatus}
          allowClear
          style={{ width: 140 }}
        >
          <Select.Option value="AC">通过</Select.Option>
          <Select.Option value="WA">答案错误</Select.Option>
          <Select.Option value="TLE">超时</Select.Option>
          <Select.Option value="MLE">内存超限</Select.Option>
          <Select.Option value="RE">运行错误</Select.Option>
          <Select.Option value="CE">编译错误</Select.Option>
          <Select.Option value="SE">系统错误</Select.Option>
          <Select.Option value="PENDING">等待中</Select.Option>
        </Select>
        <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>搜索</Button>
        <Button icon={<IconRefresh />} onClick={handleReset}>重置</Button>
        {user?.role === "ADMIN" && (
          <Popconfirm
            title="确定清理所有系统错误(SE)、等待中(PENDING)和判题中(JUDGING)的记录吗？此操作不可撤销。"
            onOk={async () => {
              try {
                const res: any = await submissionApi.cleanDirty();
                Message.success(`已清理 ${res.deletedCount} 条脏数据`);
                fetchData(page, pageSize);
              } catch {
                Message.error("清理失败");
              }
            }}
          >
            <Button icon={<IconDelete />} status="danger">清理脏数据</Button>
          </Popconfirm>
        )}
      </Space>

      <Table
        columns={columns}
        data={data}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: true,
          showJumper: true,
          sizeCanChange: true,
          sizeOptions: [10, 20, 50],
          onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps); },
        }}
      />

      <Modal
        title="查看代码"
        visible={codeModalVisible}
        onCancel={() => setCodeModalVisible(false)}
        footer={null}
        style={{ width: 720 }}
        unmountOnExit
      >
        {codeLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>加载中...</div>
        ) : (
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 4, overflow: "hidden" }}>
            <Editor
              height="400px"
              language={codeLanguage}
              value={codeContent}
              theme="vs"
              options={{
                readOnly: true,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
