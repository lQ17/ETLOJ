import { Layout, Menu, Typography, Card } from "@arco-design/web-react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { IconUser, IconSafe, IconSkin } from "@arco-design/web-react/icon";
import GeneralSettings from "./views/GeneralSettings";
import SecuritySettings from "./views/SecuritySettings";
import ThemeSettings from "./views/ThemeSettings";

const { Sider, Content } = Layout;
const MenuItem = Menu.Item;

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useMediaQuery();

  // 根据当前路由确定高亮的菜单项
  const selectedKey = location.pathname.includes("security")
    ? "security"
    : location.pathname.includes("theme")
    ? "theme"
    : "general";

  return (
    <Card bordered={false} style={{ borderRadius: 8 }}>
      <Layout 
        className="settings-layout"
        style={{ 
          minHeight: "60vh", 
          background: "transparent",
          flexDirection: isMobile ? "column" : "row"
        }}
      >
        <Sider 
          width={isMobile ? "100%" : 240} 
          style={{ 
            borderRight: isMobile ? "none" : "1px solid var(--color-border)", 
            borderBottom: isMobile ? "1px solid var(--color-border)" : "none",
            background: "transparent",
            paddingBottom: isMobile ? 16 : 0
          }}
        >
          <Typography.Title heading={5} style={{ padding: isMobile ? "0" : "0 16px", marginTop: 8 }}>
            个人设置
          </Typography.Title>
          <Menu
            selectedKeys={[selectedKey]}
            onClickMenuItem={(key) => navigate(`/settings/${key}`)}
            style={{ width: "100%", background: "transparent" }}
          >
            <MenuItem key="general">
              <IconUser style={{ marginRight: 8 }} />
              基础资料
            </MenuItem>
            <MenuItem key="security">
              <IconSafe style={{ marginRight: 8 }} />
              密码与安全
            </MenuItem>
            <MenuItem key="theme">
              <IconSkin style={{ marginRight: 8 }} />
              个性化设计
            </MenuItem>
          </Menu>
        </Sider>
        
        <Content style={{ padding: isMobile ? "16px 0" : "24px 48px" }}>
          <Routes>
            <Route path="/" element={<GeneralSettings />} />
            <Route path="/general" element={<GeneralSettings />} />
            <Route path="/security" element={<SecuritySettings />} />
            <Route path="/theme" element={<ThemeSettings />} />
          </Routes>
        </Content>
      </Layout>
    </Card>
  );
}
