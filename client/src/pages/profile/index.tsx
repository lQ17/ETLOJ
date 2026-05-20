import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Grid, Card, Typography, Space, Divider, Tabs, Spin, Empty, Avatar } from "@arco-design/web-react";
import { IconUser, IconCalendar, IconStar, IconThunderbolt } from "@arco-design/web-react/icon";
import { profileApi } from "../../api/profile";
import { useAuthStore } from "../../stores/auth";
import { getSafeAvatar } from "./constants";
import type { ProfileInfo, ProfileStats } from "./constants";
import HeatmapChart from "./HeatmapChart";
import PieChart from "./PieChart";
import WordCloudChart from "./WordCloudChart";
import ProblemWall from "./ProblemWall";
import MySolutions from "./MySolutions";
import "./profile.css";

const { Row, Col } = Grid;
const { Title, Text } = Typography;

// ===================== Component =====================
export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    Promise.all([
      profileApi.getProfile(username),
      profileApi.getStats(username),
    ]).then(([p, s]: any) => {
      setProfile(p);
      setStats(s);
    }).catch(() => {
      setProfile(null);
      setStats(null);
    }).finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="profile-loading"><Spin size={40} /></div>;
  if (!profile) return <div className="profile-loading"><Empty description="用户不存在" /></div>;

  return (
    <div className="profile-page">
      <Row gutter={24}>
        {/* ====== 左侧：用户名片 ====== */}
        <Col xs={24} md={7} lg={6}>
          <Card bordered={false} className="profile-card user-card">
            <div className="user-card-inner">
              <Avatar size={96} className="user-avatar" triggerIcon={null}>
                {getSafeAvatar(profile.avatar)
                  ? <img src={getSafeAvatar(profile.avatar)} alt="avatar" />
                  : <IconUser style={{ fontSize: 48 }} />
                }
              </Avatar>
              <Title heading={5} className="user-name">{profile.username}</Title>
              <Text type="secondary" className="user-handle">@{profile.username}</Text>

              <Divider className="user-divider" />

              <Space direction="vertical" className="user-meta" size={8}>
                <div className="meta-row">
                  <IconCalendar className="meta-icon" />
                  <Text type="secondary">注册于 {new Date(profile.createdAt).toLocaleDateString("zh-CN")}</Text>
                </div>
                <div className="meta-row">
                  <IconStar className="meta-icon" />
                  <Text type="secondary">{profile.signature || "这个人很懒，什么都没写~"}</Text>
                </div>
              </Space>

              <Divider className="user-divider" />

              <Row className="stat-row">
                <Col span={8} className="stat-cell">
                  <div className="stat-value">{profile.solvedCount}</div>
                  <div className="stat-label">已解题数</div>
                </Col>
                <Col span={8} className="stat-cell">
                  <div className="stat-value">{profile.totalSubmissions}</div>
                  <div className="stat-label">总提交数</div>
                </Col>
                <Col span={8} className="stat-cell">
                  <div className="stat-value">{profile.totalScore ?? 0}</div>
                  <div className="stat-label">总分数</div>
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        {/* ====== 右侧：图表面板 ====== */}
        <Col xs={24} md={17} lg={18}>
          <Space direction="vertical" size={20} style={{ width: "100%" }}>

            {/* ---- 热力图 ---- */}
            <Card bordered={false} className="profile-card">
              <Title heading={6} className="card-title">
                <IconThunderbolt style={{ marginRight: 8 }} />活跃度
              </Title>
              <HeatmapChart data={stats?.heatmapData || []} />
            </Card>

            {/* ---- 饼图 + 雷达图 ---- */}
            <Row gutter={16} style={{ display: 'flex', alignItems: 'stretch' }}>
              <Col xs={24} lg={12} style={{ display: 'flex', marginBottom: 16 }}>
                <Card bordered={false} className="profile-card" style={{ width: '100%', height: '100%' }}>
                  <Title heading={6} className="card-title">提交统计</Title>
                  <div style={{ width: '100%' }}>
                    <PieChart data={stats?.statusDistribution || []} />
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={12} style={{ display: 'flex', marginBottom: 16 }}>
                <Card bordered={false} className="profile-card" style={{ width: '100%', height: '100%' }}>
                  <Title heading={6} className="card-title">能力词云</Title>
                  <div style={{ width: '100%' }}>
                    <WordCloudChart data={stats?.wordCloudData || []} />
                  </div>
                </Card>
              </Col>
            </Row>

            {/* ---- 题目墙 ---- */}
            <Card bordered={false} className="profile-card">
              <Tabs defaultActiveTab="ac" type="capsule">
                <Tabs.TabPane key="ac" title={`已通过 (${stats?.acProblems?.length || 0})`}>
                  <ProblemWall problems={stats?.acProblems || []} />
                </Tabs.TabPane>
                <Tabs.TabPane key="attempted" title={`尝试过 (${stats?.attemptedProblems?.length || 0})`}>
                  <ProblemWall problems={stats?.attemptedProblems || []} />
                </Tabs.TabPane>
              </Tabs>
            </Card>

            {/* ---- 我的题解（仅自己可见）---- */}
            {currentUser && currentUser.username === username && (
              <MySolutions userId={currentUser.id} />
            )}
          </Space>
        </Col>
      </Row>
    </div>
  );
}
