import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Message,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  Modal,
} from "@arco-design/web-react";
import {
  IconCopy,
  IconDelete,
  IconDownload,
  IconEye,
  IconPlus,
  IconRefresh,
} from "@arco-design/web-react/icon";
import { exportPosterToPng, sanitizeFileName } from "./exportPoster";
import { feedbackApi } from "../../../api/feedback";
import type { FeedbackListItem, FeedbackItemPayload, FeedbackLifetimePayload } from "../../../api/feedback";
import PosterCard from "./PosterCard";
import FeedbackLogoSettings from "./FeedbackLogoSettings";
import type { FeedbackPosterData } from "./types";

const { Title, Text } = Typography;

function toYmd(d: string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function publicUrl(token: string): string {
  return `${window.location.origin}/f/${token}`;
}

function toPosterData(row: FeedbackListItem, logoUrl?: string | null): FeedbackPosterData {
  const items = (row.items || []) as FeedbackItemPayload[];
  return {
    title: row.title,
    dateLabel: row.displayDate || toYmd(row.rangeStart) || toYmd(row.createdAt),
    studentName: row.student?.username || "",
    studentHandle: row.student?.username,
    avatarUrl: row.student?.avatar || undefined,
    note: row.note || undefined,
    items: items.map((i) => ({
      problemId: i.problemId,
      slug: i.slug,
      title: i.title,
      difficulty: i.difficulty,
      status: i.status,
      score: i.score ?? null,
      submitCount: i.submitCount,
    })),
    lifetime: (row.lifetime as FeedbackLifetimePayload) || undefined,
    brand: "威科姆编程中心",
    publicToken: row.publicToken,
    logoUrl: logoUrl || undefined,
  };
}

interface FeedbackListProps {
  onCreate: () => void;
}

export default function FeedbackList({ onCreate }: FeedbackListProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FeedbackListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [preview, setPreview] = useState<FeedbackListItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const fetchList = useCallback(
    async (p = page, ps = pageSize) => {
      setLoading(true);
      try {
        const res = await feedbackApi.list({ page: p, pageSize: ps });
        setItems(res.items || []);
        setTotal(res.total || 0);
      } catch (err: any) {
        Message.error(err?.message || "加载列表失败");
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize],
  );

  useEffect(() => {
    fetchList(page, pageSize);
  }, [page, pageSize, fetchList]);

  const handleCopy = async (token: string) => {
    const url = publicUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      Message.success("链接已复制");
    } catch {
      Message.error("复制失败：" + url);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await feedbackApi.remove(id);
      Message.success("已删除");
      fetchList(page, pageSize);
    } catch (err: any) {
      Message.error(err?.message || "删除失败");
    }
  };

  const handleDownload = async () => {
    const el = posterRef.current;
    if (!el || !preview) return;
    setExporting(true);
    try {
      const name =
        sanitizeFileName(
          `${preview.student?.username || "student"}_${preview.title}`,
        ) + ".png";
      await exportPosterToPng(el, { fileName: name });
      Message.success("PNG 已下载");
    } catch {
      Message.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 64,
    },
    {
      title: "标题",
      dataIndex: "title",
      ellipsis: true,
    },
    {
      title: "学生",
      dataIndex: "student",
      width: 120,
      render: (_: unknown, row: FeedbackListItem) => row.student?.username || "—",
    },
    {
      title: "题数",
      width: 70,
      render: (_: unknown, row: FeedbackListItem) =>
        Array.isArray(row.items) ? row.items.length : "—",
    },
    {
      title: "短码",
      dataIndex: "publicToken",
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "创建者",
      width: 100,
      render: (_: unknown, row: FeedbackListItem) => row.creator?.username || "—",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      width: 170,
      render: (v: string) => (v ? new Date(v).toLocaleString("zh-CN") : "—"),
    },
    {
      title: "操作",
      width: 260,
      render: (_: unknown, row: FeedbackListItem) => (
        <Space size="mini">
          <Button
            type="text"
            size="small"
            icon={<IconEye />}
            onClick={() => setPreview(row)}
          >
            预览
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IconCopy />}
            onClick={() => handleCopy(row.publicToken)}
          >
            链接
          </Button>
          <Popconfirm
            title="确认删除该反馈？"
            onOk={() => handleDelete(row.id)}
          >
            <Button type="text" size="small" status="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <Title heading={5} style={{ margin: 0 }}>
            课堂反馈
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            生成单学生课后反馈海报与公开分享链接
          </Text>
        </div>
        <Space>
          <Button icon={<IconRefresh />} onClick={() => fetchList(page, pageSize)}>
            刷新
          </Button>
          <Button type="primary" icon={<IconPlus />} onClick={onCreate}>
            创建反馈
          </Button>
        </Space>
      </div>

      <FeedbackLogoSettings onChange={setLogoUrl} />

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        data={items}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: true,
          sizeCanChange: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={preview ? `预览 · ${preview.title}` : "预览"}
        visible={!!preview}
        onCancel={() => setPreview(null)}
        style={{ width: 540 }}
        unmountOnExit
        className="fb-poster-preview-modal"
        footer={
          <Space>
            <Button onClick={() => setPreview(null)}>关闭</Button>
            {preview && (
              <>
                <Button icon={<IconCopy />} onClick={() => handleCopy(preview.publicToken)}>
                  复制链接
                </Button>
                <Button
                  type="primary"
                  icon={<IconDownload />}
                  loading={exporting}
                  onClick={handleDownload}
                >
                  下载 PNG
                </Button>
              </>
            )}
          </Space>
        }
      >
        {preview && (
          <div className="fb-poster-preview-host">
            {/*
              只渲染一份海报：导出走 exportPosterToPng 离屏克隆，
              不要再挂 fixed 第二份，否则 Modal 内布局/滚动宽度会错乱。
            */}
            <PosterCard data={toPosterData(preview, logoUrl)} fixedWidth posterRef={posterRef} />
          </div>
        )}
      </Modal>
    </div>
  );
}
