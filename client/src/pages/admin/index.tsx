import { Tabs, Typography } from "@arco-design/web-react";
import { IconApps, IconList, IconFile, IconSound, IconUser, IconRobot, IconMessage } from "@arco-design/web-react/icon";
import AdminProblemsPage from "./problems";
import AdminListsPage from "./lists";
import AdminUsersPage from "./users";
import AdminSolutionsPage from "./solutions";
import AdminAnnouncementsPage from "./announcements";
import AdminFeedbackPage from "./feedback";
import { useAuthStore } from "../../stores/auth";

import AdminAiPage from "./ai";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";

  return (
    <div style={{ padding: "32px 24px", maxWidth: 1400, margin: "0 auto", minHeight: "80vh" }}>
      <Typography.Title heading={3} style={{ marginTop: 0, marginBottom: 32, fontWeight: 600 }}>
        后台管理中枢
      </Typography.Title>
      
      <Tabs 
        defaultActiveTab="problems" 
        tabPosition="left" 
        size="large"
        animation
        destroyOnHide
        className="admin-sidebar-tabs"
      >
        <Tabs.TabPane 
          key="problems" 
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}><IconApps /> 题目与标签</div>}
        >
          <div style={{ paddingLeft: 32 }}>
            <AdminProblemsPage />
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane 
          key="lists" 
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}><IconList /> 题单管理</div>}
        >
          <div style={{ paddingLeft: 32 }}>
            <AdminListsPage />
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane 
          key="solutions" 
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}><IconFile /> 题解管理</div>}
        >
          <div style={{ paddingLeft: 32 }}>
            <AdminSolutionsPage />
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane
          key="feedback"
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}><IconMessage /> 课堂反馈</div>}
        >
          <div style={{ paddingLeft: 32 }}>
            <AdminFeedbackPage />
          </div>
        </Tabs.TabPane>

        {isAdmin && (
          <Tabs.TabPane 
            key="announcements" 
            title={<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}><IconSound /> 公告管理</div>}
          >
            <div style={{ paddingLeft: 32 }}>
              <AdminAnnouncementsPage />
            </div>
          </Tabs.TabPane>
        )}

        {isAdmin && (
          <Tabs.TabPane 
            key="users" 
            title={<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}><IconUser /> 用户管理</div>}
          >
            <div style={{ paddingLeft: 32 }}>
              <AdminUsersPage />
            </div>
          </Tabs.TabPane>
        )}

        {isAdmin && (
          <Tabs.TabPane 
            key="ai" 
            title={<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}><IconRobot /> AI 核心设定</div>}
          >
            <div style={{ paddingLeft: 32 }}>
              <AdminAiPage />
            </div>
          </Tabs.TabPane>
        )}
      </Tabs>
      
      {/* 补充一点小样式来优化左侧边栏的美感 */}
      <style>{`
        .admin-sidebar-tabs .arco-tabs-nav-vertical {
          width: 220px;
          border-right: 1px solid var(--color-border-1);
        }
        .admin-sidebar-tabs .arco-tabs-tab {
          padding: 16px 20px !important;
          margin-bottom: 8px !important;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .admin-sidebar-tabs .arco-tabs-tab:hover {
          background-color: var(--color-fill-2);
        }
        .admin-sidebar-tabs .arco-tabs-tab-active {
          background-color: var(--color-fill-1);
          font-weight: 600;
        }
        .admin-sidebar-tabs .arco-tabs-nav-ink {
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
