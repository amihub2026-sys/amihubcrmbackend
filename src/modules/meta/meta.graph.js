import { createHmac } from "node:crypto";
import { ApiError, assert } from "../../utils/index.js";

// Safe error messages.
// Never expose raw provider errors containing tokens or URLs.

export class MetaGraphError extends ApiError {
  constructor(code, transient = false) {
    const messages = {
      190:
        "Meta access token expired or invalid. Ask your administrator to replace the backend token.",

      10:
        "Meta permission missing. Check ads_read and access to this ad account.",

      200:
        "Meta permission missing. Check ads_read and access to this ad account.",

      100:
        "Meta rejected a field, date range, account ID, or API version. Check the configured version and account access.",
    };

    super(
      422,
      messages[code] ||
        (
          transient
            ? "Meta is busy or rate-limited. Sync will retry later."
            : "Meta request failed. Check account access and the configured API version."
        ),
    );

    this.code = code;
    this.transient = transient;
  }
}

export class MetaGraph {
  constructor(
    config,
    connectionKey,
    {
      fetcher = fetch,
      heartbeat = async () => {},
    } = {},
  ) {
    const connection =
      config.meta?.connections?.[connectionKey];

    assert(
      connection && config.meta?.version,
      422,
      "Meta connection is not configured on the backend",
    );

    this.connection = connection;
    this.version = config.meta.version;
    this.fetcher = fetcher;
    this.heartbeat = heartbeat;
  }

  // Request one page from Meta.

  async get(path, params = {}) {
    assert(
      /^(act_\d+)(\/(campaigns|adsets|ads|insights))?$/.test(path),
      422,
      "Invalid Meta API path",
    );

    const url = new URL(
      `https://graph.facebook.com/${this.version}/${path}`,
    );

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(
        key,
        typeof value === "object"
          ? JSON.stringify(value)
          : String(value),
      );
    }

    if (this.connection.appSecret) {
      const proof = createHmac(
        "sha256",
        this.connection.appSecret,
      )
        .update(this.connection.accessToken)
        .digest("hex");

      url.searchParams.set("appsecret_proof", proof);
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.heartbeat();

      let response;
      let body;

      try {
        response = await this.fetcher(url, {
          headers: {
            Authorization:
              `Bearer ${this.connection.accessToken}`,
          },

          signal: AbortSignal.timeout(25000),
          redirect: "error",
        });

        body = await response.json();
      } catch {
        if (attempt < 2) {
          await this.pause(attempt);
          continue;
        }

        throw new MetaGraphError(0, true);
      }

      if (response.ok && !body.error) {
        return body;
      }

      const code = Number(
        body.error?.code || response.status,
      );

      const transient =
        response.status === 429 ||
        response.status >= 500 ||
        body.error?.is_transient ||
        [4, 17, 32, 613, 80000, 80004].includes(code);

      if (transient && attempt < 2) {
        await this.pause(attempt);
        continue;
      }

      throw new MetaGraphError(code, !!transient);
    }
  }

  // Short delay before retrying a failed request.

  async pause(attempt) {
    await new Promise((resolve) =>
      setTimeout(resolve, 500 * 2 ** attempt),
    );
  }

  // Collect all pages using Meta's pagination cursor.
  // Always keep requests on the verified Graph API host.

  async list(path, params = {}) {
    let after;
    let pages = 0;

    const rows = [];
    const seen = new Set();

    do {
      const body = await this.get(path, {
        ...params,
        limit: 100,
        ...(after ? { after } : {}),
      });

      assert(
        Array.isArray(body.data),
        422,
        "Meta returned an unexpected response",
      );

      rows.push(...body.data);

      assert(
        rows.length <= 10000 && ++pages <= 150,
        422,
        "Account is too large for this sync. Use a smaller reporting range or extend the worker.",
      );

      after = body.paging?.next
        ? body.paging?.cursors?.after
        : undefined;

      assert(
        !body.paging?.next || typeof after === "string",
        422,
        "Meta pagination was incomplete",
      );

      assert(
        !after || !seen.has(after),
        422,
        "Meta pagination repeated a cursor",
      );

      if (after) {
        seen.add(after);
      }
    } while (after);

    return rows;
  }
}