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
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "10vh" }}>
      <div style={{ width: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>登录 ETLOJ</h1>
          <p style={{ color: "var(--color-muted)", fontSize: 15 }}>欢迎回来，继续你的算法进阶之旅</p>
        </div>
        <Card bordered={false} style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.04)", borderRadius: "var(--rounded-xl)" }}>
          <Form layout="vertical" onSubmit={handleSubmit} style={{ marginTop: 8 }}>
            <Form.Item field="account" label="账号" rules={[{ required: true }]}>
              <Input prefix={<IconUser />} placeholder="用户名 / 邮箱 / 手机号" size="large" />
            </Form.Item>
            <Form.Item field="password" label="密码" rules={[{ required: true }]}>
              <Input.Password prefix={<IconLock />} placeholder="请输入密码" size="large" />
            </Form.Item>
            <Form.Item style={{ marginTop: 24, marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" long loading={loading} size="large">
                进入平台
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}
