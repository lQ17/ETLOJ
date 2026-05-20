import { useState } from "react";
import { Modal, Upload, Button, Typography, Message } from "@arco-design/web-react";
import type { TestCase } from "./constants";

interface BatchUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (cases: TestCase[]) => void;
}

export default function BatchUploadModal({ visible, onClose, onConfirm }: BatchUploadModalProps) {
  const [batchFiles, setBatchFiles] = useState<any[]>([]);
  const [processingBatch, setProcessingBatch] = useState(false);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || "");
      reader.readAsText(file);
    });
  };

  const processBatchFiles = async (autoSort: boolean, parsedList: { num: number, in?: File, out?: File }[]) => {
    setProcessingBatch(true);
    try {
      const newCases: TestCase[] = [];
      for (let i = 0; i < parsedList.length; i++) {
        const item = parsedList[i];
        const index = autoSort ? i + 1 : item.num;

        const inContent = item.in ? await readFileAsText(item.in) : "";
        const outContent = item.out ? await readFileAsText(item.out) : "";

        newCases.push({
          id: Date.now().toString() + "_" + index,
          name: `测试点 ${index}`,
          input: inContent,
          output: outContent,
        });
      }
      onConfirm(newCases);
      Message.success(`成功导入 ${newCases.length} 个测试节点`);
    } finally {
      setProcessingBatch(false);
      handleClose();
    }
  };

  const handleClose = () => {
    setBatchFiles([]);
    onClose();
  };

  const handleBatchUploadConfirm = () => {
    const files = batchFiles.map(f => f.originFile).filter(Boolean) as File[];
    if (files.length === 0) {
      Message.warning("请选择或拖入文件");
      return;
    }

    // 限制单次最多上传200个文件
    if (files.length > 200) {
      Message.error("单次最多上传200个文件 (即 100 组 .in/.out)");
      return;
    }

    // 限制单个文件大小不大于30MB
    const MAX_SIZE = 30 * 1024 * 1024;
    const seenNames = new Set<string>();

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        Message.error(`文件 ${file.name} 超过 30MB 限制`);
        return;
      }
      if (seenNames.has(file.name)) {
        Message.error(`检测到重复的文件名: ${file.name}，请检查后重新上传`);
        return;
      }
      seenNames.add(file.name);
    }

    const filePairs = new Map<number, { num: number, in?: File, out?: File }>();

    files.forEach(file => {
      const match = file.name.match(/^(\d+)\.(in|out)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const type = match[2].toLowerCase() as "in" | "out";
        if (!filePairs.has(num)) {
          filePairs.set(num, { num });
        }
        filePairs.get(num)![type] = file;
      }
    });

    const parsedList = Array.from(filePairs.values()).sort((a, b) => a.num - b.num);

    if (parsedList.length === 0) {
      Message.error("没有找到符合命名的文件 (如 1.in, 1.out)");
      return;
    }

    // 限制最终生成的测试节点数量
    if (parsedList.length > 100) {
      Message.error("单次最多导入 100 个测试节点 (1.in/1.out 到 100.in/100.out)");
      return;
    }

    let isContinuous = true;
    for (let i = 0; i < parsedList.length; i++) {
      if (parsedList[i].num !== i + 1) {
        isContinuous = false;
        break;
      }
    }

    if (!isContinuous) {
      Modal.confirm({
        title: "节点标号不连续",
        content: "节点标号不连续，系统可自动重命名排序，但可能会与题面效果不一致。是否自动重命名并重新排序？",
        okText: "自动排序",
        cancelText: "取消",
        onOk: () => processBatchFiles(true, parsedList),
      });
    } else {
      processBatchFiles(false, parsedList);
    }
  };

  return (
    <Modal
      title="一键导入测试数据"
      visible={visible}
      onOk={handleBatchUploadConfirm}
      onCancel={handleClose}
      confirmLoading={processingBatch}
    >
      <Upload
        drag
        multiple
        autoUpload={false}
        showUploadList={false}
        fileList={batchFiles}
        onChange={(fileList) => setBatchFiles(fileList)}
        tip={
          <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', marginTop: 8, color: 'var(--color-text-3)' }}>
            一键导入测试数据可批量上传文件，文件命名需要从1.in, 1.out开始，单个文件大小不大于30MB，单次最多上传200个文件(1.in/1.out到100.in/100.out)
          </div>
        }
      />

      {/* 完全自定义的文件列表，没有任何库内置的 progress 或 status div */}
      {batchFiles.length > 0 && (
        <div style={{ marginTop: 16, maxHeight: 200, overflow: 'auto' }}>
          {batchFiles.map((file) => (
            <div key={file.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-fill-2)', borderRadius: 4, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', maxWidth: '85%', overflow: 'hidden' }}>
                {/* 绿色对勾图标 */}
                <svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8, color: '#52c41a', flexShrink: 0, display: 'block' }}>
                  <path d="M43 11L16.875 37L5 25.1818" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <Typography.Text ellipsis style={{ margin: 0, lineHeight: '14px', display: 'block' }}>{file.name}</Typography.Text>
              </div>
              <Button
                type="text"
                size="mini"
                status="danger"
                icon={
                  <svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 10V44H39V10H9Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
                    <path d="M20 20V33" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M28 20V33" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 10H44" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 10L19.289 4H28.711L32 10H16Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
                  </svg>
                }
                onClick={() => setBatchFiles(prev => prev.filter(item => item.uid !== file.uid))}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
