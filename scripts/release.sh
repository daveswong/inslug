#!/usr/bin/env bash
#
# 发布一个新版本。
#
#   npm run release 1.0.0        # 发布 v1.0.0
#   npm run release 1.0.0-rc1   # 预发布也支持
#
# 做四件事：
#   1. 把 main 的内容推到 release 分支（force：release 是 main 的镜像，
#      不是独立开发的分支，每次重建都会产生新 SHA）
#   2. 打 tag
#   3. 推 tag
#   4. 打印 GitHub Release 的创建链接（更新说明得自己写几句）
#
# 前提：main 上的改动已经 commit 并 push 完毕。
# 脚本不会替你提交 main 上的东西——没推完就发布，等于把半成品发出去。

set -euo pipefail

REPO_SLUG="daveswong/inslog"
RELEASE_BRANCH="release"

version="${1:-}"
if [ -z "$version" ]; then
  echo "用法：npm run release <版本号>" >&2
  echo "例如：npm run release 1.0.0" >&2
  exit 1
fi

# 版本号里不能有斜杠和空格，否则 tag 名会出问题
# 注意：空串要单独写 ""，写成 *"") 的话模式会退化成 *，什么版本号都通不过
case "$version" in
  ""|*/*|*" "*)
    echo "版本号不合法：$version" >&2
    exit 1
    ;;
esac

tag="v$version"

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
    if [ "$attempt" -ge "$max" ]; then
      echo "推送失败，重试 $max 次仍不通。检查网络或代理设置。" >&2
      return 1
    fi
    echo "  推送没成功，第 $attempt 次重试…" >&2
    attempt=$((attempt + 1))
    sleep 3
  done
}

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "工作区还有没提交的改动，先提交或 stash 再发布。" >&2
  exit 1
fi

if [ "$(git branch --show-current)" != "main" ]; then
  echo "请先切到 main 分支再发布。" >&2
  exit 1
fi

echo "==> 检查 main 是否已推到远端"
remote_main="$(git ls-remote origin refs/heads/main | cut -f1)"
local_main="$(git rev-parse HEAD)"
if [ "$remote_main" != "$local_main" ]; then
  echo "main 还没推到远端。先执行：git push origin main" >&2
  exit 1
fi

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "tag $tag 已经存在了。换一个版本号。" >&2
  exit 1
fi

echo "==> 重建 release 分支（内容 = main）"
git_push push origin "HEAD:$RELEASE_BRANCH" --force

echo "==> 打 tag $tag"
git tag -a "$tag" -m "发布 $version"
git_push push origin "$tag"

echo
echo "✅ 发布完成："
echo "   release 分支 → $RELEASE_BRANCH"
echo "   tag         → $tag"
echo
echo "接下来去 GitHub 写更新说明："
echo "   https://github.com/$REPO_SLUG/releases/new?tag=$tag"
