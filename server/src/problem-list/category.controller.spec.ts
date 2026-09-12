import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import request from "supertest";
import { CategoryController } from "./category.controller";
import { CategoryService } from "./category.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

describe("Category API authorization and validation", () => {
  let app: INestApplication;
  let role: string;
  const service = { tree: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}), items: jest.fn().mockResolvedValue([]), add: jest.fn().mockResolvedValue({}), sort: jest.fn().mockResolvedValue({}), remove: jest.fn().mockResolvedValue({}) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [CategoryController], providers: [{ provide: CategoryService, useValue: service }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: context => { context.switchToHttp().getRequest().user = { id: 1, role }; return true; } }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => { jest.clearAllMocks(); role = "ADMIN"; });
  it("allows public tree access", async () => { role = "USER"; await request(app.getHttpServer()).get("/problem-list-categories").expect(200); });
  it.each(["USER", "TEACHER"])("prevents %s from changing category structure", async value => {
    role = value;
    await request(app.getHttpServer()).post("/problem-list-categories/initialize").expect(403);
    await request(app.getHttpServer()).post("/problem-list-categories").send({ name: "A" }).expect(403);
    await request(app.getHttpServer()).patch("/problem-list-categories/1").send({ enabled: false }).expect(403);
    expect(service.create).not.toHaveBeenCalled(); expect(service.update).not.toHaveBeenCalled();
  });
  it("prevents ordinary users from reading management data or changing memberships", async () => {
    role = "USER";
    await request(app.getHttpServer()).get("/problem-list-categories/manage").expect(403);
    await request(app.getHttpServer()).get("/problem-list-categories/2/items").expect(403);
    await request(app.getHttpServer()).post("/problem-list-categories/2/items").send({ listIds: [1] }).expect(403);
    await request(app.getHttpServer()).patch("/problem-list-categories/2/items/sort").send({ listIds: [1] }).expect(403);
    await request(app.getHttpServer()).delete("/problem-list-categories/2/items/1").expect(403);
  });
  it("allows teachers to arrange lists", async () => {
    role = "TEACHER";
    await request(app.getHttpServer()).post("/problem-list-categories/2/items").send({ listIds: [1, 2] }).expect(201);
    expect(service.add).toHaveBeenCalledWith(2, [1, 2]);
  });
  it("rejects invalid category names and duplicate membership IDs", async () => {
    await request(app.getHttpServer()).post("/problem-list-categories").send({}).expect(400);
    await request(app.getHttpServer()).post("/problem-list-categories").send({ name: "   " }).expect(400);
    await request(app.getHttpServer()).post("/problem-list-categories/2/items").send({ listIds: [1, 1] }).expect(400);
    await request(app.getHttpServer()).patch("/problem-list-categories/2/items/sort").send({ listIds: [-1] }).expect(400);
    expect(service.add).not.toHaveBeenCalled();
  });
  it("rejects null for non-nullable fields but allows clearing a description", async () => {
    await request(app.getHttpServer()).patch("/problem-list-categories/1").send({ name: null }).expect(400);
    await request(app.getHttpServer()).patch("/problem-list-categories/1").send({ sortOrder: null }).expect(400);
    await request(app.getHttpServer()).patch("/problem-list-categories/1").send({ enabled: null }).expect(400);
    await request(app.getHttpServer()).patch("/problem-list-categories/1").send({ description: null }).expect(200);
    expect(service.update).toHaveBeenCalledWith(1, { description: null });
  });
});
