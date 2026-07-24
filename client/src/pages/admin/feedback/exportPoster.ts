import { toPng } from "html-to-image";

export interface ExportPosterOptions {
  /** 文件名，含 .png */
  fileName: string;
  /** 导出倍图，默认 2 */
  pixelRatio?: number;
  backgroundColor?: string;
}

/**
 * 将海报节点导出为 PNG。
 * 使用离屏克隆，避免父级 overflow / max-height 把画面截断；
 * 尺寸取 scrollWidth/scrollHeight，保证长列表完整入图。
 */
export async function exportPosterToPng(
  source: HTMLElement,
  options: ExportPosterOptions,
): Promise<void> {
  const pixelRatio = options.pixelRatio ?? 2;
  const backgroundColor = options.backgroundColor ?? "#f7f8fc";

  // 等布局稳定
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  const height = Math.ceil(source.scrollHeight || source.offsetHeight);

  // 离屏容器：不受任何祖先 overflow 影响
  const host = document.createElement("div");
  host.setAttribute("data-fb-export-host", "1");
  host.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    "z-index:-1",
    "pointer-events:none",
    "margin:0",
    "padding:0",
    "overflow:visible",
    "background:transparent",
  ].join(";");

  const clone = source.cloneNode(true) as HTMLElement;
  // 导出固定 480 宽，与后台预览一致
  clone.classList.add("fb-poster--fixed");
  clone.style.width = "480px";
  clone.style.maxWidth = "480px";
  // 去掉可能影响尺寸的内联限制
  clone.style.maxHeight = "none";
  clone.style.height = "auto";
  clone.style.overflow = "hidden";
  clone.style.transform = "none";
  clone.style.position = "relative";
  // 导出时阴影可能被裁，略加透明边
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    // 强制 reflow，再量克隆真实高度
    void host.offsetHeight;
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const w = 480;
    const h = Math.max(
      height,
      Math.ceil(clone.scrollHeight || clone.offsetHeight),
    );

    const dataUrl = await toPng(clone, {
      cacheBust: true,
      pixelRatio,
      backgroundColor,
      width: w,
      height: h,
      style: {
        margin: "0",
        maxHeight: "none",
        maxWidth: "480px",
        height: `${h}px`,
        width: "480px",
        overflow: "hidden",
        transform: "none",
      },
    });

    const a = document.createElement("a");
    a.download = options.fileName.endsWith(".png")
      ? options.fileName
      : `${options.fileName}.png`;
    a.href = dataUrl;
    a.click();
  } finally {
    host.remove();
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "feedback";
}
