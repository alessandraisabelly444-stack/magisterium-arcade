import { mergeConfig } from "vite";
import type { ConfigEnv } from "vite";
import baseConfig from "./vite.config";

export default async (environment: ConfigEnv) => {
  const resolvedBase =
    typeof baseConfig === "function" ? await baseConfig(environment) : baseConfig;
  return mergeConfig(resolvedBase, {
    server: {
      allowedHosts: ["4173-icx9db1lx2sgwmk0ymnoz-1272e15b.us1.manus.computer"],
    },
  });
};
