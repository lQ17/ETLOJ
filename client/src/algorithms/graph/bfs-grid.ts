import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `function bfs(maze, start, end) {
  const queue = [start];
  const visited = new Set([start]);
  const parent = {};
  
  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr === end) {
      return reconstructPath(parent, end);
    }
    
    for (const next of getNeighbors(curr)) {
      if (isValid(next) && !visited.has(next)) {
        visited.add(next);
        parent[next] = curr;
        queue.push(next);
      }
    }
  }
  return null; // 无通路
}`;

function parseGrid(input: number[]): { grid: number[][]; R: number; C: number } {
  const n = input.length;
  const C = Math.ceil(Math.sqrt(n));
  const R = Math.ceil(n / C);
  const grid: number[][] = [];
  for (let i = 0; i < R; i++) {
    grid.push(input.slice(i * C, (i + 1) * C));
  }
  return { grid, R, C };
}

function generateSteps(input: number[]): { steps: VisualStep[]; state?: unknown } {
  const { grid: initialGrid, R, C } = parseGrid(input);
  const steps: VisualStep[] = [];

  // Find start (-2) and end (-3)
  let start: [number, number] = [0, 0];
  let end: [number, number] = [R - 1, C - 1];
  let hasStart = false;
  let hasEnd = false;

  for (let i = 0; i < R; i++) {
    for (let j = 0; j < C; j++) {
      if (initialGrid[i][j] === -2) {
        start = [i, j];
        hasStart = true;
      } else if (initialGrid[i][j] === -3) {
        end = [i, j];
        hasEnd = true;
      }
    }
  }

  // Force set if not present in the input
  const grid = initialGrid.map((row) => [...row]);
  if (!hasStart) grid[0][0] = -2;
  if (!hasEnd && R > 0 && C > 0) grid[R - 1][C - 1] = -3;

  const queue: [number, number][] = [[...start]];
  const visited: boolean[][] = Array.from({ length: R }, () => new Array(C).fill(false));
  visited[start[0]][start[1]] = true;

  const parent: Record<string, [number, number]> = {};
  const dist: number[][] = Array.from({ length: R }, () => new Array(C).fill(0));

  // Step 1: Init
  steps.push({
    array: [...input],
    highlights: {
      grids: [{ grid: grid.map((r) => [...r]), label: "网格迷宫 (BFS)" }],
    },
    message: `初始化: 起点为 S (${start[0]}, ${start[1]})，终点为 E (${end[0]}, ${end[1]})，队列已加入起点。`,
    line: 2,
    variables: { "队列长度": queue.length, "已访问数": 1 },
  });

  const dirs = [
    [-1, 0], // 上
    [1, 0],  // 下
    [0, -1], // 左
    [0, 1],  // 右
  ];

  let found = false;

  // Helper to extract visited cells that are NOT currently in the queue, nor the start/end, for coloring
  const getUpdatedCells = (q: [number, number][]): [number, number][] => {
    const res: [number, number][] = [];
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < C; j++) {
        if (visited[i][j] && !(i === start[0] && j === start[1]) && !(i === end[0] && j === end[1])) {
          // Check if it's in the queue
          const inQueue = q.some(([qr, qc]) => qr === i && qc === j);
          if (!inQueue) {
            res.push([i, j]);
          }
        }
      }
    }
    return res;
  };

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;

    // Step: Pop current node
    steps.push({
      array: [...input],
      highlights: {
        grids: [
          {
            grid: grid.map((row) => [...row]),
            label: "网格迷宫 (BFS)",
            highlights: {
              current: [r, c],
              related: queue.map((pos) => [...pos] as [number, number]),
              updated: getUpdatedCells(queue),
            },
          },
        ],
      },
      message: `从队列头部取出当前节点 (${r}, ${c})，准备探索其上下左右相邻的未访问通道。`,
      line: 7,
      variables: { "当前节点": `(${r}, ${c})`, "队列长度": queue.length },
    });

    if (r === end[0] && c === end[1]) {
      found = true;
      break;
    }

    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;

      if (nr >= 0 && nr < R && nc >= 0 && nc < C) {
        const val = grid[nr][nc];
        if (val !== -1 && !visited[nr][nc]) {
          visited[nr][nc] = true;
          parent[`${nr},${nc}`] = [r, c];
          dist[nr][nc] = dist[r][c] + 1;

          // If it's a regular empty pathway, show the step distance
          if (grid[nr][nc] === 0) {
            grid[nr][nc] = dist[nr][nc];
          }

          queue.push([nr, nc]);

          // Step: Push next node
          steps.push({
            array: [...input],
            highlights: {
              grids: [
                {
                  grid: grid.map((row) => [...row]),
                  label: "网格迷宫 (BFS)",
                  highlights: {
                    current: [nr, nc],
                    related: queue.map((pos) => [...pos] as [number, number]),
                    updated: getUpdatedCells(queue),
                  },
                },
              ],
            },
            message: `从 (${r}, ${c}) 成功探索到相邻节点 (${nr}, ${nc})，步数记录为 ${dist[nr][nc]}，加入队列中。`,
            line: 15,
            variables: { "当前节点": `(${r}, ${c})`, "探索节点": `(${nr}, ${nc})`, "队列长度": queue.length },
          });
        }
      }
    }
  }

  if (found) {
    // Reconstruct path
    const path: [number, number][] = [];
    let curr: [number, number] = end;
    while (!(curr[0] === start[0] && curr[1] === start[1])) {
      path.push(curr);
      const nextNode = parent[`${curr[0]},${curr[1]}`];
      if (!nextNode) break;
      curr = nextNode;
    }
    path.push(start);
    path.reverse();

    // Visualize the path creation step-by-step for cool aesthetics
    for (let i = 1; i <= path.length; i++) {
      const currentPath = path.slice(0, i);
      steps.push({
        array: [...input],
        highlights: {
          grids: [
            {
              grid: grid.map((row) => [...row]),
              label: "网格迷宫 (BFS)",
              highlights: {
                updated: currentPath.map((pos) => [...pos] as [number, number]),
              },
            },
          ],
        },
        message: `成功找到通路！最少步数为 ${dist[end[0]][end[1]]} 步，正在回溯重构最短路径...`,
        line: 9,
      });
    }

    // Final state
    steps.push({
      array: [...input],
      highlights: {
        grids: [
          {
            grid: grid.map((row) => [...row]),
            label: "网格迷宫 (BFS)",
            highlights: {
              updated: path.map((pos) => [...pos] as [number, number]),
            },
          },
        ],
      },
      message: `寻路完成！最短路径共计 ${dist[end[0]][end[1]]} 步（不含起点），绿色轨迹为最终求得的最短路径。`,
      line: 9,
    });
  } else {
    steps.push({
      array: [...input],
      highlights: {
        grids: [{ grid: grid.map((row) => [...row]), label: "网格迷宫 (BFS)" }],
      },
      message: `队列已空，未能到达终点 E (${end[0]}, ${end[1]})。该迷宫没有可行通路！`,
      line: 20,
    });
  }

  return { steps };
}

