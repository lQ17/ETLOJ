const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');

async function main() {
  const endpoint = process.argv[2];
  if (!endpoint) throw new Error('Usage: node mcp-production-smoke.cjs <endpoint>');
  const token = process.env.MCP_SMOKE_ACCESS_TOKEN;
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    ...(token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  });
  const client = new Client({ name: 'etloj-production-smoke', version: '1.0.0' });
  await client.connect(transport);
  try {
    const tools = await client.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    console.log('server', JSON.stringify(client.getServerVersion()));
    console.log('tools', names.join(','));
    if (!token) {
      const tags = await client.callTool({ name: 'list_tags', arguments: {} });
      const problems = await client.callTool({ name: 'search_problems', arguments: { pageSize: 2 } });
      const lists = await client.callTool({ name: 'list_problem_lists', arguments: { pageSize: 5 } });
      console.log('tags_total', tags.structuredContent.total);
      console.log('problems_total', problems.structuredContent.total);
      console.log('lists_total', lists.structuredContent.total);
      const problem = problems.structuredContent.items[0];
      if (problem) {
        const detail = await client.callTool({ name: 'get_problem', arguments: { problem: problem.slug } });
        const markdown = await client.callTool({ name: 'get_problem_markdown', arguments: { problem: String(problem.id) } });
        console.log('problem_ok', detail.structuredContent.slug, markdown.isError !== true);
      }
      const list = lists.structuredContent.items[0];
      if (list) {
        const detail = await client.callTool({ name: 'get_problem_list', arguments: { listId: list.id } });
        console.log('list_detail', JSON.stringify(detail.structuredContent));
      }
      const boundary = await client.callTool({ name: 'list_problem_lists', arguments: { pageSize: 51 } });
      console.log('boundary_rejected', boundary.isError === true);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
