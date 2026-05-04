import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { QueryRankingDto } from "./dto/query-ranking.dto";

@Injectable()
export class RankingService {
  constructor(private prisma: PrismaService) {}

  async getRanking(query: QueryRankingDto) {
    const { mode = "ac", range = "all", startDate, endDate, page = 1, pageSize = 20 } = query;

    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 20;
    const offset = (pageNum - 1) * sizeNum;

    // Calculate time boundaries
    const now = new Date();
    let timeStart: Date | null = null;
    let timeEnd: Date | null = null;

    switch (range) {
      case "today":
        timeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "yesterday":
        timeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        timeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "1w":
        timeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "1m":
        timeStart = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case "6m":
        timeStart = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case "custom":
        if (startDate) timeStart = new Date(startDate);
        if (endDate) {
          timeEnd = new Date(endDate);
          timeEnd.setHours(23, 59, 59, 999);
        }
        break;
      default: // 'all'
        timeStart = null;
    }

    const items = mode === "ac"
      ? await this.getAcRanking(timeStart, timeEnd, sizeNum, offset)
      : await this.getScoreRanking(timeStart, timeEnd, sizeNum, offset);

    const total = mode === "ac"
      ? await this.countAcRanking(timeStart, timeEnd)
      : await this.countScoreRanking(timeStart, timeEnd);

    // BigInt -> Number（MySQL COUNT/SUM 返回 BigInt，JSON.stringify 无法序列化）
    // LongText（avatar）通过 $queryRawUnsafe 返回 Buffer，需转为 string
    const safeItems = (items as any[]).map((r) => ({
      ...r,
      value: Number(r.value),
      avatar: r.avatar ? Buffer.from(r.avatar).toString() : null,
    }));

    return { items: safeItems, total, page: pageNum, pageSize: sizeNum };
  }

  private timeWhere(alias: string, timeStart: Date | null, timeEnd: Date | null): string {
    const conditions: string[] = [];
    if (timeStart) conditions.push(`${alias}.created_at >= '${timeStart.toISOString()}'`);
    if (timeEnd) conditions.push(`${alias}.created_at < '${timeEnd.toISOString()}'`);
    return conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";
  }

  private async getAcRanking(timeStart: Date | null, timeEnd: Date | null, limit: number, offset: number) {
    const timeFilter = this.timeWhere("s", timeStart, timeEnd);
    return this.prisma.$queryRawUnsafe(`
      SELECT u.id, u.username, u.avatar, COUNT(DISTINCT s.problem_id) as value
      FROM users u
      INNER JOIN submissions s ON s.user_id = u.id AND s.status = 'AC'
      WHERE u.is_active = 1 ${timeFilter}
      GROUP BY u.id, u.username, u.avatar
      HAVING value > 0
      ORDER BY value DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  private async countAcRanking(timeStart: Date | null, timeEnd: Date | null) {
    const timeFilter = this.timeWhere("s", timeStart, timeEnd);
    const result: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total FROM (
        SELECT u.id
        FROM users u
        INNER JOIN submissions s ON s.user_id = u.id AND s.status = 'AC'
        WHERE u.is_active = 1 ${timeFilter}
        GROUP BY u.id
        HAVING COUNT(DISTINCT s.problem_id) > 0
      ) t
    `);
    return Number(result[0]?.total || 0);
  }

  private async getScoreRanking(timeStart: Date | null, timeEnd: Date | null, limit: number, offset: number) {
    const timeFilter = this.timeWhere("s", timeStart, timeEnd);
    return this.prisma.$queryRawUnsafe(`
      SELECT u.id, u.username, u.avatar, COALESCE(SUM(p.score), 0) as value
      FROM users u
      INNER JOIN (
        SELECT user_id, problem_id, MIN(id) as first_ac_id
        FROM submissions
        WHERE status = 'AC'
        GROUP BY user_id, problem_id
      ) fa ON fa.user_id = u.id
      INNER JOIN submissions s ON s.id = fa.first_ac_id
      INNER JOIN problems p ON p.id = fa.problem_id
      WHERE u.is_active = 1 ${timeFilter}
      GROUP BY u.id, u.username, u.avatar
      HAVING value > 0
      ORDER BY value DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
  }

  private async countScoreRanking(timeStart: Date | null, timeEnd: Date | null) {
    const timeFilter = this.timeWhere("s", timeStart, timeEnd);
    const result: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total FROM (
        SELECT u.id
        FROM users u
        INNER JOIN (
          SELECT user_id, problem_id, MIN(id) as first_ac_id
          FROM submissions
          WHERE status = 'AC'
          GROUP BY user_id, problem_id
        ) fa ON fa.user_id = u.id
        INNER JOIN submissions s ON s.id = fa.first_ac_id
        INNER JOIN problems p ON p.id = fa.problem_id
        WHERE u.is_active = 1 ${timeFilter}
        GROUP BY u.id
        HAVING COALESCE(SUM(p.score), 0) > 0
      ) t
    `);
    return Number(result[0]?.total || 0);
  }
}
