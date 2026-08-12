import assert from "node:assert/strict";
import test from "node:test";

test("dispatches an approved issue and posts the stopped Manus result", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalEnv = { ...process.env };
  const calls = [];

  Object.assign(process.env, {
    GITHUB_TOKEN: "test-github-token",
    MANUS_API_KEY: "test-manus-key",
    NAVIXA_REPOSITORY: "s3sultan/Navixa-v1",
    NAVIXA_ISSUE_NUMBER: "3",
    NAVIXA_BASE_COMMIT: "abc123",
    NAVIXA_TRIGGER_ACTOR: "s3sultan",
  });

  globalThis.setTimeout = (callback) => {
    queueMicrotask(callback);
    return 1;
  };

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    let payload;
    if (String(url).endsWith("/issues/3")) {
      payload = {
        state: "open",
        title: "Read-only acceptance task",
        body: "Review only",
        html_url: "https://github.com/s3sultan/Navixa-v1/issues/3",
      };
    } else if (String(url).endsWith("/task.create")) {
      payload = {
        ok: true,
        task_id: "task_test",
        task_url: "https://manus.im/app/task_test",
      };
    } else if (String(url).includes("/task.detail")) {
      payload = { ok: true, task: { status: "stopped", credit_usage: 1 } };
    } else if (String(url).includes("/task.listMessages")) {
      payload = {
        ok: true,
        messages: [
          {
            type: "assistant_message",
            assistant_message: { content: "Safe report for @owner" },
          },
        ],
      };
    } else if (String(url).endsWith("/issues/3/comments")) {
      payload = { id: calls.length };
    } else {
      return new Response(JSON.stringify({ message: "unexpected URL" }), { status: 404 });
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await import(`../scripts/manus-task-runner.mjs?test=${Date.now()}`);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }

  const createCall = calls.find((call) => call.url.endsWith("/task.create"));
  const createBody = JSON.parse(createCall.options.body);
  assert.equal(createBody.share_visibility, "private");
  assert.equal(createBody.locale, "ar");
  assert.match(createBody.message.content[0].text, /Do not push, merge, deploy/);

  const commentCalls = calls.filter((call) => call.url.endsWith("/issues/3/comments"));
  assert.equal(commentCalls.length, 2);
  const resultComment = JSON.parse(commentCalls[1].options.body).body;
  assert.match(resultComment, /Manus result/);
  assert.match(resultComment, /Safe report for @​owner/);
  assert.match(resultComment, /Nothing was applied, merged, or deployed/);
});
