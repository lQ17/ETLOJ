import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { CategoryService } from "./category.service";
import { ProblemListService } from "./problem-list.service";
import { PrismaService } from "../prisma/prisma.service";

// Explicitly opt in against a local database. All fixtures are rolled back.
const describeLocal = process.env.RUN_CATEGORY_DB_TESTS === "1" ? describe : describe.skip;
describeLocal("Category database integration", () => {
  const prisma = new PrismaClient();
  afterAll(async () => prisma.$disconnect());
  it("preserves independent ordering, deduplicates roots and keeps visibility/counts consistent", async () => {
    const host = new URL(process.env.DATABASE_URL!).hostname;
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(host);
    const rollback = new Error("ROLLBACK_TEST_FIXTURES");
    let rootId: number | undefined;
    await expect(prisma.$transaction(async tx => {
      const scoped = new Proxy(tx, { get(target, key) {
        if (key === "$transaction") return (callback: (client: typeof tx) => unknown) => callback(tx);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      } }) as unknown as PrismaService;
      const categories = new CategoryService(scoped);
      const lists = new ProblemListService(scoped);
      const root = await categories.create({ name: "__category_integration__" });
      rootId = root.id;
      const first = await categories.create({ name: "A", parentId: root.id });
      const second = await categories.create({ name: "B", parentId: root.id });
      const a = await tx.problemList.create({ data: { title: "__category_integration__ A", isPublic: true } });
      const b = await tx.problemList.create({ data: { title: "__category_integration__ B", isPublic: true } });
      const privateList = await tx.problemList.create({ data: { title: "__category_integration__ private", isPublic: false } });
      await expect(categories.add(first.id, [a.id, privateList.id])).rejects.toThrow();
      expect(await categories.items(first.id)).toHaveLength(0);
      await categories.add(first.id, [a.id, b.id]);
      await categories.add(second.id, [a.id, b.id]);
      expect((await categories.add(first.id, [a.id])).count).toBe(0);
      await categories.sort(first.id, [b.id, a.id]);
      expect((await lists.findAllPublic(1, 1, undefined, undefined, undefined, first.id)).items.map(i => i.id)).toEqual([b.id]);
      expect((await lists.findAllPublic(2, 1, undefined, undefined, undefined, first.id)).items.map(i => i.id)).toEqual([a.id]);
      expect((await lists.findAllPublic(1, 20, undefined, undefined, undefined, second.id)).items.map(i => i.id)).toEqual([a.id, b.id]);
      expect((await lists.findAllPublic(1, 20, undefined, undefined, undefined, root.id)).total).toBe(2);
      const user = await tx.user.create({ data: { username: `cat-test-${root.id}`, password: "not-a-valid-login-hash" } });
      const problem = await tx.problem.create({ data: { slug: `cat-test-${root.id}`, title: "Visible", filePath: "__category_test__" } });
      const hidden = await tx.problem.create({ data: { slug: `cat-hidden-${root.id}`, title: "Hidden", filePath: "__category_test__", isPublic: false } });
      await tx.problemListItem.createMany({ data: [{ listId: a.id, problemId: problem.id }, { listId: a.id, problemId: hidden.id }] });
      await tx.submission.createMany({ data: [{ userId: user.id, problemId: problem.id, code: "", language: "cpp", status: "AC" }, { userId: user.id, problemId: hidden.id, code: "", language: "cpp", status: "AC" }] });
      for (const categoryId of [undefined, root.id, first.id]) {
        const result = await lists.findAllPublic(1, 100, "__category_integration__", user.id, "USER", categoryId);
        const item = result.items.find(i => i.id === a.id) as any;
        expect(item._count.items).toBe(1); expect(item.acCount).toBe(1);
      }
      const detail = await lists.findOne(a.id, user.id, "USER");
      expect(detail.items.map(i => i.problem.id)).toEqual([problem.id]);
      await categories.update(root.id, { enabled: false });
      expect((await categories.tree()).some(i => i.id === root.id)).toBe(false);
      await expect(lists.findAllPublic(1, 20, undefined, undefined, "ADMIN", first.id)).rejects.toThrow();
      expect((await lists.findAllPublic(1, 100, "__category_integration__")).total).toBe(2);
      await categories.remove(first.id, a.id);
      expect((await categories.items(second.id)).some(i => i.listId === a.id)).toBe(true);
      expect(await tx.problemList.findUnique({ where: { id: a.id } })).not.toBeNull();
      await categories.remove(second.id, a.id);
      expect((await lists.findAllPublic(1, 100, "__category_integration__", user.id, "ADMIN", undefined, true)).items.map(i => i.id)).toEqual([a.id]);
      throw rollback;
    }, { timeout: 30000 })).rejects.toBe(rollback);
    expect(await prisma.problemListCategory.findUnique({ where: { id: rootId } })).toBeNull();
  }, 40000);
});
