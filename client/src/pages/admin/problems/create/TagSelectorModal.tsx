import { useState } from "react";
import { Modal, Input, Button, Space, Typography, Checkbox, Tag } from "@arco-design/web-react";

interface TagSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  allTags: any[];
  selectedTagIds: number[];
  onUpdate: (ids: number[]) => void;
}

export default function TagSelectorModal({ visible, onClose, allTags, selectedTagIds, onUpdate }: TagSelectorModalProps) {
  const [keyword, setKeyword] = useState("");

  const filtered = allTags
    .filter(t => !keyword || t.name.includes(keyword))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));

  return (
    <Modal
      title="选择标签"
      visible={visible}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={() => onUpdate([])}>清空</Button>
          <Button type="primary" onClick={onClose}>确定</Button>
        </Space>
      }
      style={{ width: 500 }}
    >
      <Input.Search
        placeholder="搜索标签..."
        value={keyword}
        onChange={setKeyword}
        style={{ marginBottom: 16 }}
        allowClear
      />
      <div style={{ maxHeight: 400, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <Typography.Text type="secondary">暂无标签，请先在标签管理中创建</Typography.Text>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 16px" }}>
            {filtered.map(tag => (
              <div key={tag.id}>
                <Checkbox
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={(checked) => {
                    if (checked) {
                      onUpdate([...selectedTagIds, tag.id]);
                    } else {
                      onUpdate(selectedTagIds.filter(id => id !== tag.id));
                    }
                  }}
                >
                  <Tag style={{ marginRight: 4 }}>{tag.name}</Tag>
                </Checkbox>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
