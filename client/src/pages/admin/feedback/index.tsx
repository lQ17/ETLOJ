import { useState } from "react";
import FeedbackList from "./FeedbackList";
import CreateFeedback from "./CreateFeedback";
import type { FeedbackListItem } from "../../../api/feedback";

/**
 * 课堂反馈管理
 * - 列表：历史反馈、复制链接、预览/下载 PNG、删除
 * - 创建：选学生 / 时间窗 / 勾题 / 生成快照
 * 海报视觉原型仍保留在 PosterPrototype.tsx，可按需对照
 */
export default function AdminFeedbackPage() {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [, setLastCreated] = useState<FeedbackListItem | null>(null);

  if (mode === "create") {
    return (
      <CreateFeedback
        onCancel={() => setMode("list")}
        onCreated={(row) => {
          setLastCreated(row);
          // 留在创建页以便导出；用户点「返回列表」再回去
        }}
      />
    );
  }

  return <FeedbackList onCreate={() => setMode("create")} />;
}
