import { useState, useEffect } from "react";
import { Table, Card, Button, Input, Space, Popconfirm, Message, Tag, Switch } from "@arco-design/web-react";
import { problemApi } from "../../../api/problem";

export default function ManageProblems({ onEdit }: { onEdit?: (id: number) => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

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
          onChange: (page, pageSize) => fetchData(page, pageSize)
        }}
      />
    </Card>
  );
}
