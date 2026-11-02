import assert from "node:assert/strict";
import { test } from "node:test";
import { isBlocked, openStream } from "../src/routes/radio.js";

test("private and internal addresses are blocked", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])
    assert.ok(isBlocked(ip), ip);
  for (const ip of ["8.8.8.8", "91.98.4.78", "2a01:4f8:1c1d:699::1"]) assert.ok(!isBlocked(ip), ip);
});

test("proxy refuses internal hosts and non-http schemes", async () => {
  await assert.rejects(openStream("http://127.0.0.1:4000/api/health"), /blocked/);
  await assert.rejects(openStream("http://[::1]/"), /blocked/);
  await assert.rejects(openStream("http://localhost:4000/"), /blocked/);
  await assert.rejects(openStream("file:///etc/passwd"), /unsupported protocol/);
});
