import { useState, useRef, useEffect } from "react";
import { Layout, Menu, Space, Button, Tag, Dropdown } from "@arco-design/web-react";
import { IconUser, IconSun, IconMoon } from "@arco-design/web-react/icon";
import logoWithText from "../assets/images/logo-with-text.png";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

const { Header } = Layout;

// 验证头像 URL 是否安全（仅允许 data:image 或 http/https URL）
function getSafeAvatar(avatar: string | undefined): string | undefined {
  if (!avatar) return undefined;
  if (/^data:image\//.test(avatar) || /^https?:\/\//.test(avatar)) return avatar;
  return undefined;
}

// 普通左键点击走 SPA 导航，Ctrl/Meta/中键点击让浏览器原生处理（打开新页签）
function handleNavClick(href: string, navigate: (to: string) => void) {
  return (e: React.MouseEvent) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      navigate(href);
    }
  };
}

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [theme, setTheme] = useState(() => {
    return document.body.getAttribute("arco-theme") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    const syncThemeState = () => {
      setTheme(document.body.getAttribute("arco-theme") === "dark" ? "dark" : "light");
    };
    window.addEventListener("theme-change", syncThemeState);
    return () => window.removeEventListener("theme-change", syncThemeState);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    
    // 手动切换时，关闭“跟随系统”设定
    localStorage.setItem("theme_follow_system", "false");
    
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    
    if (nextTheme === "dark") {
      document.body.setAttribute("arco-theme", "dark");
      document.body.setAttribute("data-color-mode", "dark");
    } else {
      document.body.removeAttribute("arco-theme");
      document.body.setAttribute("data-color-mode", "light");
    }
    window.dispatchEvent(new Event("theme-change"));
  };

  const menuItems = [
    { key: "/", label: "首页" },
    { key: "/problems", label: "题库" },
    { key: "/lists", label: "题单" },
    { key: "/records", label: "评测记录" },
    { key: "/ranking", label: "排名" },
    { key: "/visualization", label: "可视化算法" },
  ];

  const selectedKey = menuItems.find(
    (item) => item.key !== "/" && location.pathname.startsWith(item.key)
  )?.key ?? "/";

  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const navContainerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLAnchorElement | null)[]>([]);

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
      <a
        href="/"
        onClick={handleNavClick("/", navigate)}
        style={{ cursor: "pointer", marginRight: 48, color: "inherit", textDecoration: "none" }}
      >
        <img src={logoWithText} alt="ETLOJ" className="logo-image" style={{ height: 32, objectFit: "contain" }} />
      </a>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", height: "100%" }}>
        <div ref={navContainerRef} style={{ position: "relative", display: "flex", height: "100%", gap: 40 }}>
          {menuItems.map((item, index) => {
            const isActive = item.key === selectedKey;
            return (
              <a
                key={item.key}
                ref={(el) => (navRefs.current[index] = el)}
                href={item.key}
                onClick={handleNavClick(item.key, navigate)}
                style={{
                  cursor: "pointer",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 15,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--color-primary)" : "var(--color-muted)",
                  textDecoration: "none",
                  transition: "color 0.2s"
                }}
              >
                {item.label}
              </a>
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
      <Space size={16}>
        <Button
          type="text"
          shape="circle"
          onClick={toggleTheme}
          icon={theme === "dark" ? <IconSun style={{ fontSize: 18, color: "var(--color-ink)" }} /> : <IconMoon style={{ fontSize: 18, color: "var(--color-ink)" }} />}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        />
        {user ? (
          <Dropdown
            droplist={
              <Menu>
                <Menu.Item key="profile">
                  <a
                    href={`/profile/${user.username}`}
                    onClick={handleNavClick(`/profile/${user.username}`, navigate)}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    个人主页
                  </a>
                </Menu.Item>
                <Menu.Item key="settings">
                  <a
                    href="/settings"
                    onClick={handleNavClick("/settings", navigate)}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    个人设置
                  </a>
                </Menu.Item>
                {(user.role === "ADMIN" || user.role === "TEACHER") && (
                  <Menu.Item key="admin">
                    <a
                      href="/admin"
                      onClick={handleNavClick("/admin", navigate)}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      后台管理
                    </a>
                  </Menu.Item>
                )}
                <Menu.Item key="logout" onClick={() => { logout(); navigate("/"); }}>
                  退出登录
                </Menu.Item>
              </Menu>
            }
          >
            <Space style={{ cursor: "pointer" }}>
              {getSafeAvatar(user.avatar) ? (
                <img src={getSafeAvatar(user.avatar)} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} alt="avatar" />
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
