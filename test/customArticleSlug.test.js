const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function load(relativePath, modules) {
  const filename = path.join(__dirname, "..", relativePath);
  const module = { exports: {} };
  vm.compileFunction(fs.readFileSync(filename, "utf8"), ["require", "module", "console"], {
    filename,
  })((name) => {
    assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`);
    return modules[name];
  }, module, { error() {}, warn() {} });
  return module.exports;
}

function fixture({ duplicate = false, exists, create } = {}) {
  const calls = { exists: [], upload: [], create: [], unlink: [] };
  const addPost = load("controllers/post/addPost.js", {
    "../../models": { Post: {
      async exists(query) {
        calls.exists.push(query);
        return exists ? exists(query) : duplicate;
      },
      async create(data) {
        calls.create.push(data);
        return create ? create(data) : { _id: "synthetic-article", ...data };
      },
    } },
    "../../utils/cloudinary": { async uploads(...args) {
      calls.upload.push(args);
      return { url: "https://res.cloudinary.com/example/image/upload/article.jpg" };
    } },
    fs: { promises: { async unlink(file) { calls.unlink.push(file); } } },
    "cyrillic-to-translit-js": () => ({ transform: (value, separator) => value.replaceAll(" ", separator) }),
    langdetect: { detectOne: () => "en" },
    "../../utils/customArticleSlug": require("../utils/customArticleSlug"),
  });

  const routes = new Map();
  const router = {};
  for (const method of ["get", "patch", "post"]) {
    router[method] = (pathname, ...handlers) => routes.set(`${method.toUpperCase()} ${pathname}`, handlers);
  }
  load("routes/post.js", {
    express: { Router: () => router },
    "../controllers": { post: { addPost } },
    "../middelwares": {
      ctrlWrapper: load("middelwares/ctrlWrapper.js", {}),
      upload: { array: (field) => field },
    },
  });

  function response() {
    return {
      code: 200,
      headers: {},
      status(code) { this.code = code; return this; },
      set(key, value) { this.headers[key] = value; return this; },
      json(value) {
        assert.equal(this.body, undefined, "Only one response");
        this.body = value; return this;
      },
    };
  }

  const invoke = async (fields = {}, files = [{ path: "synthetic.jpg" }]) => {
    const [field, handle] = routes.get("POST /add-post");
    assert.equal(field, "image");
    const res = response();
    await handle({ body: { title: "Editor title", heading: "Legacy Heading", ...fields }, files }, res,
      (error) => assert.fail(`Escaped route handler: ${error}`));
    return res;
  };

  const capabilities = () => {
    const res = response();
    const [handle] = routes.get("GET /capabilities");
    return handle({}, res);
  };

  return { invoke, capabilities, calls };
}

test("GET capabilities is no-store with the exact compatible shape", () => {
  const res = fixture().capabilities();
  assert.equal(res.code, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.deepEqual(res.body, { customArticleSlug: true });
});

test("POST custom slug is used independently of the title in Ukraine", async () => {
  const f = fixture();
  const res = await f.invoke({ country: "Ukraine", slug: "kyiv-theatres" });
  const url = "https://www.thewandered.com/ukraine/kyiv-theatres";
  assert.deepEqual(f.calls.exists, [{ articleUrl: url }]);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.articleUrl, url);
  assert.equal(res.body.data.country, "ukraine");
  assert.equal(res.body.data.heading, "Legacy Heading");
  assert.equal(res.body.data.title, "Editor title");
  assert.equal(res.body.data.imageUrl.length, 1);
  assert.deepEqual(f.calls.unlink, ["synthetic.jpg"]);
});

test("custom home slug maps directly to the root article URL", async () => {
  for (const fields of [{ country: "home" }, {}, { country: "" }]) {
    const res = await fixture().invoke({ ...fields, slug: "kyiv-theatres" });
    assert.equal(res.code, 201);
    assert.equal(res.body.data.articleUrl, "https://www.thewandered.com/kyiv-theatres");
  }
});

test("omitted, empty or whitespace-only slug preserves legacy URL behavior", async () => {
  for (const slug of [undefined, "", "  \t"]) {
    const root = await fixture().invoke({ slug });
    const country = await fixture().invoke({ slug, country: "Ukraine" });
    assert.equal(root.body.data.articleUrl, "https://www.thewandered.com/legacy-heading");
    assert.equal(country.body.data.articleUrl, "https://www.thewandered.com/ukraine/legacy-heading");
  }
});

test("invalid slug and invalid category are rejected before DB query or upload", async () => {
  const f = fixture();
  const slugs = ["/ukraine/article", "https://example.test/a", "a?b", "a#b",
    "A-b", "a--b", "-a", "a-", "a_b", "teатри", "a%2fb", "a".repeat(81),
    ["duplicate", "value"], null, " space", "trailing\n"];
  for (const slug of slugs) assert.equal((await f.invoke({ slug, country: "ukraine" })).code, 400);
  for (const country of ["other", "ukraine/../usa", ["usa"], "usa "]) {
    assert.equal((await f.invoke({ slug: "some-article", country })).code, 400);
  }
  assert.deepEqual(f.calls.exists, []);
  assert.deepEqual(f.calls.upload, []);
  assert.deepEqual(f.calls.create, []);
  assert.equal(f.calls.unlink.length, slugs.length + 4);
  assert.equal((await f.invoke({ slug: "1".repeat(80), country: "usa" })).code, 201);
});

test("existing public routes, aliases and redirects are reserved per section", async () => {
  const f = fixture();
  for (const [country, slug] of [
    ["home", "authors"], ["home", "ukraine"], ["home", "travel-resources"],
    ["home", "blog"], ["home", "terms-conditions-users"], ["home", "wandered-posts"],
    ["ukraine", "authors"], ["poland", "authors"],
    ["usa", "public-transport-in-new-york-city-2027"],
    ["usa", "public-transport-in-new-york-city-a-2023-travelq-guide"],
  ]) assert.equal((await f.invoke({ slug, country })).code, 409);
  assert.deepEqual(f.calls.exists, []);
  assert.deepEqual(f.calls.upload, []);
  assert.deepEqual(f.calls.create, []);
  assert.equal((await f.invoke({ slug: "authors", country: "usa" })).code, 201);
});

test("an occupied canonical URL returns 409 without Cloudinary upload or create", async () => {
  const f = fixture({ duplicate: true });
  const res = await f.invoke({ slug: "kyiv-theatres", country: "ukraine" });
  assert.equal(res.code, 409);
  assert.equal(f.calls.exists.length, 1);
  assert.deepEqual(f.calls.upload, []);
  assert.deepEqual(f.calls.create, []);
  assert.deepEqual(f.calls.unlink, ["synthetic.jpg"]);
});

test("simultaneous legacy and custom writes of the same URL are rejected in this process", async () => {
  let settle;
  const gate = new Promise((resolve) => { settle = resolve; });
  const f = fixture({ exists: () => gate });
  const first = f.invoke({ slug: "legacy-heading", country: "ukraine" });
  const second = await f.invoke({ country: "ukraine" }, [{ path: "second.jpg" }]);
  assert.equal(second.code, 409);
  assert.deepEqual(f.calls.upload, []);
  assert.deepEqual(f.calls.unlink, ["second.jpg"]);
  settle(false);
  assert.equal((await first).code, 201);
  assert.equal(f.calls.create.length, 1);
  assert.ok(f.calls.unlink.includes("synthetic.jpg"));
});

test("failure releases the in-process guard and cleans temp uploads", async () => {
  let fail = true;
  const f = fixture({ create: (data) => { if (fail) throw new Error("test failure"); return data; } });
  const input = { slug: "safe-retry", country: "poland" };
  assert.equal((await f.invoke(input)).code, 500);
  assert.deepEqual(f.calls.unlink, ["synthetic.jpg"]);
  fail = false;
  assert.equal((await f.invoke(input)).code, 201);
});
