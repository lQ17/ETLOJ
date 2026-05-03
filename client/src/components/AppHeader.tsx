import { Layout, Menu, Space, Button, Tag, Dropdown } from "@arco-design/web-react";
import { IconCode, IconUser } from "@arco-design/web-react/icon";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

const { Header } = Layout;

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const menuItems = [
    { key: "/", label: "首页" },
    { key: "/problems", label: "题库" },
    { key: "/ranking", label: "排名" },
  ];

  const selectedKey = menuItems.find(
    (item) => item.key !== "/" && location.pathname.startsWith(item.key)
  )?.key ?? "/";

  const roleColors: Record<string, string> = {
    ADMIN: "red",
    TEACHER: "blue",
    USER: "green",
  };

  return (
    <Header
      style={{
        background: "var(--color-bg-2)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
      }}
    >
      <Space size="medium" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
        <IconCode style={{ fontSize: 24, color: "rgb(var(--primary-6))" }} />
        <span style={{ fontWeight: 600, fontSize: 18 }}>ETL OJ</span>
      </Space>
      <Menu
        mode="horizontal"
        selectedKeys={[selectedKey]}
        onClickMenuItem={(key) => navigate(key)}
        style={{ flex: 1, justifyContent: "center", border: "none", background: "transparent" }}
      >
        {menuItems.map((item) => (
          <Menu.Item key={item.key}>{item.label}</Menu.Item>
        ))}
      </Menu>
      <Space>
        {user ? (
          <Dropdown
            droplist={
              <Menu>
                {(user.role === "ADMIN" || user.role === "TEACHER") && (
                  <Menu.Item key="admin-problems" onClick={() => navigate("/admin/problems")}>
                    题目管理
                  </Menu.Item>
                )}
                {user.role === "ADMIN" && (
                  <Menu.Item key="admin-users" onClick={() => navigate("/admin/users")}>
                    用户管理
                  </Menu.Item>
                )}
                <Menu.Item key="logout" onClick={logout}>
                  退出登录
                </Menu.Item>
              </Menu>
            }
          >
            <Space style={{ cursor: "pointer" }}>
              <IconUser />
              <span>{user.username}</span>
              <Tag color={roleColors[user.role]}>{user.role}</Tag>
            </Space>
          </Dropdown>
        ) : (
          <Button type="text" onClick={() => navigate("/login")}>
            登录
          </Button>
        )}
      </Space>
    </Header>
  );
}
