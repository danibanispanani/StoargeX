export function parseHttpUrlList(value?: string): string[] {
  return (value ?? "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      let url: URL;
      try {
        url = new URL(item);
      } catch {
        throw new Error(`Ungültige URL: ${item}`);
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(`Nur HTTP-/HTTPS-URLs sind erlaubt: ${item}`);
      }
      return url.toString();
    });
}
