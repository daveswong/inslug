/**
 * RECOVERY_TOKEN 的提示文案。
 *
 * 只在安装和紧急登录场景出现。程序不提供删除按钮，也不写环境变量；
 * 是否删除由用户手动完成，不删除也不报错。
 */

export const RECOVERY_DELETE_HINT =
  "RECOVERY_TOKEN 是临时救急钥匙。绑定好 Passkey 和验证器后可以自行删除：从服务器 .env 里删掉 RECOVERY_TOKEN 这一行；Vercel 在项目 → Settings → Environment Variables 删除同名变量并重新部署。不删除也不会报错。";

/** 安装页页脚用的短版，详细删除指引见登录页的 RECOVERY_DELETE_HINT */
export const RECOVERY_DELETE_HINT_BRIEF =
  "RECOVERY_TOKEN 是临时救急钥匙，绑定好 Passkey 和验证器后可自行删除，不删也不报错。";

export const RECOVERY_SETUP_HINT =
  "这个站点当前未设置 RECOVERY_TOKEN。可以用下面的「生成恢复密钥」按钮生成一把，复制后添加到服务器 .env 或 Vercel 项目 → Settings → Environment Variables，然后重新部署 / 重启，再用紧急登录。";
