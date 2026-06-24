import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, Card, Message, Modal } from "@arco-design/web-react";
import { IconUser, IconLock, IconEmail } from "@arco-design/web-react/icon";
import { Turnstile } from "@marsidev/react-turnstile";
import logoWithText from "../../assets/images/logo-with-text.png";
import { useAuthStore } from "../../stores/auth";
import { authApi } from "../../api/auth";
import "./login.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);

  // 重新申请 Modal 状态
  const [reapplyVisible, setReapplyVisible] = useState(false);
  const [reapplyLoading, setReapplyLoading] = useState(false);
  const [reapplyUser, setReapplyUser] = useState<any>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [reapplyForm] = Form.useForm();

  const handleSubmit = async (values: { account: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.account, values.password);
      Message.success("登录成功");
      navigate("/");
    } catch (err: any) {
      if (err?.code === "REGISTRATION_REJECTED") {
        const defaultUser = {
          username: err.username || values.account,
          password: values.password,
          email: err.email || "",
          remark: err.remark || "",
        };
        setReapplyUser(defaultUser);
        reapplyForm.setFieldsValue({
          email: defaultUser.email,
          remark: defaultUser.remark,
        });
        setTurnstileToken("");
        setReapplyVisible(true);
        return;
      }
      Message.error(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleReapplySubmit = async () => {
    try {
      const values = await reapplyForm.validate();
      if (!turnstileToken) {
        Message.warning("请完成人机验证");
        return;
      }
      setReapplyLoading(true);
      await authApi.reapply({
        username: reapplyUser.username,
        password: reapplyUser.password,
        email: values.email,
        remark: values.remark,
        turnstileToken,
      });
      Message.success("申请重新提交成功，请等待管理员审核");
      setReapplyVisible(false);
    } catch (err: any) {
      Message.error(err?.message || "重新提交失败");
    } finally {
      setReapplyLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      {/* Background spotlights glows */}
      <div className="login-glow-container">
        <div className="login-glow-1" />
        <div className="login-glow-2" />
      </div>

      <div className="login-content">
        <div className="login-brand-section">
          {/* Brand Logo */}
          <div className="login-logo-container">
            <img src={logoWithText} alt="ETLOJ" style={{ height: 46, objectFit: "contain" }} />
          </div>
          <h1 className="login-title">欢迎回来</h1>
          <p className="login-subtitle">继续你的算法进阶之旅</p>
        </div>

        <Card bordered={false} className="login-glass-card">
          <Form layout="vertical" onSubmit={handleSubmit} className="login-form" style={{ marginTop: 4 }}>
            <Form.Item field="account" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
              <Input 
                className="login-input-wrapper" 
                prefix={<IconUser />} 
                placeholder="用户名 / 邮箱 / 手机号" 
                size="large" 
                maxLength={100} 
                minLength={1} 
              />
            </Form.Item>
            <Form.Item field="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password 
                className="login-input-wrapper" 
                prefix={<IconLock />} 
                placeholder="请输入密码" 
                size="large" 
                maxLength={100} 
                minLength={1} 
              />
            </Form.Item>
            <Form.Item style={{ marginTop: 28, marginBottom: 4 }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                long 
                loading={loading} 
                size="large"
                className="login-submit-btn"
              >
                进入平台
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Footer Support Info */}
        <div className="login-footer-info">
          还没有账号？<span onClick={() => navigate("/register")} style={{ color: "var(--color-text-1)", cursor: "pointer", textDecoration: "underline", marginRight: 16 }}>立即注册</span>
          遇到问题？<a href="mailto:qingx.yang@outlook.com">联系管理员</a>
        </div>
        <div className="login-footer-copyright">
          © ETLOJ - Easy To Learn OJ
        </div>
      </div>

      <Modal
        title="重新提交注册申请"
        visible={reapplyVisible}
        onOk={handleReapplySubmit}
        onCancel={() => setReapplyVisible(false)}
        confirmLoading={reapplyLoading}
        okText="确认并重新提交"
        cancelText="取消"
        style={{ width: 440 }}
      >
        <div style={{ marginBottom: 16, color: "var(--color-text-2)", fontSize: 13, lineHeight: 1.6 }}>
          您的注册申请已被拒绝。您可以直接修改邮箱和申请理由重新提交审核，原用户名和密码保持不变，无需重新注册。
        </div>
        <Form form={reapplyForm} layout="vertical">
          <Form.Item field="email" label="邮箱" rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "请输入有效的邮箱" }]}>
            <Input className="login-input-wrapper" prefix={<IconEmail />} placeholder="请输入新的常用邮箱" />
          </Form.Item>
          <Form.Item field="remark" label="申请说明/重新提交理由">
            <Input.TextArea className="login-input-wrapper" placeholder="重新陈述申请原因，如补填班级学号信息" autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
            <Turnstile
              siteKey={
                (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
                  ? "1x00000000000000000000AA"
                  : "0x4AAAAAADqLQ4ZrU-Lb81-a"
              }
              onSuccess={(token) => setTurnstileToken(token)}
              onError={() => Message.error("人机验证组件加载失败")}
              options={{ theme: "dark" }}
            />
          </div>
        </Form>
      </Modal>
    </div>
  );
}

