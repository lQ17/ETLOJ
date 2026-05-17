import { useState, useEffect, useCallback } from "react";
import {
  Table, Button, Input, Space, Popconfirm, Message, Modal, Form, Tag,
} from "@arco-design/web-react";
import { tagApi } from "../../../api/tag";

export default function ManageTags() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");

  // 编辑/新建弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await tagApi.list();
      let tags = res || [];
      if (keyword) {
        tags = tags.filter((t: any) =>
          t.name.includes(keyword) || (t.description && t.description.includes(keyword))
        );
      }
      setData(tags);
    } catch {
      Message.error("获取标签列表失败");
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => fetchData();

  const openCreate = () => {
    setEditingTag(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEdit = (record: any) => {
    setEditingTag(record);
    form.setFieldsValue({ name: record.name, description: record.description });
    setModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validate();
      if (editingTag) {
        await tagApi.update(editingTag.id, values);
        Message.success("标签更新成功");
      } else {
        await tagApi.create(values);
        Message.success("标签创建成功");
      }
      setModalVisible(false);
      fetchData();
    } catch (err: any) {
      if (err?.message) Message.error(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tagApi.remove(id);
      Message.success("标签删除成功");
      fetchData();
    } catch (err: any) {
      Message.error(err?.message || "删除失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    {
      title: "标签名",
      dataIndex: "name",
      render: (name: string) => <Tag>{name}</Tag>,
    },
    { title: "描述", dataIndex: "description", ellipsis: true },
    {
      title: "关联题目数",
      dataIndex: "_count",
      width: 100,
      render: (_: any, record: any) => record._count?.problems ?? 0,
    },
    {
      title: "操作",
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="删除标签后，关联题目的该标签将被移除。确认删除？"
            onOk={() => handleDelete(record.id)}
          >
            <Button type="text" status="danger" size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Input.Search
            placeholder="搜索标签名..."
            value={keyword}
            onChange={setKeyword}
            onSearch={handleSearch}
            onPressEnter={handleSearch}
            style={{ width: 250 }}
            allowClear
          />
          <Button type="primary" onClick={openCreate}>
            新建标签
          </Button>
        </Space>
      </div>

      <Table
        loading={loading}
        columns={columns}
        data={data}
        rowKey="id"
        pagination={false}
      />

      <Modal
        title={editingTag ? "编辑标签" : "新建标签"}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            field="name"
            label="标签名"
            rules={[{ required: true, message: "请输入标签名" }]}
          >
            <Input placeholder="请输入标签名" maxLength={50} />
          </Form.Item>
          <Form.Item field="description" label="描述">
            <Input.TextArea placeholder="标签描述（可选）" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
