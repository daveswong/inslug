// 只读连通测试：ping + 列出集合名，不写入任何数据
import { MongoClient } from "mongodb";
import { resolveDb } from "./_db.mjs";

const config = resolveDb();

const client = new MongoClient(config.uri, { serverSelectionTimeoutMS: 15000 });

try {
  await client.connect();
  // ping 只验证连通性，不写数据
  const ping = await client.db(config.dbName).command({ ping: 1 });
  console.log("连接成功：", ping.ok === 1 ? "OK" : "异常");

  // 列出已有集合（只读）
  const collections = await client.db(config.dbName).listCollections().toArray();
  const names = collections.map((c) => c.name);
  console.log(`数据库 ${config.dbName} 的集合数：${names.length}`);
  if (names.length) console.log("集合：", names.join(", "));
  else console.log("（空库，尚无集合）");
} catch (err) {
  console.error("连接失败：", err.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
