import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Message } from "@arco-design/web-react";
import { IconUser, IconLock } from "@arco-design/web-react/icon";
import { useAuthStore } from "../../stores/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { account: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.account, values.password);
      Message.success("登录成功");
      navigate("/");
    } catch (err: any) {
      Message.error(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <Card style={{ width: 400 }} title="登录 ETL OJ">
        <Form layout="vertical" onSubmit={handleSubmit}>
          <Form.Item field="account" label="用户名" rules={[{ required: true }]}>
            <Input prefix={<IconUser />} placeholder="用户名 / 邮箱 / 手机号" />
          </Form.Item>
          <Form.Item field="password" label="密码" rules={[{ required: true }]}>
            <Input.Password prefix={<IconLock />} placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" long loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
