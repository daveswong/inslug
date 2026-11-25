// 生成后备密码的 bcrypt 哈希：npm run hash-password -- 你的密码
import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("用法：npm run hash-password -- 你的密码");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
