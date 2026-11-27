#!/usr/bin/env bash
#
# 把 nightly 的内容发布到 main。
#
#   npm run release
#
# 分支模型（2026-11-27 定）：
#   nightly —— 开发分支，改动都在这儿做，测通了才发
#   main    —— 发布分支，用户部署的就是它
#
# 所以这个脚本只做一件事：force push nightly 到 main。
# 不打 tag，也不建 GitHub Release——版本记录就落在 commit 历史里。
#
# 前提：nightly 上的改动已经 commit 并 push 完毕。
# 脚本不会替你提交——没推完就发布，等于把半成品发出去。

set -euo pipefail

REPO_SLUG="daveswong/inslug"
DEV_BRANCH="nightly"
PUBLISH_BRANCH="main"

cd "$(dirname "$0")/.."

# 推送加重试。
# 走代理时 git 的连接偶尔会失败（CONNECT tunnel failed / 502），
# 而 curl 同样的地址是好的——像是 TLS 指纹被中间设备区别对待。
# 这种抖动重试一次通常就好，不用因此中断发布。
git_push() {
  local max=5 attempt=1
  while true; do
    if git "$@"; then
      return 0
    fi
    if [ "${attempt}" -ge "${max}" ]; then
      echo "推送失败，重试 ${max} 次仍不通。检查网络或代理设置。" >&2
      return 1
    fi
    echo "  推送没成功，第 ${attempt} 次重试…" >&2
    attempt=$((attempt + 1))
    sleep 3
  done
}

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "工作区还有没提交的改动，先提交或 stash 再发布。" >&2
  exit 1
fi

if [ "$(git branch --show-current)" != "${DEV_BRANCH}" ]; then
  echo "请先切到 ${DEV_BRANCH} 分支再发布（改动都在那儿做）。" >&2
  exit 1
fi

echo "==> 检查 ${DEV_BRANCH} 是否已推到远端"
remote_dev="$(git_push ls-remote origin "refs/heads/${DEV_BRANCH}" | cut -f1)"
local_head="$(git rev-parse HEAD)"
if [ "${remote_dev}" != "${local_head}" ]; then
  echo "${DEV_BRANCH} 还没推到远端。先执行：git push origin ${DEV_BRANCH}" >&2
  exit 1
fi

echo "==> 发布 ${DEV_BRANCH} → ${PUBLISH_BRANCH}"
git_push push origin "HEAD:${PUBLISH_BRANCH}" --force

echo
echo "✅ 发布完成："
echo "   ${PUBLISH_BRANCH} ← ${DEV_BRANCH}"
echo
echo "   用户部署的是 ${PUBLISH_BRANCH}；下次改动继续在 ${DEV_BRANCH} 上做。"
