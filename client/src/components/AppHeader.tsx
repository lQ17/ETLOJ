import { useState, useRef, useEffect } from "react";
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
    { key: "/lists", label: "题单" },
    { key: "/records", label: "评测记录" },
    { key: "/ranking", label: "排名" },
  ];

  const selectedKey = menuItems.find(
    (item) => item.key !== "/" && location.pathname.startsWith(item.key)
  )?.key ?? "/";

  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const navContainerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const index = menuItems.findIndex(item => item.key === selectedKey);
    const el = navRefs.current[index];
    if (el) {
      setIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
        opacity: 1
      });
    }
  }, [selectedKey, location.pathname]);

  const roleColors: Record<string, string> = {
    ADMIN: "red",
    TEACHER: "blue",
    USER: "green",
  };

  return (
    <Header
      style={{
        background: "var(--color-canvas)",
        borderBottom: "1px solid var(--color-hairline)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        height: 64,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <Space size="small" style={{ cursor: "pointer", marginRight: 48 }} onClick={() => navigate("/")}>
        <div style={{ width: 24, height: 24, background: "var(--color-ink)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconCode style={{ fontSize: 16, color: "var(--color-canvas)" }} />
        </div>
        <span style={{ fontWeight: 600, fontSize: 18, color: "var(--color-ink)", letterSpacing: "-0.02em" }}>ETLOJ</span>
      </Space>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", height: "100%" }}>
        <div ref={navContainerRef} style={{ position: "relative", display: "flex", height: "100%", gap: 40 }}>
          {menuItems.map((item, index) => {
            const isActive = item.key === selectedKey;
            return (
              <div
                key={item.key}
                ref={(el) => (navRefs.current[index] = el)}
                onClick={() => navigate(item.key)}
                style={{
                  cursor: "pointer",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 15,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--color-primary)" : "var(--color-muted)",
                  transition: "color 0.2s"
                }}
              >
                {item.label}
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              height: 2,
              backgroundColor: "var(--color-primary)",
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              opacity: indicatorStyle.opacity,
              transition: "left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              pointerEvents: "none"
            }}
          />
        </div>
      </div>
      <Space>
        {user ? (
          <Dropdown
            droplist={
              <Menu>
                <Menu.Item key="profile" onClick={() => navigate(`/profile/${user.username}`)}>
                  个人主页
                </Menu.Item>
                <Menu.Item key="settings" onClick={() => navigate("/settings")}>
                  个人设置
                </Menu.Item>
                {(user.role === "ADMIN" || user.role === "TEACHER") && (
                  <Menu.Item key="admin" onClick={() => navigate("/admin")}>
                    后台管理
                  </Menu.Item>
                )}
                <Menu.Item key="logout" onClick={() => { logout(); navigate("/"); }}>
                  退出登录
                </Menu.Item>
              </Menu>
            }
          >
            <Space style={{ cursor: "pointer" }}>
              {user.avatar ? (
                <img src={user.avatar} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} alt="avatar" />
              ) : (
                <IconUser />
              )}
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