function randomMaze(): number[] {
  const R = 6;
  const C = 6;
  const grid: number[] = [];
  for (let i = 0; i < R * C; i++) {
    const r = Math.floor(i / C);
    const c = i % C;
    if (r === 0 && c === 0) {
      grid.push(-2);
    } else if (r === R - 1 && c === C - 1) {
      grid.push(-3);
    } else {
      grid.push(Math.random() < 0.25 ? -1 : 0);
    }
  }
  return grid;
}

const bfsGrid: AlgorithmDef = {
  id: "bfs-grid",
  name: "网格图广度优先搜索 (BFS)",
  category: "graph",
  description: "在二维网格地图上执行广度优先搜索以寻找从起点到终点的最短路径。搜索过程类似波纹向四周层层扩散，确保第一次到达终点时即为最短路。",
  timeComplexity: "O(R×C)",
  spaceComplexity: "O(R×C)",
  defaultInput: [
    -2,  0, -1,  0,  0,  0,
     0,  0, -1,  0, -1,  0,
     0,  0,  0,  0, -1,  0,
    -1, -1, -1,  0,  0,  0,
     0,  0,  0, -1, -1,  0,
     0,  0,  0,  0,  0, -3
  ],
  inputDimension: "2d",
  sourceCode: SOURCE_CODE,
  randomInput: randomMaze,
  generateSteps,
};

registerAlgorithm(bfsGrid);
export default bfsGrid;
