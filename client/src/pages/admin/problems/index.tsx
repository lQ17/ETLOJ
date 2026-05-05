import { useState } from "react";
import { Tabs } from "@arco-design/web-react";
import ManageProblems from "./ManageProblems";
import CreateProblem from "./CreateProblem";
import ExportProblems from "./ExportProblems";

const TabPane = Tabs.TabPane;

export default function AdminProblemsPage() {
  const [activeTab, setActiveTab] = useState("manage");
  const [editingProblemId, setEditingProblemId] = useState<number | null>(null);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === "create") {
      setEditingProblemId(null);
    }
  };

  const handleEdit = (id: number) => {
    setEditingProblemId(id);
    setActiveTab("create");
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Tabs activeTab={activeTab} onChange={handleTabChange}>
        <TabPane key="manage" title="管理题目">
          <ManageProblems onEdit={handleEdit} />
        </TabPane>
        <TabPane key="create" title={editingProblemId ? "编辑题目" : "创建题目"}>
          <CreateProblem problemId={editingProblemId} onFinish={() => handleTabChange("manage")} />
        </TabPane>
        <TabPane key="export" title="导出题目">
          <ExportProblems />
        </TabPane>
      </Tabs>
    </div>
  );
}
