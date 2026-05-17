import { useState, useEffect } from "react";
import {
  Table, Tag, Button, Space, Input, Message, Typography, Popconfirm,
  Switch, Radio, Select,
} from "@arco-design/web-react";
import { IconPlus, IconLeft } from "@arco-design/web-react/icon";
import MDEditor from "@uiw/react-md-editor";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { announcementApi } from "../../../api/announcement";

const { Text } = Typography;

const statusMap: Record<string, { label: string; color: string }> = {
  PUBLISHED: { label: "已发布", color: "green" },
  DRAFT: { label: "草稿", color: "orange" },
};

export default function AdminAnnouncementsPage() {
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleCreate = () => {
    setEditingId(null);
    setMode("create");
  };

  const handleEdit = (id: number) => {
    setEditingId(id);
    setMode("edit");
  };

  const handleBack = () => {
    setMode("list");
    setEditingId(null);
  };

  if (mode === "list") {
    return <AnnouncementList onCreate={handleCreate} onEdit={handleEdit} />;
  }

  return <AnnouncementForm id={editingId} onBack={handleBack} />;
}

function AnnouncementList({ onCreate, onEdit }: { onCreate: () => void; onEdit: (id: number) => void }) {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");

  const fetchData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const params: any = { page: p, pageSize: ps };
      if (filterStatus) params.status = filterStatus;
      const res: any = await announcementApi.adminList(params);
      setData(res.items);
      setTotal(res.total);
    } catch {
      Message.error("加载公告列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1); }, []);

  const handleSearch = () => { setPage(1); fetchData(1); };

  const handleDelete = async (id: number) => {
    try {
      await announcementApi.remove(id);
      Message.success("已删除");
      fetchData(page, pageSize);
    } catch {
      Message.error("删除失败");
    }
  };

  const handleTogglePinned = async (id: number, isPinned: boolean) => {
    try {
      await announcementApi.update(id, { isPinned });
      Message.success(isPinned ? "已置顶" : "已取消置顶");
      fetchData(page, pageSize);
    } catch {
      Message.error("操作失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "标题",
      render: (_: any, record: any) => <Text>{record.title}</Text>,
    },
    {
      title: "状态",
      width: 100,
      render: (_: any, record: any) => {
        const st = statusMap[record.status] || statusMap.DRAFT;
        return <Tag color={st.color}>{st.label}</Tag>;
      },
    },
    {
      title: "置顶",
      width: 80,
      render: (_: any, record: any) => (
        <Switch
          checked={record.isPinned}
          onChange={(checked) => handleTogglePinned(record.id, checked)}
          size="small"
        />
      ),
    },
    {
      title: "创建时间",
      render: (_: any, record: any) => new Date(record.createdAt).toLocaleString("zh-CN"),
      width: 180,
    },
    {
      title: "操作",
      width: 140,
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" size="mini" onClick={() => onEdit(record.id)}>编辑</Button>
          <Popconfirm title="确定删除这条公告吗？" onOk={() => handleDelete(record.id)}>
            <Button type="text" size="mini" status="danger">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="按状态筛选"
          value={filterStatus || undefined}
          onChange={(val) => setFilterStatus(val || "")}
          style={{ width: 150 }}
          allowClear
        >
          <Select.Option value="DRAFT">草稿</Select.Option>
          <Select.Option value="PUBLISHED">已发布</Select.Option>
        </Select>
        <Button type="primary" onClick={handleSearch}>搜索</Button>
        <Button type="outline" icon={<IconPlus />} onClick={onCreate}>创建公告</Button>
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

function AnnouncementForm({ id, onBack }: { id: number | null; onBack: () => void }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      announcementApi.adminGetById(id).then((res: any) => {
        setTitle(res.title);
        setSummary(res.summary);
        setContent(res.content || "");
        setIsPinned(res.isPinned);
        setStatus(res.status);
      }).catch(() => {
        Message.error("加载公告失败");
        onBack();
      });
    }
  }, [id]);

  const handleSubmit = async () => {
    if (!title.trim()) { Message.warning("请输入标题"); return; }
    if (!summary.trim()) { Message.warning("请输入摘要"); return; }

    setLoading(true);
    try {
      const data = { title, summary, content, isPinned, status };
      if (id) {
        await announcementApi.update(id, data);
        Message.success("更新成功");
      } else {
        await announcementApi.create(data);
        Message.success("创建成功");
      }
      onBack();
    } catch {
      Message.error("操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button type="text" icon={<IconLeft />} onClick={onBack} style={{ marginBottom: 16, padding: "0 4px" }}>
        返回列表
      </Button>
      <div>
        <div style={{ marginBottom: 16 }}>
          <Text style={{ display: "block", marginBottom: 6 }}>标题 *</Text>
          <Input
            placeholder="公告标题（最多 200 字）"
            value={title}
            onChange={setTitle}
            maxLength={200}
            showWordLimit
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text style={{ display: "block", marginBottom: 6 }}>摘要 *</Text>
          <Input.TextArea
            placeholder="公告摘要（最多 500 字，首页列表展示）"
            value={summary}
            onChange={setSummary}
            maxLength={500}
            showWordLimit
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </div>
        <div data-color-mode="light" style={{ marginBottom: 16 }}>
          <Text style={{ display: "block", marginBottom: 6 }}>详情内容</Text>
          <MDEditor
            value={content}
            onChange={(val) => setContent(val || "")}
            preview="live"
            height={400}
            previewOptions={{
              remarkPlugins: [remarkMath],
              rehypePlugins: [rehypeKatex],
            }}
          />
        </div>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Text>置顶</Text>
            <Switch checked={isPinned} onChange={setIsPinned} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Text>状态</Text>
            <Radio.Group value={status} onChange={setStatus}>
              <Radio value="DRAFT">草稿</Radio>
              <Radio value="PUBLISHED">已发布</Radio>
            </Radio.Group>
          </div>
        </div>
        <Button type="primary" loading={loading} onClick={handleSubmit}>
          {id ? "更新公告" : "创建公告"}
        </Button>
      </div>
    </div>
  );
}
