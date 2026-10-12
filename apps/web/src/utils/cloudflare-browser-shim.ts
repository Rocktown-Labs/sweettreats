export const env = new Proxy({} as Env, {
  get() {
    return undefined;
  },
});
