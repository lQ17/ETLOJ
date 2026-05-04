import { useState, useEffect } from "react";
import {
  Table, Tag, Button, Breadcrumb, Modal, Input, Message, Typography, Space, Popconfirm,
} from "@arco-design/web-react";
import { IconPlus, IconDelete } from "@arco-design/web-react/icon";
import { useNavigate, useParams, Link } from "react-router-dom";
import { problemListApi } from "../../api/problem-list";
import { useAuthStore } from "../../stores/auth";

const { Title, Text, Paragraph } = Typography;

const difficultyColor: Record<string, string> = {
  EASY: "green",
  MEDIUM: "orange",
  HARD: "red",
};

const difficultyLabel: Record<string, string> = {
  EASY: "简单",
  MEDIUM: "中等",
  HARD: "困难",
};

export default function ProblemListDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);

  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [problemSlugs, setProblemSlugs] = useState("");
  const [adding, setAdding] = useState(false);

  const isOwner = user?.id === detail?.creator?.id;
  const isAdmin = user?.role === "ADMIN" || user?.role === "TEACHER";
  const canEdit = isOwner || isAdmin;

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res: any = await problemListApi.getDetail(+id);
      setDetail(res);
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
    const slugs = problemSlugs.split(",").map((s) => s.trim()).filter(Boolean);
    if (slugs.length === 0) {
      Message.warning("请输入题号");
      return;
    }
    setAdding(true);
    try {
      await problemListApi.addItems(+id!, slugs.map((s) => Number(s)).filter((n) => !isNaN(n)));
      Message.success("添加成功");
      setAddModalVisible(false);
      setProblemSlugs("");
      fetchDetail();
    } catch {
      Message.error("添加失败，请检查题号是否正确");
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

  const columns = [
    {
      title: "序号",
      width: 70,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "题号",
      dataIndex: ["problem", "slug"],
      width: 120,
      render: (slug: string) => (
        <Text
          style={{ cursor: "pointer", color: "rgb(var(--primary-6))" }}
          onClick={() => navigate(`/problems/${slug}`)}
        >
          {slug}
        </Text>
      ),
    },
    {
      title: "标题",
      dataIndex: ["problem", "title"],
    },
    {
      title: "难度",
      width: 80,
      render: (_: any, record: any) => {
        const diff = record.problem?.difficulty;
        return diff ? (
          <Tag color={difficultyColor[diff]} size="small">
            {difficultyLabel[diff] || diff}
          </Tag>
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
          {canEdit && (
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

      <Modal
        title="添加题目"
        visible={addModalVisible}
        onCancel={() => { setAddModalVisible(false); setProblemSlugs(""); }}
        onOk={handleAddProblems}
        confirmLoading={adding}
        unmountOnExit
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">请输入题号（数字ID），多个用逗号分隔</Text>
        </div>
        <Input.TextArea
          placeholder="例如: 1, 2, 3"
          value={problemSlugs}
          onChange={setProblemSlugs}
          autoSize={{ minRows: 2 }}
        />
      </Modal>
    </div>
  );
}
