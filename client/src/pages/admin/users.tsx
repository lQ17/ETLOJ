import { useState, useEffect, useCallback } from "react";
import {
  Form, Input, Button, Select, Card, Message, Typography,
  Tabs, Table, Tag, Space, Modal, Popconfirm,
} from "@arco-design/web-react";
import { IconSearch, IconRefresh } from "@arco-design/web-react/icon";
import { userApi } from "../../api/user";

const roleColors: Record<string, string> = { ADMIN: "red", TEACHER: "blue", USER: "green" };

// ========== 创建用户 Tab ==========
function CreateUserTab() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await userApi.create(values);
      Message.success(`用户 ${values.username} 创建成功`);
    } catch (err: any) {
      Message.error(err?.message || "创建失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 24 }}>
      <Card style={{ width: 480 }}>
        <Form layout="vertical" onSubmit={handleSubmit}>
          <Form.Item field="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item field="email" label="邮箱">
            <Input placeholder="邮箱（选填）" />
          </Form.Item>
          <Form.Item field="phone" label="手机号">
            <Input placeholder="手机号（选填）" />
          </Form.Item>
          <Form.Item field="password" label="密码">
            <Input.Password placeholder="留空则默认 123456" />
          </Form.Item>
          <Form.Item field="role" label="角色" initialValue="USER">
            <Select>
              <Select.Option value="USER">普通用户</Select.Option>
              <Select.Option value="TEACHER">教师</Select.Option>
              <Select.Option value="ADMIN">管理员</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" long loading={loading}>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

// ========== 管理用户 Tab ==========
function ManageUsersTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [filterRole, setFilterRole] = useState<string | undefined>();
  const [filterActive, setFilterActive] = useState<string | undefined>();

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm] = Form.useForm();

  const fetchData = useCallback(async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const params: any = { page: p, pageSize: ps };
      if (keyword) params.keyword = keyword;
      if (filterRole) params.role = filterRole;
      if (filterActive !== undefined) params.isActive = filterActive === "true";
      const res: any = await userApi.list(params);
      setData(res.items);
      setTotal(res.total);
    } catch {
      Message.error("加载用户列表失败");
    } finally {
      setLoading(false);
    }
  }, [keyword, filterRole, filterActive, page, pageSize]);

  useEffect(() => { fetchData(1); }, []);

  const handleSearch = () => { setPage(1); fetchData(1); };

  const handleToggleActive = async (record: any) => {
    try {
      await userApi.toggleActive(record.id);
      Message.success(`用户 ${record.username} 已${record.isActive ? "停用" : "启用"}`);
      fetchData();
    } catch (err: any) {
      Message.error(err?.message || "操作失败");
    }
  };

  const handleDelete = async (record: any) => {
    try {
      await userApi.remove(record.id);
      Message.success(`用户 ${record.username} 已删除`);
      fetchData();
    } catch (err: any) {
      Message.error(err?.message || "删除失败");
    }
  };

  const openEdit = (record: any) => {
    setEditUser(record);
    editForm.setFieldsValue({
      username: record.username,
      email: record.email || "",
      phone: record.phone || "",
      role: record.role,
      password: "",
    });
    setEditVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validate();
      const payload: any = { ...values };
      if (!payload.password) delete payload.password;
      await userApi.update(editUser.id, payload);
      Message.success("修改成功");
      setEditVisible(false);
      fetchData();
    } catch (err: any) {
      if (err?.message) Message.error(err.message);
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "用户名", dataIndex: "username", width: 120 },
    { title: "邮箱", dataIndex: "email", width: 180, render: (v: string) => v || "-" },
    { title: "手机号", dataIndex: "phone", width: 140, render: (v: string) => v || "-" },
    {
      title: "角色", dataIndex: "role", width: 90,
      render: (v: string) => <Tag color={roleColors[v]}>{v}</Tag>,
    },
    {
      title: "状态", dataIndex: "isActive", width: 80,
      render: (v: boolean) => <Tag color={v ? "green" : "red"}>{v ? "启用" : "停用"}</Tag>,
    },
    {
      title: "创建时间", dataIndex: "createdAt", width: 170,
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
    {
      title: "操作", width: 200, fixed: "right" as const,
      render: (_: any, record: any) => (
        <Space>
          <Button type="text" size="mini" onClick={() => openEdit(record)}>编辑</Button>
          <Button
            type="text" size="mini"
            status={record.isActive ? "warning" : "success"}
            onClick={() => handleToggleActive(record)}
          >
            {record.isActive ? "停用" : "启用"}
          </Button>
          <Popconfirm title="确认删除此用户？" onOk={() => handleDelete(record)}>
            <Button type="text" size="mini" status="danger">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索用户名/邮箱/手机号"
          value={keyword}
          onChange={setKeyword}
          style={{ width: 240 }}
          onPressEnter={handleSearch}
          suffix={<IconSearch style={{ cursor: "pointer" }} onClick={handleSearch} />}
        />
        <Select
          placeholder="角色筛选"
          value={filterRole}
          onChange={setFilterRole}
          allowClear
          style={{ width: 120 }}
        >
          <Select.Option value="USER">普通用户</Select.Option>
          <Select.Option value="TEACHER">教师</Select.Option>
          <Select.Option value="ADMIN">管理员</Select.Option>
        </Select>
        <Select
          placeholder="状态筛选"
          value={filterActive}
          onChange={setFilterActive}
          allowClear
          style={{ width: 120 }}
        >
          <Select.Option value="true">启用</Select.Option>
          <Select.Option value="false">停用</Select.Option>
        </Select>
        <Button type="primary" icon={<IconSearch />} onClick={handleSearch}>搜索</Button>
        <Button
          icon={<IconRefresh />}
          onClick={async () => {
            setKeyword(""); setFilterRole(undefined); setFilterActive(undefined); setPage(1);
            setLoading(true);
            try {
              const res: any = await userApi.list({ page: 1, pageSize });
              setData(res.items); setTotal(res.total);
            } catch { Message.error("加载用户列表失败"); }
            finally { setLoading(false); }
          }}
        >
          重置
        </Button>
      </Space>

      <Table
        columns={columns}
        data={data}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1040 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: true,
          showJumper: true,
          sizeCanChange: true,
          pageSizeOptions: [10, 20, 50],
          onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchData(p, ps); },
        }}
      />

      <Modal
        title="编辑用户"
        visible={editVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditVisible(false)}
        autoFocus={false}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item field="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item field="email" label="邮箱">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item field="phone" label="手机号">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item field="password" label="新密码" extra="留空则不修改密码">
            <Input.Password placeholder="不修改请留空" />
          </Form.Item>
          <Form.Item field="role" label="角色">
            <Select>
              <Select.Option value="USER">普通用户</Select.Option>
              <Select.Option value="TEACHER">教师</Select.Option>
              <Select.Option value="ADMIN">管理员</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ========== 主页面 ==========
export default function AdminUsersPage() {
  return (
    <div>
      <Typography.Title heading={4} style={{ marginBottom: 0 }}>用户管理</Typography.Title>
      <Tabs defaultActiveTab="create" style={{ marginTop: 16 }}>
        <Tabs.TabPane key="create" title="创建用户">
          <CreateUserTab />
        </Tabs.TabPane>
        <Tabs.TabPane key="manage" title="管理用户">
          <ManageUsersTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
