import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Layout, Spin } from "@arco-design/web-react";
import AppHeader from "./components/AppHeader";
import HomePage from "./pages/home";
import ProblemListPage from "./pages/problems";
import ProblemDetailPage from "./pages/problems/detail";
import ProblemListsPage from "./pages/lists";
import ProblemListDetailPage from "./pages/lists/detail";
import RankingPage from "./pages/ranking";
import LoginPage from "./pages/login";
import AdminPage from "./pages/admin";
import RecordsPage from "./pages/records";
import ProfilePage from "./pages/profile";
import SettingsPage from "./pages/settings";
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
          padding: isDetailPage ? "24px 32px" : "48px 32px",
          width: "100%",
        }}
      >
        <div key={location.pathname} className="page-transition-wrapper">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/problems" element={<ProblemListPage />} />
            <Route path="/problems/:id" element={<ProblemDetailPage />} />
            <Route path="/lists" element={<ProblemListsPage />} />
            <Route path="/lists/:id" element={<ProblemListDetailPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/profile/:username" element={<ProfilePage />} />
            <Route path="/settings/*" element={<SettingsPage />} />
          </Routes>
        </div>
      </Content>
    </Layout>
  );
}

export default App;
