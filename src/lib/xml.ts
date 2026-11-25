/** XML 文本转义：标题和简介里可能出现 < > & 引号 */
export function xmlEscape(value: string): string {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case '"': return "&quot;";
      default: return "&apos;";
    }
  });
}
