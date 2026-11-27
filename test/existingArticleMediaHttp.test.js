const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const { unlink } = require("node:fs/promises");
const upload = require("../middelwares/uploadArticleMedia");
const { requireMediaAdmin } = require("../utils/existingArticleMedia");

test("HTTP multipart: admin authorization precedes parsing and file limits apply", async () => {
  const oldFlag = process.env.BLOG_EXISTING_ARTICLE_MEDIA;
  const oldSecret = process.env.BLOG_MEDIA_GATEWAY_SECRET;
  const key = "test-only-value-not-a-production-key-12345";
  process.env.BLOG_EXISTING_ARTICLE_MEDIA = "true";
  process.env.BLOG_MEDIA_GATEWAY_SECRET = key;
  const endpoint = "/blog/api/post/update-post-media/123456789012345678901234";
  const app = express();
  let calls = 0;
  app.patch(endpoint, requireMediaAdmin, upload, async (req, res) => {
    calls++;
    const result = {
      sizes: req.files.map((f) => f.size),
      media: JSON.parse(req.body.media),
    };
    await Promise.all(req.files.map((f) => unlink(f.path)));
    res.json(result);
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const makeBody = (size = 20, mime = "image/jpeg") => {
    const body = new FormData();
    body.append("media", JSON.stringify({ cover: { alt: "Text", caption: "" }, inline: [] }));
    if (size) body.append("image", new Blob([Buffer.alloc(size)], { type: mime }), "test.jpg");
    return body;
  };
  const call = (body, gateway = key) => fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, {
    method: "PATCH",
    body, headers: gateway ? { "X-Blog-Media-Gateway": gateway } : {},
  });
  try {
    assert.equal((await call(makeBody(), null)).status, 403);
    assert.equal((await call(makeBody(512001))).status, 413);
    assert.equal((await call(makeBody(20, "image/svg+xml"))).status, 400);
    assert.equal((await call("{}")).status, 415);
    assert.equal(calls, 0);
    const single = await call(makeBody());
    assert.equal(single.status, 200);
    assert.deepEqual((await single.json()).sizes, [20]);
    const cover = await call(makeBody(0));
    assert.deepEqual((await cover.json()).sizes, []);
    assert.equal(calls, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (oldFlag === undefined) delete process.env.BLOG_EXISTING_ARTICLE_MEDIA;
    else process.env.BLOG_EXISTING_ARTICLE_MEDIA = oldFlag;
    if (oldSecret === undefined) delete process.env.BLOG_MEDIA_GATEWAY_SECRET;
    else process.env.BLOG_MEDIA_GATEWAY_SECRET = oldSecret;
  }
});
