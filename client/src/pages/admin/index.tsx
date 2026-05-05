import { Tabs, Typography } from "@arco-design/web-react";
import AdminProblemsPage from "./problems";
import AdminListsPage from "./lists";
import AdminUsersPage from "./users";
import { useAuthStore } from "../../stores/auth";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";

  return (
    <div>
      <Typography.Title heading={4}>后台管理</Typography.Title>
      <Tabs defaultActiveTab="problems">
        <Tabs.TabPane key="problems" title="题目管理">
          <AdminProblemsPage />
        </Tabs.TabPane>
        <Tabs.TabPane key="lists" title="题单管理">
          <AdminListsPage />
        </Tabs.TabPane>
        {isAdmin && (
          <Tabs.TabPane key="users" title="用户管理">
            <AdminUsersPage />
          </Tabs.TabPane>
        )}
      </Tabs>
    </div>
  );
}
