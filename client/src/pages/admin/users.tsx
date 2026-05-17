import { useState, useEffect, useCallback } from "react";
import {
  Form, Input, Button, Select, Card, Message,
  Tabs, Table, Tag, Space, Modal, Popconfirm, Typography,
} from "@arco-design/web-react";
import { IconSearch, IconRefresh } from "@arco-design/web-react/icon";
import { userApi } from "../../api/user";

const roleColors: Record<string, string> = { ADMIN: "red", TEACHER: "blue", USER: "green" };

const roleMap: Record<string, string> = { "1": "USER", "2": "TEACHER", "3": "ADMIN" };

// ========== 批量创建 Tab ==========
function BatchCreateTab() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<any[]>([]);
  const [failed, setFailed] = useState<string[]>([]);

  const handleBatchCreate = async () => {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      Message.warning("请输入至少一行用户信息");
      return;
    }

    setLoading(true);
    setCreated([]);
    setFailed([]);
    const newCreated: any[] = [];
    const newFailed: string[] = [];

    for (const line of lines) {
      const parts = line.split(",").map((s) => s.trim());
      const [username, email, phone, password, roleCode] = parts;

      if (!username) {
        newFailed.push(`[空行] 用户名不能为空`);
        continue;
      }

      const role = roleMap[roleCode] || "USER";
      const payload: any = { username, role };
      if (email) payload.email = email;
      if (phone) payload.phone = phone;
      if (password) payload.password = password;

      try {
        const res: any = await userApi.create(payload);
        newCreated.push({ ...res, _password: password || "123456" });
      } catch (err: any) {
        newFailed.push(`${username}: ${err?.message || "创建失败"}`);
      }
    }

    setCreated(newCreated);
    setFailed(newFailed);
    setLoading(false);
    if (newFailed.length === 0) {
      Message.success(`全部 ${newCreated.length} 个用户创建成功`);
    }
  };

  const roleLabel: Record<string, string> = { USER: "普通用户", TEACHER: "教师", ADMIN: "管理员" };

  const resultColumns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "用户名", dataIndex: "username", width: 120 },
    { title: "邮箱", dataIndex: "email", width: 180, render: (v: string) => v || "" },
    { title: "手机号", dataIndex: "phone", width: 140, render: (v: string) => v || "" },
    {
      title: "角色", dataIndex: "role", width: 90,
      render: (v: string) => <Tag color={roleColors[v]} size="small">{roleLabel[v] || v}</Tag>,
    },
    { title: "密码", dataIndex: "_password", width: 120 },
  ];

  return (
    <div style={{ display: "flex", gap: 16, paddingTop: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Card>
          <Typography.Text style={{ display: "block", marginBottom: 8 }}>
            每行一个用户，格式：<Typography.Text code>用户名,邮箱,手机号,密码,角色</Typography.Text>
          </Typography.Text>
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            角色：1=普通用户 2=教师 3=管理员；邮箱、手机号、密码均可留空（默认密码 123456）
          </Typography.Text>
          <Input.TextArea
            placeholder={"zhangsan,zs@example.com,,123456,1\nlisi,,,,2\nwangwu,,13800000000,,3"}
            value={text}
            onChange={setText}
            autoSize={{ minRows: 10, maxRows: 24 }}
            style={{ fontFamily: "monospace" }}
          />
          <Button
            type="primary"
            onClick={handleBatchCreate}
            loading={loading}
            style={{ marginTop: 12 }}
            long
          >
            批量创建
          </Button>
        </Card>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Card style={{ height: "100%" }}>
          <Typography.Text bold style={{ display: "block", marginBottom: 8 }}>
            创建结果
          </Typography.Text>
          {created.length === 0 && failed.length === 0 && (
            <Typography.Text type="secondary">创建后将在此显示结果</Typography.Text>
          )}
          {created.length > 0 && (
            <Table
              columns={resultColumns}
              data={created}
              rowKey="id"
              pagination={false}
              size="small"
              border={false}
            />
          )}
          {failed.length > 0 && (
            <div style={{ marginTop: created.length > 0 ? 12 : 0 }}>
              <Typography.Text style={{ color: "var(--color-error)", display: "block", marginBottom: 4 }}>
                失败：{failed.length} 个
              </Typography.Text>
              {failed.map((msg, i) => (
                <div key={i} style={{ color: "var(--color-error)", fontSize: 13, padding: "2px 0" }}>{msg}</div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

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
      if (!payload.email) delete payload.email;
      if (!payload.phone) delete payload.phone;
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
          sizeOptions: [10, 20, 50],
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
      <Tabs defaultActiveTab="create" style={{ marginTop: 16 }}>
        <Tabs.TabPane key="create" title="创建用户">
          <CreateUserTab />
        </Tabs.TabPane>
        <Tabs.TabPane key="batch" title="批量创建">
          <BatchCreateTab />
        </Tabs.TabPane>
        <Tabs.TabPane key="manage" title="管理用户">
          <ManageUsersTab />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
