import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Layout, Spin } from "@arco-design/web-react";
import AppHeader from "./components/AppHeader";
import HomePage from "./pages/home";
import ProblemListPage from "./pages/problems";
import ProblemDetailPage from "./pages/problems/detail";
import RankingPage from "./pages/ranking";
import LoginPage from "./pages/login";
import AdminUsersPage from "./pages/admin/users";
import AdminProblemsPage from "./pages/admin/problems";
import RecordsPage from "./pages/records";
import { useAuthStore } from "./stores/auth";

const { Content } = Layout;

function App() {
  const initFromStorage = useAuthStore((s) => s.initFromStorage);
  const loading = useAuthStore((s) => s.loading);
  const location = useLocation();
  const isDetailPage = /^\/problems\/[^/]+/.test(location.pathname);

  useEffect(() => {
    initFromStorage();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin />
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <AppHeader />
      <Content
        style={{
          maxWidth: isDetailPage ? "100%" : 1200,
          margin: "0 auto",
          padding: isDetailPage ? "16px 24px" : "24px 16px",
          width: "100%",
        }}
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/problems" element={<ProblemListPage />} />
          <Route path="/problems/:id" element={<ProblemDetailPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/ranking" element={<RankingPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/problems" element={<AdminProblemsPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
