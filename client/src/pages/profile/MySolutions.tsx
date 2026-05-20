import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { Card, Typography, Space, Tag, Spin, Empty, Button, Message, Popconfirm } from "@arco-design/web-react";
import { IconEdit, IconDelete } from "@arco-design/web-react/icon";
import { solutionApi } from "../../api/solution";

const { Title } = Typography;

/** 我的题解（懒加载） */
export default function MySolutions({ userId: _userId }: { userId: number }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadSolutions = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await solutionApi.mine();
      setSolutions(data);
      setLoaded(true);
    } catch {
      Message.error("加载题解失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || loaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadSolutions();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded, loadSolutions]);

  const handleDelete = async (solutionId: number) => {
    try {
      await solutionApi.delete(solutionId);
      Message.success("已删除");
      setSolutions((prev) => prev.filter((s) => s.id !== solutionId));
    } catch (err: any) {
      Message.error(err?.message || "删除失败");
    }
  };

  return (
    <Card bordered={false} className="profile-card" ref={containerRef}>
      <Title heading={6} className="card-title" style={{ marginBottom: 16 }}>我的题解</Title>
      {loading && <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>}
      {!loading && loaded && solutions.length === 0 && (
        <Empty description="还没有写过题解" style={{ padding: 32 }} />
      )}
      {!loading && solutions.length > 0 && (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {solutions.map((sol: any) => {
            const statusMap: Record<string, { label: string; color: string }> = {
              APPROVED: { label: "已通过", color: "green" },
              PENDING: { label: "正在审核", color: "blue" },
              REJECTED: { label: "被驳回", color: "red" },
            };
            const st = statusMap[sol.status] || statusMap.PENDING;
            return (
              <div
                key={sol.id}
                style={{
                  padding: "12px 16px",
                  background: "var(--color-fill-1)",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Link
                        to={`/problems/${sol.problem?.slug}`}
                        style={{ fontWeight: 600, fontSize: 14, color: "var(--color-primary)" }}
                      >
                        {sol.problem?.slug} {sol.problem?.title}
                      </Link>
                      <Tag size="small" color={st.color}>{st.label}</Tag>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-2)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {sol.content.replace(/[#*`>\-\[\]()]/g, "").slice(0, 100)}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--color-text-3)" }}>
                      {new Date(sol.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <Space size={4}>
                    {sol.status !== "APPROVED" && (
                      <Button
                        type="text"
                        size="mini"
                        icon={<IconEdit />}
                        onClick={() => navigate(`/problems/${sol.problem?.slug}?tab=solutions&edit=${sol.id}`)}
                      />
                    )}
                    <Popconfirm
                      title="确定删除这篇题解吗？"
                      onOk={() => handleDelete(sol.id)}
                    >
                      <Button type="text" size="mini" status="danger" icon={<IconDelete />} />
                    </Popconfirm>
                  </Space>
                </div>
                {sol.status === "REJECTED" && sol.rejectReason && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "var(--color-error)", background: "var(--color-danger-light-1)", padding: "6px 10px", borderRadius: 4 }}>
                    驳回原因：{sol.rejectReason}
                  </div>
                )}
              </div>
            );
          })}
        </Space>
      )}
    </Card>
  );
}
