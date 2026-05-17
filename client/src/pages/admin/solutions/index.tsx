import { useState, useEffect } from "react";
import {
  Tabs, Table, Tag, Button, Space, Modal, Input, Message, Typography, Popconfirm,
} from "@arco-design/web-react";
import { solutionApi } from "../../../api/solution";
import ReactMarkdown from "react-markdown";

const { Text } = Typography;

const statusMap: Record<string, { label: string; color: string }> = {
  APPROVED: { label: "已通过", color: "green" },
  PENDING: { label: "待审核", color: "blue" },
  REJECTED: { label: "已驳回", color: "red" },
};

export default function AdminSolutionsPage() {
  return (
    <Tabs defaultActiveTab="pending" type="capsule">
      <Tabs.TabPane key="pending" title="待审核">
        <PendingSolutions />
      </Tabs.TabPane>
      <Tabs.TabPane key="list" title="题解列表">
        <AllSolutions />
      </Tabs.TabPane>
    </Tabs>
  );
}

function PendingSolutions() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewModal, setViewModal] = useState<any>(null);
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await solutionApi.pending();
      setData(res);
    } catch {
      Message.error("加载待审核题解失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (id: number) => {
    try {
      await solutionApi.approve(id);
      Message.success("已通过");
      setData((prev) => prev.filter((s) => s.id !== id));
      setViewModal(null);
    } catch {
      Message.error("操作失败");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      Message.warning("请输入驳回原因");
      return;
    }
    try {
      await solutionApi.reject(rejectModal.id, rejectReason);
      Message.success("已驳回");
      setData((prev) => prev.filter((s) => s.id !== rejectModal.id));
      setRejectModal(null);
      setRejectReason("");
      setViewModal(null);
    } catch {
      Message.error("操作失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "题目",
      render: (_: any, record: any) => (
        <Text>{record.problem?.slug} {record.problem?.title}</Text>
      ),
    },
    {
      title: "作者",
      render: (_: any, record: any) => <Text>{record.author?.username}</Text>,
      width: 120,
    },
    {
      title: "提交时间",
      render: (_: any, record: any) => new Date(record.createdAt).toLocaleString("zh-CN"),
      width: 180,
    },
    {
      title: "操作",
      width: 100,
      render: (_: any, record: any) => (
        <Button type="primary" size="mini" onClick={() => setViewModal(record)}>
          查看
        </Button>
      ),
    },
  ];

  return (
    <>
      <Table columns={columns} data={data} loading={loading} rowKey="id" pagination={false} />

      <Modal
        title="审核题解"
        visible={!!viewModal}
        onCancel={() => setViewModal(null)}
        footer={
          viewModal && (
            <Space>
              <Button
                status="danger"
                onClick={() => { setRejectModal(viewModal); setRejectReason(""); }}
              >
                驳回
              </Button>
              <Button type="primary" onClick={() => handleApprove(viewModal.id)}>
                通过
              </Button>
            </Space>
          )
        }
        style={{ width: "70%" }}
      >
        {viewModal && (
          <div>
            <div style={{ marginBottom: 12, color: "var(--color-text-3)", fontSize: 13 }}>
              {viewModal.problem?.slug} {viewModal.problem?.title} — {viewModal.author?.username}
            </div>
            <div className="problem-markdown" style={{ maxHeight: 500, overflow: "auto" }}>
              <ReactMarkdown>{viewModal.content}</ReactMarkdown>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="驳回题解"
        visible={!!rejectModal}
        onCancel={() => setRejectModal(null)}
        onOk={handleReject}
        okText="确认驳回"
        okButtonProps={{ status: "danger" }}
      >
        <Input.TextArea
          placeholder="请输入驳回原因，将展示给用户..."
          value={rejectReason}
          onChange={setRejectReason}
          autoSize={{ minRows: 3 }}
        />
      </Modal>
    </>
  );
}

function AllSolutions() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [filterProblemId, setFilterProblemId] = useState("");

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const params: any = { page: p, pageSize: ps };
      if (filterProblemId) params.problemId = +filterProblemId;
      const res: any = await solutionApi.adminList(params);
      setData(res.items);
      setTotal(res.total);
    } catch {
      Message.error("加载题解列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1); }, []);

  const handleSearch = () => { setPage(1); fetchData(1); };

  const handleDelete = async (id: number) => {
    try {
      await solutionApi.delete(id);
      Message.success("已删除");
      fetchData(page, pageSize);
    } catch {
      Message.error("删除失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "题目",
      render: (_: any, record: any) => (
        <Text>{record.problem?.slug} {record.problem?.title}</Text>
      ),
    },
    {
      title: "作者",
      render: (_: any, record: any) => <Text>{record.author?.username}</Text>,
      width: 120,
    },
    {
      title: "状态",
      width: 100,
      render: (_: any, record: any) => {
        const st = statusMap[record.status] || statusMap.PENDING;
        return <Tag color={st.color}>{st.label}</Tag>;
      },
    },
    {
      title: "提交时间",
      render: (_: any, record: any) => new Date(record.createdAt).toLocaleString("zh-CN"),
      width: 180,
    },
    {
      title: "操作",
      width: 80,
      render: (_: any, record: any) => (
        <Popconfirm title="确定删除这篇题解吗？" onOk={() => handleDelete(record.id)}>
          <Button type="text" size="mini" status="danger">删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="按题目 ID 筛选"
          value={filterProblemId}
          onChange={setFilterProblemId}
          style={{ width: 180 }}
          onPressEnter={handleSearch}
        />
        <Button type="primary" onClick={handleSearch}>搜索</Button>
      </Space>
      <Table
        columns={columns}
        data={data}
        loading={loading}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps); },
        }}
      />
    </>
  );
}
