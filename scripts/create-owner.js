import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import mongoose from "mongoose";
import { configuration } from "../src/config/env.js";
import { connect, models, transaction } from "../src/config/database.js";
import { hashPassword, assert } from "../src/utils/index.js";
// Password prompt is muted. No credentials are committed or printed.
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!output.muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
try {
  const config = configuration();
  await connect(config.mongoUri);
  const name = (await rl.question("Owner name: ")).trim();
  const email = (await rl.question("Owner email: ")).trim().toLowerCase();
  process.stdout.write("Owner password (12–128 characters, hidden): ");
  output.muted = true;
  const password = await rl.question("");
  output.muted = false;
  process.stdout.write("\n");
  assert(
    name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    422,
    "Valid name and email required",
  );
  const passwordHash = await hashPassword(password);
  await transaction(async (session) => {
    assert(
      !(await models.users.exists({ role: "owner" }).session(session)),
      409,
      "Owner already exists. Manage accounts through CRM.",
    );
    await models.users.create(
      [
        {
          name,
          email,
          passwordHash,
          role: "owner",
          status: "ACTIVE",
          authVersion: 1,
        },
      ],
      { session },
    );
  });
  console.log("Owner created. Sign in through the Angular frontend.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rl.close();
  await mongoose.disconnect();
}
