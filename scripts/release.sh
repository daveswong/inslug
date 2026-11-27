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

REPO_SLUG="daveswong/inslug"
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

/**
 * 拿 GitHub 的访问令牌。
 *
 * 优先用环境变量 GITHUB_TOKEN；没有的话问 git 的凭据助手
 * （你平时 push 能用，说明那儿存着）。
 */
get_github_token() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN"
    return 0
  fi
  printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null |
    sed -n 's/^password=//p' | head -1
}

/**
 * 自动写更新说明：上一个版本到这次的提交清单。
 *
 * 提交信息本身就是中文短句，直接拿来当说明最省事，
 * 也比 GitHub 的自动生成（英文）好用。
 */
build_notes() {
  local tag="$1"
  local previous=""
  # 找上一个 tag（排除刚打的这个）
  previous="$(git tag --sort=-v:refname | grep -vx "$tag" | head -1)"

  local range
  if [ -n "$previous" ]; then
    range="$previous..HEAD"
  else
    range="HEAD"
  fi

  local count
  count="$(git rev-list --count "$range" 2>/dev/null || echo 0)"

  local notes=""
  notes+="## 更新内容"
  notes+=$'\n\n'
  if [ "$count" -gt 0 ]; then
    notes+="共 $count 次提交。"$'\n\n'
    notes+="$(git log "$range" --no-merges --pretty=format:'- %s')"
    notes+=$'\n'
  else
    notes+="本次没有新的提交内容。"$'\n'
  fi

  # 改了哪些文件，给人一个大概的范围
  if [ -n "$previous" ]; then
    local files
    files="$(git diff --name-only "$previous..HEAD" | wc -l | tr -d ' ')"
    notes+=$'\n'
    notes+="改动文件：$files 个。"
  fi

  echo "$notes"
}

# 调 GitHub API 创建 Release，带上自动生成的说明
create_release() {
  local tag="$1" version="$2" notes="$3"
  local token
  token="$(get_github_token)"
  if [ -z "$token" ]; then
    echo "拿不到 GitHub 令牌（设 GITHUB_TOKEN 环境变量，或让 git 凭据助手能取到）。" >&2
    return 1
  fi

  local payload
  payload="$(printf '{"tag_name":"%s","name":"%s","body":%s,"draft":false,"prerelease":false}' \
    "$tag" "$tag" "$(printf '%s' "$notes" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")"

  local response
  response="$(curl -sS --max-time 60 -X POST \
    -H "Authorization: Bearer $token" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "https://api.github.com/repos/$REPO_SLUG/releases" 2>&1)"

  # 200 或 201 都算成功（201 = 新建）
  case "$response" in
    *'"id"'*) return 0 ;;
    *) echo "$response" >&2; return 1 ;;
  esac
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
remote_main="$(git_push ls-remote origin refs/heads/main | cut -f1)"
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

echo "==> 生成更新说明"
notes="$(build_notes "$tag")"

echo "==> 创建 GitHub Release"
if ! create_release "$tag" "$version" "$notes"; then
  echo "Release 没创建成功。手动补一下：" >&2
  echo "   https://github.com/$REPO_SLUG/releases/new?tag=$tag" >&2
  exit 1
fi

echo
echo "✅ 发布完成："
echo "   release 分支 → $RELEASE_BRANCH"
echo "   tag         → $tag"
echo "   更新说明    → 已自动写到 GitHub Release"
echo
echo "   https://github.com/$REPO_SLUG/releases/tag/$tag"
