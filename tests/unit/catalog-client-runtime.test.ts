import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { transform } from "esbuild";

declare global {
  var __catalogRouter: Array<{ url: string; options?: object }>;
  var __catalogPathname: string;
  var __catalogSearch: string;
  var __catalogBegin: () => void;
  var __catalogReset: () => void;
}

type Element = { type: unknown; props: Record<string, unknown> };

const stateModule = "data:text/javascript," + encodeURIComponent(`
  let values = []; let cursor = 0;
  globalThis.__catalogBegin = () => { cursor = 0; };
  globalThis.__catalogReset = () => { values = []; cursor = 0; };
  export const useState = (initial) => { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }]; };
  export const useRef = (initial) => ({ current: initial });
  export const useEffect = () => {};
`);
const navigationModule = "data:text/javascript," + encodeURIComponent(`
  export const useRouter = () => ({ push: (url, options) => globalThis.__catalogRouter.push({ url, options }) });
  export const usePathname = () => globalThis.__catalogPathname;
  export const useSearchParams = () => new URLSearchParams(globalThis.__catalogSearch);
`);
const jsxRuntimeModule = "data:text/javascript," + encodeURIComponent(`
  export const jsx = (type, props) => ({ type, props: props || {} });
  export const jsxs = jsx;
  export const Fragment = "fragment";
`);
const iconsModule = "data:text/javascript," + encodeURIComponent("export const Search = () => null;");
const optionsModule = "data:text/javascript," + encodeURIComponent(`
  const icon = null;
  export const categoryFilterOptions = [{ label: "Tất cả", icon }, { label: "Marketing", icon }];
  export const courseFilterOptions = [{ label: "Tất cả", icon }, { label: "Video", icon }, { label: "Online", icon }, { label: "Zoom", icon }, { label: "Sắp mở", icon }, { label: "Đang nhận đăng ký", icon }];
  export const tutorFilterOptions = [{ label: "Tất cả", icon }, { label: "Online", icon }, { label: "1:1", icon }, { label: "Marketing", icon }];
`);
const urlModule = "data:text/javascript," + encodeURIComponent(`
  export const buildCatalogFilterUrl = (pathname, current, changes) => { const params = new URLSearchParams(current); params.delete("page"); for (const [key, value] of changes) value ? params.set(key, value) : params.delete(key); const query = params.toString(); return query ? pathname + "?" + query : pathname; };
  export const buildCatalogPageUrl = (current, page) => { const params = new URLSearchParams(current); params.set("page", String(page)); return "?" + params.toString(); };
`);
const childModule = (name: string) => "data:text/javascript," + encodeURIComponent(`export const ${name} = (props) => ({ type: "${name}", props: props || {} });`);
const paginationModule = "data:text/javascript," + encodeURIComponent(`
  export const CatalogPagination = ({ page }) => ({ type: "pagination", props: { children: page.hasNext ? { type: "button", props: { children: "Trang sau", onClick: () => { const params = new URLSearchParams(globalThis.__catalogSearch); params.set("page", String(page.page + 1)); globalThis.__catalogRouter.push({ url: "?" + params.toString(), options: { scroll: false } }); } } } : null } });
`);

async function loadClient(file: string, exportName: string) {
  const source = await readFile(path.resolve(process.cwd(), file), "utf8");
  const replacements: Array<[string, string]> = [
    ["\"react\"", `\"${stateModule}\"`],
    ["\"next/navigation\"", `\"${navigationModule}\"`],
    ["\"lucide-react\"", `\"${iconsModule}\"`],
    ["\"@/lib/domain/catalog-url\"", `\"${urlModule}\"`],
    ["\"@/components/catalog/catalog-options\"", `\"${optionsModule}\"`],
    ["\"@/components/catalog/material-card\"", `\"${childModule("MaterialCard")}\"`],
    ["\"@/components/catalog/course-card\"", `\"${childModule("CourseCard")}\"`],
    ["\"@/components/catalog/tutor-card\"", `\"${childModule("TutorCard")}\"`],
    ["\"@/components/catalog/empty-state\"", `\"${childModule("EmptyState")}\"`],
    ["\"@/components/site/motion-reveal\"", `\"${childModule("MotionReveal")}\"`],
    ["\"@/components/site/section-heading\"", `\"${childModule("SectionHeading")}\"`],
    ["\"@/components/catalog/catalog-pagination\"", `\"${paginationModule}\"`]
  ];
  let replaced = source;
  for (const [from, to] of replacements) replaced = replaced.replaceAll(from, to);
  const compiled = await transform(replaced, { loader: "tsx", format: "esm", jsx: "automatic", sourcefile: file });
  const code = compiled.code.replaceAll("react/jsx-runtime", jsxRuntimeModule);
  return (await import("data:text/javascript," + encodeURIComponent(code)))[exportName] as (props: Record<string, unknown>) => Element;
}

