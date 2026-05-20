import ReactECharts from "echarts-for-react";
import { Empty } from "@arco-design/web-react";
import "echarts-wordcloud";

/** 词云图 */
export default function WordCloudChart({ data }: { data: { name: string; value: number }[] }) {
  if (!data || data.length === 0) return <Empty description="暂无标签数据" style={{ padding: 40 }} />;

  const option = {
    tooltip: { show: true },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      keepAspect: false,
      left: 'center',
      top: 'center',
      width: '90%',
      height: '90%',
      sizeRange: [12, 40],
      rotationRange: [-90, 90],
      rotationStep: 45,
      gridSize: 8,
      drawOutOfBound: false,
      textStyle: {
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        color: function () {
          const palette = ['#111111', '#6b7280', '#00b42a', '#ff7d00', '#f53f3f', '#7816ff', '#b37feb', '#ffb470'];
          return palette[Math.floor(Math.random() * palette.length)];
        }
      },
      emphasis: { focus: 'self', textStyle: { shadowBlur: 10, shadowColor: '#333' } },
      data: data
    }]
  };

  return <ReactECharts option={option} style={{ height: 280, width: '100%' }} />;
}
