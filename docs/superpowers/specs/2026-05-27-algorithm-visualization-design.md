# Algorithm Visualization Page — Design Spec

## Overview

在 ETLOJ 平台新增"算法可视化"页面，放在一级导航栏"排名"之后。用户可选择算法、编辑输入数据、观看逐步动画演示。采用自建 step-based 可视化引擎 + Framer Motion 动画方案。

## Architecture

### 分层结构

```
┌─────────────────────────────────────┐
│  页面层 (pages/visualization/)       │
│  - 左侧：算法分类选择 + 参数面板     │
│  - 中间：可视化画布（柱状图）         │
│  - 底部：播放控制栏                   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  引擎层 (components/visual-engine/)  │
│  - PlaybackController：播放控制      │
│  - BarChart：柱状图渲染              │
│  - StepInfo：步骤说明                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  算法注册层 (algorithms/)            │
│  - registry.ts：统一注册入口          │
│  - types.ts：类型定义                │
│  - sorting/*.ts：各排序算法          │
└─────────────────────────────────────┘
```

### 算法注册机制

每个算法是独立文件，导出标准化 `AlgorithmDef` 接口。新增算法只需：
1. 创建算法文件（如 `algorithms/sorting/heap.ts`）
2. 在 `registry.ts` 注册一行

引擎自动发现已注册算法，无需修改页面代码。

## Core Types

```ts
interface VisualStep {
  array: number[];
  highlights: {
    comparing?: number[];  // 正在比较的索引
    swapping?: number[];   // 正在交换的索引
    sorted?: number[];     // 已排好序的索引
    pivot?: number;        // 快排 pivot
    active?: number[];     // 当前处理区间
  };
  message?: string;        // 步骤说明（如 "比较 arr[2] 和 arr[3]"）
}

interface AlgorithmDef {
  id: string;
  name: string;            // 如 "冒泡排序"
  category: "sorting" | "graph" | "string" | "data-structure";
  description: string;     // 算法简介
  timeComplexity: string;  // 如 "O(n²)"
  spaceComplexity: string; // 如 "O(1)"
  defaultInput: number[];
  generateSteps(input: number[]): VisualStep[];
  inputParser?: (text: string) => number[] | null;
}
```

## Page Layout

```
┌──────────────────────────────────────────────────┐
│  顶部：算法选择区                                  │
│  [排序] [图论] [数据结构] [字符串]  ← 分类 Tab      │
│  [冒泡排序] [选择排序] [插入排序] [归并排序] [快速排序] │
└──────────────────────────────────────────────────┘
┌──────────────────────┬───────────────────────────┐
│  左侧面板             │  可视化画布                 │
│                      │                           │
│  输入数据             │   ▌ ▌▌ ▌ ▌▌ ▌ ▌           │
│  [34,12,45,9,67...]  │   ▌ ▌▌ ▌ ▌▌ ▌ ▌           │
│  [随机生成] [重置]     │   ▌ ▌▌ ▌ ▌▌ ▌ ▌           │
│                      │                           │
│  算法说明             │                           │
│  冒泡排序，时间复杂度   │                           │
│  O(n²)，空间复杂度...  │                           │
└──────────────────────┴───────────────────────────┘
┌──────────────────────────────────────────────────┐
│  底部控制栏                                        │
│  [⏮] [▶/⏸] [⏭]   进度条 ═══●══════   速度 [2x]  │
│                     步骤说明：比较 arr[2] 和 arr[3]  │
└──────────────────────────────────────────────────┘
```

### UI 细节

- 分类 Tab 和算法选择：Arco Design `Radio.Group`（按钮样式）
- 左侧面板与画布：flex 布局，比例 2:8
- 柱状图颜色：
  - 默认：`#165DFF`（Arco 主色）
  - 比较中：`#FF7D00`（橙色）
  - 已排序：`#00B42A`（绿色）
- 暗色模式：跟随网站主题，使用 CSS 变量
- 控制栏：播放按钮突出，速度用 Arco `Select`（0.5x / 1x / 2x / 4x）
- 进度条：可点击跳转到指定步骤

### 输入编辑

- 文本框输入逗号分隔数字，点"应用"生效
- "随机生成"按钮：生成 10~30 个随机数（范围 5~100）
- 输入校验：非数字、超长（>50）、空数组给出 Toast 提示

## Playback Engine

### 状态管理

- 播放状态：`idle | playing | paused`
- `currentStep` 索引驱动渲染
- `useEffect` + `setInterval` 实现自动播放，间隔 = `baseInterval(800ms) / speed`

### 控制操作

| 操作 | 行为 |
|------|------|
| 播放 | 从 currentStep 开始自动前进 |
| 暂停 | 停留在当前步骤 |
| 上一步 | currentStep - 1（最小 0） |
| 下一步 | currentStep + 1（最大 steps.length - 1） |
| 重置 | 回到 idle，清空 steps，恢复初始数组 |
| 速度调节 | 调整 interval 间隔 |
| 进度条点击 | 跳转到指定步骤 |

### 动画实现

- 每根柱子用 `<motion.div>` 渲染
- `layoutId` 绑定数组索引，交换时 Framer Motion 自动做位移过渡
- 高亮状态通过 `backgroundColor` 的 `animate` 切换，200ms 过渡
- 柱子高度通过 `animate={{ height }}` 平滑变化

## File Structure

```
client/src/
├── pages/
│   └── visualization/
│       └── index.tsx              # 页面主组件
├── components/
│   └── visual-engine/
│       ├── PlaybackController.tsx  # 播放控制栏
│       ├── BarChart.tsx            # 柱状图可视化
│       └── StepInfo.tsx            # 步骤说明
├── algorithms/
│   ├── registry.ts                 # 算法注册中心
│   ├── types.ts                    # 类型定义
│   └── sorting/
│       ├── bubble.ts               # 冒泡排序
│       ├── selection.ts            # 选择排序
│       ├── insertion.ts            # 插入排序
│       ├── merge.ts                # 归并排序
│       └── quick.ts                # 快速排序
```

### Modified Files

- `AppHeader.tsx` — menuItems 追加 `{ key: "/visualization", label: "可视化" }`
- `App.tsx` — 追加 `<Route path="/visualization" element={<VisualizationPage />} />`

## MVP Scope

### 包含

- 5 个排序算法：冒泡、选择、插入、归并、快速
- 完整播放控制（播放/暂停/步进/速度/进度条）
- 可编辑输入（文本框 + 随机生成）
- 步骤说明文字
- 响应式布局
- 暗色模式适配

### 不包含（后续扩展）

- 图论算法（BFS、DFS、Dijkstra 等）
- 数据结构操作（栈、队列、树等）
- 字符串/查找算法
- 代码同步高亮
- 拖拽调整柱子高度

## Dependencies

- `framer-motion` — 动画过渡（唯一新增依赖）
