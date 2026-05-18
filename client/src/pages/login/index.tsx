import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Message } from "@arco-design/web-react";
import { IconUser, IconLock } from "@arco-design/web-react/icon";
import logoWithText from "../../assets/images/logo-with-text.png";
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
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 50%, #f5f5f5 100%)" }}>
      <div style={{ width: 420, position: "relative" }}>
        {/* 背景装饰圆 */}
        <div style={{ position: "absolute", top: -120, right: -80, width: 300, height: 300, borderRadius: "50%", background: "#e5e7eb", opacity: 0.5, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: -100, width: 200, height: 200, borderRadius: "50%", background: "#f3f4f6", opacity: 0.6, pointerEvents: "none" }} />

        <div style={{ textAlign: "center", marginBottom: 32, position: "relative" }}>
          {/* 品牌 Logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <img src={logoWithText} alt="ETLOJ" style={{ height: 44, objectFit: "contain" }} />
          </div>
          <h1 style={{ fontSize: 24, marginBottom: 8, fontWeight: 600 }}>欢迎回来</h1>
          <p style={{ color: "var(--color-muted)", fontSize: 15 }}>继续你的算法进阶之旅</p>
        </div>
        <Card bordered={false} style={{ borderTop: "2px solid var(--color-primary)", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", borderRadius: "var(--rounded-xl)" }}>
          <Form layout="vertical" onSubmit={handleSubmit} style={{ marginTop: 8 }}>
            <Form.Item field="account" label="账号" rules={[{ required: true }]}>
              <Input prefix={<IconUser />} placeholder="用户名 / 邮箱 / 手机号" size="large" maxLength={100} minLength={1} />
            </Form.Item>
            <Form.Item field="password" label="密码" rules={[{ required: true }]}>
              <Input.Password prefix={<IconLock />} placeholder="请输入密码" size="large" maxLength={100} minLength={1} />
            </Form.Item>
            <Form.Item style={{ marginTop: 24, marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" long loading={loading} size="large">
                进入平台
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* 底部信息 */}
        <p style={{ textAlign: "center", color: "var(--color-muted)", fontSize: 12, marginTop: 32 }}>
          © ETLOJ - Easy To Learn OJ
        </p>
      </div>
    </div>
  );
}
