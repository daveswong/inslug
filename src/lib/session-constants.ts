// 会话相关的纯常量。单独拆出来是为了让 Edge 中间件能引用，
// 而不必把读 .env 的服务端模块（node:fs）拖进 Edge 运行时。
export const SESSION_COOKIE = "inslug_session";
export const CHALLENGE_COOKIE = "inslug_challenge";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天
