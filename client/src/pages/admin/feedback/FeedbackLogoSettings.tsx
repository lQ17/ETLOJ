import { useCallback, useEffect, useState } from "react";
import { Button, Message, Space, Typography, Upload } from "@arco-design/web-react";
import type { UploadItem } from "@arco-design/web-react/es/Upload";
import { IconDelete, IconUpload } from "@arco-design/web-react/icon";
import { feedbackApi } from "../../../api/feedback";

const { Text } = Typography;

const MAX_BYTES = 500 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

interface FeedbackLogoSettingsProps {
  /** Logo 变更后通知父级刷新预览 */
  onChange?: (logoUrl: string | null) => void;
}

/**
 * 海报左上角 Logo：上传 PNG（等），存服务端 Redis，可随时替换/清除。
 */
export default function FeedbackLogoSettings({ onChange }: FeedbackLogoSettingsProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await feedbackApi.getLogo();
      const url = res.logoUrl || null;
      setLogoUrl(url);
      onChange?.(url);
    } catch {
      /* 无 Logo 时忽略 */
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      Message.warning("请选择图片文件（推荐 PNG）");
      return;
    }
    if (file.size > MAX_BYTES) {
      Message.warning("图片请压缩到 500KB 以内");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await feedbackApi.setLogo(dataUrl);
      setLogoUrl(res.logoUrl);
      onChange?.(res.logoUrl);
      Message.success("Logo 已更新，后续海报与公开页将使用新图");
    } catch (err: any) {
      Message.error(err?.message || "上传失败");
    } finally {
      setUploading(false);
      setFileList([]);
    }
  };

  const handleClear = async () => {
    setUploading(true);
    try {
      await feedbackApi.clearLogo();
      setLogoUrl(null);
      onChange?.(null);
      Message.success("已恢复默认 OJ 字标");
    } catch (err: any) {
      Message.error(err?.message || "清除失败");
    } finally {
      setUploading(false);
      setFileList([]);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
        padding: "12px 16px",
        background: "var(--color-fill-1)",
        borderRadius: 12,
        border: "1px solid var(--color-border-2)",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          background: "#fff",
          border: "1px solid var(--color-border-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="logo"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <span style={{ fontWeight: 800, color: "#165dff", fontSize: 14 }}>OJ</span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>海报左上角 Logo</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          支持 PNG / JPEG，建议正方形透明底，≤500KB。可随时替换。
        </Text>
      </div>

      <Space>
        <Upload
          accept="image/png,image/jpeg,image/webp,image/gif"
          autoUpload={false}
          showUploadList={false}
          fileList={fileList}
          onChange={(list, file) => {
            setFileList(list);
            const raw = (file.originFile || (file as any).file) as File | undefined;
            if (raw) void handleUpload(raw);
          }}
          disabled={uploading || loading}
        >
          <Button type="primary" icon={<IconUpload />} loading={uploading} size="small">
            {logoUrl ? "替换 Logo" : "上传 Logo"}
          </Button>
        </Upload>
        {logoUrl && (
          <Button
            status="danger"
            type="outline"
            icon={<IconDelete />}
            size="small"
            loading={uploading}
            onClick={handleClear}
          >
            恢复默认
          </Button>
        )}
      </Space>
    </div>
  );
}
