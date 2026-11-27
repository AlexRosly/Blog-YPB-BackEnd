const assert = require("node:assert/strict");
const test = require("node:test");
const { readFileSync } = require("node:fs");
const { compileFunction } = require("node:vm");
const rules = require("../utils/existingArticleMedia");

const id = "123456789012345678901234";
const rev = new Date("2026-11-27T09:00:00.000Z");
const photo = (id, context = {}) => ({ id, url: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`, context });
const post = {
  markup: '<h2>Existing heading</h2><p><img src="blob:historical"></p>',
  imageUrl: [photo("cover", { alt: "D", caption: "D" }), photo("first", { alt: "First" })],
  updatedAt: rev, country: "canada", articleUrl: "https://www.thewandered.com/canada/test",
  publicationDate: new Date("2025-01-01"),
};
const markup = '<h2>Existing heading</h2><p><img src="blob:new"></p><p><img src="' + post.imageUrl[1].url + '"></p>';
const manifest = { cover: { alt: "Full cover alt", caption: "" }, inline: [
  { upload: 0, src: "blob:new", alt: "Full new image alt", caption: "Full new image caption" },
  { existing: 1, src: post.imageUrl[1].url },
] };
const fixture = ({ onWrite, onUpload } = {}) => {
  const log = { write: [], upload: [], remove: [], unlink: [] };
  const deps = {
    "node:fs/promises": { unlink: async (p) => log.unlink.push(p) },
    "../../models": { Post: {
      findById: async () => post,
      findOneAndUpdate: async (...args) => {
        log.write.push(args);
        return onWrite ? onWrite() : { ...post, ...args[1].$set };
      },
    } },
    "../../utils/cloudinary": {
      async uploadArticleMedia(p) {
        log.upload.push(p);
        return onUpload ? onUpload(p) : photo("new");
      },
      async remove(p) { log.remove.push(p); },
    },
    "../../utils/existingArticleMedia": rules,
  };
  const module = { exports: {} };
  compileFunction(readFileSync(require.resolve("../controllers/post/updatePostMedia"), "utf8"),
    ["require", "module"])((name) => deps[name], module);
  const res = { code: 200, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
  const invoke = (fields = {}, files = [{ path: "/test/new" }]) => module.exports({
    params: { id }, files, body: {
      revision: rev.toISOString(), markup, media: JSON.stringify(manifest),
      title: "Same", description: "Same description", author: "Author", ...fields,
    },
  }, res);
  return { log, res, invoke };
};

test("disabled by default and unauthorized request rejected before upload", () => {
  const saved = [process.env.BLOG_EXISTING_ARTICLE_MEDIA, process.env.BLOG_MEDIA_GATEWAY_SECRET];
  try {
    delete process.env.BLOG_EXISTING_ARTICLE_MEDIA;
    delete process.env.BLOG_MEDIA_GATEWAY_SECRET;
    assert.equal(rules.enabled(), false);
    let code, passed = false;
    const res = { status(n) { code = n; return this; }, json() {} };
    const next = () => { passed = true; };
    rules.requireMediaAdmin({ get: () => "" }, res, next);
    assert.equal(code, 404);
    process.env.BLOG_EXISTING_ARTICLE_MEDIA = "true";
    process.env.BLOG_MEDIA_GATEWAY_SECRET = "s".repeat(32);
    rules.requireMediaAdmin({ get: () => "x".repeat(32) }, res, next);
    assert.equal(code, 403);
    assert.equal(passed, false);
    rules.requireMediaAdmin({ get: () => "s".repeat(32) }, res, next);
    assert.equal(passed, true);
  } finally {
    ["BLOG_EXISTING_ARTICLE_MEDIA", "BLOG_MEDIA_GATEWAY_SECRET"].forEach((k, i) => {
      if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i];
    });
  }
});

test("new inline before old is persisted at the correct positions; immutable fields and old assets unchanged", async () => {
  const f = fixture();
  await f.invoke();
  assert.equal(f.res.code, 200);
  const [filter, { $set }] = f.log.write[0];
  assert.deepEqual(filter, { _id: id, updatedAt: rev });
  for (const key of ["articleUrl", "country", "publicationDate", "heading"]) assert.equal(Object.hasOwn($set, key), false);
  assert.deepEqual($set.imageUrl.map((p) => p.id), ["cover", "new", "first"]);
  assert.deepEqual($set.imageUrl[0].context, manifest.cover);
  assert.equal($set.imageUrl[1].context.caption, manifest.inline[0].caption);
  assert.deepEqual($set.imageUrl[2], post.imageUrl[1]);
  assert.ok($set.markup.includes(photo("new").url));
  assert.ok(!$set.markup.includes("blob:"));
  assert.ok($set.markup.startsWith("<h2>Existing heading</h2>"));
  assert.deepEqual(f.log.remove, []);
  assert.deepEqual(f.log.unlink, ["/test/new"]);
});

test("cover metadata only retains image IDs and leaves blank caption intentional", async () => {
  const f = fixture();
  await f.invoke({ markup: post.markup, media: JSON.stringify({ cover: manifest.cover, inline: [
    { existing: 1, src: "blob:historical" },
  ] }) }, []);
  assert.deepEqual(f.log.upload, []);
  assert.equal(f.res.body.data.result.imageUrl[0].context.caption, "");
  assert.deepEqual(f.res.body.data.result.imageUrl.map((p) => p.id), ["cover", "first"]);
});

test("stale before upload rejected and temporary file removed", async () => {
  const f = fixture();
  await f.invoke({ revision: new Date(0).toISOString() });
  assert.equal(f.res.code, 409);
  assert.deepEqual(f.log.upload, []);
  assert.deepEqual(f.log.unlink, ["/test/new"]);
});

test("concurrent save after uploads never overwrites and cleans new files only", async () => {
  const f = fixture({ onWrite: () => null });
  await f.invoke();
  assert.equal(f.res.code, 409);
  assert.deepEqual(f.log.remove, ["new"]);
});

test("ambiguous database failure never deletes potentially committed media", async () => {
  const f = fixture({ onWrite: () => { throw Error("Connection interrupted"); } });
  await assert.rejects(f.invoke(), /interrupted/);
  assert.deepEqual(f.log.remove, []);
  assert.deepEqual(f.log.unlink, ["/test/new"]);
});

test("failed second upload leaves published article untouched and cleans first upload", async () => {
  const f = fixture({ onUpload: (p) => p === "/test/new" ? photo("new") : null });
  const body = markup + '<p><img src="blob:second"></p>';
  const m = { ...manifest, inline: [...manifest.inline, { upload: 1, src: "blob:second", alt: "Second", caption: "" }] };
  await f.invoke({ markup: body, media: JSON.stringify(m) }, [{ path: "/test/new" }, { path: "/test/second" }]);
  assert.equal(f.res.code, 502);
  assert.deepEqual(f.log.write, []);
  assert.deepEqual(f.log.remove, ["new"]);
  assert.deepEqual(f.log.unlink, ["/test/new", "/test/second"]);
});

test("missing, reordered or spoofed image references cannot silently shift slots", () => {
  assert.throws(() => rules.buildPlan(post, markup, { ...manifest, inline: manifest.inline.slice(1) }, [{}]), /invalid photo list/);
  assert.throws(() => rules.buildPlan(post, markup, { ...manifest, inline: [...manifest.inline].reverse() }, [{}]), /positions/);
  assert.throws(() => rules.buildPlan({ ...post, markup: "" }, markup, manifest, [{}]), /safely matched/);
});
