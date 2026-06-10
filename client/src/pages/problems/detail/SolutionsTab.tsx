import { useState, useEffect } from "react";
import { Typography, Button, Card, Spin, Avatar, Modal, Message } from "@arco-design/web-react";
import { IconPen } from "@arco-design/web-react/icon";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import MDEditor from "@uiw/react-md-editor";
import { solutionApi } from "../../../api/solution";

interface SolutionsTabProps {
  user: any;
  authLoading: boolean;
  problemId: number;
  navigate: (path: string, opts?: any) => void;
  editId?: string | null;
  onEditHandled?: () => void;
}

export default function SolutionsTab({
  user,
  authLoading,
  problemId,
  navigate,
  editId,
  onEditHandled,
}: SolutionsTabProps) {
  const [solutions, setSolutions] = useState<any[]>([]);
  const [solutionsLoading, setSolutionsLoading] = useState(false);
  const [selectedSolution, setSelectedSolution] = useState<any>(null);
  const [solutionContent, setSolutionContent] = useState("");
  const [submittingSolution, setSubmittingSolution] = useState(false);
  const [writeModalVisible, setWriteModalVisible] = useState(false);
  const [editingSolutionId, setEditingSolutionId] = useState<number | null>(null);

  const loadSolutions = async () => {
    setSolutionsLoading(true);
    try {
      const data: any = await solutionApi.list(problemId);
      setSolutions(data);
      if (data.length > 0 && !selectedSolution) {
        setSelectedSolution(data[0]);
      }
    } catch {
      Message.error("加载题解失败");
    } finally {
      setSolutionsLoading(false);
    }
  };

  useEffect(() => {
    if (problemId) {
      loadSolutions();
    }
  }, [problemId]);

  // 从个人主页跳转编辑题解时，自动打开编辑弹窗
  useEffect(() => {
    if (!editId) return;
    solutionApi.getOne(Number(editId)).then((sol: any) => {
      setEditingSolutionId(sol.id);
      setSolutionContent(sol.content);
      setWriteModalVisible(true);
    }).catch(() => {
      Message.error("加载题解失败");
    }).finally(() => {
      onEditHandled?.();
    });
  }, [editId]);

  const handleSubmitSolution = async () => {
    if (!solutionContent.trim()) {
      Message.warning("请输入题解内容");
      return;
    }
    setSubmittingSolution(true);
    try {
      if (editingSolutionId) {
        await solutionApi.update(editingSolutionId, solutionContent);
        Message.success("题解已更新，等待审核通过后展示");
      } else {
        await solutionApi.create({ problemId, content: solutionContent });
        Message.success("题解已提交，等待审核通过后展示");
      }
      setSolutionContent("");
      setEditingSolutionId(null);
      setWriteModalVisible(false);
      loadSolutions();
    } catch (err: any) {
      Message.error(err?.message || "操作失败");
    } finally {
      setSubmittingSolution(false);
    }
  };

  // 未登录
  if (!authLoading && !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <Typography.Title heading={5} style={{ marginBottom: 8 }}>查看题解</Typography.Title>
          <Typography.Paragraph style={{ color: "var(--color-muted)", marginBottom: 24 }}>
            登录后即可查看和编写题解
          </Typography.Paragraph>
          <Button type="primary" size="large" onClick={() => navigate("/login")}>
            去登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 24, width: "100%", overflow: "hidden" }}>
        {/* 左侧：题解列表 */}
        <div style={{ flex: "0 0 35%", overflow: "auto", paddingRight: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Typography.Title heading={5} style={{ margin: 0 }}>
              题解列表
            </Typography.Title>
            <Button
              type="primary"
              size="small"
              icon={<IconPen />}
              onClick={() => { setEditingSolutionId(null); setSolutionContent(""); setWriteModalVisible(true); }}
            >
              写题解
            </Button>
          </div>
          {solutionsLoading ? (
            <div style={{ textAlign: "center", paddingTop: 40 }}><Spin /></div>
          ) : solutions.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--color-text-3)", paddingTop: 40 }}>
              暂无题解，快来写第一篇吧
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {solutions.map((sol: any) => {
                const isSelected = selectedSolution?.id === sol.id;
                return (
                  <Card
                    key={sol.id}
                    size="small"
                    hoverable
                    style={{
                      cursor: "pointer",
                      borderLeft: isSelected ? "3px solid var(--color-primary)" : "3px solid transparent",
                      background: isSelected ? "var(--color-fill-1)" : undefined,
                    }}
                    onClick={() => setSelectedSolution(sol)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Avatar size={24} style={{ backgroundColor: "var(--color-primary)", flexShrink: 0 }}>
                        {sol.author.avatar
                          ? <img src={sol.author.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : sol.author.username?.[0]?.toUpperCase()
                        }
                      </Avatar>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{sol.author.username}</span>
                      <span style={{ color: "var(--color-text-3)", fontSize: 12, marginLeft: "auto" }}>
                        {new Date(sol.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: "var(--color-text-2)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sol.content.replace(/[#*`>\-\[\]()]/g, "").split("\n").find((l: string) => l.trim()) || ""}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--color-text-3)", flexShrink: 0 }}>
                        点击在右侧查看
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 右侧：题解详情展示 */}
        <div style={{ flex: 1, overflow: "auto", minWidth: 0, borderLeft: "1px solid var(--color-border)", paddingLeft: 24 }}>
          {selectedSolution ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--color-border)" }}>
                <Avatar size={36} style={{ backgroundColor: "var(--color-primary)" }}>
                  {selectedSolution.author.avatar
                    ? <img src={selectedSolution.author.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : selectedSolution.author.username?.[0]?.toUpperCase()
                  }
                </Avatar>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedSolution.author.username}</div>
                  <div style={{ color: "var(--color-text-3)", fontSize: 13 }}>
                    发布于 {new Date(selectedSolution.createdAt).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
              <div className="problem-markdown" style={{ fontSize: 15, lineHeight: 1.8 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {selectedSolution.content}
                </ReactMarkdown>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", color: "var(--color-text-3)", paddingTop: 80 }}>
              请选择一篇题解查看
            </div>
          )}
        </div>
      </div>

      {/* 写题解弹窗 */}
      <Modal
        title={editingSolutionId ? "编辑题解" : "写题解"}
        visible={writeModalVisible}
        onCancel={() => { setWriteModalVisible(false); setEditingSolutionId(null); }}
        footer={null}
        style={{ width: "80%", top: 40 }}
        unmountOnExit={false}
      >
        <div data-color-mode="light" style={{ marginBottom: 12 }}>
          <MDEditor
            value={solutionContent}
            onChange={(val) => setSolutionContent(val || "")}
            preview="live"
            height={500}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button onClick={() => { setWriteModalVisible(false); setEditingSolutionId(null); }}>取消</Button>
          <Button type="primary" loading={submittingSolution} onClick={handleSubmitSolution}>
            {editingSolutionId ? "更新题解" : "发布题解"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
