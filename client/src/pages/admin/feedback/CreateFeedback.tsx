import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  Message,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Spin,
  Divider,
} from "@arco-design/web-react";
import {
  IconDownload,
  IconLink,
  IconRefresh,
  IconSearch,
  IconCheck,
} from "@arco-design/web-react/icon";
import dayjs from "dayjs";
import { exportPosterToPng, sanitizeFileName } from "./exportPoster";
import { feedbackApi } from "../../../api/feedback";
import type {
  FeedbackItemPayload,
  FeedbackLifetimePayload,
  FeedbackListItem,
} from "../../../api/feedback";
import { userApi } from "../../../api/user";
import PosterCard from "./PosterCard";
import FeedbackLogoSettings from "./FeedbackLogoSettings";
import type { FeedbackPosterData } from "./types";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const TextArea = Input.TextArea;

const STATUS_COLOR: Record<string, string> = {
  AC: "green",
  WA: "red",
  TLE: "orangered",
  MLE: "purple",
  RE: "arcoblue",
  CE: "orange",
  SE: "gray",
};

/** 任意输入 → 本地日历日 YYYY-MM-DD；非法则空串 */
function toYmd(d: Date | string | dayjs.Dayjs | null | undefined): string {
  if (d == null || d === "") return "";
  // 已是标准日期串
  if (typeof d === "string") {
    const m = d.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  const dj = dayjs(d as any);
  if (!dj.isValid()) return "";
  return dj.format("YYYY-MM-DD");
}

/** 查询用：当天 00:00:00 本地 ISO（带时区偏移，后端 Date 可正确解析） */
function toIsoStart(ymd: string): string {
  const day = toYmd(ymd);
  if (!day) return "";
  return dayjs(day).startOf("day").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
}

/** 查询用：当天 23:59:59.999 本地 ISO */
function toIsoEnd(ymd: string): string {
  const day = toYmd(ymd);
  if (!day) return "";
  return dayjs(day).endOf("day").format("YYYY-MM-DDTHH:mm:ss.SSSZ");
}

function publicUrl(token: string): string {
  return `${window.location.origin}/f/${token}`;
}

interface StudentOption {
  id: number;
  username: string;
  avatar?: string | null;
}

interface SummaryRow extends FeedbackItemPayload {
  hasAc?: boolean;
  key: number;
}

interface CreateFeedbackProps {
  onCreated?: (row: FeedbackListItem) => void;
  onCancel?: () => void;
}

export default function CreateFeedback({ onCreated, onCancel }: CreateFeedbackProps) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentId, setStudentId] = useState<number | undefined>();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  /** 海报右上角显示日期（YYYY-MM-DD），默认当天，可改 */
  const [displayDate, setDisplayDate] = useState<string>(() => toYmd(new Date()));
  /** 做题记录查询范围，默认当天，可改 */
  const [dateRange, setDateRange] = useState<string[]>(() => {
    const today = toYmd(new Date());
    return [today, today];
  });

  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryItems, setSummaryItems] = useState<SummaryRow[]>([]);
  const [lifetime, setLifetime] = useState<FeedbackLifetimePayload | undefined>();
  const [studentMeta, setStudentMeta] = useState<StudentOption | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<(string | number)[]>([]);

  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<FeedbackListItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const loadStudents = useCallback(async (keyword?: string) => {
    setStudentsLoading(true);
    try {
      const res: any = await userApi.list({
        page: 1,
        pageSize: 50,
        keyword: keyword || undefined,
        status: "APPROVED",
        // 默认只列普通用户；有关键字时不限角色，方便精确搜
        ...(keyword ? {} : { role: "USER" }),
      });
      const items = (res.items || res || []) as any[];
      setStudents(
        items.map((u) => ({
          id: u.id,
          username: u.username,
          avatar: u.avatar,
        })),
      );
    } catch (err: any) {
      Message.error(err?.message || "加载学生列表失败");
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleLoadSummary = async () => {
    if (!studentId) {
      Message.warning("请先选择学生");
      return;
    }
    if (!dateRange || dateRange.length < 2 || !dateRange[0] || !dateRange[1]) {
      Message.warning("请选择做题查询范围");
      return;
    }
    setSummaryLoading(true);
    setCreated(null);
    try {
      const startYmd = toYmd(dateRange[0]);
      const endYmd = toYmd(dateRange[1]);
      if (!startYmd || !endYmd) {
        Message.warning("做题查询范围日期无效");
        return;
      }
      const start = toIsoStart(startYmd);
      const end = toIsoEnd(endYmd);
      const res = await feedbackApi.previewSummary({
        userId: studentId,
        start,
        end,
      });
      const rows: SummaryRow[] = (res.items || []).map((it) => ({
        ...it,
        key: it.problemId,
        score: it.score ?? null,
      }));
      setSummaryItems(rows);
      setLifetime(res.lifetime);
      setStudentMeta(res.student);
      // 默认勾选全部 AC
      setSelectedKeys(rows.filter((r) => r.status === "AC").map((r) => r.problemId));
      if (rows.length === 0) {
        Message.info("该时段内暂无有效提交");
      } else {
        Message.success(`已加载 ${rows.length} 道题，默认勾选 AC`);
      }
    } catch (err: any) {
      Message.error(err?.message || "加载汇总失败");
    } finally {
      setSummaryLoading(false);
    }
  };

  const selectAllAc = () => {
    setSelectedKeys(summaryItems.filter((r) => r.status === "AC").map((r) => r.problemId));
  };

  const selectAll = () => {
    setSelectedKeys(summaryItems.map((r) => r.problemId));
  };

  const clearSelect = () => setSelectedKeys([]);

  const selectedItems = useMemo(
    () => summaryItems.filter((r) => selectedKeys.includes(r.problemId)),
    [summaryItems, selectedKeys],
  );

  const posterPreview: FeedbackPosterData | null = useMemo(() => {
    if (!studentMeta || selectedItems.length === 0) return null;
    return {
      title: title.trim() || "课堂练习",
      dateLabel: displayDate || toYmd(new Date()),
      studentName: studentMeta.username,
      studentHandle: studentMeta.username,
      avatarUrl: studentMeta.avatar || undefined,
      note: note.trim() || undefined,
      items: selectedItems.map((i) => ({
        problemId: i.problemId,
        slug: i.slug,
        title: i.title,
        difficulty: i.difficulty,
        status: i.status,
        score: i.score ?? null,
        submitCount: i.submitCount,
      })),
      lifetime,
      brand: "威科姆编程中心",
      publicToken: created?.publicToken,
      logoUrl: logoUrl || undefined,
    };
  }, [studentMeta, selectedItems, title, note, displayDate, lifetime, created, logoUrl]);

  const createdPoster: FeedbackPosterData | null = useMemo(() => {
    if (!created) return null;
    const items = (created.items || []) as FeedbackItemPayload[];
    return {
      title: created.title,
      dateLabel:
        created.displayDate ||
        toYmd(created.rangeStart) ||
        toYmd(created.createdAt),
      studentName: created.student?.username || studentMeta?.username || "",
      studentHandle: created.student?.username || studentMeta?.username,
      avatarUrl: created.student?.avatar || studentMeta?.avatar || undefined,
      note: created.note || undefined,
      items: items.map((i) => ({
        problemId: i.problemId,
        slug: i.slug,
        title: i.title,
        difficulty: i.difficulty,
        status: i.status,
        score: i.score ?? null,
        submitCount: i.submitCount,
      })),
      lifetime: (created.lifetime as FeedbackLifetimePayload) || lifetime,
      brand: "威科姆编程中心",
      publicToken: created.publicToken,
      logoUrl: logoUrl || undefined,
    };
  }, [created, studentMeta, lifetime, logoUrl]);

  const handleCreate = async () => {
    if (!studentId) {
      Message.warning("请选择学生");
      return;
    }
    if (!title.trim()) {
      Message.warning("请填写标题，例如：第二节课·前缀和与差分");
      return;
    }
    if (selectedItems.length === 0) {
      Message.warning("请至少勾选一道题");
      return;
    }
    if (!displayDate) {
      Message.warning("请选择海报显示日期");
      return;
    }
    if (!dateRange || dateRange.length < 2 || !dateRange[0] || !dateRange[1]) {
      Message.warning("请选择做题查询范围");
      return;
    }
    setCreating(true);
    try {
      const row = await feedbackApi.create({
        title: title.trim(),
        studentId,
        note: note.trim() || undefined,
        displayDate: toYmd(displayDate),
        rangeStart: toIsoStart(toYmd(dateRange[0])),
        rangeEnd: toIsoEnd(toYmd(dateRange[1])),
        items: selectedItems.map((i) => ({
          problemId: i.problemId,
          slug: i.slug,
          title: i.title,
          difficulty: i.difficulty,
          status: i.status,
          score: i.score ?? null,
          submitCount: i.submitCount,
        })),
      });
      setCreated(row);
      Message.success("反馈已生成");
      onCreated?.(row);
    } catch (err: any) {
      Message.error(err?.message || "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!created?.publicToken) return;
    const url = publicUrl(created.publicToken);
    try {
      await navigator.clipboard.writeText(url);
      Message.success("链接已复制");
    } catch {
      Message.error("复制失败，请手动复制：" + url);
    }
  };

  const handleDownloadPng = async () => {
    const el = posterRef.current;
    if (!el) {
      Message.warning("海报尚未就绪");
      return;
    }
    setExporting(true);
    try {
      const name =
        sanitizeFileName(
          (created?.student?.username || studentMeta?.username || "student") +
            "_" +
            (created?.title || title || "feedback"),
        ) + ".png";
      await exportPosterToPng(el, { fileName: name });
      Message.success("PNG 已下载");
    } catch (err: any) {
      console.error(err);
      Message.error("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      title: "题号",
      dataIndex: "slug",
      width: 100,
    },
    {
      title: "标题",
      dataIndex: "title",
      ellipsis: true,
    },
    {
      title: "难度",
      dataIndex: "difficulty",
      width: 100,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (v: string) => <Tag color={STATUS_COLOR[v] || "gray"}>{v}</Tag>,
    },
    {
      title: "得分",
      dataIndex: "score",
      width: 70,
      render: (v: number | null) => (v == null ? "—" : v),
    },
    {
      title: "提交",
      dataIndex: "submitCount",
      width: 70,
    },
  ];

  const displayPoster = createdPoster || posterPreview;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Title heading={5} style={{ margin: 0 }}>
            创建课堂反馈
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            选学生 → 显示日期 / 做题范围 → 勾选题目 → 生成快照 / 下载海报 / 复制公开链接
          </Text>
        </div>
        {onCancel && (
          <Button onClick={onCancel}>返回列表</Button>
        )}
      </div>

      <FeedbackLogoSettings onChange={setLogoUrl} />

      <Form layout="vertical" style={{ maxWidth: 720 }}>
        <Form.Item label="学生" required>
          <Select
            showSearch
            placeholder="搜索用户名"
            loading={studentsLoading}
            value={studentId}
            onChange={(v) => {
              setStudentId(v);
              setSummaryItems([]);
              setSelectedKeys([]);
              setCreated(null);
            }}
            filterOption={false}
            onSearch={(kw) => loadStudents(kw)}
            options={students.map((s) => ({
              label: s.username,
              value: s.id,
            }))}
            style={{ width: "100%" }}
            allowClear
          />
        </Form.Item>

        <Form.Item
          label="标题"
          required
          extra="建议格式：第 N 节课·课程名（不含日期）"
        >
          <Input
            placeholder="例如：第二节课·前缀和与差分"
            value={title}
            onChange={setTitle}
            maxLength={200}
            showWordLimit
          />
        </Form.Item>

        <Form.Item
          label="海报显示日期"
          required
          extra="出现在海报右上角，默认当天，可单独修改"
        >
          <DatePicker
            style={{ width: "100%" }}
            format="YYYY-MM-DD"
            allowClear={false}
            value={displayDate ? dayjs(displayDate) : dayjs()}
            onChange={(date) => {
              setDisplayDate(toYmd(date) || toYmd(new Date()));
              setCreated(null);
            }}
            placeholder="选择显示日期"
          />
        </Form.Item>

        <Form.Item
          label="做题查询范围"
          required
          extra="用于加载该时段内的提交记录，默认当天，可改为多天"
        >
          <RangePicker
            style={{ width: "100%" }}
            format="YYYY-MM-DD"
            allowClear={false}
            value={
              dateRange?.[0] && dateRange?.[1]
                ? [dayjs(dateRange[0]), dayjs(dateRange[1])]
                : [dayjs(), dayjs()]
            }
            onChange={(dates) => {
              const start = toYmd(dates?.[0]);
              const end = toYmd(dates?.[1]);
              if (start && end) {
                setDateRange([start, end]);
              } else {
                const today = toYmd(new Date());
                setDateRange([today, today]);
              }
              setSummaryItems([]);
              setSelectedKeys([]);
              setCreated(null);
            }}
            placeholder={["开始日期", "结束日期"]}
          />
        </Form.Item>

        <Form.Item label="老师寄语（可选）">
          <TextArea
            placeholder="写给学生的一句话鼓励…"
            value={note}
            onChange={setNote}
            maxLength={500}
            showWordLimit
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </Form.Item>

        <Space wrap style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<IconSearch />}
            loading={summaryLoading}
            onClick={handleLoadSummary}
          >
            加载做题汇总
          </Button>
          <Button icon={<IconRefresh />} onClick={() => loadStudents()}>
            刷新学生
          </Button>
        </Space>
      </Form>

      {(summaryLoading || summaryItems.length > 0) && (
        <>
          <Divider style={{ margin: "8px 0 16px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <Text>
              共 <strong>{summaryItems.length}</strong> 题，已选{" "}
              <strong>{selectedKeys.length}</strong> 题
              {lifetime && (
                <Text type="secondary" style={{ marginLeft: 12 }}>
                  累计：{lifetime.solvedCount} 题 · {lifetime.totalSubmissions} 提交 ·{" "}
                  {lifetime.totalScore} 分
                </Text>
              )}
            </Text>
            <Space>
              <Button size="small" onClick={selectAllAc}>
                全选 AC
              </Button>
              <Button size="small" onClick={selectAll}>
                全选
              </Button>
              <Button size="small" onClick={clearSelect}>
                清空
              </Button>
            </Space>
          </div>
          <Spin loading={summaryLoading} style={{ width: "100%" }}>
            <Table
              rowKey="problemId"
              columns={columns}
              data={summaryItems}
              pagination={summaryItems.length > 20 ? { pageSize: 20 } : false}
              rowSelection={{
                type: "checkbox",
                selectedRowKeys: selectedKeys,
                onChange: (keys) => setSelectedKeys(keys),
              }}
              size="small"
              borderCell
            />
          </Spin>

          <Space style={{ marginTop: 20 }} wrap>
            <Button
              type="primary"
              icon={<IconCheck />}
              loading={creating}
              disabled={selectedItems.length === 0}
              onClick={handleCreate}
            >
              {created ? "重新生成" : "生成反馈"}
            </Button>
            {created && (
              <>
                <Button icon={<IconLink />} onClick={handleCopyLink}>
                  复制公开链接
                </Button>
                <Button
                  type="outline"
                  icon={<IconDownload />}
                  loading={exporting}
                  onClick={handleDownloadPng}
                >
                  下载 PNG
                </Button>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  短码 {created.publicToken} · {publicUrl(created.publicToken)}
                </Text>
              </>
            )}
          </Space>
        </>
      )}

      {displayPoster && (
        <>
          <Divider style={{ margin: "28px 0 16px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Title heading={6} style={{ margin: 0 }}>
              {created ? "海报预览（已保存）" : "海报预览（未保存，勾选即时预览）"}
            </Title>
            {!created && selectedItems.length > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                生成后可下载 PNG 与复制链接
              </Text>
            )}
          </div>
          <div className="fb-poster-preview-host fb-poster-preview-host--page">
            {/* 仅一份；导出时 exportPosterToPng 会离屏克隆完整节点 */}
            <PosterCard
              data={displayPoster}
              fixedWidth
              posterRef={created ? posterRef : undefined}
            />
          </div>
        </>
      )}
    </div>
  );
}
