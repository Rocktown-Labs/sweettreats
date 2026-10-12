export function existsSync() {
  return false;
}

export function writeFileSync() {}

export function readFileSync() {
  return "";
}

export function appendFileSync() {}

export function mkdirSync() {}

export function rmSync() {}

export const promises = {
  readFile: async () => "",
  writeFile: async () => {},
  mkdir: async () => {},
  rm: async () => {},
  stat: async () => ({ isDirectory: () => false, isFile: () => false }),
};

export default {
  existsSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
  mkdirSync,
  rmSync,
  promises,
};
