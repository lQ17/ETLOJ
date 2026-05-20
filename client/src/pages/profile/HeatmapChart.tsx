import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { ActivityCalendar } from "react-activity-calendar";
import { Tooltip, Typography } from "@arco-design/web-react";

const { Text } = Typography;

/** 热力图 (使用 react-github-calendar 库) */
export default function HeatmapChart({ data }: { data: [string, number][] }) {
  const [calendarData, setCalendarData] = useState<Array<{ date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }> | null>(null);
  const [sums, setSums] = useState({ sum6Months: 0, sum1Month: 0, sum1Week: 0 });
  const calendarRef = useRef<HTMLDivElement>(null);

  // 修复库渲染的 SVG viewBox 宽度不足导致最后一列被裁剪的问题
  useLayoutEffect(() => {
    if (!calendarData || !calendarRef.current) return;
    const svg = calendarRef.current.querySelector('svg');
    if (!svg) return;
    const bbox = svg.getBBox();
    const padding = 10;
    const newWidth = Math.ceil(bbox.x + bbox.width + padding);
    const newHeight = Math.ceil(bbox.y + bbox.height + padding);
    svg.setAttribute('viewBox', `0 0 ${newWidth} ${newHeight}`);
    svg.setAttribute('width', String(newWidth));
    svg.setAttribute('height', String(newHeight));
  }, [calendarData]);

  useEffect(() => {
    if (!data.length) { setCalendarData(null); return; }

    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);

    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);
    oneWeekAgo.setHours(0, 0, 0, 0);

    let sum6 = 0, sum1 = 0, sumW = 0;

    const dateMap = new Map<string, number>();
    data.forEach(([d, v]) => {
      const ds = typeof d === "string" ? d : (new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
      dateMap.set(ds, v);
      const [year, month, day] = ds.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      if (dateObj >= sixMonthsAgo && dateObj <= now) sum6 += v;
      if (dateObj >= oneMonthAgo && dateObj <= now) sum1 += v;
      if (dateObj >= oneWeekAgo && dateObj <= now) sumW += v;
    });

    const cal: Array<{ date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }> = [];
    const tempDate = new Date(sixMonthsAgo);
    while (tempDate <= now) {
      const y = tempDate.getFullYear();
      const m = String(tempDate.getMonth() + 1).padStart(2, '0');
      const d = String(tempDate.getDate()).padStart(2, '0');
      const ds = `${y}-${m}-${d}`;
      const v = dateMap.get(ds) || 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (v > 0 && v <= 2) level = 1;
      else if (v > 2 && v <= 5) level = 2;
      else if (v > 5 && v <= 9) level = 3;
      else if (v > 9) level = 4;
      cal.push({ date: ds, count: v, level });
      tempDate.setDate(tempDate.getDate() + 1);
    }

    setSums({ sum6Months: sum6, sum1Month: sum1, sum1Week: sumW });
    setCalendarData(cal);
  }, [data]);

  if (!calendarData) return <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-3)" }}>暂无数据</div>;

  const { sum6Months, sum1Month, sum1Week } = sums;

  return (
    <div className="gh-calendar-container" style={{ paddingTop: '10px' }}>
      {/* 热力图主体 */}
      <div ref={calendarRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }}>
        <ActivityCalendar
          data={calendarData}
          showWeekdayLabels
          blockSize={20}
          blockMargin={5}
          blockRadius={3}
          labels={{
            months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
            weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
            totalCount: "此处仅统计初次通过的题目记录",
            legend: {
              less: "少",
              more: "多",
            },
          }}
          theme={{
            light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
            dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
          }}
          renderBlock={(block, activity) => {
            const [y, m, d] = activity.date.split("-");
            const dateStr = `${y}年${parseInt(m)}月${parseInt(d)}日`;
            const tooltipContent = (
              <div style={{ textAlign: "center", padding: "4px 2px" }}>
                <div style={{ fontWeight: 600, marginBottom: "4px" }}>{dateStr}</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px" }}>
                  {activity.count > 0 ? `通过了 ${activity.count} 道题` : "无通过记录"}
                </div>
              </div>
            );

            return (
              <Tooltip key={activity.date} content={tooltipContent} position="top" trigger="hover" style={{ backgroundColor: '#24292e' }}>
                {block}
              </Tooltip>
            );
          }}
        />
      </div>

      {/* 下方统计卡片 - 3列水平排列 */}
      <div className="heatmap-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
        {[
          { label: '最近半年通过了', value: sum6Months },
          { label: '最近一个月通过了', value: sum1Month },
          { label: '最近一周通过了', value: sum1Week },
        ].map((item) => (
          <div key={item.label} style={{
            background: 'var(--color-fill-1)',
            borderRadius: '8px',
            padding: '12px',
          }}>
            <Text type="secondary" style={{ fontSize: 13 }}>{item.label}</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text-1)', marginTop: 4 }}>
              {item.value} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-3)' }}>道题</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
