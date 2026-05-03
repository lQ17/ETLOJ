import { useState } from "react";
import { Form, Input, Button, Select, Card, Message, Typography } from "@arco-design/web-react";
import { userApi } from "../../api/user";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: {
    username: string;
    email: string;
    password: string;
    role: string;
  }) => {
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
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 40 }}>
      <Card style={{ width: 480 }} title="创建用户">
        <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
          仅管理员可创建新用户。注册不对外开放。
        </Typography.Paragraph>
        <Form layout="vertical" onSubmit={handleSubmit}>
          <Form.Item field="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item field="email" label="邮箱" rules={[{ required: true, type: "email" }]}>
            <Input placeholder="邮箱" />
          </Form.Item>
          <Form.Item field="password" label="密码" rules={[{ required: true, minLength: 6 }]}>
            <Input.Password placeholder="密码（至少6位）" />
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
