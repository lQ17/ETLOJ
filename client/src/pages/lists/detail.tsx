import { useState, useEffect } from "react";
import {
  Table, Tag, Button, Breadcrumb, Modal, Input, Message, Typography, Space, Popconfirm,
} from "@arco-design/web-react";
import { IconPlus, IconDelete } from "@arco-design/web-react/icon";
import { useParams, Link } from "react-router-dom";
import { problemListApi } from "../../api/problem-list";
import { submissionApi } from "../../api/submission";
import { useAuthStore } from "../../stores/auth";
import DifficultyTag from "../../components/DifficultyTag";

const { Title, Text, Paragraph } = Typography;

export default function ProblemListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [problemSlugs, setProblemSlugs] = useState("");
  const [adding, setAdding] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<number, string>>({});

  const isOwner = user?.id === detail?.creator?.id;
  const isAdmin = user?.role === "ADMIN" || user?.role === "TEACHER";
  const canEdit = isOwner || isAdmin;
  // 公共题单不在浏览页面提供添加入口，由管理员在后台管理
  const canAddProblems = canEdit && !detail?.isPublic;

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

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleAddProblems = async () => {
    const slugs = problemSlugs.split(/[,，\s\n]+/).map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 0) {
      Message.warning("请输入题号");
      return;
    }
    setAdding(true);
    try {
      const res: any = await problemListApi.addItems(+id!, slugs);
      setAddModalVisible(false);
      setProblemSlugs("");
      fetchDetail();
      if (res.errors?.length > 0) {
        Message.warning(`以下题号不存在：${res.errors.join("、")}`);
      } else {
        Message.success(`成功添加 ${res.added?.length ?? slugs.length} 道题`);
      }
    } catch {
      Message.error("添加失败");
    } finally {
      setAdding(false);
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

  const statusIcon = (problemId: number) => {
    const s = statusMap[problemId];
    if (s === "AC") return <span style={{ color: "var(--color-success)", fontWeight: 600 }}>✓</span>;
    if (s === "ATTEMPTED") return <span style={{ color: "var(--color-error)", fontWeight: 600 }}>✗</span>;
    return <span style={{ color: "var(--color-text-4)", fontSize: 18 }}>•</span>;
  };

  const columns: any[] = [
    ...(user
      ? [
          {
            title: "状态",
            width: 60,
            align: "center" as const,
            render: (_: any, record: any) => (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
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
        return diff ? (
          <DifficultyTag difficulty={diff} size="small" />
        ) : "-";
      },
    },
    {
      title: "分数",
      width: 70,
      render: (_: any, record: any) => record.problem?.score ?? "-",
    },
    ...(canEdit
      ? [
          {
            title: "操作",
            width: 80,
            render: (_: any, record: any) => (
              <Popconfirm title="确定移除此题？" onOk={() => handleRemove(record.problem?.id)}>
                <Button type="text" size="mini" status="danger" icon={<IconDelete />} />
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

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 16 }}>
        <Breadcrumb.Item>
          <Link to="/lists">题单</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{detail.title}</Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <Title heading={4} style={{ marginBottom: 8 }}>{detail.title}</Title>
            <Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {detail.description || "暂无简介"}
            </Paragraph>
            <Space>
              <Text type="secondary">创建者: {detail.creator?.username}</Text>
              <Tag color="blue">{detail.items?.length ?? 0} 题</Tag>
            </Space>
          </div>
          {canAddProblems && (
            <Button type="primary" icon={<IconPlus />} onClick={() => setAddModalVisible(true)}>
              添加题目
            </Button>
          )}
        </div>
      </div>

      <Table
        columns={columns}
        data={detail.items || []}
        rowKey={(record: any) => record.id}
        pagination={false}
        border={false}
      />

      {canAddProblems && (
        <Modal
          title="添加题目"
          visible={addModalVisible}
          onCancel={() => { setAddModalVisible(false); setProblemSlugs(""); }}
          onOk={handleAddProblems}
          confirmLoading={adding}
          unmountOnExit
        >
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary">请输入题号（如 P1012），多个用逗号或空格分隔</Text>
          </div>
          <Input.TextArea
            placeholder="例如: P1001, P1002, P1012"
            value={problemSlugs}
            onChange={setProblemSlugs}
            autoSize={{ minRows: 2 }}
          />
        </Modal>
      )}
    </div>
  );
}
