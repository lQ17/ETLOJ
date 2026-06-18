import { useState, useEffect } from "react";
import { Table, Tag, Breadcrumb, Message, Typography, Space, Popconfirm, Button } from "@arco-design/web-react";
import { useParams, Link } from "react-router-dom";
import { IconPlus } from "@arco-design/web-react/icon";
import { problemListApi } from "../../api/problem-list";
import { submissionApi } from "../../api/submission";
import { useAuthStore } from "../../stores/auth";
import DifficultyTag from "../../components/DifficultyTag";
import AddProblemsModal from "../../components/AddProblemsModal";

const { Title, Text, Paragraph } = Typography;

export default function ProblemListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});
  const [addModalVisible, setAddModalVisible] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res: any = await problemListApi.getDetail(+id);
      setDetail(res);
      if (user && res.items?.length > 0) {
        const ids = res.items.map((item: any) => item.problem?.id).filter(Boolean);
        try {
          const status: any = await submissionApi.getStatus(ids);
          setStatusMap(status);
        } catch { /* ignore */ }
      }
    } catch {
      Message.error("加载题单详情失败");
    } finally {
      setLoading(false);
    }
  };

  const canModify = user && detail && (
    detail.isPublic
      ? (user.role === "ADMIN" || user.role === "TEACHER")
      : (detail.creatorId === user.id || user.role === "ADMIN" || user.role === "TEACHER")
  );

  const handleAddProblems = async (slugs: string[]) => {
    const res: any = await problemListApi.addItems(+id!, slugs);
    fetchDetail();
    if (res.errors?.length > 0) {
      Message.warning(`以下题号不存在：${res.errors.join("、")}`);
    } else {
      Message.success(`成功添加 ${res.added?.length ?? slugs.length} 道题目`);
    }
  };

  const handleRemove = async (problemId: number) => {
    try {
      await problemListApi.removeItem(+id!, problemId);
      Message.success("移除成功");
      fetchDetail();
    } catch {
      Message.error("移除失败");
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const statusIcon = (problemId: number) => {
    const s = statusMap[problemId];
    if (s === "AC") return <span style={{ color: "var(--color-success)", fontWeight: 600 }}>&#10003;</span>;
    if (s === "ATTEMPTED") return <span style={{ color: "var(--color-error)", fontWeight: 600 }}>&#10007;</span>;
    return <span style={{ color: "var(--color-text-4)", fontSize: 18 }}>&bull;</span>;
  };

  const columns: any[] = [
    ...(user
      ? [
          {
            title: "状态",
            width: 60,
            align: "center" as const,
            render: (_: any, record: any) => (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {statusIcon(record.problem?.id)}
              </div>
            ),
          },
        ]
      : []),
    {
      title: "序号",
      width: 70,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "题号",
      dataIndex: ["problem", "slug"],
      width: 120,
      render: (slug: string) => <span style={{ fontFamily: "Consolas, monospace" }}>{slug}</span>,
    },
    {
      title: "标题",
      dataIndex: ["problem", "title"],
      render: (title: string, record: any) => (
        <Link to={`/problems/${record.problem?.slug}`} style={{ color: "#3b82f6", textDecoration: "none" }}>
          {title}
        </Link>
      ),
    },
    {
      title: "难度",
      width: 80,
      render: (_: any, record: any) => {
        const diff = record.problem?.difficulty;
        return diff ? <DifficultyTag difficulty={diff} size="small" /> : "-";
      },
    },
    {
      title: "分数",
      width: 70,
      render: (_: any, record: any) => record.problem?.score ?? "-",
    },
    ...(canModify
      ? [
          {
            title: "操作",
            width: 80,
            align: "center" as const,
            render: (_: any, record: any) => (
              <Popconfirm
                title="确认从题单中移除该题目？"
                onOk={() => handleRemove(record.problem?.id)}
              >
                <Button type="text" status="danger" size="small">
                  移除
                </Button>
              </Popconfirm>
            ),
          },
        ]
      : []),
  ];

  if (loading) {
    return <div style={{ textAlign: "center", padding: 80 }}>加载中...</div>;
  }

  if (!detail) {
    return <div style={{ textAlign: "center", padding: 80 }}>题单不存在</div>;
  }

  const existingSlugs = (detail.items || [])
    .map((item: any) => item.problem?.slug)
    .filter(Boolean);

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item>
          <Link to="/lists">题单</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{detail.title}</Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <Title heading={4} style={{ marginBottom: 8 }}>{detail.title}</Title>
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {detail.description || "暂无简介"}
          </Paragraph>
          <Space>
            <Text type="secondary">创建者: {detail.creator?.username}</Text>
            <Tag color="blue">{detail.items?.length ?? 0} 题</Tag>
            {user && detail.items?.length > 0 && (() => {
              const acCount = detail.items.filter((item: any) => statusMap[item.problem?.id] === "AC").length;
              const total = detail.items.length;
              const pct = Math.round((acCount / total) * 100);
              return (
                <Tag color={acCount === total && total > 0 ? "green" : acCount > 0 ? "orange" : "gray"}>
                  {acCount}/{total} 已通过{pct === 100 ? " ✓" : ` (${pct}%)`}
                </Tag>
              );
            })()}
          </Space>
        </div>
        {canModify && (
          <Button
            type="primary"
            icon={<IconPlus />}
            onClick={() => setAddModalVisible(true)}
          >
            添加题目
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        data={detail.items || []}
        rowKey={(record: any) => record.id}
        pagination={false}
        border={false}
      />

      <AddProblemsModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddProblems}
        existingSlugs={existingSlugs}
      />
    </div>
  );
}
