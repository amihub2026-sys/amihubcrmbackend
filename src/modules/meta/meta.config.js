export function metaConfiguration(env = process.env) {
  let connections = {};

  try {
    connections = JSON.parse(env.META_CONNECTIONS_JSON || "{}");
  } catch {
    throw new Error("META_CONNECTIONS_JSON must be a JSON object");
  }

  if (
    !connections ||
    typeof connections !== "object" ||
    Array.isArray(connections)
  ) {
    throw new Error("META_CONNECTIONS_JSON must be a JSON object");
  }

  for (const [key, value] of Object.entries(connections)) {
    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(key) ||
      !value ||
      typeof value.accessToken !== "string" ||
      value.accessToken.length < 20 ||
      (
        value.appSecret !== undefined &&
        typeof value.appSecret !== "string"
      )
    ) {
      throw new Error(
        "Each Meta connection needs a safe alias and accessToken; appSecret is optional"
      );
    }
  }

  const version = env.META_GRAPH_VERSION || "";

  if (version && !/^v\d+\.\d+$/.test(version)) {
    throw new Error("META_GRAPH_VERSION must look like vNN.0");
  }

  if (Object.keys(connections).length && !version) {
    throw new Error(
      "Set META_GRAPH_VERSION to the supported version selected for your Meta app"
    );
  }

  const syncMinutes = Number(env.META_SYNC_MINUTES || 180);

  if (
    !Number.isInteger(syncMinutes) ||
    syncMinutes < 15 ||
    syncMinutes > 1440
  ) {
    throw new Error("META_SYNC_MINUTES must be 15–1440");
  }

  return {
    connections,
    version,
    syncMinutes,
  };
}