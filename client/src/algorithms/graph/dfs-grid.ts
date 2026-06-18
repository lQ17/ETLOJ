import type { AlgorithmDef, VisualStep } from "../types";
import { registerAlgorithm } from "../registry";

const SOURCE_CODE = `function dfs(maze, curr, end, visited, path) {
  if (curr === end) return true;
  
  for (const next of getNeighbors(curr)) {
    if (isValid(next) && !visited.has(next)) {
      visited.add(next);
      path.push(next);
      
      if (dfs(maze, next, end, visited, path)) {
        return true;
      }
      
      path.pop(); // 回溯
    }
  }
  return false;
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

  const visited: boolean[][] = Array.from({ length: R }, () => new Array(C).fill(false));
  const path: [number, number][] = [];
  let found = false;

  const getDeadEnds = (): [number, number][] => {
    const res: [number, number][] = [];
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < C; j++) {
        if (visited[i][j] && !(i === start[0] && j === start[1]) && !(i === end[0] && j === end[1])) {
          const inPath = path.some(([pr, pc]) => pr === i && pc === j);
          if (!inPath) {
            res.push([i, j]);
          }
        }
      }
    }
    return res;
  };

  // Step 1: Init
  steps.push({
    array: [...input],
    highlights: {
      grids: [{ grid: grid.map((r) => [...r]), label: "网格迷宫 (DFS)" }],
    },
    message: `初始化: 起点为 S (${start[0]}, ${start[1]})，终点为 E (${end[0]}, ${end[1]})，准备开始深度优先搜索 (DFS)。`,
    line: 1,
  });

  function dfsHelper(r: number, c: number): boolean {
    visited[r][c] = true;
    path.push([r, c]);

    // Step: enter current node
    steps.push({
      array: [...input],
      highlights: {
        grids: [
          {
            grid: grid.map((row) => [...row]),
            label: "网格迷宫 (DFS)",
            highlights: {
              current: [r, c],
              related: path.map((pos) => [...pos] as [number, number]),
              updated: getDeadEnds(),
            },
          },
        ],
      },
      message: `进入节点 (${r}, ${c})，探索是否可达终点。当前探索路径深度: ${path.length}。`,
      line: 4,
      variables: { "当前节点": `(${r}, ${c})`, "探索路径深度": path.length },
    });

    if (r === end[0] && c === end[1]) {
      found = true;
      return true;
    }

    const dirs = [
      [-1, 0], // 上
      [1, 0],  // 下
      [0, -1], // 左
      [0, 1],  // 右
    ];

    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < R && nc >= 0 && nc < C) {
        if (grid[nr][nc] !== -1 && !visited[nr][nc]) {
          // Step: found unvisited neighbor
          steps.push({
            array: [...input],
            highlights: {
              grids: [
                {
                  grid: grid.map((row) => [...row]),
                  label: "网格迷宫 (DFS)",
                  highlights: {
                    current: [r, c],
                    related: path.map((pos) => [...pos] as [number, number]),
                    updated: getDeadEnds(),
                  },
                },
              ],
            },
            message: `在 (${r}, ${c}) 探测到相邻未访问通道 (${nr}, ${nc})，深入递归以判定连通性。`,
            line: 7,
            variables: { "当前节点": `(${r}, ${c})`, "下一探索节点": `(${nr}, ${nc})` },
          });

          if (dfsHelper(nr, nc)) {
            return true;
          }
        }
      }
    }

    // Backtrack
    path.pop();

    // Step: backtrack from current node
    steps.push({
      array: [...input],
      highlights: {
        grids: [
          {
            grid: grid.map((row) => [...row]),
            label: "网格迷宫 (DFS)",
            highlights: {
              current: [r, c],
              related: path.map((pos) => [...pos] as [number, number]),
              updated: getDeadEnds(),
            },
          },
        ],
      },
      message: `从 (${r}, ${c}) 回溯，此分支所有方向均已探明，无法到达终点。`,
      line: 12,
      variables: { "回退节点": `(${r}, ${c})`, "探索路径深度": path.length },
    });

    return false;
  }

  dfsHelper(start[0], start[1]);

  if (found) {
    // Show final pathway reconstruction
    for (let i = 1; i <= path.length; i++) {
      const currentPath = path.slice(0, i);
      steps.push({
        array: [...input],
        highlights: {
          grids: [
            {
              grid: grid.map((row) => [...row]),
              label: "网格迷宫 (DFS)",
              highlights: {
                updated: currentPath.map((pos) => [...pos] as [number, number]),
              },
            },
          ],
        },
        message: `连通性判定成功！起点与终点可达。正在高亮展示连通通路...`,
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
            label: "网格迷宫 (DFS)",
            highlights: {
              updated: path.map((pos) => [...pos] as [number, number]),
            },
          },
        ],
      },
      message: `DFS 连通性判定完成！终点可达，高亮轨迹展示了一条连通起点与终点的可行通路。`,
      line: 9,
    });
  } else {
    steps.push({
      array: [...input],
      highlights: {
        grids: [{ grid: grid.map((row) => [...row]), label: "网格迷宫 (DFS)" }],
      },
      message: `DFS 探索结束，遍历了所有连通区域，终点不可达！该迷宫没有可行通路。`,
      line: 15,
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

const dfsGrid: AlgorithmDef = {
  id: "dfs-grid",
  name: "网格图深度优先搜索 (DFS) - 可达性",
  category: "graph",
  description: "在二维网格地图上执行深度优先搜索以判定起点与终点的连通性（是否可达）。算法会沿某一方向深入探索，若遇死胡同则通过回溯返回，直到找到终点（可达）或遍历所有可达节点（不可达）。",
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

registerAlgorithm(dfsGrid);
export default dfsGrid;
