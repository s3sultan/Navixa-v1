import assert from "node:assert/strict";
import test from "node:test";

test("sends bounded issue context to Gemini and posts a safe report", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const calls = [];
  Object.assign(process.env, {
    GITHUB_TOKEN: "test-github-token",
    GEMINI_API_KEY: "test-gemini-key",
    GEMINI_MODEL: "gemini-test",
    NAVIXA_REPOSITORY: "s3sultan/Navixa-v1",
    NAVIXA_ISSUE_NUMBER: "3",
    NAVIXA_BASE_COMMIT: "abc123",
    NAVIXA_TRIGGER_ACTOR: "s3sultan",
  });

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    let payload;
    if (String(url).endsWith("/issues/3")) {
      payload = {
        state: "open",
        title: "Review old test",
        body: "Read `tests/rendered-html.test.mjs`; do not read `../secret.txt`.",
        html_url: "https://github.com/s3sultan/Navixa-v1/issues/3",
      };
    } else if (String(url).includes("generativelanguage.googleapis.com")) {
      payload = {
        candidates: [{ content: { parts: [{ text: "Safe Gemini report for @owner" }] } }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
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
    await import(`../scripts/gemini-task-runner.mjs?test=${Date.now()}`);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  }

  const geminiCall = calls.find((call) => call.url.includes("generativelanguage.googleapis.com"));
  const request = JSON.parse(geminiCall.options.body);
  assert.match(request.contents[0].parts[0].text, /FILE: tests\/rendered-html\.test\.mjs/);
  assert.doesNotMatch(request.contents[0].parts[0].text, /FILE: \.\.\/secret\.txt/);
  assert.equal(request.generationConfig.maxOutputTokens, 6000);

  const comments = calls.filter((call) => call.url.endsWith("/issues/3/comments"));
  assert.equal(comments.length, 2);
  const result = JSON.parse(comments[1].options.body).body;
  assert.match(result, /Safe Gemini report for @​owner/);
  assert.match(result, /total 15/);
  assert.match(result, /Nothing was applied, merged, or deployed/);
});
