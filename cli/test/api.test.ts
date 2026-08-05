import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { EtlojApi } from "../src/api.ts";
import { buildProblemQuery } from "../src/commands.ts";

let server: ReturnType<typeof createServer>;
let baseUrl = "";

before(async () => {
  server = createServer((request, response) => {
    assert.equal(request.headers.authorization, "Bearer test-token");
    if (request.url?.startsWith("/api/problems?")) {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20 }));
      return;
    }
    response.statusCode = 404;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ message: "not found" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not start");
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(() => server.close());

test("requests JSON APIs with auth and query parameters", async () => {
  const client = new EtlojApi({ apiUrl: baseUrl, token: "test-token" });
  const result = await client.request<{ total: number }>("problems", {
    query: { page: 1, tags: ["图论", "DP"] },
  });
  assert.equal(result.total, 0);
});

test("builds an unfiltered list query without leaking Commander objects", () => {
  const query = buildProblemQuery({ pageSize: "20", tag: [], tagMode: "OR" }, { internal: "command" });
  assert.equal(query.keyword, undefined);
  assert.equal(query.content, undefined);
  assert.deepEqual(query.tags, []);
});

test("supports title and content search modes", () => {
  const titleQuery = buildProblemQuery({ pageSize: "20", searchIn: "title" }, "binary search");
  assert.equal(titleQuery.keyword, "binary search");
  assert.equal(titleQuery.content, undefined);

  const contentQuery = buildProblemQuery({ pageSize: "20", searchIn: "content" }, "complexity");
  assert.equal(contentQuery.keyword, undefined);
  assert.equal(contentQuery.content, "complexity");
});
