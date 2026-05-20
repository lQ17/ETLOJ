import { Link } from "react-router-dom";
import { Empty } from "@arco-design/web-react";
import DifficultyTag from "../../components/DifficultyTag";
import { getDifficultyHexColor } from "../../constants/difficulty";

interface ProblemItem {
  problem_id: number;
  slug: string;
  title: string;
  difficulty: string;
}

/** 题目墙 */
export default function ProblemWall({ problems }: { problems: ProblemItem[] }) {
  if (!problems.length) return <Empty description="暂无数据" style={{ padding: 32 }} />;

  return (
    <div className="problem-wall">
      {problems.map((p) => (
        <Link
          key={p.problem_id}
          to={`/problems/${p.slug}`}
          className="problem-tag"
          style={{ borderLeftColor: getDifficultyHexColor(p.difficulty) }}
        >
          <DifficultyTag difficulty={p.difficulty} size="small" />
          <span className="problem-tag-title">{p.title}</span>
        </Link>
      ))}
    </div>
  );
}
