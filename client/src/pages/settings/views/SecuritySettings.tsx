import { useState } from "react";
import { Typography, Form, Input, Button, Message, Divider } from "@arco-design/web-react";
import { userApi } from "../../../api/user";

const { Title, Paragraph } = Typography;

export default function SecuritySettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await userApi.updateSecurity({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      Message.success("密码修改成功，请妥善保管新密码！");
      form.resetFields();
    } catch (e: any) {
      Message.error(e?.message || "密码修改失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 500 }}>
      <Title heading={4}>密码与安全</Title>
      <Paragraph type="secondary">修改您的登录密码以保护账号安全。</Paragraph>
      <Divider />
      
      <div style={{ marginTop: 24 }}>
        <Form form={form} layout="vertical" onSubmit={handleSubmit} size="large">
          <Form.Item 
            label="当前密码" 
            field="oldPassword" 
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前使用的密码" />
          </Form.Item>

          <Form.Item 
            label="新密码" 
            field="newPassword" 
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码长度不能少于6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>

          <Form.Item 
            label="确认新密码" 
            field="confirmPassword" 
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(value, cb) {
                  if (!value || getFieldValue('newPassword') === value) {
                    cb();
                  } else {
                    cb('两次输入的密码不匹配');
                  }
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} style={{ width: 120 }}>
              更新密码
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
