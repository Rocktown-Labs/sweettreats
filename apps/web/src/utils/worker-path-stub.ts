export function join(...parts: string[]) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

export function resolve(...parts: string[]) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

export function dirname(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || ".";
}

export function basename(path: string, ext?: string) {
  let base = path.split("/").pop() || "";
  if (ext && base.endsWith(ext)) {
    base = base.slice(0, -ext.length);
  }
  return base;
}

export default {
  join,
  resolve,
  dirname,
  basename,
};