function inspect(value: unknown, output: Element[]): void {
  if (value === null || value === undefined || typeof value !== "object") return;
  if (Array.isArray(value)) { value.forEach((item) => inspect(item, output)); return; }
  const element = value as Element;
  if (typeof element.type === "function") { inspect((element.type as (props: Record<string, unknown>) => unknown)(element.props), output); return; }
  output.push(element);
  inspect(element.props?.children, output);
}

function render(component: (props: Record<string, unknown>) => Element, props: Record<string, unknown>): Element[] {
  const output: Element[] = [];
  globalThis.__catalogRouter = [];
  globalThis.__catalogBegin();
  return output.concat((() => { const root = component(props); inspect(root, output); return output; })());
}

function find(elements: Element[], predicate: (element: Element) => boolean): Element {
  const result = elements.find(predicate);
  assert.ok(result, "expected interactive element was not rendered");
  return result;
}

const pageProps = (initialFilters: object = {}) => ({
  initialMaterials: [], initialCourses: [], initialTutors: [], pagination: { page: 2, limit: 12, offset: 12, total: 30, hasPrevious: true, hasNext: true, items: [] }, initialFilters
});

describe("catalog client runtime interactions", () => {
  test("real materials, courses, and tutors clients preserve filters and paginate through router events", async () => {
    const cases = [
      ["app/tai-lieu/materials-catalog-client.tsx", "MaterialsCatalogClient", "/tai-lieu", "initialMaterials", "Tìm tài liệu, môn học..."],
      ["app/khoa-hoc/courses-catalog-client.tsx", "CoursesCatalogClient", "/khoa-hoc", "initialCourses", "Tìm khóa học, mentor..."],
      ["app/tutor/tutors-catalog-client.tsx", "TutorsCatalogClient", "/tutor", "initialTutors", "Tìm tutor, môn học..."]
    ] as const;
    for (const [file, exportName, pathname, itemsKey, placeholder] of cases) {
      const component = await loadClient(file, exportName);
      globalThis.__catalogReset();
      globalThis.__catalogPathname = pathname;
      globalThis.__catalogSearch = "category=Marketing&page=4&keep=1";
      const initial = { ...pageProps({}), [itemsKey]: [] };
      const elements = render(component, initial);
      const input = find(elements, (element) => element.type === "input" && element.props.placeholder === placeholder);
      assert.equal(typeof input.props["aria-label"], "string");
      assert.ok(String(input.props.className).includes("focus-visible"));
      const clear = find(elements, (element) => element.type === "button" && element.props["aria-label"] === "Xóa tìm kiếm");
      assert.equal(clear.props.disabled, true);
      const select = find(elements, (element) => element.type === "select");
      assert.equal(typeof select.props["aria-label"], "string");
      const filters = elements.filter((element) => element.type === "button" && element.props["data-filter-active"] !== undefined);
      assert.ok(filters.length > 0);
      assert.ok(filters.every((filterButton) => typeof filterButton.props["aria-pressed"] === "boolean" && String(filterButton.props.className).includes("focus-visible")));
      (input.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: " Đặng " } });
      const rerendered = render(component, initial);
      const updatedInput = find(rerendered, (element) => element.type === "input" && element.props.placeholder === placeholder);
      (updatedInput.props.onKeyDown as (event: { key: string }) => void)({ key: "Enter" });
      const calls = globalThis.__catalogRouter as Array<{ url: string; options: object }>;
      assert.equal(calls.at(-1)?.url, `${pathname}?category=Marketing&keep=1&search=%C4%90%E1%BA%B7ng`);
      const next = find(rerendered, (element) => element.type === "button" && element.props.children === "Trang sau");
      (next.props.onClick as () => void)();
      assert.equal((globalThis.__catalogRouter as Array<{ url: string }>).at(-1)?.url, "?category=Marketing&page=3&keep=1");
    }
  });
});
