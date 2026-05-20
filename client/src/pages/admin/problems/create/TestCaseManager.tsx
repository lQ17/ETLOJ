import { useState } from "react";
import { Button, Space, Table, Modal, Upload, Typography, Message } from "@arco-design/web-react";
import Editor from "@monaco-editor/react";
import type { TestCase } from "./constants";

interface TestCaseManagerProps {
  testCases: TestCase[];
  setTestCases: React.Dispatch<React.SetStateAction<TestCase[]>>;
}

export default function TestCaseManager({ testCases, setTestCases }: TestCaseManagerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTestCase, setEditingTestCase] = useState<TestCase | null>(null);

  const handleAddTestCase = () => {
    const newCase = { id: Date.now().toString(), name: `测试点 ${testCases.length + 1}`, input: "", output: "" };
    setTestCases([...testCases, newCase]);
  };

  const handleDeleteTestCase = (id: string) => {
    setTestCases(testCases.filter(t => t.id !== id));
  };

  const handleUploadTestCase = (file: File, id: string, type: "input" | "output") => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setTestCases(testCases.map(t => t.id === id ? { ...t, [type]: text } : t));
      Message.success(`${file.name} 上传成功`);
    };
    reader.readAsText(file);
    return false; // Prevent default upload
  };

  const openEditModal = (record: TestCase) => {
    setEditingTestCase(record);
    setModalVisible(true);
  };

  const saveEditModal = () => {
    if (editingTestCase) {
      setTestCases(testCases.map(t => t.id === editingTestCase.id ? editingTestCase : t));
    }
    setModalVisible(false);
  };

  const columns = [
    { title: "测试点名称", dataIndex: "name" },
    {
      title: "输入",
      render: (_: any, record: TestCase) => (
        <Space>
          <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 100 }}>
            {record.input ? "已上传" : "未上传"}
          </Typography.Text>
          <Upload
            autoUpload={false}
            showUploadList={false}
            accept=".in"
            beforeUpload={(file) => handleUploadTestCase(file, record.id, "input")}
          >
            <Button size="small">上传 .in</Button>
          </Upload>
        </Space>
      )
    },
    {
      title: "输出",
      render: (_: any, record: TestCase) => (
        <Space>
          <Typography.Text ellipsis={{ showTooltip: true }} style={{ width: 100 }}>
            {record.output ? "已上传" : "未上传"}
          </Typography.Text>
          <Upload
            autoUpload={false}
            showUploadList={false}
            accept=".out"
            beforeUpload={(file) => handleUploadTestCase(file, record.id, "output")}
          >
            <Button size="small">上传 .out</Button>
          </Upload>
        </Space>
      )
    },
    {
      title: "操作",
      render: (_: any, record: TestCase) => (
        <Space>
          <Button type="text" onClick={() => openEditModal(record)}>修改</Button>
          <Button type="text" status="danger" onClick={() => handleDeleteTestCase(record.id)}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <>
      <Button onClick={handleAddTestCase} type="outline">添加测试节点</Button>
      <Table data={testCases} columns={columns} pagination={false} rowKey="id" />

      <Modal
        title="修改测试节点"
        visible={modalVisible}
        onOk={saveEditModal}
        onCancel={() => setModalVisible(false)}
        autoFocus={false}
        focusLock={true}
        style={{ width: 800 }}
      >
        {editingTestCase && (
          <Space style={{ width: "100%" }} direction="vertical" size={0}>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Typography.Text bold>输入</Typography.Text>
                <div style={{ border: "1px solid var(--color-border)", borderRadius: 4, marginTop: 8 }}>
                  <Editor
                    height="300px"
                    language="plaintext"
                    value={editingTestCase.input}
                    onChange={(val: string | undefined) => setEditingTestCase({ ...editingTestCase, input: val || "" })}
                    options={{ minimap: { enabled: false }, wordWrap: "on" }}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <Typography.Text bold>输出</Typography.Text>
                <div style={{ border: "1px solid var(--color-border)", borderRadius: 4, marginTop: 8 }}>
                  <Editor
                    height="300px"
                    language="plaintext"
                    value={editingTestCase.output}
                    onChange={(val: string | undefined) => setEditingTestCase({ ...editingTestCase, output: val || "" })}
                    options={{ minimap: { enabled: false }, wordWrap: "on" }}
                  />
                </div>
              </div>
            </div>
          </Space>
        )}
      </Modal>
    </>
  );
}
