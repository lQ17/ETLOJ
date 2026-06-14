import { useState, useEffect } from "react";
import { Typography, Form, Input, Button, Message, Avatar, Upload, Divider, Grid } from "@arco-design/web-react";
import { IconCamera, IconUser } from "@arco-design/web-react/icon";
import { useAuthStore } from "../../../stores/auth";
import { userApi } from "../../../api/user";
import { useMediaQuery } from "../../../hooks/useMediaQuery";

const { Title, Paragraph } = Typography;
const { Row, Col } = Grid;

export default function GeneralSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { isMobile } = useMediaQuery();
  
  const user = useAuthStore((s) => s.user);
  const initFromStorage = useAuthStore((s) => s.initFromStorage);

  const [avatarBase64, setAvatarBase64] = useState<string | undefined>(user?.avatar);

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        username: user.username,
        email: user.email,
        phone: user.phone,
        signature: user.signature,
      });
      setAvatarBase64(user.avatar);
    }
  }, [user, form]);

  const handleAvatarChange = (_: any, file: any) => {
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarBase64(reader.result as string);
      form.setFieldValue("avatar", reader.result as string);
    };
    if (file.originFile) {
      reader.readAsDataURL(file.originFile);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await userApi.updateProfile({
        email: values.email,
        phone: values.phone,
        signature: values.signature,
        avatar: avatarBase64,
      });
      Message.success("基础资料更新成功");
      await initFromStorage(); // Refresh global user state
    } catch (e: any) {
      Message.error(e?.message || "更新失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <Title heading={4}>基础资料</Title>
      <Paragraph type="secondary">管理你的公开档案、头像和个人偏好设置。</Paragraph>
      <Divider />
      
      <div style={{ marginTop: 24 }}>
        <Form form={form} layout="vertical" onSubmit={handleSubmit} size="large">
          <Row gutter={isMobile ? 0 : 48}>
            <Col span={isMobile ? 24 : 16} style={{ order: isMobile ? 2 : 1 }}>
              <Form.Item label="用户名 (Username)" field="username">
                <Input disabled placeholder="用户名不可修改" />
              </Form.Item>
              
              <Form.Item label="个性签名 (Signature)" field="signature">
                <Input.TextArea placeholder="用一句话介绍你自己..." maxLength={100} showWordLimit autoSize={{ minRows: 3, maxRows: 5 }} />
              </Form.Item>

              <Form.Item label="邮箱 (Email)" field="email" rules={[{ type: 'email', message: '请输入有效的邮箱' }]}>
                <Input placeholder="输入你的联系邮箱" />
              </Form.Item>

              <Form.Item label="手机号 (Phone)" field="phone">
                <Input placeholder="输入你的手机号" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} style={{ width: 120 }}>
                  保存修改
                </Button>
              </Form.Item>
            </Col>

            <Col span={isMobile ? 24 : 8} style={{ order: isMobile ? 1 : 2, marginBottom: isMobile ? 24 : 0 }}>
              <Form.Item label="头像 (Avatar)">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Upload
                    showUploadList={false}
                    autoUpload={false}
                    onChange={handleAvatarChange}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer' }}>
                      <Avatar size={120} triggerIcon={<IconCamera />} triggerType="mask" style={{ backgroundColor: 'var(--color-fill-3)' }}>
                        {avatarBase64 ? <img src={avatarBase64} alt="avatar" /> : <IconUser style={{ fontSize: 48 }} />}
                      </Avatar>
                      <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
                        点击头像上传<br />支持 JPG, PNG, WEBP (最大 2MB)
                      </Typography.Text>
                    </div>
                  </Upload>
                </div>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>
    </div>
  );
}
