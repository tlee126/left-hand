import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";
import { Constants } from "../../lib/supabase/database.types";

const harness = String.raw`
import { mock } from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
const scenario = JSON.parse(process.argv[1]);
const timeline = [], calls = [], mutations = [], forms = [], controls = [], headings = [], links = [];
const id = "11111111-1111-1111-1111-111111111111";
const access = scenario.access ?? { status: "approved", profile: { role: "admin" } };
const modules = Object.fromEntries(["auth", "repo", "actions", "nav", "jsx", "link", "cache"].map(key => [key, "data:text/javascript,catalog-ui-" + key]));
mock.module(modules.auth, { namedExports: { getAccountAccess: async () => { timeline.push("guard"); return access; } } });
mock.module(modules.nav, { namedExports: {
 redirect: (url) => { timeline.push("redirect"); throw Error("REDIRECT:" + url); },
 notFound: () => { timeline.push("notFound"); throw Error("NOT_FOUND"); }
} });
mock.module(modules.jsx, { namedExports: { Fragment: "fragment", jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props}) } });
mock.module(modules.link, { namedExports: { default: props => ({type: "a", props}) } });
mock.module(modules.cache, { namedExports: { revalidatePath: () => {} } });
const row = { id: scenario.invalidId ? "bad-id" : id, slug: "marketing", name: "Môn mẫu", title: "Nội dung mẫu", category: "Marketing", color_theme: "marketing", faculty_group: "Kinh doanh", description: "Mô tả mẫu", subject_id: id, publication_status: scenario.status ?? "draft", delivery_kind: "digital_download", price_vnd: null, old_price_vnd: null, is_contact_for_price: true, is_hot: false, rating: 4.5,
 phone: "0901234567", note: "PRIVATE_NOTE", updated_by: "PRIVATE_ACTOR", secret: "PRIVATE_SECRET",
 materials: {pages: 20, tags: ["Một", "Hai"], includes: ["PDF"], suitable_for: []},
 courses: {format: "online", sessions: 4, duration: "4 tuần", schedule: "Thứ bảy", mentor: "Người hướng dẫn", enrollment_status: "coming-soon", tags: [], curriculum: ["Cơ bản"], suitable_for: [], preparation: []},
 tutors: {name: "Gia sư mẫu", faculty: "Kinh doanh", format: "1:1", availability: "Cuối tuần", short_bio: "Giới thiệu mẫu", strengths: [], tags: [], suitable_for: [], support_methods: ["Trao đổi"]}
};
mock.module(modules.repo, { namedExports: {
 isValidCatalogSlug: value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
 ...Object.fromEntries(["Subject", "Material", "Course", "Tutor"].flatMap(entity => ["create", "update", "delete"].map(verb => [verb + "Admin" + entity, async (...args) => {
  mutations.push({name: verb + "Admin" + entity, args}); return {...row, slug: "marketing"};
 }]))),
 isValidUuid: value => typeof value === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value),
 ...Object.fromEntries(["Subjects", "Materials", "Courses", "Tutors"].map(entity => ["listAdmin" + entity, async (...args) => {
  timeline.push("repository:" + entity); calls.push({name: "listAdmin" + entity, args});
  if (scenario.fail === entity || scenario.fail === true) throw Error("SQL SELECT PRIVATE_SECRET 0901234567 PRIVATE_NOTE stack trace");
  return scenario.empty ? [] : Array.from({length: scenario.rows ?? 1}, () => row);
 }]))
} });
mock.module(modules.actions, { namedExports: Object.fromEntries(["Subject", "Material", "Course", "Tutor"].flatMap(entity => ["create", "update", "delete"].map(verb => {
 const name = verb + entity + "Action"; return [name, async (...args) => {mutations.push({name, args});}];
}))) });
async function load(file) {
 let source = await readFile(file, "utf8");
 if(scenario.realActions) {
  let actions = await readFile("app/quan-tri/catalog/actions.ts", "utf8");
  for(const [from, to] of [["@/lib/auth/session", "auth"], ["@/lib/repositories/admin-catalog-repository", "repo"], ["next/navigation", "nav"], ["next/cache", "cache"]]) actions = actions.replaceAll(from, modules[to]);
  const compiled = await transform(actions, {loader: "ts", format: "esm"});
  source = source.replaceAll("./actions", "data:text/javascript," + encodeURIComponent(compiled.code));
 }
 const database = await transform(await readFile("lib/supabase/database.types.ts", "utf8"), {loader: "ts", format: "esm"});
 source = source.replaceAll("@/lib/supabase/database.types", "data:text/javascript," + encodeURIComponent(database.code));
 for (const [from, to] of [["@/lib/auth/session", "auth"], ["@/lib/repositories/admin-catalog-repository", "repo"], ["./actions", "actions"], ["next/navigation", "nav"], ["next/link", "link"]]) source = source.replaceAll(from, modules[to]);
 const result = await transform(source, {loader: "tsx", format: "esm", jsx: "automatic"});
 return (await import("data:text/javascript," + encodeURIComponent(result.code.replaceAll("react/jsx-runtime", modules.jsx)))).default;
}
function expand(node) {
 if (Array.isArray(node)) return node.map(expand);
 if (!node || typeof node !== "object") return node;
 if (typeof node.type === "function") return expand(node.type(node.props));
 return {...node, props: {...node.props, children: expand(node.props?.children)}};
}
function textOf(node) {
 if (Array.isArray(node)) return node.map(textOf).join(" ");
 if (!node || typeof node === "boolean") return "";
 if (typeof node !== "object") return String(node);
 return textOf(node.props?.children);
}
function walk(node, current = null) {
 if (Array.isArray(node)) {node.forEach(n => walk(n, current)); return;}
 if (!node || typeof node !== "object") return;
 const p = node.props;
 if (node.type === "form") { current = {action: p.action, controls: []}; forms.push(current); }
 if (["input", "textarea", "select"].includes(node.type)) {
  const control = {tag: node.type, name: p.name, type: p.type, required: !!p.required, defaultValue: p.defaultValue, defaultChecked: p.defaultChecked, options: []};
  function options(n) {if(Array.isArray(n)) n.forEach(options); else if(n?.type === "option") control.options.push(n.props.value); else if(n?.props) options(n.props.children);}
  options(p.children); controls.push(control); if(current) current.controls.push(control);
 }
 if (["h1", "h2", "h3"].includes(node.type)) headings.push(textOf(node));
 if(node.type === "a") links.push({href: p.href, text: textOf(node).trim()});
 walk(p.children, current);
}
let error, text = "";
try {
 const page = await load(scenario.layout ? "app/quan-tri/layout.tsx" : "app/quan-tri/catalog/page.tsx");
 const tree = expand(await page({searchParams: Promise.resolve(scenario.params ?? {}), children: "ADMIN_CHILD"}));
 timeline.push("render"); text = textOf(tree).replace(/\s+/g, " "); walk(tree);
 if(scenario.submit) for(const form of forms) {
  if(scenario.realActions && form !== forms[1]) continue;
  const data = new FormData();
  for(const field of form.controls) {
   if(!field.name) continue;
   if(field.type === "checkbox") {if(field.defaultChecked) data.set(field.name, "on"); continue;}
   data.set(field.name, String(field.defaultValue ?? ""));
  }
  data.set("role", "admin"); data.set("updated_by", "PRIVATE_ACTOR");
  if(scenario.overrides) for(const [key, value] of Object.entries(scenario.overrides)) data.set(key, value);
  await form.action(data);
 }
} catch(e) {error = e.message;}
console.log(JSON.stringify({timeline, calls, mutations, forms: forms.map(f => ({hasAction: typeof f.action === "function", controls: f.controls})), controls, headings, links, text, error}));
`;
type Control = { name?: string; required: boolean; defaultValue?: string; defaultChecked?: boolean; options: string[] };
type Result = { timeline: string[]; calls: {name: string; args: unknown[]}[]; mutations: {name: string; args: Record<string, unknown>[]}[]; forms: {hasAction: boolean; controls: Control[]}[]; controls: Control[]; headings: string[]; links: {href: string; text: string}[]; text: string; error?: string };
async function run(scenario: Record<string, unknown> = {}): Promise<Result> {
 const {stdout} = await promisify(execFile)(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx/esm", "-e", harness, JSON.stringify(scenario)], {maxBuffer: 4 * 1024 * 1024});
 return JSON.parse(stdout.trim());
}

test("anonymous redirects before catalog access or rendering", async () => {
 const result = await run({access: {status: "unauthenticated", profile: null}});
 assert.equal(result.error, "REDIRECT:/dang-nhap?next=/quan-tri/catalog");
 assert.deepEqual(result.timeline, ["guard", "redirect"]); assert.deepEqual(result.calls, []);
});
test("all unauthorized access states block before any repository call", async () => {
 for(const access of [
  ...["pending", "rejected", "suspended", "unapproved"].map(status => ({status, profile: {role: "admin"}})),
  {status: "profile_missing", profile: null}, {status: "approved", profile: null},
  ...["student", "tutor"].map(role => ({status: "approved", profile: {role}}))
 ]) {
  const result = await run({access}); assert.equal(result.error, "NOT_FOUND");
  assert.deepEqual(result.timeline, ["guard", "notFound"]); assert.deepEqual(result.calls, []);
 }
});
test("approved admin lists all typed entities after guard and renders four sections", async () => {
 const result = await run(); assert.equal(result.error, undefined);
 assert.deepEqual(result.timeline, ["guard", "repository:Subjects", "repository:Materials", "repository:Courses", "repository:Tutors", "render"]);
 assert.deepEqual(result.calls.map(c => c.name), ["listAdminSubjects", "listAdminMaterials", "listAdminCourses", "listAdminTutors"]);
 for(const call of result.calls) assert.deepEqual(call.args, [{limit: 21, offset: 0}]);
 for(const title of ["Môn học", "Tài liệu", "Khóa học", "Gia sư"]) assert.ok(result.headings.includes(title));
 assert.equal(result.forms.length, 12); assert.ok(result.forms.every(f => f.hasAction));
 assert.ok(result.text.includes("Bản nháp"));
 assert.ok((await run({status: "archived"})).text.includes("Đã lưu trữ"));
});
test("rendered native forms invoke exactly all twelve actions with bound record ids and typed payloads", async () => {
 const result = await run({submit: true}); assert.equal(result.error, undefined);
 assert.deepEqual(result.mutations.map(m => m.name), ["Subject", "Material", "Course", "Tutor"].flatMap(e => ["create", "update", "delete"].map(v => v + e + "Action")));
 for(const mutation of result.mutations) {
  if(!mutation.name.startsWith("create")) assert.equal(mutation.args[0], "11111111-1111-1111-1111-111111111111");
  if(mutation.name.startsWith("delete")) {assert.equal(mutation.args.length, 2); continue;}
  const input = mutation.args.at(-1)!;
  assert.ok(!("role" in input)); assert.ok(!("updated_by" in input));
  if(mutation.name === "updateMaterialAction") {
   assert.equal(input.pages, 20); assert.deepEqual(input.tags, ["Một", "Hai"]);
   assert.equal(input.price_vnd, null); assert.equal(input.old_price_vnd, null);
   assert.equal(input.is_contact_for_price, true); assert.equal(input.is_hot, false); assert.equal(input.rating, 4.5);
  }
  if(mutation.name === "updateCourseAction") {assert.equal(input.sessions, 4); assert.deepEqual(input.curriculum, ["Cơ bản"]);}
  if(mutation.name === "updateTutorAction") assert.deepEqual(input.support_methods, ["Trao đổi"]);
 }
 const changed = await run({submit: true, overrides: {tags: "  A\r\n\n B  ", price_vnd: "120000", old_price_vnd: "150000", is_contact_for_price: "", is_hot: "on"}});
 const payload = changed.mutations.find(m => m.name === "updateMaterialAction")!.args[1];
 assert.deepEqual(payload.tags, ["A", "B"]); assert.equal(payload.price_vnd, 120000); assert.equal(payload.old_price_vnd, 150000); assert.equal(payload.is_contact_for_price, false); assert.equal(payload.is_hot, true);
});
test("all editable contracts, required fields, and canonical enum options appear", async () => {
 const result = await run();
 const common = ["slug", "category", "color_theme"];
 const product = [...common, "title", "description", "subject_id", "delivery_kind", "publication_status", "price_vnd", "old_price_vnd", "is_contact_for_price", "rating", "is_hot"];
 const expected = [[...common, "name", "faculty_group"], [...product, "pages", "tags", "includes", "suitable_for"], [...product, "format", "sessions", "duration", "schedule", "mentor", "enrollment_status", "tags", "curriculum", "suitable_for", "preparation"], [...product, "name", "faculty", "format", "availability", "short_bio", "strengths", "tags", "suitable_for", "support_methods"]];
 for(let i=0;i<4;i++) for(const index of [i*3, i*3+1]) {
  const controls = result.forms[index].controls;
  assert.deepEqual(controls.map(c=>c.name).sort(), [...expected[i]].sort());
  for(const field of controls) if(!["price_vnd", "old_price_vnd", "is_contact_for_price", "is_hot", "tags", "includes", "suitable_for", "curriculum", "preparation", "strengths", "support_methods"].includes(field.name!)) assert.equal(field.required, true, field.name);
 }
 const e = Constants.public.Enums;
 for(const [name, options] of Object.entries({category: e.category_enum, color_theme: e.color_theme_enum, delivery_kind: e.delivery_kind_enum, publication_status: e.publication_status_enum, enrollment_status: e.enrollment_status_enum})) {
  for(const control of result.controls.filter(c=>c.name===name)) assert.deepEqual(control.options, options);
 }
 assert.deepEqual(result.forms[6].controls.find(c=>c.name==="format")!.options, e.course_format_enum);
 assert.deepEqual(result.forms[9].controls.find(c=>c.name==="format")!.options, []);
});
test("real subject action accepts every canonical category submitted by the rendered edit form", async () => {
 const rejected: string[] = [];
 for(const category of Constants.public.Enums.category_enum) {
  const result = await run({submit: true, realActions: true, overrides: {category}});
  if(result.error !== "REDIRECT:/quan-tri/catalog?success=1" || result.mutations.length !== 1) rejected.push(category);
 }
 assert.deepEqual(rejected, [], "Existing catalog/actions.ts must accept the database's canonical category values");
});
test("empty states, fixed query banners, and repository failures disclose no private data", async () => {
 const empty = await run({empty: true, params: {success: "1", error: "1"}});
 for(const entity of ["môn học", "tài liệu", "khóa học", "gia sư"]) assert.ok(empty.text.includes("Chưa có " + entity));
 assert.equal(empty.forms.length, 4); assert.ok(empty.text.includes("Cập nhật danh mục thành công."));
 assert.ok(empty.text.includes("Không thể cập nhật danh mục. Vui lòng kiểm tra thông tin và thử lại."));
 const failure = await run({fail: true}); assert.equal(failure.error, undefined); assert.ok(failure.text.includes("Không thể tải danh mục lúc này. Vui lòng thử lại sau.")); assert.ok(!failure.text.includes("Chưa có"));
 for(const result of [await run(), failure, await run({params: {success: "PRIVATE_SECRET", error: "SQL SELECT PRIVATE_NOTE 0901234567"}})]) {
  const serialized = JSON.stringify({text: result.text, controls: result.controls}).toLowerCase();
  for(const forbidden of ["private_secret", "private_note", "private_actor", "0901234567", "sql select", "stack trace", "gpa", "kế hoạch học tập", "môn đã học", "tiến độ tuần", "studentdashboardclient"]) assert.ok(!serialized.includes(forbidden), forbidden);
 }
 assert.equal((await run({invalidId: true})).forms.length, 4);
});
test("pagination is bounded and admin layout retains exact navigation and home link", async () => {
 const paged = await run({rows: 21, params: {page: "2"}});
 assert.ok(paged.calls.every(c=>JSON.stringify(c.args)==='[{"limit":21,"offset":20}]'));
 assert.ok(paged.links.some(l=>l.href==="?page=3")); assert.ok(paged.links.some(l=>l.href==="?page=1"));
 const layout = await run({layout: true}); assert.equal(layout.error, undefined);
 assert.deepEqual(layout.links.slice(1,5), [{href: "/quan-tri", text: "Tổng quan"}, {href: "/quan-tri/tai-khoan", text: "Tài khoản"}, {href: "/quan-tri/tu-van", text: "Tư vấn"}, {href: "/quan-tri/catalog", text: "Danh mục"}]);
 assert.ok(layout.links.some(l=>l.href==="/" && l.text==="Về trang chủ"));
});
