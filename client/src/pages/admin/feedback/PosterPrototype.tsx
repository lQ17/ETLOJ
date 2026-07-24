import { useMemo, useState } from "react";
import { Button, Space, Typography, Switch, Divider } from "@arco-design/web-react";
import { IconDownload } from "@arco-design/web-react/icon";
import PosterCard from "./PosterCard";
import type { FeedbackPosterData } from "./types";

const { Title, Text, Paragraph } = Typography;

/** 假数据：模拟一节课结束后的学生反馈 */
const MOCK_BASE: Omit<FeedbackPosterData, "note"> & { note?: string } = {
  title: "第二节课·前缀和与差分",
  dateLabel: "2026-03-20",
  studentName: "小明",
  studentHandle: "xiaoming",
  brand: "威科姆编程中心",
  lifetime: {
    solvedCount: 42,
    totalSubmissions: 186,
    totalScore: 1280,
  },
  items: [
    {
      problemId: 1,
      slug: "P1001",
      title: "A+B Problem",
      difficulty: "IRON",
      status: "AC",
      score: 100,
      submitCount: 1,
    },
    {
      problemId: 2,
      slug: "P1002",
      title: "数列求和",
      difficulty: "BRONZE",
      status: "AC",
      score: 100,
      submitCount: 2,
    },
    {
      problemId: 3,
      slug: "P1003",
      title: "模拟栈",
      difficulty: "SILVER",
      status: "WA",
      score: 40,
      submitCount: 5,
    },
    {
      problemId: 4,
      slug: "P1008",
      title: "最大子段和",
      difficulty: "GOLD",
      status: "AC",
      score: 100,
      submitCount: 3,
    },
    {
      problemId: 5,
      slug: "P1012",
      title: "二分查找入门",
      difficulty: "SILVER",
      status: "TLE",
      score: 0,
      submitCount: 4,
    },
    {
      problemId: 6,
      slug: "P1020",
      title: "前缀和练习",
      difficulty: "BRONZE",
      status: "AC",
      score: 100,
      submitCount: 1,
    },
    {
      problemId: 7,
      slug: "P1033",
      title: "简单图论 BFS",
      difficulty: "GOLD",
      status: "RE",
      score: 20,
      submitCount: 2,
    },
  ],
  note: "今天前缀和掌握不错，二分边界条件还要再练一练。继续加油！",
};

export default function PosterPrototype() {
  const [showNote, setShowNote] = useState(true);
  const [longList, setLongList] = useState(false);

  const data: FeedbackPosterData = useMemo(() => {
    const items = longList
      ? [
          ...MOCK_BASE.items,
          ...Array.from({ length: 6 }, (_, i) => ({
            problemId: 100 + i,
            slug: `P1${100 + i}`,
            title: `额外练习题 ${i + 1}`,
            difficulty: "IRON",
            status: i % 2 === 0 ? "AC" : "WA",
            score: i % 2 === 0 ? 100 : 30,
            submitCount: i + 1,
          })),
        ]
      : MOCK_BASE.items;

    return {
      ...MOCK_BASE,
      items,
      note: showNote ? MOCK_BASE.note : undefined,
    };
  }, [showNote, longList]);

  return (
    <div>
      <Title heading={5} style={{ marginTop: 0, marginBottom: 8 }}>
        课堂反馈 · 海报原型
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 20, maxWidth: 640 }}>
        这是<strong>单学生</strong>课后反馈海报的视觉稿，当前为假数据。确认版式后会接入：
        选学生 / 时间窗勾选做题记录、导出 PNG。海报仅展示本节练习概况，不含链接或二维码。
      </Paragraph>

      <Space wrap style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>显示老师寄语</span>
        <Switch checked={showNote} onChange={setShowNote} size="small" />
        <Divider type="vertical" />
        <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>模拟超多题目（溢出提示）</span>
        <Switch checked={longList} onChange={setLongList} size="small" />
        <Divider type="vertical" />
        <Button
          size="small"
          type="outline"
          icon={<IconDownload />}
          disabled
          title="Phase 2 接入 html-to-image 后启用"
        >
          下载 PNG（待接入）
        </Button>
      </Space>

      <div
        style={{
          display: "flex",
          gap: 32,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        {/* 海报预览 */}
        <div
          style={{
            padding: 24,
            background: "var(--color-fill-1)",
            borderRadius: 16,
            border: "1px dashed var(--color-border-2)",
          }}
        >
          <Text
            type="secondary"
            style={{ display: "block", marginBottom: 12, fontSize: 12 }}
          >
            预览宽度 480px · 窄竖版，手机全宽更清晰
          </Text>
          <PosterCard data={data} fixedWidth />
        </div>

        {/* 说明侧栏 */}
        <div style={{ maxWidth: 320, fontSize: 13, lineHeight: 1.7, color: "var(--color-text-2)" }}>
          <Title heading={6} style={{ marginTop: 0 }}>
            设计说明（可反馈）
          </Title>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            <li>
              <strong>单学生</strong>：头像/昵称；三格左右对照——左彩色本节（AC / 尝试 / 题数），斜线分隔，右灰色累计（解题 / 提交 / 总分）
            </li>
            <li>
              <strong>日期 / 标题</strong>：右上角 YYYY-MM-DD；主标题为「第 N 节课·课程名」（不含日期）
            </li>
            <li>
              <strong>题目列表</strong>：勾选后的快照，AC 打勾，其他打圈 + 状态色
            </li>
            <li>
              <strong>老师寄语</strong>：可选，可在生成时填写
            </li>
            <li>
              <strong>纯海报</strong>：不含链接、二维码；分享详情由后台「复制链接」等操作完成（后续接入）
            </li>
          </ul>
          <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
            请直接说不满意的地方：例如不要头像、竖版再高一点、只要 AC、评语区换位置、颜色更喜庆等。
          </Paragraph>
        </div>
      </div>
    </div>
  );
}
