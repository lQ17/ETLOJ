import { useState, useEffect, useCallback } from "react";
import {
  Table, Card, Button, Input, Space, Popconfirm, Message, Tag, Modal,
  Form, Typography,
} from "@arco-design/web-react";
import { IconPlus } from "@arco-design/web-react/icon";
import { problemListApi } from "../../../api/problem-list";
import DifficultyTag from "../../../components/DifficultyTag";

const { Text } = Typography;
const FormItem = Form.Item;

export default function AdminListsPage() {
  const [activeTab, setActiveTab] = useState("manage");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [managingListId, setManagingListId] = useState<number | null>(null);

  const handleEdit = (id: number) => {
    setEditingId(id);
    setActiveTab("create");
  };

  const handleManageItems = (id: number) => {
    setManagingListId(id);
    setActiveTab("items");
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === "create") setEditingId(null);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button type={activeTab === "manage" ? "primary" : "default"} onClick={() => handleTabChange("manage")}>管理题单</Button>
        <Button type={activeTab === "create" ? "primary" : "default"} onClick={() => handleTabChange("create")}>{editingId ? "编辑题单" : "创建题单"}</Button>
        <Button type={activeTab === "items" ? "primary" : "default"} onClick={() => handleTabChange("items")} disabled={!managingListId}>题目管理</Button>
      </div>
      {activeTab === "manage" && <ManageLists onEdit={handleEdit} onManageItems={handleManageItems} />}
      {activeTab === "create" && <CreateOrEditList listId={editingId} onFinish={() => handleTabChange("manage")} />}
      {activeTab === "items" && managingListId && <ManageItems listId={managingListId} />}
    </div>
  );
}

function ManageLists({ onEdit, onManageItems }: { onEdit: (id: number) => void; onManageItems: (id: number) => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchData = useCallback(async (current = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res: any = await problemListApi.getPublicLists({ page: current, pageSize, keyword });
      setData(res.items || []);
      setPagination({ current: res.page || current, pageSize: res.pageSize || pageSize, total: res.total || 0 });
    } catch {
      Message.error("获取题单列表失败");
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => { fetchData(); }, []);

  const handleSearch = () => fetchData(1, pagination.pageSize);

  const handleDelete = async (id: number) => {
    try {
      await problemListApi.delete(id);
      Message.success("删除成功");
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      Message.error("删除失败");
    }
  };

  const columns: any[] = [
    { title: "ID", dataIndex: "id", width: 70 },
    { title: "标题", dataIndex: "title" },
    { title: "简介", dataIndex: "description", ellipsis: true },
    {
      title: "题目数量",
      dataIndex: "itemCount",
      width: 100,
      render: (v: number) => v ?? 0,
    },
    {
      title: "创建者",
      width: 120,
      render: (_: any, record: any) => record.creator?.username || "-",
    },
    {
      title: "操作",
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" size="small" onClick={() => onEdit(record.id)}>编辑</Button>
          <Button type="text" size="small" onClick={() => onManageItems(record.id)}>管理题目</Button>
          <Popconfirm title="确认删除该题单？" onOk={() => handleDelete(record.id)}>
            <Button type="text" status="danger" size="small">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input.Search
            placeholder="搜索题单标题..."
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
            allowClear
          />
        </Space>
      </div>
      <Table
        loading={loading}
        columns={columns}
        data={data}
        rowKey="id"
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: true,
          sizeCanChange: true,
          sizeOptions: [10, 20, 50],
          onChange: (page, pageSize) => fetchData(page, pageSize),
        }}
      />
    </Card>
  );
}

function CreateOrEditList({ listId, onFinish }: { listId: number | null; onFinish: () => void }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (listId) {
      problemListApi.getDetail(listId).then((res: any) => {
        form.setFieldsValue({ title: res.title, description: res.description });
      }).catch(() => Message.error("加载题单信息失败"));
    } else {
      form.resetFields();
    }
  }, [listId]);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setLoading(true);
      if (listId) {
        await problemListApi.update(listId, { title: values.title, description: values.description });
        Message.success("更新成功");
      } else {
        await problemListApi.create({ title: values.title, description: values.description, isPublic: true });
        Message.success("创建成功");
      }
      onFinish();
    } catch {
      // validation failed or API error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <FormItem field="title" label="题单标题" rules={[{ required: true, message: "请输入题单标题" }]}>
          <Input placeholder="请输入题单标题" />
        </FormItem>
        <FormItem field="description" label="题单简介">
          <Input.TextArea placeholder="请输入题单简介（可选）" rows={4} />
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" loading={loading} onClick={handleSubmit}>
              {listId ? "保存修改" : "创建题单"}
            </Button>
            <Button onClick={onFinish}>取消</Button>
          </Space>
        </FormItem>
      </Form>
    </Card>
  );
}

function ManageItems({ listId }: { listId: number }) {
  const [listInfo, setListInfo] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [problemIdsInput, setProblemIdsInput] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await problemListApi.getDetail(listId);
      setListInfo(res);
      setItems(res.items || []);
    } catch {
      Message.error("获取题单详情失败");
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => { fetchDetail(); }, [listId]);

  const handleAdd = async () => {
    const slugs = problemIdsInput
      .split(/[,，\s\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (slugs.length === 0) {
      Message.warning("请输入题号");
      return;
    }
    setAdding(true);
    try {
      const res: any = await problemListApi.addItems(listId, slugs);
      setAddModalVisible(false);
      setProblemIdsInput("");
      fetchDetail();
      if (res.errors?.length > 0) {
        Message.warning(`以下题号不存在：${res.errors.join("、")}`);
      } else {
        Message.success(`成功添加 ${res.added?.length ?? slugs.length} 道题目`);
      }
    } catch {
      Message.error("添加题目失败");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (problemId: number) => {
    try {
      await problemListApi.removeItem(listId, problemId);
      Message.success("移除成功");
      fetchDetail();
    } catch {
      Message.error("移除失败");
    }
  };

  const columns: any[] = [
    { title: "排序", dataIndex: "sortOrder", width: 70 },
    { title: "题号", dataIndex: ["problem", "slug"], width: 120 },
    { title: "标题", dataIndex: ["problem", "title"] },
    {
      title: "难度",
      dataIndex: ["problem", "difficulty"],
      width: 90,
      render: (val: string) => <DifficultyTag difficulty={val} size="small" />,
    },
    {
      title: "操作",
      width: 80,
      render: (_: any, record: any) => (
        <Popconfirm title="确认从题单中移除该题目？" onOk={() => handleRemove(record.problem?.id)}>
          <Button type="text" status="danger" size="small">移除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space>
          <Text bold>{listInfo?.title || "加载中..."}</Text>
          <Tag color="blue">共 {items.length} 题</Tag>
        </Space>
        <Button type="primary" icon={<IconPlus />} onClick={() => setAddModalVisible(true)}>添加题目</Button>
      </div>
      <Table
        loading={loading}
        columns={columns}
        data={items}
        rowKey={(record) => record.problem?.id || record.id}
        pagination={items.length > 20 ? { pageSize: 20 } : false}
      />
      <Modal
        title="添加题目"
        visible={addModalVisible}
        onCancel={() => { setAddModalVisible(false); setProblemIdsInput(""); }}
        onOk={handleAdd}
        confirmLoading={adding}
        okText="添加"
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">输入题号（如 P1012），多个用逗号或空格分隔</Text>
        </div>
        <Input.TextArea
          placeholder="例如：P1001, P1002, P1012"
          value={problemIdsInput}
          onChange={setProblemIdsInput}
          rows={3}
        />
      </Modal>
    </Card>
  );
}
