import { useState, useEffect } from "react";
import { Typography, Spin } from "@arco-design/web-react";
import { IconNotification } from "@arco-design/web-react/icon";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { announcementApi } from "../../api/announcement";

const { Title, Text } = Typography;

interface Announcement {
  id: number;
  title: string;
  summary: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
}

export default function AnnouncementsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState<Announcement[]>([]);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    announcementApi.list({ pageSize: 100 }).then((res: any) => {
      setList(res.items);
      setListLoading(false);
      // 默认选中：URL 参数 > 第一条置顶 > 第一条
      const paramId = searchParams.get("id");
      if (paramId) {
        const found = res.items.find((a: Announcement) => a.id === +paramId);
        if (found) { loadDetail(found.id); return; }
      }
      const firstPinned = res.items.find((a: Announcement) => a.isPinned);
      if (firstPinned) loadDetail(firstPinned.id);
      else if (res.items.length > 0) loadDetail(res.items[0].id);
    }).catch(() => setListLoading(false));
  }, []);

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res: any = await announcementApi.getById(id);
      setSelected(res);
      setSearchParams({ id: String(id) }, { replace: true });
    } catch {
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelect = (item: Announcement) => {
    if (selected?.id === item.id) return;
    loadDetail(item.id);
  };

  return (
    <div style={{ display: "flex", gap: 32, minHeight: "calc(100vh - 200px)" }}>
      {/* 左侧列表 */}
      <div style={{
        width: 340,
        flexShrink: 0,
        background: "var(--color-surface-soft)",
        borderRadius: "var(--rounded-xl, 16px)",
        border: "1px solid var(--color-hairline)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid var(--color-hairline)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <IconNotification style={{ fontSize: 20, color: "var(--color-primary-6)" }} />
          <Title heading={5} style={{ margin: 0 }}>公告列表</Title>
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {listLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin /></div>
          ) : list.length === 0 ? (
            <div style={{ color: "var(--color-muted)", textAlign: "center", padding: 48 }}>暂无公告</div>
          ) : (
            list.map((item) => {
              const isActive = selected?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  style={{
                    padding: "14px 24px",
                    cursor: "pointer",
                    borderLeft: isActive ? "3px solid var(--color-primary-6)" : "3px solid transparent",
                    background: isActive ? "var(--color-canvas)" : "transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--color-fill-1)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {item.isPinned && <span style={{ color: "var(--color-warning-6)", fontSize: 13 }}>📌</span>}
                    <Text bold style={{ fontSize: 15, color: isActive ? "var(--color-primary-6)" : undefined }}>{item.title}</Text>
                  </div>
                  <Text style={{ fontSize: 12, color: "var(--color-muted)" }}>
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </Text>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 右侧详情 */}
      <div style={{
        flex: 1,
        background: "var(--color-surface-card)",
        borderRadius: "var(--rounded-xl, 16px)",
        border: "1px solid var(--color-hairline)",
        padding: "32px 40px",
        overflow: "auto",
      }}>
        {detailLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin /></div>
        ) : selected ? (
          <>
            <Title heading={3} style={{ marginTop: 0, marginBottom: 8 }}>{selected.title}</Title>
            <Text style={{ fontSize: 13, color: "var(--color-muted)", display: "block", marginBottom: 24 }}>
              {new Date(selected.createdAt).toLocaleString("zh-CN")}
            </Text>
            <div className="problem-markdown" style={{ fontSize: 16 }}>
              <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
                {selected.content || "暂无详情"}
              </ReactMarkdown>
            </div>
          </>
        ) : (
          <div style={{ color: "var(--color-muted)", textAlign: "center", padding: 80 }}>请从左侧选择一条公告</div>
        )}
      </div>
    </div>
  );
}
