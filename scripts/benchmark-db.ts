import postgres from "postgres";
import { isolatedTestDatabase } from "./test-database";

const client = postgres(isolatedTestDatabase(process.env.TEST_DATABASE_URL), { max: 1, prepare: false });
try {
  await client.begin(async (tx) => {
    const target = crypto.randomUUID();
    await tx`create temporary table ss_perf_logs (like public.notification_logs including defaults) on commit drop`;
    await tx`insert into ss_perf_logs (assignment_id, channel, recipient, status)
      select case when n % 200 = 0 then ${target}::uuid else gen_random_uuid() end, 'email', 'benchmark@example.invalid', 'sent' from generate_series(1, 20000) n`;
    await tx`analyze ss_perf_logs`;
    const query = "explain (analyze, buffers, format json) select status from ss_perf_logs where assignment_id = $1 order by channel, created_at desc, id desc limit 2";
    const [before] = await tx.unsafe(query, [target]);
    await tx`create index ss_perf_history_idx on ss_perf_logs(assignment_id, channel, created_at desc, id desc)`;
    await tx`analyze ss_perf_logs`;
    const [after] = await tx.unsafe(query, [target]);
    console.log(JSON.stringify({ syntheticRows: 20000, before: before["QUERY PLAN"][0], after: after["QUERY PLAN"][0] }, null, 2));
  });
} finally { await client.end(); }
