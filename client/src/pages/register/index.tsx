import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Message, Result } from "@arco-design/web-react";
import { IconUser, IconLock, IconEmail } from "@arco-design/web-react/icon";
import { Turnstile } from "@marsidev/react-turnstile";
import logoWithText from "../../assets/images/logo-with-text.png";
import { authApi } from "../../api/auth";
import "../login/login.css"; // Reuse the login page CSS

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (values: any) => {
    if (values.password !== values.confirmPassword) {
      Message.error("两次输入的密码不一致");
      return;
    }
    if (!turnstileToken) {
      Message.warning("请完成人机验证");
      return;
    }
    setLoading(true);
    try {
      await authApi.register({
        username: values.username,
        password: values.password,
        email: values.email,
        remark: values.remark,
        turnstileToken,
      });
      setIsSuccess(true);
    } catch (err: any) {
      Message.error(err?.response?.data?.message || err?.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="login-page-wrapper">
        <div className="login-glow-container">
          <div className="login-glow-1" />
          <div className="login-glow-2" />
        </div>
        <div className="login-content" style={{ maxWidth: 480 }}>
          <Card bordered={false} className="login-glass-card" style={{ padding: 40 }}>
            <Result
              status="success"
              title="注册申请已提交"
              subTitle="您的账号注册申请已成功提交，请耐心等待管理员审核。审核通过后您即可登录平台。"
              extra={[
                <Button key="back" type="primary" onClick={() => navigate("/login")}>
                  返回登录页面
                </Button>,
              ]}
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page-wrapper">
      <div className="login-glow-container">
        <div className="login-glow-1" />
        <div className="login-glow-2" />
      </div>

      <div className="login-content" style={{ maxWidth: 460 }}>
        <div className="login-brand-section">
          <div className="login-logo-container">
            <img src={logoWithText} alt="ETLOJ" style={{ height: 46, objectFit: "contain" }} />
          </div>
          <h1 className="login-title">加入平台</h1>
          <p className="login-subtitle">注册新账号并等待审核</p>
        </div>

        <Card bordered={false} className="login-glass-card" style={{ padding: "32px 32px 24px" }}>
          <Form layout="vertical" onSubmit={handleSubmit} className="login-form">
            <Form.Item field="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
              <Input className="login-input-wrapper" prefix={<IconUser />} placeholder="设置用户名 (3-20个字符)" maxLength={20} minLength={3} />
            </Form.Item>
            
            <Form.Item field="email" label="邮箱" rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "请输入有效的邮箱地址" }]}>
              <Input className="login-input-wrapper" prefix={<IconEmail />} placeholder="请输入常用邮箱" />
            </Form.Item>

            <Form.Item field="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password className="login-input-wrapper" prefix={<IconLock />} placeholder="设置密码 (最少6个字符)" minLength={6} />
            </Form.Item>

            <Form.Item field="confirmPassword" label="确认密码" rules={[{ required: true, message: "请再次输入密码" }]}>
              <Input.Password className="login-input-wrapper" prefix={<IconLock />} placeholder="请再次输入密码" />
            </Form.Item>

            <Form.Item field="remark" label="申请说明 (选填)">
              <Input.TextArea className="login-input-wrapper" placeholder="例如：我是软件工程X班的张三，学号123456" autoSize={{ minRows: 2, maxRows: 4 }} />
            </Form.Item>

            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <Turnstile
                siteKey={
                  // 如果是本地开发环境，自动使用 Cloudflare 官方测试 Site Key，防止 110200 域名未授权错误
                  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
                    ? "1x00000000000000000000AA"
                    : "0x4AAAAAADqLQ4ZrU-Lb81-a"
                }
                onSuccess={(token) => setTurnstileToken(token)}
                onError={() => Message.error("人机验证组件加载失败")}
                options={{ theme: "dark" }}
              />
            </div>

            <Form.Item style={{ marginBottom: 4 }}>
              <Button type="primary" htmlType="submit" long loading={loading} size="large" className="login-submit-btn">
                提交注册申请
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div className="login-footer-info">
          已有账号？<span onClick={() => navigate("/login")} style={{ color: "var(--color-text-1)", cursor: "pointer", textDecoration: "underline", marginRight: 16 }}>直接登录</span>
          遇到问题？<a href="mailto:qingx.yang@outlook.com">联系管理员</a>
        </div>
      </div>
    </div>
  );
}
