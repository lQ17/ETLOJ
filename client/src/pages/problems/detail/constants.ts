export const langMap: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  java: "java",
  python: "python",
};


export const statusLabel: Record<string, string> = {
  PENDING: "等待中",
  JUDGING: "判题中",
  AC: "通过",
  WA: "答案错误",
  TLE: "超时",
  MLE: "内存超限",
  RE: "运行错误",
  CE: "编译错误",
  SE: "系统错误",
};
export const statusColor: Record<string, string> = {
  PENDING: "gray", JUDGING: "blue", AC: "green",
  WA: "red", TLE: "orange", MLE: "orange",
  RE: "red", CE: "orange", SE: "red",
};

export const defaultCode: Record<string, string> = {
  c: "",
  cpp: "",
  java: "",
  python: "",
};
