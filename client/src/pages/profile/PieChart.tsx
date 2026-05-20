import ReactECharts from "echarts-for-react";
import { Empty } from "@arco-design/web-react";
import { STATUS_COLOR_MAP } from "./constants";

/** 提交状态饼图 */
export default function PieChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const option = {
    title: {
      text: `总提交数\n${total}`,
      left: 'center',
      top: '42%',
      textBaseline: 'middle',
      textAlign: 'center',
      textStyle: { fontSize: 14, color: 'var(--color-text-2)', lineHeight: 22, fontWeight: 500 },
    },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { bottom: 0, textStyle: { color: "#86909c" }, itemWidth: 12, itemHeight: 12 },
    series: [{
      type: "pie",
      radius: ["45%", "70%"],
      center: ["50%", "42%"],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { scale: true, label: { show: false } },
      itemStyle: { borderRadius: 6 },
      data: data.map((d) => ({
        ...d,
        itemStyle: { color: STATUS_COLOR_MAP[d.name] || "#86909c" },
      })),
    }],
  };

  if (!data.length) return <Empty description="暂无提交记录" style={{ padding: 40 }} />;
  return <ReactECharts option={option} style={{ height: 280, width: '100%' }} />;
}
