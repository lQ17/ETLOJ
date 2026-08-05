export type OutputFormat = "table" | "json" | "ndjson" | "markdown";

export type ProblemListItem = {
  slug: string;
  title: string;
  timeLimit: number;
  memoryLimit: number;
  score: number;
  tags: string[];
  stats: ProblemStats;
  id?: number;
  difficulty?: string;
  isPublic?: boolean;
  totalSubmissions?: number;
  acceptedCount?: number;
  markdown?: string;
};

export type ProblemListResponse = {
  items: ProblemListItem[];
  total: number;
  page: number;
  pageSize: number;
  truncated?: boolean;
};

export type ProblemStats = {
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
};

export type ProblemDetail = {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  timeLimit: number;
  memoryLimit: number;
  tags: string[];
  tagIds: number[];
  isPublic: boolean;
  score: number;
  createdAt: string;
  updatedAt: string;
  markdown: string;
  testcaseCount: number;
  stats: ProblemStats;
};

export type ProblemSummary = {
  slug: string;
  title: string;
  timeLimit: number;
  memoryLimit: number;
  score: number;
  markdown?: string;
  tags: string[];
  stats: ProblemStats;
};

export type ProblemStatusResult = {
  slug: string;
  title: string;
  status: "AC" | "ATTEMPTED" | "NOT_ATTEMPTED";
  passed: boolean;
};

export type LibrarySummary = {
  id: number;
  title: string;
  description?: string | null;
  creator?: { id: number; username: string } | null;
  problemCount: number;
  acCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type LibraryDetail = {
  id: number;
  title: string;
  description?: string | null;
  isPublic: boolean;
  creator: { id: number; username: string };
  items: Array<{
    id: number;
    sortOrder: number;
    problem: {
      id: number;
      slug: string;
      title: string;
      difficulty: string;
      score: number;
    };
  }>;
};

export type Tag = {
  id: number;
  name: string;
  description?: string | null;
  _count?: { problems: number };
};

export type ApiConfig = {
  apiUrl: string;
  token?: string;
};
