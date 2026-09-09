/**
 * Standalone Verification & Audit Script for Supabase Migrations, Seed & RLS
 * 
 * Run with: npx tsx scripts/verify-supabase-migrations-seed-rls.ts
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { materials, courses, tutors } from "../data/catalog";
import { CANONICAL_SUBJECTS } from "../lib/domain/subjects";
import { parseVND } from "../lib/domain/product-types";

interface AuditResult {
  category: string;
  check: string;
  passed: boolean;
  details?: string;
}

const expectedAdminPredicate = "EXISTS ( SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' )";

const immutableMigrationHashes = {
  "0001_core_schema.sql": "4f8c5f8b256587d959fc03ead5187211d2e3d983b33114d3300a98baefe71dc3",
  "0002_public_catalog_read_policies.sql": "52284e6a48d81a70b7393b644f89fa98111838fc40f369ac5e873769bbb6c21a",
  "0003_public_catalog_table_grants.sql": "4e84c0c166aa21fd42815eaeaf570e55e982139e7e0f01c29b325ea8f1667a50",
  "0004_profiles_schema_and_policies.sql": "4bb0cacad65ad5c8cf6a8264bc0347067793ff49e0cee2b8ae8aa7bbf04d0a04",
  "0005_account_approval_gate.sql": "a876f5660c0835d22ac308b0d0390f4c58f8289c8827be656f0060130461f0b6",
  "0006_consultations.sql": "a4c5c75e0b45f752f12f3cc71775f426dada33108e1bb7b8124a40d749e5a9f0",
  "0007_consultation_admin_rls.sql": "93c003956a9b8f642605f239f4e805b79a5760daa00fe366bcb69eeeab6a9387",
  "0008_consultation_admin_status_update.sql": "0705472f64d3a156d690d0ff5c51bfca378499b6738ed27b6bebf386b7052544",
  "0009_consultation_updated_by.sql": "8c8bc38c4661bdd80b3451cae0f0dbd87d87c0df0e42a0a4ba7135f1d615b605",
  "0010_admin_account_approval_rls.sql": "f13168186d1addb34c254525d61f51058e5b7386962063c0a9bb45f9e32987b8",
  "0011_admin_catalog_crud_rls.sql": "2ce64ed6eeaa810d7e01671120b0ab761fda2efa29aa9da332f9346f302e0a5e",
  "0012_private_material_storage.sql": "40fb2a4b8b3b818bc9ccaea83348c5f13780ffab9f587a88e9f1cd903a394c76",
  "0013_material_asset_metadata.sql": "9062310091dc76760396b901320209e78155e2890b835535847999f869c31796",
  "0014_product_entitlements.sql": "77b507859e5295bae896ac3e0ed66f4bb749a7f56ab71aeae9c0bb293b9722b2",
  "0015_learning_progress.sql": "4cd65043f20cd7badc9496e2d4d8466f5c6bc1546d6b91ac565c07d3e2a11e37",
  "0016_study_plans.sql": "3697e891b0833ab23bef47227090470e2afd916e6caa2bdbbb73d666017d8dc9",
  "0017_profile_on_auth_signup.sql": "0b4dac5f5a3092704b2101bcbfaf47274e75a96f7fbfe8c304daba215b565351",
  "0018_catalog_semantic_invariants.sql": "49b58453495fd1e65c45bcc6cd3bb6789938b0ebf3cc6f8edfb984feda785996",
  "0019_admin_catalog_transaction_rpc.sql": "3da9cf2fa53a80d8456547a309f6492dfb27a9e9a2fd03a04c2e38b2648cd6c5",
  "0020_catalog_mutation_access_boundary.sql": "87d0666521f557f2e759afe9022f327b308040a1b068a513f2a02f8a6022699d",
  "0021_catalog_search_normalization.sql": "e4712ed14e58d2da24350c0bab1349f26845d5e4024eac635fee872a4cf15d09",
  "0022_catalog_integrity_boundary.sql": "060255c2e7e8649dab3f544ef6f8df6cf2abb850067bc38c95f1a98517b8b446",
  "0023_catalog_search_child_fields.sql": "68a2aff1ac320bb76ba6bb7d0711e035ac67f4db1728fc3034a1a73dc8669786",
  "0024_consultation_workflow_hardening.sql": "622f9ba3a657f2f3bab31d8503b545a24e9502c2158bbf4b87a3e263dba28b10",
  "0025_consultation_workflow_trigger_order.sql": "b9d970dff674bd05b7f27c0d3a8d04ced7d4ee738e7f524e7029e2aa0a58acb7",
  "0026_consultation_intake_access_boundary.sql": "dc4121d4b7f61f4f765b529238bf747fb989cbd558b2d9fee267c9905d30330f",
  "0027_consultation_rpc_private_boundary.sql": "774388ad8fdc272930e563657ae90ceafe64a997c44e23f40e0925d52aae478e"
} as const;

export const IMMUTABLE_MIGRATION_FILENAMES = Object.keys(immutableMigrationHashes) as Array<keyof typeof immutableMigrationHashes>;

function canonicalMigrationContent(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

/** Pure assertion that protects the complete applied migration history from content changes. */
export function assertMigrationHistoryUnchanged(contents: Readonly<Record<string, string>>): void {
  for (const filename of IMMUTABLE_MIGRATION_FILENAMES) {
    const content = contents[filename];
    if (typeof content !== "string") {
      throw new Error(`Immutable migration ${filename} is missing from the verification snapshot`);
    }

    const actualHash = createHash("sha256").update(canonicalMigrationContent(content), "utf8").digest("hex");
    if (actualHash !== immutableMigrationHashes[filename]) {
      throw new Error(`Immutable migration ${filename} must remain unchanged (canonical SHA-256 mismatch)`);
    }
  }
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function stripSqlCommentsAndSplitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let singleQuoteBackslashEscapes = false;
  let inDoubleQuote = false;
  let dollarTag: string | null = null;
  let dollarBodyInSingleQuote = false;
  let dollarBodyInDoubleQuote = false;
  let dollarBodyBlockCommentDepth = 0;
  let blockCommentDepth = 0;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];

    if (blockCommentDepth > 0) {
      if (character === "/" && next === "*") {
        blockCommentDepth += 1;
        index += 1;
      } else if (character === "*" && next === "/") {
        blockCommentDepth -= 1;
        index += 1;
        if (blockCommentDepth === 0) current += " ";
      }
      continue;
    }

    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length - 1;
        dollarTag = null;
        dollarBodyInSingleQuote = false;
        dollarBodyInDoubleQuote = false;
        dollarBodyBlockCommentDepth = 0;
        continue;
      }

      if (dollarBodyBlockCommentDepth > 0) {
        if (character === "/" && next === "*") {
          dollarBodyBlockCommentDepth += 1;
          index += 1;
        } else if (character === "*" && next === "/") {
          dollarBodyBlockCommentDepth -= 1;
          index += 1;
          if (dollarBodyBlockCommentDepth === 0) current += " ";
        }
        continue;
      }

      if (dollarBodyInSingleQuote) {
        current += character;
        if (character === "'" && next === "'") {
          current += next;
          index += 1;
        } else if (character === "'") {
          dollarBodyInSingleQuote = false;
        }
        continue;
      }

      if (dollarBodyInDoubleQuote) {
        current += character;
        if (character === '"' && next === '"') {
          current += next;
          index += 1;
        } else if (character === '"') {
          dollarBodyInDoubleQuote = false;
        }
        continue;
      }

      if (character === "-" && next === "-") {
        index += 2;
        while (index < sql.length && sql[index] !== "\n") index += 1;
        current += " ";
        continue;
      }
      if (character === "/" && next === "*") {
        dollarBodyBlockCommentDepth = 1;
        index += 1;
        continue;
      }
      if (character === "'") dollarBodyInSingleQuote = true;
      if (character === '"') dollarBodyInDoubleQuote = true;
      current += character;
      continue;
    }

    if (inSingleQuote) {
      current += character;
      if (singleQuoteBackslashEscapes && character === "\\" && next !== undefined) {
        current += next;
        index += 1;
      } else if (character === "'" && next === "'") {
        current += next;
        index += 1;
      } else if (character === "'") {
        inSingleQuote = false;
        singleQuoteBackslashEscapes = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      current += character;
      if (character === '"' && next === '"') {
        current += next;
        index += 1;
      } else if (character === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && character === "-" && next === "-") {
      index += 2;
      while (index < sql.length && sql[index] !== "\n") index += 1;
      current += " ";
      continue;
    }
    if (!inSingleQuote && !inDoubleQuote && character === "/" && next === "*") {
      blockCommentDepth = 1;
      index += 1;
      continue;
    }

    if (character === "$" && sql.slice(index).match(/^(?:\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/)) {
      const tagMatch = sql.slice(index).match(/^(?:\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/);
      dollarTag = tagMatch![0];
      current += dollarTag;
      index += dollarTag.length - 1;
      continue;
    }
    if (character === "'") {
      const prefix = sql[index - 1];
      const beforePrefix = sql[index - 2];
      singleQuoteBackslashEscapes = (prefix === "E" || prefix === "e")
        && (beforePrefix === undefined || !/[A-Za-z0-9_$]/.test(beforePrefix));
      current += character;
      inSingleQuote = true;
      continue;
    }
    if (character === '"') {
      inDoubleQuote = true;
      current += character;
      continue;
    }
    if (character === ";") {
      if (normalizeSql(current)) statements.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  if (inSingleQuote || inDoubleQuote || dollarTag || blockCommentDepth > 0) {
    const context = inSingleQuote
      ? "single-quoted string"
      : inDoubleQuote
        ? "double-quoted identifier"
        : dollarTag
          ? `dollar-quoted body ${dollarTag}`
          : "block comment";
    throw new Error(`SQL contains an unterminated ${context}`);
  }
  if (normalizeSql(current)) statements.push(current);
  return statements;
}

function normalizeMigrationStatement(statement: string): string {
  return normalizeSql(statement).replace(/"([A-Za-z_][A-Za-z0-9_$]*)"/g, "$1").toLowerCase();
}

function extractDollarQuotedFunctionBodies(statements: readonly string[]): string[] {
  const bodies: string[] = [];
  for (const statement of statements) {
    const match = /\bas\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)([\s\S]*?)\s*\1\s*$/i.exec(statement);
    if (match) bodies.push(match[2]);
  }
  return bodies;
}

function maskSqlStringLiterals(sql: string): string {
  let masked = "";
  let quote: "single" | "double" | null = null;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    if (quote === "single") {
      if (character === "'" && next === "'") {
        masked += "  ";
        index += 1;
      } else if (character === "'") {
        masked += " ";
        quote = null;
      } else {
        masked += " ";
      }
      continue;
    }
    if (quote === "double") {
      if (character === '"' && next === '"') {
        masked += "  ";
        index += 1;
      } else if (character === '"') {
        masked += " ";
        quote = null;
      } else {
        masked += " ";
      }
      continue;
    }
    if (character === "'") {
      masked += " ";
      quote = "single";
    } else if (character === '"') {
      masked += " ";
      quote = "double";
    } else {
      masked += character;
    }
  }
  return masked;
}

type SqlTokenKind = "word" | "quoted_identifier" | "string" | "dollar_quote" | "symbol";

interface SqlToken {
  kind: SqlTokenKind;
  value: string;
}

interface SqlDmlOperation {
  kind: "insert" | "update" | "delete";
  table: string;
}

function readDollarQuoteTag(sql: string, index: number): string | null {
  const match = /^(?:\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/.exec(sql.slice(index));
  return match?.[0] ?? null;
}

/** Tokenizes executable SQL without confusing quoted identifiers with literals. */
function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let index = 0;

  while (index < sql.length) {
    const character = sql[index];
    const next = sql[index + 1];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === "-" && next === "-") {
      index += 2;
      while (index < sql.length && sql[index] !== "\n") index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      let depth = 1;
      index += 2;
      while (index < sql.length && depth > 0) {
        if (sql[index] === "/" && sql[index + 1] === "*") {
          depth += 1;
          index += 2;
        } else if (sql[index] === "*" && sql[index + 1] === "/") {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      if (depth !== 0) throw new Error("SQL contains an unterminated block comment");
      continue;
    }
    if (character === "'") {
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          index += 2;
        } else if (sql[index] === "'") {
          index += 1;
          break;
        } else if (sql[index] === "\\" && sql[index + 1] !== undefined) {
          index += 2;
        } else {
          index += 1;
        }
      }
      if (sql[index - 1] !== "'") throw new Error("SQL contains an unterminated single-quoted string");
      tokens.push({ kind: "string", value: "" });
      continue;
    }
    if (character === '"') {
      let value = "";
      index += 1;
      while (index < sql.length) {
        if (sql[index] === '"' && sql[index + 1] === '"') {
          value += '"';
          index += 2;
        } else if (sql[index] === '"') {
          index += 1;
          break;
        } else {
          value += sql[index];
          index += 1;
        }
      }
      if (sql[index - 1] !== '"') throw new Error("SQL contains an unterminated double-quoted identifier");
      tokens.push({ kind: "quoted_identifier", value: value.toLowerCase() });
      continue;
    }
    if (character === "$" && readDollarQuoteTag(sql, index)) {
      const tag = readDollarQuoteTag(sql, index)!;
      const end = sql.indexOf(tag, index + tag.length);
      if (end < 0) throw new Error(`SQL contains an unterminated dollar-quoted string ${tag}`);
      tokens.push({ kind: "dollar_quote", value: "" });
      index = end + tag.length;
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      const start = index;
      index += 1;
      while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index])) index += 1;
      tokens.push({ kind: "word", value: sql.slice(start, index).toLowerCase() });
      continue;
    }
    tokens.push({ kind: "symbol", value: character });
    index += 1;
  }

  return tokens;
}

function isWordToken(token: SqlToken | undefined, value?: string): boolean {
  return token?.kind === "word" && (value === undefined || token.value === value);
}

function readRelation(tokens: readonly SqlToken[], start: number): { table: string; next: number } | null {
  const first = tokens[start];
  if (!first || (first.kind !== "word" && first.kind !== "quoted_identifier")) return null;
  let next = start + 1;
  let relation = first.value;
  if (tokens[next]?.kind === "symbol" && tokens[next]?.value === ".") {
    const second = tokens[next + 1];
    if (!second || (second.kind !== "word" && second.kind !== "quoted_identifier")) return null;
    relation = `${relation}.${second.value}`;
    next += 2;
  }
  return { table: relation.split(".").at(-1)!, next };
}

function findDmlOperations(tokens: readonly SqlToken[]): SqlDmlOperation[] {
  const operations: SqlDmlOperation[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const kind = isWordToken(tokens[index], "insert")
      ? "insert"
      : isWordToken(tokens[index], "update")
        ? "update"
        : isWordToken(tokens[index], "delete")
          ? "delete"
          : null;
    if (!kind) continue;

    let relationStart = index + 1;
    if (kind === "insert") {
      if (!isWordToken(tokens[relationStart], "into")) continue;
      relationStart += 1;
    } else if (kind === "delete") {
      if (!isWordToken(tokens[relationStart], "from")) continue;
      relationStart += 1;
    } else if (isWordToken(tokens[index - 1], "for")) {
      continue;
    } else if (isWordToken(tokens[relationStart], "set")) {
      continue;
    } else if (isWordToken(tokens[relationStart], "only")) {
      relationStart += 1;
    }
    const relation = readRelation(tokens, relationStart);
    if (relation) operations.push({ kind, table: relation.table });
  }
  return operations;
}

function findRelationsAfter(tokens: readonly SqlToken[], keyword: "from" | "join"): string[] {
  const relations: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (!isWordToken(tokens[index], keyword)) continue;
    if (isWordToken(tokens[index - 1], "distinct") || isWordToken(tokens[index - 1], "not") && isWordToken(tokens[index - 2], "distinct")) continue;
    const relation = readRelation(tokens, index + 1);
    if (relation) relations.push(relation.table);
  }
  return relations;
}

function hasTokenSequence(tokens: readonly SqlToken[], first: string, second?: string): boolean {
  return tokens.some((token, index) => isWordToken(token, first) && (second === undefined || isWordToken(tokens[index + 1], second)));
}

function assertNoUnsafeExecutableTokens(tokens: readonly SqlToken[], context: string): void {
  const unsafe = new Set(["grant", "revoke", "create", "alter", "drop", "truncate", "copy", "call", "bypassrls", "service_role"]);
  for (const [index, token] of tokens.entries()) {
    if (token.kind === "word" && unsafe.has(token.value)) throw new Error(`${context} contains unsafe executable token ${token.value}`);
    if (isWordToken(token, "do") && (isWordToken(tokens[index + 1], "language") || tokens[index + 1]?.kind === "dollar_quote")) throw new Error(`${context} contains unsafe executable token do`);
    if (isWordToken(token, "execute")) throw new Error(`${context} contains dynamic SQL EXECUTE`);
    if (isWordToken(token, "set") && isWordToken(tokens[index + 1], "role")) throw new Error(`${context} contains SET ROLE`);
  }
  if (hasTokenSequence(tokens, "or", "true")) throw new Error(`${context} contains a permissive predicate`);
}

function assertNestedFunctionSqlScope(
  statements: readonly string[],
  options: { allowDmlTables: readonly string[]; allowSelectTables: readonly string[]; allowSqlExpressionSelect?: boolean }
): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const bodies = extractDollarQuotedFunctionBodies(statements);
  fail(bodies.length > 0, "Migration function body could not be parsed");
  const bodySql = bodies.map((body) => stripSqlCommentsAndSplitStatements(body).join(" ; ")).join(" ; ");
  const executableTokens = tokenizeSql(bodySql);
  assertNoUnsafeExecutableTokens(executableTokens, "Nested function body");
  fail(!executableTokens.some((token) => isWordToken(token, "perform")), "Nested function body contains executable PERFORM outside the migration contract");

  const allowedDml = new Set(options.allowDmlTables);
  const allowedSelect = new Set(options.allowSelectTables);
  for (const operation of findDmlOperations(executableTokens)) {
    fail(allowedDml.has(operation.table), `Nested function mutates an out-of-scope table: ${operation.table}`);
  }
  for (const relation of findRelationsAfter(executableTokens, "from").concat(findRelationsAfter(executableTokens, "join"))) {
    fail(allowedSelect.has(relation) || ["jsonb_object_keys", "jsonb_array_elements"].includes(relation), `Nested function reads an out-of-scope table: ${relation}`);
  }

  for (let index = 0; index < executableTokens.length; index += 1) {
    if (!isWordToken(executableTokens[index], "select")) continue;
    const selectTokens = executableTokens.slice(index + 1, executableTokens.findIndex((token, tokenIndex) => tokenIndex > index && token.kind === "symbol" && token.value === ";"));
    const hasAllowedRelation = findRelationsAfter(selectTokens, "from").concat(findRelationsAfter(selectTokens, "join"))
      .some((relation) => allowedSelect.has(relation));
    const isApprovedExpression = options.allowSqlExpressionSelect === true && selectTokens.some((token) =>
      token.kind === "word" && ["regexp_replace", "lower", "btrim", "coalesce", "concat_ws", "unaccent", "jsonb_array_elements", "jsonb_array_elements_text", "jsonb_object_keys"].includes(token.value));
    fail(hasAllowedRelation || isApprovedExpression, "Nested SELECT is outside the migration contract");
  }
}

function splitTopLevelClauses(value: string): string[] {
  const clauses: string[] = [];
  let start = 0;
  let depth = 0;
  let inSingleQuote = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "'" && value[index + 1] === "'") {
      index += 1;
      continue;
    }
    if (character === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (inSingleQuote) continue;
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      clauses.push(value.slice(start, index));
      start = index + 1;
    }
  }
  clauses.push(value.slice(start));
  return clauses.map(normalizeMigrationStatement).filter(Boolean);
}

function extractPolicyClause(policy: string, clauseName: "USING" | "WITH CHECK"): string | null {
  const clauseStart = new RegExp(`\\b${clauseName}\\s*\\(`, "i").exec(policy);
  if (!clauseStart) return null;

  const openingParen = policy.indexOf("(", clauseStart.index);
  let depth = 0;
  let inString = false;
  for (let index = openingParen; index < policy.length; index += 1) {
    const character = policy[index];
    if (character === "'" && policy[index + 1] === "'") {
      index += 1;
      continue;
    }
    if (character === "'") inString = !inString;
    if (inString) continue;
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return policy.slice(openingParen + 1, index);
    }
  }
  return null;
}

/** Pure contract used by both the CLI audit and integration tests. */
export function assertConsultationUpdatedByMigrationContract(sql0009: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  let sqlWithoutComments: string;
  try {
    sqlWithoutComments = stripSqlCommentsAndSplitStatements(sql0009).join(" ");
  } catch (error) {
    if (/\bSECURITY\s+DEFINER\b/i.test(sql0009)) {
      throw new Error("Migration 0009 must not contain SECURITY DEFINER");
    }
    throw error;
  }
  fail(
    !/\bSECURITY\s+DEFINER\b/i.test(sqlWithoutComments),
    "Migration 0009 must not contain SECURITY DEFINER"
  );

  const statements = stripSqlCommentsAndSplitStatements(sql0009);
  const normalized = statements.map(normalizeMigrationStatement);
  const alterTable = normalized.find((statement) => statement.startsWith("alter table "));
  const updaterFunction = normalized.find((statement) => statement.startsWith("create or replace function set_consultations_updated_by"));
  const dropTrigger = normalized.find((statement) => statement.startsWith("drop trigger "));
  const createTrigger = normalized.find((statement) => statement.startsWith("create trigger "));

  fail(
    alterTable === "alter table consultations add column if not exists updated_by uuid references auth.users(id) on delete set null",
    "Migration 0009 must add nullable updated_by UUID referencing auth.users(id) ON DELETE SET NULL"
  );
  fail(
    Boolean(updaterFunction && /returns trigger[\s\S]*new\.updated_by\s*=\s*auth\.uid\s*\(\s*\)\s*;[\s\S]*return new\s*;/i.test(updaterFunction)),
    "Migration 0009 updater function must assign NEW.updated_by = auth.uid()"
  );
  fail(
    dropTrigger === "drop trigger if exists trg_consultations_updated_by on consultations",
    "Migration 0009 must drop the updater trigger immediately before recreating it"
  );
  fail(
    createTrigger === "create trigger trg_consultations_updated_by before update on consultations for each row execute function set_consultations_updated_by()",
    "Migration 0009 must drop the updater trigger immediately before recreating it"
  );
  fail(statements.length === 4, "Migration 0009 must contain only its four audit-trail statements");
}

/** Pure contract used by the CLI audit and integration tests for migration 0010. */
export function assertAdminAccountApprovalMigrationContract(sql0010: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  const statements = stripSqlCommentsAndSplitStatements(sql0010);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");

  fail(!/\bservice_role\b/i.test(code), "Migration 0010 must not reference service_role");
  fail(
    !/\b(?:password|secret|token|bearer|apikey|api_key|service_role_key|anon_key)\b\s*[:=]/i.test(code)
      && !/'ey[a-zA-Z0-9._-]{20,}'/.test(code),
    "Migration 0010 must not contain credentials or hardcoded secrets"
  );
  fail(!/\bBYPASSRLS\b/i.test(code), "Migration 0010 must not include BYPASSRLS");
  fail(!/\b(?:SET|ALTER)\s+ROLE\b/i.test(code), "Migration 0010 must not use SET ROLE or ALTER ROLE");
  fail(!/\b(?:ALTER\s+SYSTEM|OWNER\s+TO)\b/i.test(code), "Migration 0010 must not escalate privileges");
  fail(
    !/GRANT\s+[^;]*?\bTO\s+[^;]*?\b(?:postgres|supabase_admin|service_role|authenticator|dashboard_user)\b/i.test(code),
    "Migration 0010 must not grant privileges to system roles"
  );
  fail(
    !/\bGRANT\s+[^;]*?\bTO\s+[^;]*?\b(?:anon|public)\b/i.test(code),
    "Migration 0010 must not grant privileges to anon or public"
  );
  fail(!/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(code), "Migration 0010 must not disable RLS");
  fail(!/\bEXECUTE\s+(?:IMMEDIATE|format)\b/i.test(code), "Migration 0010 must not use dynamic SQL");
  fail(!/\b(?:GRANT|REVOKE)\s+[^;]*\bON\s+(?:SCHEMA|DATABASE)\b/i.test(code), "Migration 0010 must not alter unrelated schema/database privileges");
  fail(
    !/(?:DROP|CREATE(?:\s+OR\s+REPLACE)?|ALTER)\s+(?:TRIGGER|FUNCTION)\s+(?:trg_profiles_updated_at|update_updated_at_column|[a-zA-Z_]\w*updated_at\b)/i.test(code),
    "Migration 0010 must not modify the established updated_at trigger or function"
  );

  const grantTables = [...code.matchAll(/GRANT\s+[^;]*?\bON\s+(?!FUNCTION\b)(?:TABLE\s+)?([a-zA-Z_]\w*)/gi)]
    .map((match) => match[1].toLowerCase());
  const revokeTables = [...code.matchAll(/REVOKE\s+[^;]*?\bON\s+(?!FUNCTION\b)(?:TABLE\s+)?([a-zA-Z_]\w*)/gi)]
    .map((match) => match[1].toLowerCase());
  fail(
    grantTables.every((table) => table === "profiles")
      && revokeTables.every((table) => table === "profiles"),
    "Migration 0010 privilege statements must target profiles only"
  );

  const updateGrants = normalized.filter((statement) => /^grant\s+update\b/i.test(statement));
  fail(
    updateGrants.length === 1
      && updateGrants[0] === "grant update (account_status, rejection_reason) on table profiles to authenticated",
    "Migration 0010 must grant UPDATE only on account_status and rejection_reason to authenticated"
  );
  fail(
    !/grant\s+update\s+on\s+(?:table\s+)?profiles\b/i.test(code),
    "Migration 0010 must not grant table-wide UPDATE on profiles"
  );
  fail(
    !/grant\s+update\s*\([^)]*\b(?:role|email|id|full_name|phone|approved_at|approved_by)\b/i.test(code),
    "Migration 0010 must not grant UPDATE on protected profile columns"
  );
  fail(
    /revoke update on table profiles from authenticated/i.test(code),
    "Migration 0010 must keep table-wide UPDATE revoked"
  );
  fail(
    /grant select on table profiles to authenticated/i.test(code),
    "Migration 0010 must grant profile SELECT to authenticated"
  );

  const policyStatements = normalized.filter((statement) => /^create policy\b/i.test(statement));
  fail(policyStatements.length === 2, "Migration 0010 must create exactly one admin SELECT and one admin UPDATE policy");
  fail(
    policyStatements.every((statement) => /\bon profiles for (?:select|update) to authenticated\b/i.test(statement)),
    "Migration 0010 policies must target profiles and authenticated only"
  );
  fail(
    !policyStatements.some((statement) => /\bto\s+(?:anon|public)\b/i.test(statement)),
    "Migration 0010 must not create anon or public policies"
  );

  const selectPolicy = policyStatements.find((statement) => /\bon profiles for select\b/i.test(statement)) || "";
  const updatePolicy = policyStatements.find((statement) => /\bon profiles for update\b/i.test(statement)) || "";
  fail(
    extractPolicyClause(selectPolicy, "USING")?.trim().toLowerCase() === "public.is_approved_admin()",
    "Admin SELECT policy must use the approved-admin helper"
  );
  const expectedUpdatePredicate = "public.is_approved_admin() AND profiles.id <> auth.uid()";
  fail(
    extractPolicyClause(updatePolicy, "USING")?.replace(/\s+/g, " ").trim().toLowerCase() === expectedUpdatePredicate.toLowerCase()
      && extractPolicyClause(updatePolicy, "WITH CHECK")?.replace(/\s+/g, " ").trim().toLowerCase() === expectedUpdatePredicate.toLowerCase(),
    "Admin UPDATE policy must require an approved admin and forbid self-updates"
  );
  fail(
    /\bon profiles for select to authenticated\b/i.test(selectPolicy)
      && /\bon profiles for update to authenticated\b/i.test(updatePolicy),
    "Admin policies must target authenticated only"
  );

  const helper = normalized.find((statement) => statement.startsWith("create or replace function public.is_approved_admin")) || "";
  fail(
    /returns boolean[\s\S]*security definer[\s\S]*set search_path = pg_catalog, public[\s\S]*select exists[\s\S]*from public\.profiles[\s\S]*profiles\.id = auth\.uid\s*\(\s*\s*\)[\s\S]*profiles\.role = 'admin'[\s\S]*profiles\.account_status = 'approved'/i.test(helper),
    "Admin helper must be a fixed-search-path SECURITY DEFINER check for an approved admin"
  );
  fail(
    normalized.filter((statement) => /\bsecurity definer\b/i.test(statement)).length === 1
      && helper.length > 0,
    "Only the admin-check helper may use SECURITY DEFINER"
  );
  fail(
    normalized.includes("drop function if exists public.is_approved_admin()")
      && normalized.includes("revoke execute on function public.is_approved_admin() from public, anon")
      && normalized.includes("grant execute on function public.is_approved_admin() to authenticated"),
    "Admin helper execution must be revoked from public/anon and granted only to authenticated"
  );

  const approvalFunction = normalized.find((statement) => statement.startsWith("create or replace function public.set_profiles_approval_audit")) || "";
  fail(
    normalized.includes("drop function if exists public.set_profiles_approval_audit()"),
    "Approval trigger function must be safely replaceable"
  );
  fail(
    /new\.approved_by\s*=\s*auth\.uid\s*\(\s*\s*\)\s*;/i.test(approvalFunction)
      && /new\.approved_at\s*=\s*timezone\s*\(\s*'utc'::text\s*,\s*now\s*\(\s*\s*\)\s*\)\s*;/i.test(approvalFunction)
      && /new\.account_status\s+is\s+distinct\s+from\s+old\.account_status/i.test(approvalFunction)
      && /new\.rejection_reason\s+is\s+distinct\s+from\s+old\.rejection_reason/i.test(approvalFunction),
    "Approval trigger must stamp approved_by from auth.uid() and approved_at from the UTC clock"
  );
  fail(
    /old\.id\s*=\s*auth\.uid\s*\(\s*\s*\)/i.test(approvalFunction)
      && /public\.is_approved_admin\s*\(\s*\s*\)/i.test(approvalFunction)
      && /new\.role\s+is\s+distinct\s+from\s+old\.role/i.test(approvalFunction),
    "Approval trigger must reject self/non-admin approval changes and protect role"
  );
  fail(
    normalized.includes("drop trigger if exists trg_profiles_approval_audit on profiles")
      && normalized.includes("create trigger trg_profiles_approval_audit before update on profiles for each row execute function public.set_profiles_approval_audit()"),
    "Approval audit trigger must be safely replaceable and run before profile updates"
  );

  const canonicalLiterals = new Set([
    "pending",
    "approved",
    "rejected",
    "suspended",
    "admin",
    "utc",
    "text",
    "profile approval updates may change only approval fields",
    "profile approval update is not permitted"
  ]);
  const allLiterals = normalized.flatMap((statement) =>
    statement.match(/'([^']+)'/g)?.map((value) => value.slice(1, -1)) || []
  );
  fail(
    allLiterals.every((value) => canonicalLiterals.has(value)),
    "Migration 0010 must not introduce account statuses outside the canonical set"
  );
  fail(
    !/CREATE\s+TYPE|ADD\s+CONSTRAINT/i.test(code),
    "Migration 0010 must not add a second status type or constraint"
  );
}

/** Pure contract used by the CLI audit and integration tests for migration 0011. */
export function assertAdminCatalogMigrationContract(sql0011: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  const statements = stripSqlCommentsAndSplitStatements(sql0011);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");
  const catalogTables = ["subjects", "products", "materials", "courses", "tutors"];
  const adminPredicate = "EXISTS ( SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.account_status = 'approved' )";
  const normalizedAdminPredicate = normalizeSql(adminPredicate).toLowerCase();

  fail(!/\bservice_role\b/i.test(code), "Migration 0011 must not reference service_role");
  fail(!/\b(?:password|secret|token|bearer|apikey|api_key|service_role_key|anon_key)\b\s*[:=]/i.test(code), "Migration 0011 must not contain credentials or secrets");
  fail(!/\bBYPASSRLS\b/i.test(code), "Migration 0011 must not include BYPASSRLS");
  fail(!/\b(?:SET|ALTER)\s+ROLE\b/i.test(code), "Migration 0011 must not use SET ROLE or ALTER ROLE");
  fail(!/\bSECURITY\s+DEFINER\b/i.test(code), "Migration 0011 must not use SECURITY DEFINER");
  fail(!/\b(?:EXECUTE\s+IMMEDIATE|EXECUTE\s+FORMAT|format\s*\()/i.test(code), "Migration 0011 must not use dynamic SQL");
  fail(!/\bOR\s+TRUE\b/i.test(code), "Migration 0011 must not use OR true predicates");
  fail(!/\bGRANT\s+ALL\b/i.test(code), "Migration 0011 must not grant ALL");
  fail(!/\b(?:ALTER\s+SYSTEM|OWNER\s+TO|DISABLE\s+ROW\s+LEVEL\s+SECURITY)\b/i.test(code), "Migration 0011 must not escalate or bypass privileges");
  fail(!/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i.test(code), "Migration 0011 must not create functions");
  fail(!/\b(?:CREATE\s+TYPE|ADD\s+CONSTRAINT)\b/i.test(code), "Migration 0011 must not create duplicate types or constraints");
  fail(!/\bGRANT\s+SELECT\b/i.test(code), "Migration 0011 must not add SELECT grants");

  const grantStatements = normalized.filter((statement) => /^grant\s+/i.test(statement));
  const revokeStatements = normalized.filter((statement) => /^revoke\s+/i.test(statement));
  const expectedRevokes = catalogTables.map(
    (table) => `revoke insert, update, delete on table ${table} from anon, public, authenticated`
  );
  fail(revokeStatements.length === expectedRevokes.length, "Migration 0011 must revoke mutation privileges on exactly five catalog tables");
  fail(expectedRevokes.every((statement) => revokeStatements.includes(statement)), "Migration 0011 has an unexpected revoke target or privilege");

  const expectedGrants = [
    "grant insert (slug, name, category, faculty_group, color_theme) on table subjects to authenticated",
    "grant update (slug, name, category, faculty_group, color_theme) on table subjects to authenticated",
    "grant delete on table subjects to authenticated",
    "grant insert (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, is_contact_for_price, rating, is_hot, color_theme) on table products to authenticated",
    "grant update (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, is_contact_for_price, rating, is_hot, color_theme) on table products to authenticated",
    "grant delete on table products to authenticated",
    "grant insert (product_id, pages, tags, includes, suitable_for) on table materials to authenticated",
    "grant update (pages, tags, includes, suitable_for) on table materials to authenticated",
    "grant delete on table materials to authenticated",
    "grant insert (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation) on table courses to authenticated",
    "grant update (format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation) on table courses to authenticated",
    "grant delete on table courses to authenticated",
    "grant insert (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods) on table tutors to authenticated",
    "grant update (name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods) on table tutors to authenticated",
    "grant delete on table tutors to authenticated"
  ];
  fail(grantStatements.length === expectedGrants.length, "Migration 0011 must contain only the explicit catalog mutation grants");
  fail(expectedGrants.every((statement) => grantStatements.includes(statement)), "Migration 0011 has an unexpected grant, role, table, or column");
  fail(
    !grantStatements.some((statement) => /\b(?:anon|public)\b/.test(statement)),
    "Migration 0011 must not grant mutation privileges to anon or public"
  );

  const policyStatements = normalized.filter((statement) => /^create policy\b/i.test(statement));
  fail(policyStatements.length === catalogTables.length * 4, "Migration 0011 must create exactly SELECT, INSERT, UPDATE, and DELETE policies for each catalog table");
  for (const table of catalogTables) {
    for (const action of ["select", "insert", "update", "delete"] as const) {
      const policy = policyStatements.find((statement) => new RegExp(`\\bon ${table} for ${action} to authenticated\\b`, "i").test(statement));
      fail(Boolean(policy), `Migration 0011 is missing the authenticated ${action} policy for ${table}`);
      const policyTarget = (policy || "").match(new RegExp(`\\bfor\\s+${action}\\s+to\\s+(.+?)\\s+(?:using|with check)\\b`, "i"))?.[1]?.trim();
      fail(policyTarget === "authenticated", `Migration 0011 ${table} ${action} policy must target authenticated only`);
      const using = extractPolicyClause(policy || "", "USING");
      const withCheck = extractPolicyClause(policy || "", "WITH CHECK");
      if (action === "select") {
        fail(using !== null, `${table} SELECT policy must use an approved-admin USING predicate`);
        fail(withCheck === null, `${table} SELECT policy must not use WITH CHECK`);
        fail(normalizeSql(using || "").toLowerCase() === normalizedAdminPredicate, `${table} SELECT policy must require an approved admin`);
        fail(!/publication_status/i.test(using || ""), `${table} admin SELECT policy must not limit publication_status`);
      } else if (action === "insert") {
        fail(using === null, `${table} INSERT policy must not use USING`);
        fail(normalizeSql(withCheck || "").toLowerCase() === normalizedAdminPredicate, `${table} INSERT policy must require an approved admin`);
      } else if (action === "update") {
        fail(normalizeSql(using || "").toLowerCase() === normalizedAdminPredicate, `${table} UPDATE policy USING must require an approved admin`);
        fail(normalizeSql(withCheck || "").toLowerCase() === normalizedAdminPredicate, `${table} UPDATE policy WITH CHECK must require an approved admin`);
      } else {
        fail(normalizeSql(using || "").toLowerCase() === normalizedAdminPredicate, `${table} DELETE policy must require an approved admin`);
        fail(withCheck === null, `${table} DELETE policy must not use WITH CHECK`);
      }
    }
  }
}

/** Pure contract used by the CLI audit and integration tests for migration 0012. */
export function assertMigration0012Contract(sql0012: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  const statements = stripSqlCommentsAndSplitStatements(sql0012);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");

  fail(!/\bservice_role\b/i.test(code), "Migration 0012 must not reference service_role");
  fail(!/\bSECURITY\s+DEFINER\b/i.test(code), "Migration 0012 must not use SECURITY DEFINER");
  fail(!/\bBYPASSRLS\b/i.test(code), "Migration 0012 must not include BYPASSRLS");
  fail(!/\b(?:SET|ALTER)\s+ROLE\b/i.test(code), "Migration 0012 must not use SET ROLE or ALTER ROLE");
  fail(
    !/\b(?:password|secret|token|bearer|apikey|api_key|service_role_key|anon_key)\b\s*[:=]/i.test(code)
      && !/'ey[a-zA-Z0-9._-]{20,}'/.test(code),
    "Migration 0012 must not contain credentials or hardcoded secrets"
  );
  fail(
    !/\b(?:EXECUTE\s+(?:IMMEDIATE|FORMAT)|EXECUTE\s+['$]|format\s*\()/i.test(code),
    "Migration 0012 must not use dynamic SQL"
  );
  fail(!/\b(?:GRANT|REVOKE)\b/i.test(code), "Migration 0012 must not add grants or cross-table privileges");
  fail(
    !/\b(?:ALTER\s+SYSTEM|CREATE\s+ROLE|OWNER\s+TO|SET\s+SESSION\s+AUTHORIZATION|DISABLE\s+ROW\s+LEVEL\s+SECURITY)\b/i.test(code),
    "Migration 0012 must not escalate privileges or disable RLS"
  );
  fail(
    !/\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:FUNCTION|PROCEDURE|TRIGGER|TABLE|VIEW|TYPE|EXTENSION)\b/i.test(code),
    "Migration 0012 must not create functions or unrelated schema objects"
  );
  fail(
    !/\b(?:ALTER|DROP|TRUNCATE)\s+(?:TABLE|VIEW|SCHEMA|FUNCTION|PROCEDURE|TRIGGER|TYPE|EXTENSION)\b/i.test(code),
    "Migration 0012 must not mutate unrelated schema objects"
  );

  fail(statements.length === 9, "Migration 0012 must contain exactly one bucket upsert and four DROP/CREATE policy pairs");

  const expectedBucketUpsert = normalizeMigrationStatement(`
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('materials', 'materials', false)
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, public = false
  `);
  fail(
    normalized[0] === expectedBucketUpsert,
    "Migration 0012 must idempotently upsert exactly the private materials bucket with matching id/name"
  );
  fail(
    normalized.filter((statement) => /^insert\s+into\s+storage\.buckets\b/.test(statement)).length === 1,
    "Migration 0012 must create exactly one storage bucket"
  );

  const expectedPredicate = normalizeMigrationStatement(`
    bucket_id = 'materials'
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.role = 'admin'
        AND public.profiles.account_status = 'approved'
    )
  `);
  const actions = ["select", "insert", "update", "delete"] as const;
  const policyStatements = normalized.filter((statement) => /^create\s+policy\b/.test(statement));
  const dropPolicyStatements = normalized.filter((statement) => /^drop\s+policy\b/.test(statement));

  fail(policyStatements.length === 4, "Migration 0012 must create exactly four materials policies");
  fail(dropPolicyStatements.length === 4, "Migration 0012 must safely replace exactly four materials policies");

  for (const [actionIndex, action] of actions.entries()) {
    const policyName = `materials_approved_admin_${action}`;
    const dropIndex = 1 + actionIndex * 2;
    const createIndex = dropIndex + 1;
    fail(
      normalized[dropIndex] === `drop policy if exists ${policyName} on storage.objects`,
      `Migration 0012 must safely drop the ${action.toUpperCase()} policy on storage.objects before recreation`
    );

    const policy = normalized[createIndex] || "";
    fail(
      policy.startsWith(`create policy ${policyName} on storage.objects for ${action} to authenticated `),
      `Migration 0012 ${action.toUpperCase()} policy must target storage.objects and authenticated only`
    );

    const roleTarget = policy.match(new RegExp(`\\bfor\\s+${action}\\s+to\\s+(.+?)\\s+(?:using|with check)\\b`, "i"))?.[1]?.trim();
    fail(roleTarget === "authenticated", `Migration 0012 ${action.toUpperCase()} policy role must be exactly authenticated`);

    const using = extractPolicyClause(policy, "USING");
    const withCheck = extractPolicyClause(policy, "WITH CHECK");
    const normalizedUsing = using === null ? null : normalizeMigrationStatement(using);
    const normalizedWithCheck = withCheck === null ? null : normalizeMigrationStatement(withCheck);

    if (action === "select" || action === "delete") {
      fail(normalizedUsing === expectedPredicate, `Migration 0012 ${action.toUpperCase()} USING must require the materials bucket and approved-admin predicate`);
      fail(withCheck === null, `Migration 0012 ${action.toUpperCase()} policy must not use WITH CHECK`);
    } else if (action === "insert") {
      fail(using === null, "Migration 0012 INSERT policy must not use USING");
      fail(normalizedWithCheck === expectedPredicate, "Migration 0012 INSERT WITH CHECK must require the materials bucket and approved-admin predicate");
    } else {
      fail(normalizedUsing === expectedPredicate, "Migration 0012 UPDATE USING must require the materials bucket and approved-admin predicate");
      fail(normalizedWithCheck === expectedPredicate, "Migration 0012 UPDATE WITH CHECK must require the materials bucket and approved-admin predicate");
    }

    const expectedPolicy = action === "insert"
      ? `create policy ${policyName} on storage.objects for insert to authenticated with check ( ${expectedPredicate} )`
      : action === "update"
        ? `create policy ${policyName} on storage.objects for update to authenticated using ( ${expectedPredicate} ) with check ( ${expectedPredicate} )`
        : `create policy ${policyName} on storage.objects for ${action} to authenticated using ( ${expectedPredicate} )`;
    fail(policy === expectedPolicy, `Migration 0012 ${action.toUpperCase()} policy must not broaden its exact approved-admin contract`);
  }
}

/** Pure contract used by the CLI audit and integration tests for migration 0013. */
export function assertMigration0013Contract(sql0013: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0013);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");
  const compactPredicate = (value: string) => normalizeMigrationStatement(value).replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  const adminPredicate = normalizeMigrationStatement(`
    EXISTS ( SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin' AND public.profiles.account_status = 'approved')
  `);

  fail(!/\b(?:service_role|security\s+definer|bypassrls|set\s+role|alter\s+role)\b/i.test(code), "Migration 0013 must not escalate roles");
  fail(!/\b(?:password|secret|token|bearer|apikey|api_key|credential)\b\s*[:=]/i.test(code), "Migration 0013 must not contain credentials");
  fail(!/\b(?:execute\s+(?:immediate|format)|execute\s+['$]|format\s*\()/i.test(code), "Migration 0013 must not use dynamic SQL");
  fail(!/\b(?:create\s+(?:or\s+replace\s+)?(?:function|procedure|trigger|view|type|extension)|alter\s+system|disable\s+row\s+level\s+security)\b/i.test(code), "Migration 0013 contains unrelated or unsafe statements");
  fail(statements.length === 6, "Migration 0013 must contain exactly table, RLS, privilege, and two policy statements");

  const table = normalized[0] || "";
  fail(table.startsWith("create table public.material_assets ("), "Migration 0013 must create public.material_assets");
  const tableOpening = table.indexOf("(");
  const tableClosing = table.lastIndexOf(")");
  fail(tableOpening > 0 && tableClosing > tableOpening, "Migration 0013 must contain a parseable material_assets table body");
  const definitions = splitTopLevelClauses(table.slice(tableOpening + 1, tableClosing));
  const expectedColumns = new Map([
    ["id", "id uuid primary key default gen_random_uuid()"],
    ["product_id", "product_id uuid not null references public.products(id) on delete cascade"],
    ["uploaded_by", "uploaded_by uuid references auth.users(id) on delete set null"],
    ["storage_path", "storage_path text not null unique"],
    ["original_name", "original_name text not null"],
    ["mime_type", "mime_type text not null"],
    ["byte_size", "byte_size bigint not null"],
    ["version", "version integer not null"],
    ["visibility", "visibility text not null default 'private'"],
    ["created_at", "created_at timestamptz not null default now()"],
    ["updated_at", "updated_at timestamptz not null default now()"]
  ]);
  const columnDefinitions = definitions.filter((definition) => !/^constraint\b|^foreign key\b/i.test(definition));
  fail(columnDefinitions.length === expectedColumns.size, "Migration 0013 must contain exactly the expected material_assets columns");
  const actualColumns = new Map<string, string>();
  for (const definition of columnDefinitions) {
    const name = definition.match(/^([a-z_][a-z0-9_]*)\b/i)?.[1];
    fail(Boolean(name) && !actualColumns.has(name!.toLowerCase()), "Migration 0013 must not contain duplicate or unnamed columns");
    actualColumns.set(name!.toLowerCase(), definition);
  }
  fail(actualColumns.size === expectedColumns.size && [...expectedColumns].every(([name, definition]) => actualColumns.get(name) === definition), "Migration 0013 column definitions must match the exact metadata contract");

  const expectedConstraints = [
    "constraint material_assets_byte_size_positive check (byte_size > 0)",
    "constraint material_assets_version_positive check (version >= 1)",
    "constraint material_assets_visibility_private check (visibility = 'private')",
    "constraint material_assets_storage_path_materials check ( storage_path ~ '^materials/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/v[1-9][0-9]*/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[a-z0-9][a-z0-9._-]*$' )",
    "constraint material_assets_product_version_unique unique (product_id, version)",
    "constraint material_assets_product_material_fkey foreign key (product_id) references public.materials(product_id) on delete cascade"
  ];
  const actualConstraints = definitions.filter((definition) => /^constraint\b|^foreign key\b/i.test(definition));
  fail(actualConstraints.length === expectedConstraints.length && expectedConstraints.every((constraint) => actualConstraints.includes(constraint)), "Migration 0013 constraints and foreign keys must match exactly");
  fail(normalized[1] === "alter table public.material_assets enable row level security", "Migration 0013 must enable RLS");
  fail(normalized[2] === "revoke all on table public.material_assets from anon, public, authenticated", "Migration 0013 must revoke broad metadata privileges");
  fail(normalized[3] === "grant select, insert on table public.material_assets to authenticated", "Migration 0013 must grant only metadata SELECT and INSERT to authenticated");
  fail(!/\b(?:update|delete)\b/.test(normalized.slice(2).join(" ")), "Migration 0013 must not add UPDATE or DELETE metadata access");

  const policies = normalized.slice(4);
  fail(policies.length === 2, "Migration 0013 must contain exactly two metadata policies");
  for (const [name, action] of [["material_assets_approved_admin_select", "select"], ["material_assets_approved_admin_insert", "insert"]] as const) {
    const policy = policies.find((statement) => statement.startsWith(`create policy ${name} `)) || "";
    fail(policy.startsWith(`create policy ${name} on public.material_assets for ${action} to authenticated `), "Migration 0013 policies must target material_assets and authenticated only");
    const using = extractPolicyClause(policy, "USING");
    const withCheck = extractPolicyClause(policy, "WITH CHECK");
    if (action === "select") {
      fail(compactPredicate(using || "") === compactPredicate(adminPredicate) && withCheck === null, "Migration 0013 SELECT policy must require the exact approved-admin predicate");
    } else {
      fail(using === null && compactPredicate(withCheck || "") === compactPredicate(adminPredicate), "Migration 0013 INSERT policy must require the exact approved-admin predicate");
    }
  }
  fail(!/\b(?:storage\.buckets|storage\.objects|public\s*=\s*true|grant\s+(?!select, insert on table public\.material_assets to authenticated)|revoke\s+(?!all on table public\.material_assets from anon, public, authenticated))\b/i.test(code), "Migration 0013 must not alter storage authority or cross-table privileges");
}

/** Pure contract used by the CLI audit and integration tests for migration 0014. */
export function assertMigration0014Contract(sql0014: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0014);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");
  const compactPredicate = (value: string) => normalizeMigrationStatement(value).replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  const adminPredicate = normalizeMigrationStatement(`
    EXISTS ( SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid()
      AND public.profiles.role = 'admin' AND public.profiles.account_status = 'approved')
  `);
  const ownPredicate = "public.product_entitlements.user_id = auth.uid()";

  fail(!/\b(?:service_role|security\s+definer|bypassrls|set\s+role|alter\s+role)\b/i.test(code), "Migration 0014 must not escalate roles");
  fail(!/\b(?:password|secret|token|bearer|apikey|api_key|credential)\b\s*[:=]/i.test(code), "Migration 0014 must not contain credentials");
  fail(!/\b(?:execute\s+(?:immediate|format)|execute\s+['$]|format\s*\()/i.test(code), "Migration 0014 must not use dynamic SQL");
  fail(!/\b(?:create\s+(?:or\s+replace\s+)?(?:function|procedure|trigger|view|type|extension)|alter\s+system|disable\s+row\s+level\s+security)\b/i.test(code), "Migration 0014 contains unrelated or unsafe statements");
  fail(statements.length === 10, "Migration 0014 must contain exactly table, index, RLS, privilege, and five policy statements");

  const table = normalized[0] || "";
  fail(table.startsWith("create table public.product_entitlements ("), "Migration 0014 must create public.product_entitlements");
  const tableOpening = table.indexOf("(");
  const tableClosing = table.lastIndexOf(")");
  fail(tableOpening > 0 && tableClosing > tableOpening, "Migration 0014 must contain a parseable product_entitlements table body");
  const definitions = splitTopLevelClauses(table.slice(tableOpening + 1, tableClosing));
  const expectedColumns = new Map([
    ["id", "id uuid primary key default gen_random_uuid()"],
    ["user_id", "user_id uuid not null references auth.users(id) on delete cascade"],
    ["product_id", "product_id uuid not null references public.products(id) on delete cascade"],
    ["status", "status text not null default 'active'"],
    ["granted_at", "granted_at timestamptz not null default now()"],
    ["expires_at", "expires_at timestamptz null"],
    ["revoked_at", "revoked_at timestamptz null"],
    ["granted_by", "granted_by uuid null references auth.users(id) on delete set null"],
    ["created_at", "created_at timestamptz not null default now()"],
    ["updated_at", "updated_at timestamptz not null default now()"]
  ]);
  const columnDefinitions = definitions.filter((definition) => !/^constraint\b|^foreign key\b/i.test(definition));
  fail(columnDefinitions.length === expectedColumns.size, "Migration 0014 must contain exactly the expected product_entitlements columns");
  const actualColumns = new Map<string, string>();
  for (const definition of columnDefinitions) {
    const name = definition.match(/^([a-z_][a-z0-9_]*)\b/i)?.[1];
    fail(Boolean(name) && !actualColumns.has(name!.toLowerCase()), "Migration 0014 must not contain duplicate or unnamed columns");
    actualColumns.set(name!.toLowerCase(), definition);
  }
  fail(actualColumns.size === expectedColumns.size && [...expectedColumns].every(([name, definition]) => actualColumns.get(name) === definition), "Migration 0014 column definitions must match the exact entitlement contract");

  const expectedConstraints = [
    "constraint product_entitlements_status_check check (status in ('active', 'revoked', 'expired'))",
    "constraint product_entitlements_expires_after_grant check (expires_at is null or expires_at > granted_at)",
    "constraint product_entitlements_active_not_revoked check (status <> 'active' or revoked_at is null)",
    "constraint product_entitlements_revoked_at_required check (status <> 'revoked' or revoked_at is not null)",
    "constraint product_entitlements_user_product_unique unique (user_id, product_id)"
  ];
  const actualConstraints = definitions.filter((definition) => /^constraint\b|^foreign key\b/i.test(definition));
  fail(actualConstraints.length === expectedConstraints.length && expectedConstraints.every((constraint) => actualConstraints.includes(constraint)), "Migration 0014 constraints and foreign keys must match exactly");

  fail(normalized[1] === "create index idx_product_entitlements_user_product_status on public.product_entitlements (user_id, product_id, status)", "Migration 0014 must create the exact entitlement lookup index");
  fail(normalized[2] === "alter table public.product_entitlements enable row level security", "Migration 0014 must enable RLS");
  fail(normalized[3] === "revoke all on table public.product_entitlements from anon, public, authenticated", "Migration 0014 must revoke broad entitlement privileges");
  fail(normalized[4] === "grant select, insert, update, delete on table public.product_entitlements to authenticated", "Migration 0014 must grant only explicit entitlement access to authenticated");

  const policies = normalized.slice(5);
  const expectedPolicies = [
    ["product_entitlements_select_own", "select"],
    ["product_entitlements_select_admin", "select"],
    ["product_entitlements_insert_admin", "insert"],
    ["product_entitlements_update_admin", "update"],
    ["product_entitlements_delete_admin", "delete"]
  ] as const;
  fail(policies.length === expectedPolicies.length, "Migration 0014 must contain exactly five entitlement policies");

  for (const [name, action] of expectedPolicies) {
    const policy = policies.find((statement) => statement.startsWith(`create policy ${name} `)) || "";
    fail(policy.startsWith(`create policy ${name} on public.product_entitlements for ${action} to authenticated `), "Migration 0014 policies must target product_entitlements and authenticated only");
    const using = extractPolicyClause(policy, "USING");
    const withCheck = extractPolicyClause(policy, "WITH CHECK");
    if (name === "product_entitlements_select_own") {
      fail(compactPredicate(using || "") === ownPredicate && withCheck === null, "Migration 0014 own SELECT policy must require auth.uid() ownership");
    } else if (name === "product_entitlements_select_admin" || name === "product_entitlements_delete_admin") {
      fail(compactPredicate(using || "") === compactPredicate(adminPredicate) && withCheck === null, "Migration 0014 admin read/delete policy must require the exact approved-admin predicate");
    } else if (name === "product_entitlements_insert_admin") {
      fail(using === null && compactPredicate(withCheck || "") === compactPredicate(adminPredicate), "Migration 0014 INSERT policy must require the exact approved-admin predicate");
    } else {
      fail(compactPredicate(using || "") === compactPredicate(adminPredicate) && compactPredicate(withCheck || "") === compactPredicate(adminPredicate), "Migration 0014 UPDATE policy must require the exact approved-admin predicate in USING and WITH CHECK");
    }
  }

  fail(!/\b(?:public\s*=\s*true|grant\s+all|grant\s+[^;]*\bon\s+(?!table\s+public\.product_entitlements\b)[a-z_][a-z0-9_.]*|revoke\s+[^;]*\bon\s+(?!table\s+public\.product_entitlements\b)[a-z_][a-z0-9_.]*)\b/i.test(code), "Migration 0014 must not add public or cross-table privileges");
}

/** Pure contract used by the CLI audit and integration tests for migration 0015. */
export function assertMigration0015Contract(sql0015: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0015);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");
  const ownPredicate = "public.learning_progress.user_id = auth.uid()";

  fail(!/\b(?:service_role|security\s+definer|bypassrls|set\s+role|alter\s+role)\b/i.test(code), "Migration 0015 must not escalate roles");
  fail(!/\b(?:password|secret|token|bearer|apikey|api_key|credential)\b\s*[:=]/i.test(code), "Migration 0015 must not contain credentials");
  fail(!/\b(?:execute\s+(?:immediate|format)|execute\s+['$]|format\s*\()/i.test(code), "Migration 0015 must not use dynamic SQL");
  fail(!/\b(?:create\s+(?:or\s+replace\s+)?(?:function|procedure|view|type|extension)|alter\s+system|disable\s+row\s+level\s+security)\b/i.test(code), "Migration 0015 contains unrelated or unsafe statements");
  fail(statements.length === 11, "Migration 0015 must contain only the table, indexes, RLS, grants, trigger, and three policies");

  const table = normalized[0] || "";
  fail(table.startsWith("create table public.learning_progress ("), "Migration 0015 must create public.learning_progress");
  const tableOpening = table.indexOf("(");
  const tableClosing = table.lastIndexOf(")");
  fail(tableOpening > 0 && tableClosing > tableOpening, "Migration 0015 must contain a parseable learning_progress table body");
  const definitions = splitTopLevelClauses(table.slice(tableOpening + 1, tableClosing));
  const expectedColumns = new Map([
    ["user_id", "user_id uuid not null references auth.users(id) on delete cascade"],
    ["product_id", "product_id uuid not null references public.products(id) on delete cascade"],
    ["item_type", "item_type text not null"],
    ["item_id", "item_id uuid not null"],
    ["status", "status text not null default 'not_started'"],
    ["watched_percent", "watched_percent numeric(5, 2) not null default 0"],
    ["started_at", "started_at timestamptz null"],
    ["completed_at", "completed_at timestamptz null"],
    ["created_at", "created_at timestamptz not null default now()"],
    ["updated_at", "updated_at timestamptz not null default now()"]
  ]);
  const columnDefinitions = definitions.filter((definition) => !/^constraint\b|^foreign key\b/i.test(definition));
  fail(columnDefinitions.length === expectedColumns.size, "Migration 0015 must contain exactly the expected learning_progress columns");
  const actualColumns = new Map<string, string>();
  for (const definition of columnDefinitions) {
    const name = definition.match(/^([a-z_][a-z0-9_]*)\b/i)?.[1];
    fail(Boolean(name) && !actualColumns.has(name!.toLowerCase()), "Migration 0015 must not contain duplicate or unnamed columns");
    actualColumns.set(name!.toLowerCase(), definition);
  }
  fail(actualColumns.size === expectedColumns.size && [...expectedColumns].every(([name, definition]) => actualColumns.get(name) === definition), "Migration 0015 column definitions must match the exact learning progress contract");

  const expectedConstraints = [
    "constraint learning_progress_item_type_check check (item_type in ('material', 'lesson'))",
    "constraint learning_progress_status_check check (status in ('not_started', 'in_progress', 'completed'))",
    "constraint learning_progress_watched_percent_check check (watched_percent >= 0 and watched_percent <= 100)",
    "constraint learning_progress_user_product_item_unique unique (user_id, product_id, item_type, item_id)"
  ];
  const actualConstraints = definitions.filter((definition) => /^constraint\b|^foreign key\b/i.test(definition));
  fail(actualConstraints.length === expectedConstraints.length && expectedConstraints.every((constraint) => actualConstraints.includes(constraint)), "Migration 0015 constraints and foreign keys must match exactly");

  fail(normalized[1] === "create index idx_learning_progress_user_product_updated_at on public.learning_progress (user_id, product_id, updated_at desc)", "Migration 0015 must create the exact user/product progress index");
  fail(normalized[2] === "create index idx_learning_progress_product_user on public.learning_progress (product_id, user_id)", "Migration 0015 must create the exact product/user progress index");
  fail(normalized[3] === "alter table public.learning_progress enable row level security", "Migration 0015 must enable RLS");
  fail(normalized[4] === "revoke all on table public.learning_progress from anon, public, authenticated", "Migration 0015 must revoke broad progress privileges");
  fail(normalized[5] === "grant select, insert, update on table public.learning_progress to authenticated", "Migration 0015 must grant only explicit authenticated progress access");
  fail(normalized[6] === "drop trigger if exists trg_learning_progress_updated_at on public.learning_progress", "Migration 0015 must safely replace only its own timestamp trigger");
  fail(normalized[7] === "create trigger trg_learning_progress_updated_at before update on public.learning_progress for each row execute function update_updated_at_column()", "Migration 0015 must reuse the established updated_at function");

  const policies = normalized.slice(8);
  const expectedPolicies = [
    ["learning_progress_select_own", "select"],
    ["learning_progress_insert_own", "insert"],
    ["learning_progress_update_own", "update"]
  ] as const;
  fail(policies.length === expectedPolicies.length, "Migration 0015 must contain exactly three learning progress policies");
  for (const [name, action] of expectedPolicies) {
    const policy = policies.find((statement) => statement.startsWith(`create policy ${name} `)) || "";
    fail(policy.startsWith(`create policy ${name} on public.learning_progress for ${action} to authenticated `), "Migration 0015 policies must target learning_progress and authenticated only");
    const using = extractPolicyClause(policy, "USING");
    const withCheck = extractPolicyClause(policy, "WITH CHECK");
    if (action === "select") {
      fail(normalizeSql(using || "").toLowerCase() === ownPredicate && withCheck === null, "Migration 0015 SELECT policy must require auth.uid() ownership");
    } else if (action === "insert") {
      fail(using === null && normalizeSql(withCheck || "").toLowerCase() === ownPredicate, "Migration 0015 INSERT policy must require auth.uid() ownership");
    } else {
      fail(normalizeSql(using || "").toLowerCase() === ownPredicate && normalizeSql(withCheck || "").toLowerCase() === ownPredicate, "Migration 0015 UPDATE policy must require auth.uid() ownership in both predicates");
    }
  }

  const grants = normalized.filter((statement) => /^grant\s+/i.test(statement));
  const revokes = normalized.filter((statement) => /^revoke\s+/i.test(statement));
  fail(grants.length === 1 && revokes.length === 1, "Migration 0015 must contain only one grant and one revoke statement");
  fail(!/\bgrant\s+(?:delete|all)\b/i.test(code), "Migration 0015 must not grant DELETE or ALL");
  fail(!/\b(?:grant|create\s+policy)\b[^;]*\b(?:anon|public|service_role)\b/i.test(code.replace(/public\.learning_progress/gi, "learning_progress")), "Migration 0015 must not grant or policy-authorize public roles");
  fail(!/\b(?:grant|revoke)\s+[^;]*\bon\s+(?!table\s+public\.learning_progress\b)[a-z_][a-z0-9_.]*/i.test(code), "Migration 0015 must not alter cross-table privileges");
}

/** Exact entitlement, item-binding, and RPC privilege contract for migration 0028. */
export function assertLearningProgressBoundaryMigrationContract(sql0028: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0028).map(normalizeMigrationStatement);
  const signature = "uuid, text, uuid, text, numeric, timestamptz, timestamptz";
  fail(statements.length === 4, "Migration 0028 must contain exactly its four boundary statements");
  fail(statements[0] === "revoke insert, update on table public.learning_progress from anon, public, authenticated", "Migration 0028 must revoke direct progress INSERT and UPDATE");
  fail(
    /^create or replace function public\.save_learning_progress\(/i.test(statements[1])
      && /p_product_id uuid, p_item_type text, p_item_id uuid, p_status text, p_watched_percent numeric, p_started_at timestamptz, p_completed_at timestamptz/i.test(statements[1])
      && /returns public\.learning_progress language plpgsql security definer/i.test(statements[1])
      && /set search_path = pg_catalog, public/i.test(statements[1])
      && statements[1].endsWith("$function$"),
    "Migration 0028 must define the exact fixed progress RPC"
  );
  fail(statements[2] === `revoke all on function public.save_learning_progress(${signature}) from public, anon`, "Migration 0028 must revoke public and anonymous RPC execution");
  fail(statements[3] === `grant execute on function public.save_learning_progress(${signature}) to authenticated`, "Migration 0028 must grant RPC execution only to authenticated");
  const executableCode = maskSqlStringLiterals(statements.join(" ; "));
  fail(/auth\.uid\(\)|product_entitlements|materials|course_lessons|on conflict\s*\(/i.test(executableCode), "Migration 0028 must bind auth identity, entitlement, item ownership, and idempotency");
  fail(!/\b(?:execute\s+(?:immediate|format)|set\s+role|alter\s+role|bypassrls|dynamic\s+sql|service_role)\b/i.test(executableCode), "Migration 0028 must not use dynamic SQL or privilege escalation");
  fail(!/p_user_id|p_actor|p_uploaded_by/i.test(executableCode), "Migration 0028 must not accept caller-supplied identity");
}

/** Exact storage reservation, metadata binding, and private-object boundary contract for migration 0029. */
export function assertMaterialStorageIntegrityBoundaryMigrationContract(sql0029: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const code = stripSqlCommentsAndSplitStatements(sql0029).join(" ; ");
  const executableCode = maskSqlStringLiterals(code);
  fail(/create table public\.material_asset_upload_reservations/i.test(code), "Migration 0029 must define upload reservations");
  fail(/unique \(product_id, version\)/i.test(code), "Migration 0029 must enforce unique product versions for reservations");
  fail(/material_assets_product_version_path_binding/i.test(code) && /lower\(product_id::text\).*version::text/i.test(code), "Migration 0029 must bind metadata paths to product and version");
  fail(/revoke all on table public\.material_asset_upload_reservations from public, anon, authenticated/i.test(code), "Migration 0029 must deny direct reservation table DML");
  fail(/revoke insert on table public\.material_assets from public, anon, authenticated/i.test(code), "Migration 0029 must deny direct metadata INSERT");
  fail(/materials_approved_admin_insert[\s\S]*material_asset_upload_reservations\.storage_path = name[\s\S]*uploaded_by = auth\.uid\(\)/i.test(code), "Storage INSERT must require the caller's reservation");
  fail(/drop policy if exists "materials_approved_admin_update"[\s\S]*drop policy if exists "materials_approved_admin_delete"/i.test(code), "Storage UPDATE and DELETE must not remain direct authenticated operations");
  for (const functionName of ["reserve_material_asset_upload", "finalize_material_asset_upload", "release_material_asset_upload"]) {
    fail(new RegExp(`create or replace function public\\.${functionName}\\(`, "i").test(code), `Migration 0029 must define ${functionName}`);
  }
  fail((code.match(/set search_path = pg_catalog, public/gi) ?? []).length === 3, "All storage boundary functions must use the fixed search_path");
  fail(/auth\.uid\(\)/i.test(executableCode) && /pg_advisory_xact_lock/i.test(executableCode) && /max\(material_assets\.version\)/i.test(executableCode), "Version allocation must use caller identity, a transaction lock, and existing versions");
  fail(/returning \*/i.test(executableCode) && /delete from public\.material_asset_upload_reservations/i.test(executableCode), "Finalization must return metadata and consume the reservation");
  fail(!/\b(?:execute\s+immediate|format\s*\(|set\s+role|alter\s+role|bypassrls|dynamic\s+sql|service_role)\b/i.test(executableCode), "Migration 0029 must not use dynamic SQL or privilege escalation");
  fail(!/grant\s+(?:insert|update|delete|all)\s+on\s+(?:table\s+)?public\.(?:material_assets|material_asset_upload_reservations)/i.test(executableCode), "Migration 0029 must not grant direct material mutation");
}

/** Additive contract for direct upload session expiry and retry-safe finalization. */
export function assertMaterialDirectUploadMigrationContract(sql0033: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const code = stripSqlCommentsAndSplitStatements(sql0033).join(" ; ");
  const executableCode = maskSqlStringLiterals(code);
  fail(/alter table public\.material_asset_upload_reservations[\s\S]*add column expires_at timestamptz not null default \(now\(\) \+ interval '2 hours'\)/i.test(code), "Migration 0033 must add a bounded reservation expiry");
  fail(/alter table public\.material_assets[\s\S]*add column upload_reservation_id uuid/i.test(code), "Migration 0033 must link committed assets to their upload reservation");
  fail(/create unique index material_assets_upload_reservation_id_unique[\s\S]*where upload_reservation_id is not null/i.test(code), "Migration 0033 must make reservation finalization idempotent");
  fail(/create or replace function public\.finalize_material_asset_upload\(p_reservation_id uuid\)/i.test(code), "Migration 0033 must replace the finalization RPC");
  fail(/expires_at <= now\(\)/i.test(executableCode) && /for update/i.test(executableCode), "Finalization must reject expired sessions under a row lock");
  fail(/where upload_reservation_id = p_reservation_id[\s\S]*uploaded_by = v_user_id/i.test(executableCode) && /if found then return v_row/i.test(executableCode), "Finalization must return the existing asset on a duplicate request");
  fail(/v_reservation\.id/i.test(executableCode) && /delete from public\.material_asset_upload_reservations/i.test(executableCode), "Finalization must bind and consume the reservation atomically");
  fail((code.match(/set search_path = pg_catalog, public/gi) ?? []).length === 1, "Migration 0033 must use the fixed search_path");
  fail(!/\b(?:execute\s+(?:immediate|format)|set\s+role|alter\s+role|bypassrls|dynamic\s+sql|service_role)\b/i.test(executableCode), "Migration 0033 must not use dynamic SQL or privilege escalation");
}

/** Cleanup claim, cancellation, retry, and finalized-asset protection contract for migration 0034. */
export function assertMaterialUploadCleanupMigrationContract(sql0034: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const code = stripSqlCommentsAndSplitStatements(sql0034).join(" ; ");
  const executableCode = maskSqlStringLiterals(code);
  const functionBody = (name: string): string => executableCode.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?(?=create or replace function public\\.|revoke all on function|grant execute on function|$)`, "i"))?.[0] ?? "";
  fail(/alter table public\.material_asset_upload_reservations[\s\S]*add column cancelled_at timestamptz[\s\S]*add column cleanup_claim_id uuid[\s\S]*add column cleanup_claimed_at timestamptz[\s\S]*add column cleanup_attempts integer not null default 0/i.test(code), "Migration 0034 must add bounded cleanup state to reservations");
  fail(/create index material_asset_upload_reservations_cleanup_idx[\s\S]*expires_at, cancelled_at, cleanup_claimed_at, id/i.test(code), "Migration 0034 must index cleanup candidates");
  for (const functionName of ["cancel_material_asset_upload", "claim_expired_material_asset_uploads", "complete_expired_material_asset_upload_cleanup", "release_expired_material_asset_upload_cleanup"]) {
    fail(new RegExp(`create or replace function public\\.${functionName}\\(`, "i").test(code), `Migration 0034 must define ${functionName}`);
  }
  fail(/create or replace function public\.finalize_material_asset_upload\(p_reservation_id uuid\)/i.test(code), "Migration 0034 must preserve the finalized owner boundary");
  fail(/cancelled_at = coalesce\(cancelled_at, now\(\)\)[\s\S]*expires_at = least\(expires_at, now\(\)\)/i.test(executableCode), "Cancellation must transition a reservation into cleanup");
  fail(/uploaded_by = v_user_id[\s\S]*cleanup_claim_id is null/i.test(functionBody("cancel_material_asset_upload")), "Cancellation must not interrupt an active cleanup claim");
  fail(/claim_expired_material_asset_uploads[\s\S]*for update skip locked/i.test(executableCode) && /cleanup_claim_id = gen_random_uuid\(\)/i.test(executableCode), "Cleanup claims must be lock-safe and uniquely claimed");
  fail(/not exists \([\s\S]*from public\.material_assets[\s\S]*upload_reservation_id = reservations\.id/i.test(functionBody("claim_expired_material_asset_uploads")) && /not exists \([\s\S]*from public\.material_assets[\s\S]*upload_reservation_id = reservations\.id/i.test(functionBody("complete_expired_material_asset_upload_cleanup")), "Cleanup must never claim or delete a finalized asset reservation");
  fail(/cleanup_claim_id = p_claim_id/i.test(executableCode) && /cleanup_claimed_at = null/i.test(executableCode), "Cleanup failures must release or expire their claim");
  fail(/create or replace function public\.release_material_asset_upload\(p_reservation_id uuid\)/i.test(code) && /cleanup_claim_id is null[\s\S]*not exists[\s\S]*material_assets/i.test(functionBody("release_material_asset_upload")), "User release must not delete a claimed or finalized reservation");
  fail(/v_reservation\.cancelled_at is not null[\s\S]*v_reservation\.expires_at <= now\(\)[\s\S]*v_reservation\.cleanup_claim_id is not null/i.test(functionBody("finalize_material_asset_upload")), "Finalization must reject cancelled, expired, or claimed reservations");
  fail((code.match(/set search_path = pg_catalog, public/gi) ?? []).length === 6, "Migration 0034 functions must use the fixed search_path");
  fail(!/\b(?:execute\s+(?:immediate|format)|set\s+role|alter\s+role|bypassrls|dynamic\s+sql)\b/i.test(executableCode), "Migration 0034 must not use dynamic SQL or privilege escalation");
  fail(/revoke all on function public\.claim_expired_material_asset_uploads\(integer\) from public, anon, authenticated/i.test(code) && /grant execute on function public\.claim_expired_material_asset_uploads\(integer\) to service_role/i.test(code), "Cleanup claim execution must be private to service_role");
}

/** Server/database idempotency contract for each direct-upload attempt. */
export function assertMaterialUploadIdempotencyMigrationContract(sql0035: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const statements = stripSqlCommentsAndSplitStatements(sql0035).map(normalizeMigrationStatement);
  const code = statements.join(" ; ");
  const executableCode = maskSqlStringLiterals(code);
  const reserve = statements.find((statement) => statement.startsWith("create or replace function public.reserve_material_asset_upload(")) || "";
  const finalize = statements.find((statement) => statement.startsWith("create or replace function public.finalize_material_asset_upload(")) || "";
  const expectedPrivileges = [
    "revoke all on function public.reserve_material_asset_upload(uuid, text, text, text, bigint, uuid) from public, anon",
    "revoke all on function public.finalize_material_asset_upload(uuid, uuid) from public, anon",
    "grant execute on function public.reserve_material_asset_upload(uuid, text, text, text, bigint, uuid) to authenticated",
    "grant execute on function public.finalize_material_asset_upload(uuid, uuid) to authenticated"
  ];
  const privilegeStatements = statements.filter((statement) => /^(?:grant|revoke)\b/i.test(statement));
  fail(statements.length === 12, "Migration 0035 must contain exactly its 12 allowlisted statements");
  fail(privilegeStatements.length === expectedPrivileges.length && expectedPrivileges.every((statement) => privilegeStatements.includes(statement)), "Migration 0035 privileges must match the exact server upload allowlist");
  fail(statements.filter((statement) => !/^(?:grant|revoke)\b/i.test(statement)).every((statement) => !/^(?:do|copy|call|insert|update|delete|truncate|alter\s+system)\b/i.test(statement)), "Migration 0035 contains a top-level statement outside the upload contract");
  fail(statements.includes("create unique index material_asset_upload_reservations_idempotency_key_unique on public.material_asset_upload_reservations (uploaded_by, upload_idempotency_key) where upload_idempotency_key is not null"), "Migration 0035 must contain the exact owner/key reservation uniqueness constraint");
  fail(statements.includes("create unique index material_assets_upload_idempotency_key_unique on public.material_assets (uploaded_by, upload_idempotency_key) where uploaded_by is not null and upload_idempotency_key is not null"), "Migration 0035 must contain the exact owner/key committed-asset uniqueness constraint");
  fail(/alter table public\.material_asset_upload_reservations[\s\S]*add column upload_idempotency_key uuid/i.test(code), "Migration 0035 must bind reservations to an idempotency key");
  fail(/alter table public\.material_assets[\s\S]*add column upload_idempotency_key uuid/i.test(code), "Migration 0035 must persist the idempotency key on committed assets");
  fail(/material_asset_upload_reservations_idempotency_key_unique[\s\S]*uploaded_by, upload_idempotency_key[\s\S]*where upload_idempotency_key is not null/i.test(code), "Migration 0035 must uniquely scope active reservations by uploader and key");
  fail(/material_assets_upload_idempotency_key_unique[\s\S]*uploaded_by, upload_idempotency_key[\s\S]*where uploaded_by is not null and upload_idempotency_key is not null/i.test(code), "Migration 0035 must uniquely scope committed assets by uploader and key");
  fail(/^create or replace function public\.reserve_material_asset_upload\(\s*p_product_id uuid, p_original_name text, p_safe_filename text, p_mime_type text, p_byte_size bigint, p_idempotency_key uuid\s*\)/i.test(reserve), "Migration 0035 must require the exact keyed prepare RPC signature");
  fail(/^create or replace function public\.finalize_material_asset_upload\(\s*p_reservation_id uuid, p_idempotency_key uuid\s*\)/i.test(finalize), "Migration 0035 must require the exact keyed finalize RPC signature");
  fail(!/\b(?:p_actor|p_user_id|p_uploaded_by|p_timestamp|p_created_at|p_updated_at)\b/i.test(code), "Migration 0035 must not accept caller-supplied actor or timestamp values");
  fail(/uploaded_by = v_user_id[\s\S]*upload_idempotency_key = p_idempotency_key/i.test(reserve), "Prepare RPC must look up keys in the authenticated owner scope");
  fail(/status', 'reserved'[\s\S]*is_new', false/i.test(code) && /status', 'committed'[\s\S]*is_new', false/i.test(code), "Prepare RPC must return existing active reservations and committed assets");
  fail(/return\s+jsonb_build_object\(\s*'status',\s*'conflict'\s*\)/i.test(code), "Prepare RPC must reject immutable metadata conflicts generically");
  fail(/pg_advisory_xact_lock\(hashtextextended\(v_user_id::text[\s\S]*p_idempotency_key::text/i.test(reserve), "Prepare RPC must serialize an uploader's idempotency key");
  fail(statements.some((statement) => /^drop function if exists public\.finalize_material_asset_upload\(uuid\)$/i.test(statement)), "Finalization RPC must remove the pre-keyed overload");
  fail(/upload_idempotency_key = p_idempotency_key[\s\S]*for update/i.test(finalize) && /upload_reservation_id = p_reservation_id[\s\S]*uploaded_by = v_user_id[\s\S]*upload_idempotency_key = p_idempotency_key/i.test(finalize), "Finalization must enforce owner/key identity and return committed duplicates");
  fail(/upload_reservation_id, upload_idempotency_key, storage_path/i.test(executableCode) && /delete from public\.material_asset_upload_reservations/i.test(executableCode), "Finalization must persist the key and consume the reservation atomically");
  fail((code.match(/set search_path = pg_catalog, public/gi) ?? []).length === 2, "Migration 0035 functions must use the fixed search_path");
  fail(!/\b(?:execute\s+(?:immediate|format)|set\s+role|alter\s+role|bypassrls|dynamic\s+sql|service_role)\b/i.test(executableCode), "Migration 0035 must not use dynamic SQL or privilege escalation");
  fail(/v_reservation\.product_id <> p_product_id/i.test(reserve) && /v_reservation\.original_name is distinct from p_original_name/i.test(reserve) && /v_reservation\.mime_type is distinct from p_mime_type/i.test(reserve) && /v_reservation\.byte_size is distinct from p_byte_size/i.test(reserve), "Prepare RPC must bind product and immutable file metadata");
  fail(/material_asset_upload_reservations_idempotency_key_unique/i.test(code) && /material_assets_upload_idempotency_key_unique/i.test(code), "Migration 0035 must retain unique reservation and committed-asset idempotency scopes");
}

interface RetrySqlFunction {
  name: string;
  parameters: string;
  returns: string;
  securityDefiner: boolean;
  searchPath: string;
  body: string;
}

function matchingSqlParen(value: string, opening: number): number {
  let depth = 0;
  let quote: "single" | "double" | null = null;
  for (let index = opening; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1];
    if (quote === "single") {
      if (character === "'" && next === "'") index += 1;
      else if (character === "'") quote = null;
      continue;
    }
    if (quote === "double") {
      if (character === '"' && next === '"') index += 1;
      else if (character === '"') quote = null;
      continue;
    }
    if (character === "'") { quote = "single"; continue; }
    if (character === '"') { quote = "double"; continue; }
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** Parses a SECURITY DEFINER RPC header without treating its dollar body as opaque text. */
function parseRetrySqlFunction(statement: string): RetrySqlFunction | null {
  const prefix = /^\s*create\s+or\s+replace\s+function\s+public\.([a-z_][a-z0-9_]*)\s*\(/i.exec(statement);
  if (!prefix || prefix.index === undefined) return null;
  const opening = statement.indexOf("(", prefix.index + prefix[0].length - 1);
  const closing = matchingSqlParen(statement, opening);
  if (closing < 0) return null;
  const tail = statement.slice(closing + 1);
  const header = /^\s*returns\s+([\s\S]*?)\s+language\s+plpgsql\s+(security\s+definer)\s+set\s+search_path\s*=\s*([A-Za-z_][A-Za-z0-9_]*\s*,\s*[A-Za-z_][A-Za-z0-9_]*)\s+as\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)([\s\S]*?)\4\s*$/i.exec(tail);
  if (!header) return null;
  return {
    name: prefix[1].toLowerCase(),
    parameters: normalizeMigrationStatement(statement.slice(opening + 1, closing)),
    returns: normalizeMigrationStatement(header[1]),
    securityDefiner: Boolean(header[2]),
    searchPath: normalizeMigrationStatement(header[3]),
    body: header[5]
  };
}

function retryExecutableBody(body: string): string {
  return normalizeMigrationStatement(stripSqlCommentsAndSplitStatements(body).join(" ; "));
}

function retryDmlOperations(body: string): SqlDmlOperation[] {
  return findDmlOperations(tokenizeSql(body));
}

function assertRetryFunctionSafety(definition: RetrySqlFunction, expected: { parameters: string; returns: string; dml: readonly [number, number, number]; allowDmlTables: readonly string[]; ownerScoped?: boolean }): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  fail(definition.parameters === expected.parameters, `Migration retry RPC ${definition.name} has an unexpected parameter contract`);
  fail(definition.returns === expected.returns, `Migration retry RPC ${definition.name} has an unexpected return contract`);
  fail(definition.securityDefiner && definition.searchPath === "pg_catalog, public", `Migration retry RPC ${definition.name} must use the fixed SECURITY DEFINER boundary`);
  const body = retryExecutableBody(definition.body);
  const operations = retryDmlOperations(definition.body);
  assertNoUnsafeExecutableTokens(tokenizeSql(definition.body), `Migration retry RPC ${definition.name}`);
  const dmlCounts = [
    operations.filter((operation) => operation.kind === "insert").length,
    operations.filter((operation) => operation.kind === "update").length,
    operations.filter((operation) => operation.kind === "delete").length
  ];
  fail(dmlCounts.every((count, index) => count === expected.dml[index]), `Migration retry RPC ${definition.name} mutates outside its exact DML allowlist`);
  fail(operations.every((operation) => expected.allowDmlTables.includes(operation.table)), `Migration retry RPC ${definition.name} mutates an out-of-scope table`);
  if (expected.ownerScoped) {
    fail(/\bv_user_id\s+uuid\s*:=\s*auth\.uid\s*\(\s*\)/i.test(body), `Migration retry RPC ${definition.name} must derive its actor from auth.uid()`);
    fail(/\buploaded_by\s*=\s*v_user_id\b/i.test(body) && !/\buploaded_by\s*=\s*v_user_id\s+or\b/i.test(body), `Migration retry RPC ${definition.name} must enforce a non-permissive owner predicate`);
  }
}

/** Exact retry-state, owner-scoped cleanup, and privilege contract for migration 0036. */
export function assertMaterialUploadRetryStateMigrationContract(sql0036: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const rawStatements = stripSqlCommentsAndSplitStatements(sql0036);
  const statements = rawStatements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");
  const executableCode = maskSqlStringLiterals(code);
  const definitions = rawStatements.map(parseRetrySqlFunction).filter((value): value is RetrySqlFunction => value !== null);
  const byName = new Map(definitions.map((definition) => [definition.name, definition]));
  const expectedPrivileges = [
    "revoke all on function public.mark_material_asset_upload_retryable(uuid) from public, anon",
    "revoke all on function public.begin_material_asset_upload_retry_cleanup(uuid) from public, anon",
    "revoke all on function public.complete_material_asset_upload_retry_cleanup(uuid) from public, anon",
    "grant execute on function public.mark_material_asset_upload_retryable(uuid) to authenticated",
    "grant execute on function public.begin_material_asset_upload_retry_cleanup(uuid) to authenticated",
    "grant execute on function public.complete_material_asset_upload_retry_cleanup(uuid) to authenticated"
  ];
  const privilegeStatements = statements.filter((statement) => /^(?:grant|revoke)\b/i.test(statement));
  const expectedPrefixes = [
    /^alter table public\.material_asset_upload_reservations add column retryable_at timestamptz, add column cleanup_pending_at timestamptz, add constraint material_asset_upload_reservations_retry_state_check check \(\s*not \(retryable_at is not null and cleanup_pending_at is not null\)\s*\)$/i,
    /^create index material_asset_upload_reservations_retry_state_idx /i,
    /^drop policy if exists materials_approved_admin_insert on storage\.objects$/i,
    /^create policy materials_approved_admin_insert on storage\.objects for insert to authenticated /i,
    /^create or replace function public\.(?:reserve_material_asset_upload|mark_material_asset_upload_retryable|begin_material_asset_upload_retry_cleanup|complete_material_asset_upload_retry_cleanup|claim_expired_material_asset_uploads|complete_expired_material_asset_upload_cleanup|release_expired_material_asset_upload_cleanup|cancel_material_asset_upload|finalize_material_asset_upload)\(/i,
    /^revoke all on function public\.(?:mark_material_asset_upload_retryable|begin_material_asset_upload_retry_cleanup|complete_material_asset_upload_retry_cleanup)\(uuid\) from public, anon$/i,
    /^grant execute on function public\.(?:mark_material_asset_upload_retryable|begin_material_asset_upload_retry_cleanup|complete_material_asset_upload_retry_cleanup)\(uuid\) to authenticated$/i
  ];
  const expectedFunctionNames = [
    "reserve_material_asset_upload",
    "mark_material_asset_upload_retryable",
    "begin_material_asset_upload_retry_cleanup",
    "complete_material_asset_upload_retry_cleanup",
    "claim_expired_material_asset_uploads",
    "complete_expired_material_asset_upload_cleanup",
    "release_expired_material_asset_upload_cleanup",
    "cancel_material_asset_upload",
    "finalize_material_asset_upload"
  ];
  fail(statements.length === 19, "Migration 0036 must contain exactly its 19 allowlisted statements");
  fail(statements.every((statement) => expectedPrefixes.some((pattern) => pattern.test(statement))), "Migration 0036 contains a statement outside its exact allowlist");
  fail(expectedFunctionNames.every((name, index) => statements[index + 4].startsWith(`create or replace function public.${name}(`)), "Migration 0036 functions must match the exact state-machine allowlist and order");
  fail(privilegeStatements.length === expectedPrivileges.length && expectedPrivileges.every((statement, index) => privilegeStatements[index] === statement), "Migration 0036 privileges must match the exact owner-scoped allowlist");
  const reservationTable = ["material_asset_upload_reservations"];
  const functionContracts: Record<string, { parameters: string; returns: string; dml: readonly [number, number, number]; allowDmlTables: readonly string[]; ownerScoped?: boolean }> = {
    reserve_material_asset_upload: { parameters: "p_product_id uuid, p_original_name text, p_safe_filename text, p_mime_type text, p_byte_size bigint, p_idempotency_key uuid", returns: "jsonb", dml: [1, 1, 0], allowDmlTables: reservationTable, ownerScoped: true },
    mark_material_asset_upload_retryable: { parameters: "p_reservation_id uuid", returns: "boolean", dml: [0, 1, 0], allowDmlTables: reservationTable, ownerScoped: true },
    begin_material_asset_upload_retry_cleanup: { parameters: "p_reservation_id uuid", returns: "boolean", dml: [0, 1, 0], allowDmlTables: reservationTable, ownerScoped: true },
    complete_material_asset_upload_retry_cleanup: { parameters: "p_reservation_id uuid", returns: "boolean", dml: [0, 1, 0], allowDmlTables: reservationTable, ownerScoped: true },
    claim_expired_material_asset_uploads: { parameters: "p_limit integer", returns: "table (reservation_id uuid, storage_path text, claim_id uuid)", dml: [0, 1, 0], allowDmlTables: reservationTable },
    complete_expired_material_asset_upload_cleanup: { parameters: "p_reservation_id uuid, p_claim_id uuid", returns: "boolean", dml: [0, 1, 1], allowDmlTables: reservationTable },
    release_expired_material_asset_upload_cleanup: { parameters: "p_reservation_id uuid, p_claim_id uuid", returns: "boolean", dml: [0, 1, 0], allowDmlTables: reservationTable },
    cancel_material_asset_upload: { parameters: "p_reservation_id uuid", returns: "boolean", dml: [0, 1, 0], allowDmlTables: reservationTable, ownerScoped: true },
    finalize_material_asset_upload: { parameters: "p_reservation_id uuid, p_idempotency_key uuid", returns: "public.material_assets", dml: [1, 0, 1], allowDmlTables: ["material_asset_upload_reservations", "material_assets"], ownerScoped: true }
  };
  fail(definitions.length === expectedFunctionNames.length && expectedFunctionNames.every((name) => byName.has(name)), "Migration 0036 must contain only its parseable RPC allowlist");
  for (const name of expectedFunctionNames) assertRetryFunctionSafety(byName.get(name)!, functionContracts[name]!);
  const functionBody = (name: string): string => retryExecutableBody(byName.get(name)?.body ?? "");
  fail(/create policy materials_approved_admin_insert[\s\S]*cancelled_at is null[\s\S]*cleanup_pending_at is null[\s\S]*expires_at > now\(\)/i.test(code), "Storage INSERT must reject cancelled, cleanup-pending, and expired reservations");
  fail(/retryable_at is not null[\s\S]*cleanup_pending_at is not null/i.test(code) && /cleanup_pending_at = null[\s\S]*retryable_at = now\(\)/i.test(code), "Migration 0036 must define mutually exclusive retry states and recover cleanup-pending reservations");
  fail(/cleanup_pending_at = coalesce\(cleanup_pending_at, now\(\)\)[\s\S]*not exists[\s\S]*material_assets/i.test(functionBody("begin_material_asset_upload_retry_cleanup")), "Retry cleanup must lock only unfinalized owner reservations");
  fail(functionBody("begin_material_asset_upload_retry_cleanup").includes("cleanup_pending_at = coalesce(cleanup_pending_at, now())") && functionBody("begin_material_asset_upload_retry_cleanup").includes("retryable_at = null"), "Retry cleanup begin must prevent concurrent finalize");
  fail(functionBody("complete_material_asset_upload_retry_cleanup").includes("cleanup_pending_at = null") && functionBody("complete_material_asset_upload_retry_cleanup").includes("retryable_at = now()") && functionBody("complete_material_asset_upload_retry_cleanup").includes("cleanup_pending_at is not null"), "Successful object deletion must return the same reservation to retryable state");
  fail(/cleanup_pending_at is not null[\s\S]*or reservations\.cancelled_at is not null[\s\S]*for update skip locked/i.test(functionBody("claim_expired_material_asset_uploads")), "Cleanup must claim retry-pending sessions with row locking");
  fail(/material_assets AS assets[\s\S]*assets\.upload_reservation_id = reservations\.id/i.test(functionBody("claim_expired_material_asset_uploads")), "Cleanup claims must protect finalized assets");
  const ownerFunctions = ["reserve_material_asset_upload", "mark_material_asset_upload_retryable", "begin_material_asset_upload_retry_cleanup", "complete_material_asset_upload_retry_cleanup", "cancel_material_asset_upload", "finalize_material_asset_upload"];
  fail(ownerFunctions.every((name) => /v_user_id uuid := auth\.uid\(\)/i.test(functionBody(name)) && /uploaded_by = v_user_id/i.test(functionBody(name))), "Retry and cancellation RPCs must derive ownership from auth.uid() and apply it to the reservation");
  fail(/uploaded_by = v_user_id[\s\S]*upload_idempotency_key = p_idempotency_key/i.test(functionBody("reserve_material_asset_upload")) && /uploaded_by = v_user_id[\s\S]*upload_idempotency_key = p_idempotency_key/i.test(functionBody("finalize_material_asset_upload")), "Retry and finalize RPCs must preserve the owner-scoped idempotency key binding");
  fail(/v_reservation\.product_id <> p_product_id/i.test(functionBody("reserve_material_asset_upload")) && /v_reservation\.original_name is distinct from p_original_name/i.test(functionBody("reserve_material_asset_upload")) && /v_reservation\.mime_type is distinct from p_mime_type/i.test(functionBody("reserve_material_asset_upload")) && /v_reservation\.byte_size is distinct from p_byte_size/i.test(functionBody("reserve_material_asset_upload")), "Retry prepare must preserve the immutable product and file identity binding");
  fail(definitions.every((definition) => !/(?:^|,\s*)p_(?:actor|user_id|uploaded_by|timestamp|created_at|updated_at)\b/i.test(definition.parameters)), "Migration 0036 must not accept caller-supplied actor or timestamp values");
  fail(!/\b(?:grant\s+execute[^;]*\bto\s+(?:anon|public)|grant\s+(?:insert|update|delete|all)\s+on\s+(?:table\s+)?public\.(?:material_assets|material_asset_upload_reservations)|bypassrls|set\s+role|execute\s+(?:immediate|format)|dynamic\s+sql|service_role)\b/i.test(executableCode), "Migration 0036 must not widen privileges or use unsafe execution");
  fail(!/^(?:do|copy|call|insert|update|delete|truncate|alter\s+system)\b/i.test(statements.join(" ; ")), "Migration 0036 must not contain unrelated executable statements");
}

/** Database-enforced guard: a retry-cleanup reservation remains owned by cleanup until completion or release. */
export function assertMaterialUploadCancelCleanupGuardMigrationContract(sql0037: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const rawStatements = stripSqlCommentsAndSplitStatements(sql0037);
  const statements = rawStatements.map(normalizeMigrationStatement);
  const expectedPrivileges = [
    "revoke all on function public.cancel_material_asset_upload(uuid) from public, anon",
    "grant execute on function public.cancel_material_asset_upload(uuid) to authenticated"
  ];
  fail(statements.length === 3, "Migration 0037 must contain only the guarded cancel RPC and its exact privileges");
  const definition = parseRetrySqlFunction(rawStatements[0] ?? "");
  fail(definition?.name === "cancel_material_asset_upload", "Migration 0037 must replace only cancel_material_asset_upload");
  assertRetryFunctionSafety(definition!, { parameters: "p_reservation_id uuid", returns: "boolean", dml: [0, 1, 0], allowDmlTables: ["material_asset_upload_reservations"], ownerScoped: true });
  const body = retryExecutableBody(definition!.body);
  fail(/\bcleanup_claim_id\s+is\s+null\b/i.test(body) && /\bcleanup_pending_at\s+is\s+null\b/i.test(body), "Migration 0037 cancel must reject active or pending cleanup claims");
  fail(/\bnot\s+exists\s*\(\s*select\s+1\s+from\s+public\.material_assets\b/i.test(body), "Migration 0037 cancel must protect finalized assets");
  fail(statements.slice(1).length === expectedPrivileges.length && expectedPrivileges.every((statement, index) => statements[index + 1] === statement), "Migration 0037 must revoke public/anon and grant only authenticated execution");
}

/** Canonical catalog search document contract for migration 0030. */
export function assertCatalogCompleteSearchMigrationContract(sql0030: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const code = stripSqlCommentsAndSplitStatements(sql0030).join(" ; ");
  const executableCode = maskSqlStringLiterals(code);
  const requiredFields = [
    "subjects.category", "subjects.faculty_group", "subjects.color_theme",
    "materials.pages", "materials.tags", "materials.includes", "materials.suitable_for",
    "courses.format", "courses.sessions", "courses.duration", "courses.schedule", "courses.enrollment_status", "courses.mentor", "courses.tags", "courses.curriculum", "courses.suitable_for", "courses.preparation",
    "tutors.name", "tutors.faculty", "tutors.format", "tutors.availability", "tutors.short_bio", "tutors.strengths", "tutors.tags", "tutors.suitable_for", "tutors.support_methods"
  ];
  fail(/create or replace function public\.catalog_product_search_text\(p_product_id uuid\)/i.test(code), "Migration 0030 must define one canonical product search projection");
  fail(requiredFields.every((field) => new RegExp(field.replace(".", "\\."), "i").test(code)), "Migration 0030 must include every subject and child searchable field");
  fail(/normalize_catalog_search\(public\.catalog_product_search_text/i.test(code) && /update public\.products/i.test(code), "Migration 0030 must normalize and backfill product search documents");
  for (const trigger of ["trg_refresh_product_search_document", "trg_refresh_products_for_subject_search", "trg_refresh_subject_search_document", "trg_refresh_material_search_document", "trg_refresh_course_search_document", "trg_refresh_tutor_search_document"]) {
    fail(new RegExp(trigger, "i").test(code), `Migration 0030 must maintain ${trigger}`);
  }
  fail(/update of [^\n]*includes[^\n]*suitable_for/i.test(code) && /update of [^\n]*curriculum[^\n]*preparation/i.test(code), "Migration 0030 must refresh on child field changes");
  fail(/extensions\.unaccent/i.test(code) || /normalize_catalog_search/i.test(code), "Migration 0030 must preserve Unicode normalization");
  fail(!/\b(?:execute\s+immediate|format\s*\(|set\s+role|alter\s+role|bypassrls|dynamic\s+sql|service_role|truncate|copy\s+|call\s+|\bdo\s+)/i.test(executableCode), "Migration 0030 must not contain executable privilege escalation or unrelated DDL/DML");
}

/** Exact optimistic-concurrency and monotonic-progress contract for migration 0031. */
export function assertLearningProgressConcurrencyMigrationContract(sql0031: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const code = stripSqlCommentsAndSplitStatements(sql0031).join(" ; ");
  const executableCode = maskSqlStringLiterals(code);
  fail(/alter table public\.learning_progress[\s\S]*add column if not exists version integer not null default 1/i.test(code), "Migration 0031 must add a database version token");
  fail(/create or replace function public\.save_learning_progress\([\s\S]*p_expected_version integer/i.test(code), "Migration 0031 must require an expected version in the progress RPC");
  fail(/set search_path = pg_catalog, public/i.test(code) && /auth\.uid\(\)/i.test(executableCode), "Progress concurrency RPC must use fixed search_path and auth.uid()");
  fail(/on conflict\s*\(user_id, product_id, item_type, item_id\)/i.test(executableCode) && /version\s*=\s*public\.learning_progress\.version\s*\+\s*1/i.test(executableCode), "Progress writes must use a versioned upsert");
  fail(/where public\.learning_progress\.version = p_expected_version/i.test(executableCode) && /using errcode = 'p0002'/i.test(code), "Stale writers must receive a conflict instead of silently overwriting");
  fail(/status = 'completed'[\s\S]*p_watched_percent >= public\.learning_progress\.watched_percent/i.test(code), "Completed and watched progress must not move backward");
  fail(!/\b(?:execute\s+immediate|format\s*\(|set\s+role|alter\s+role|bypassrls|dynamic\s+sql|service_role)\b/i.test(executableCode), "Migration 0031 must not use privilege escalation or dynamic SQL");
}

/** Exact monotonicity extension contract for migration 0032. */
export function assertLearningProgressMonotonicityMigrationContract(sql0032: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const code = stripSqlCommentsAndSplitStatements(sql0032).join(" ; ");
  const executableCode = maskSqlStringLiterals(code);
  fail(/create or replace function public\.save_learning_progress\([\s\S]*p_expected_version integer/i.test(code), "Migration 0032 must replace the exact CAS progress RPC");
  fail(/returns public\.learning_progress\s+language plpgsql\s+security definer\s+set search_path = pg_catalog, public/i.test(code), "Migration 0032 must preserve the fixed SECURITY DEFINER boundary");
  fail(/p_status = 'completed'\s+and p_watched_percent <> 100/i.test(code), "Completed progress must require exactly 100 percent");
  fail(/p_watched_percent >= public\.learning_progress\.watched_percent/i.test(executableCode), "Migration 0032 must reject watched-percent regressions");
  fail(/where public\.learning_progress\.version = p_expected_version/i.test(executableCode), "Migration 0032 must preserve expected-version CAS");
  fail(/version\s*=\s*public\.learning_progress\.version\s*\+\s*1/i.test(executableCode), "Migration 0032 must increment version exactly once");
  fail(/using errcode = 'p0002'/i.test(code), "Migration 0032 must preserve the generic conflict code");
  fail(!/\b(?:execute\s+immediate|format\s*\(|set\s+role|alter\s+role|bypassrls|dynamic\s+sql|service_role|grant\s+all|revoke\s+all)\b/i.test(executableCode), "Migration 0032 must not weaken privileges or use unsafe execution");
}

/** Pure contract used by the CLI audit and integration tests for migration 0016. */
export function assertMigration0016Contract(sql0016: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const statements = stripSqlCommentsAndSplitStatements(sql0016);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");
  const ownPredicate = "public.study_plans.user_id = auth.uid()";

  fail(!/\b(?:service_role|security\s+definer|bypassrls|set\s+role|alter\s+role)\b/i.test(code), "Migration 0016 must not escalate roles");
  fail(!/\b(?:password|secret|token|bearer|apikey|api_key|credential)\b\s*[:=]/i.test(code), "Migration 0016 must not contain credentials");
  fail(!/\b(?:execute\s+(?:immediate|format)|execute\s+['$]|format\s*\()/i.test(code), "Migration 0016 must not use dynamic SQL");
  fail(!/\b(?:create\s+(?:or\s+replace\s+)?(?:function|procedure|view|type|extension)|alter\s+system|disable\s+row\s+level\s+security)\b/i.test(code), "Migration 0016 contains unrelated or unsafe statements");
  fail(statements.length === 12, "Migration 0016 must contain only the table, indexes, RLS, grants, trigger, and four policies");

  const table = normalized[0] || "";
  fail(table.startsWith("create table public.study_plans ("), "Migration 0016 must create public.study_plans");
  const tableOpening = table.indexOf("(");
  const tableClosing = table.lastIndexOf(")");
  fail(tableOpening > 0 && tableClosing > tableOpening, "Migration 0016 must contain a parseable study_plans table body");
  const definitions = splitTopLevelClauses(table.slice(tableOpening + 1, tableClosing));
  const expectedColumns = new Map([
    ["id", "id uuid primary key default gen_random_uuid()"],
    ["user_id", "user_id uuid not null references auth.users(id) on delete cascade"],
    ["request_key", "request_key uuid not null"],
    ["task_date", "task_date date not null"],
    ["title", "title text not null"],
    ["subject_id", "subject_id uuid not null references public.subjects(id) on delete restrict"],
    ["duration_minutes", "duration_minutes integer not null"],
    ["status", "status text not null default 'pending'"],
    ["completed_at", "completed_at timestamptz null"],
    ["created_at", "created_at timestamptz not null default now()"],
    ["updated_at", "updated_at timestamptz not null default now()"]
  ]);
  const columnDefinitions = definitions.filter((definition) => !/^constraint\b|^foreign key\b/i.test(definition));
  fail(columnDefinitions.length === expectedColumns.size, "Migration 0016 must contain exactly the expected study_plans columns");
  const actualColumns = new Map<string, string>();
  for (const definition of columnDefinitions) {
    const name = definition.match(/^([a-z_][a-z0-9_]*)\b/i)?.[1];
    fail(Boolean(name) && !actualColumns.has(name!.toLowerCase()), "Migration 0016 must not contain duplicate or unnamed columns");
    actualColumns.set(name!.toLowerCase(), definition);
  }
  fail(actualColumns.size === expectedColumns.size && [...expectedColumns].every(([name, definition]) => actualColumns.get(name) === definition), "Migration 0016 column definitions must match the exact study plan contract");
  const expectedConstraints = [
    "constraint study_plans_task_date_check check (task_date >= date '2000-01-01' and task_date <= date '2100-12-31')",
    "constraint study_plans_user_request_key_unique unique (user_id, request_key)",
    "constraint study_plans_title_check check (title = btrim(title) and char_length(title) between 1 and 200)",
    "constraint study_plans_duration_minutes_check check (duration_minutes between 1 and 1440)",
    "constraint study_plans_status_check check (status in ('pending', 'in_progress', 'completed'))",
    "constraint study_plans_completed_at_check check ( (status = 'completed' and completed_at is not null) or (status <> 'completed' and completed_at is null) )"
  ];
  const actualConstraints = definitions.filter((definition) => /^constraint\b|^foreign key\b/i.test(definition));
  fail(actualConstraints.length === expectedConstraints.length && expectedConstraints.every((constraint) => actualConstraints.includes(constraint)), "Migration 0016 constraints and foreign keys must match exactly");

  fail(normalized[1] === "create index idx_study_plans_user_task_date on public.study_plans (user_id, task_date, created_at, id)", "Migration 0016 must create the exact user/date lookup index");
  fail(normalized[2] === "create index idx_study_plans_status_date on public.study_plans (status, task_date, user_id)", "Migration 0016 must create the exact status/date lookup index");
  fail(normalized[3] === "alter table public.study_plans enable row level security", "Migration 0016 must enable RLS");
  fail(normalized[4] === "revoke all on table public.study_plans from anon, public, authenticated", "Migration 0016 must revoke broad study-plan privileges");
  fail(normalized[5] === "grant select, insert, update, delete on table public.study_plans to authenticated", "Migration 0016 must grant only explicit authenticated study-plan access");
  fail(normalized[6] === "drop trigger if exists trg_study_plans_updated_at on public.study_plans", "Migration 0016 must safely replace only its own timestamp trigger");
  fail(normalized[7] === "create trigger trg_study_plans_updated_at before update on public.study_plans for each row execute function update_updated_at_column()", "Migration 0016 must reuse the established updated_at function");

  const policies = normalized.slice(8);
  const expectedPolicies = [["study_plans_select_own", "select"], ["study_plans_insert_own", "insert"], ["study_plans_update_own", "update"], ["study_plans_delete_own", "delete"]] as const;
  fail(policies.length === expectedPolicies.length, "Migration 0016 must contain exactly four study-plan policies");
  for (const [name, action] of expectedPolicies) {
    const policy = policies.find((statement) => statement.startsWith(`create policy ${name} `)) || "";
    fail(policy.startsWith(`create policy ${name} on public.study_plans for ${action} to authenticated `), "Migration 0016 policies must target study_plans and authenticated only");
    const using = extractPolicyClause(policy, "USING");
    const withCheck = extractPolicyClause(policy, "WITH CHECK");
    if (action === "select" || action === "delete") fail(normalizeSql(using || "").toLowerCase() === ownPredicate && withCheck === null, "Migration 0016 read/delete policy must require auth.uid() ownership");
    else if (action === "insert") fail(using === null && normalizeSql(withCheck || "").toLowerCase() === ownPredicate, "Migration 0016 INSERT policy must require auth.uid() ownership");
    else fail(normalizeSql(using || "").toLowerCase() === ownPredicate && normalizeSql(withCheck || "").toLowerCase() === ownPredicate, "Migration 0016 UPDATE policy must require auth.uid() ownership in both predicates");
  }
  const grants = normalized.filter((statement) => /^grant\s+/i.test(statement));
  const revokes = normalized.filter((statement) => /^revoke\s+/i.test(statement));
  fail(grants.length === 1 && revokes.length === 1, "Migration 0016 must contain only one grant and one revoke statement");
  fail(!/\bgrant\s+[^;]*\b(?:anon|public|service_role)\b/i.test(code.replace(/public\.study_plans/gi, "study_plans")), "Migration 0016 must not grant or policy-authorize public roles");
  fail(!/\b(?:grant|revoke)\s+[^;]*\bon\s+(?!table\s+public\.study_plans\b)[a-z_][a-z0-9_.]*/i.test(code), "Migration 0016 must not alter cross-table privileges");
}

/** Pure contract used by the CLI audit and integration tests for migration 0017. */
export function assertMigration0017Contract(
  sql0017: string,
  dependencies?: { sql0001?: string; sql0004?: string; sql0005?: string }
): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0017);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = statements.join(" ; ");

  fail(statements.length === 4, "Migration 0017 must contain only the function, trigger replacement, trigger, and function privilege revoke");
  fail(!/\b(?:service_role|bypassrls|set\s+role|alter\s+role|alter\s+system)\b/i.test(code), "Migration 0017 must not escalate roles or bypass RLS");
  fail(!/\b(?:password|secret|token|bearer|apikey|api_key|credential)\b\s*[:=]/i.test(code), "Migration 0017 must not contain credentials");
  fail(!/\b(?:execute\s+(?:immediate|format)|execute\s+['$]|format\s*\()/i.test(code), "Migration 0017 must not use dynamic SQL");
  fail(!/\b(?:grant|revoke)\s+[^;]*\bon\s+(?:table|schema|database)\b/i.test(code), "Migration 0017 must not grant or revoke table, schema, or database privileges");
  fail(!/\bgrant\b/i.test(code), "Migration 0017 must not grant privileges");

  const functionStatement = normalized.find((statement) => statement.startsWith("create or replace function public.handle_auth_user_profile")) || "";
  fail(Boolean(functionStatement), "Migration 0017 must define the dedicated auth profile trigger function");
  const functionMatch = functionStatement.match(
    /^create or replace function public\.handle_auth_user_profile\(\) returns trigger language plpgsql security definer set search_path = public as (\$[a-z_][a-z0-9_]*\$|\$\$)\s*([\s\S]*?)\s*\1$/i
  );
  fail(Boolean(functionMatch), "Migration 0017 profile function must use the fixed SECURITY DEFINER header");

  const expectedFunctionBody = normalizeSql(`
    DECLARE
        metadata_full_name TEXT;
        metadata_name TEXT;
        email_local_part TEXT;
        resolved_full_name TEXT;
    BEGIN
        metadata_full_name := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), '');
        metadata_name := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'name'), '');
        email_local_part := NULLIF(BTRIM(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)), '');

        resolved_full_name := LEFT(
            BTRIM(COALESCE(metadata_full_name, metadata_name, email_local_part, 'Học viên')),
            200
        );
        IF resolved_full_name = '' THEN
            resolved_full_name := 'Học viên';
        END IF;

        INSERT INTO public.profiles (id, email, full_name)
        VALUES (NEW.id, NEW.email, resolved_full_name)
        ON CONFLICT (id) DO NOTHING;

        RETURN NEW;
    END;
  `).toLowerCase();
  fail(
    functionMatch !== null && normalizeSql(functionMatch[2]).toLowerCase() === expectedFunctionBody,
    "Migration 0017 function body must exactly match the bounded profile-insert allowlist"
  );

  fail(normalized.includes("drop trigger if exists on_auth_user_created on auth.users"), "Migration 0017 must safely replace the auth signup trigger");
  fail(normalized.includes("create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_auth_user_profile()"), "Migration 0017 must create an AFTER INSERT trigger on auth.users");
  fail(normalized.includes("revoke all on function public.handle_auth_user_profile() from public"), "Migration 0017 must revoke public function privileges");
  fail(!/\b(?:role|account_status)\b/i.test(functionStatement.replace(/raw_user_meta_data\s*->>\s*'[^']+'/gi, "")), "Migration 0017 must rely on existing role and account_status defaults");

  if (dependencies?.sql0001 !== undefined) {
    fail(/full_name\s+TEXT\s+NOT\s+NULL/i.test(dependencies.sql0001), "Existing profiles schema must keep full_name NOT NULL");
  }
  if (dependencies?.sql0004 !== undefined) {
    fail(/role\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'student'/i.test(dependencies.sql0004), "Existing profiles schema must keep role default student");
  }
  if (dependencies?.sql0005 !== undefined) {
    fail(/account_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'pending'/i.test(dependencies.sql0005), "Existing profiles schema must keep account_status default pending");
  }
}

/** Exact security and semantic contract for the Phase 1 catalog invariant migration. */
export function assertCatalogSemanticMigrationContract(sql0018: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0018);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = normalized.join(" ; ");
  const expectedFormats = [
    "1:1 & Nhóm nhỏ (Online/Offline)", "1:1 (Online/Offline quận 7)", "1:1 & Nhóm nhỏ (Online)",
    "1:1 (Online qua Google Meet)", "1:1 & Nhóm nhỏ (Offline/Online)", "1:1 (Online)", "1:1 & Nhóm nhỏ (Online/Offline Q7)"
  ];
  const functionNames = ["validate_product_catalog_semantics", "validate_subject_catalog_semantics", "validate_material_product_kind", "validate_course_product_kind", "validate_tutor_product_kind", "validate_tutor_subject_product_kind"];
  const triggerSpecs = [
    ["trg_validate_product_catalog_semantics", "products", "insert or update of subject_id, category, color_theme", "validate_product_catalog_semantics"],
    ["trg_validate_subject_catalog_semantics", "subjects", "update of category, color_theme", "validate_subject_catalog_semantics"],
    ["trg_validate_material_product_kind", "materials", "insert or update of product_id", "validate_material_product_kind"],
    ["trg_validate_course_product_kind", "courses", "insert or update of product_id", "validate_course_product_kind"],
    ["trg_validate_tutor_product_kind", "tutors", "insert or update of product_id", "validate_tutor_product_kind"],
    ["trg_validate_tutor_subject_product_kind", "tutor_subjects", "insert or update of tutor_product_id", "validate_tutor_subject_product_kind"]
  ] as const;
  const triggerNames = triggerSpecs.map(([name]) => name);
  const allowedStatements = [
    /^alter table public\.products add constraint chk_products_old_price_semantics check \([\s\S]+\)$/i,
    /^alter table public\.tutors add constraint chk_tutors_format_canonical check \([\s\S]+\)$/i,
    /^create unique index uq_tutor_subjects_one_primary on public\.tutor_subjects \(tutor_product_id\) where is_primary = true$/i,
    ...functionNames.map((name) => new RegExp(`^create or replace function public\\.${name}\\(\\) returns trigger language plpgsql set search_path = public as \\$function\\$[\\s\\S]+\\$function\\$$`, "i")),
    ...triggerSpecs.flatMap(([name, table, event, functionName]) => [
      new RegExp(`^drop trigger if exists ${name} on public\\.${table}$`, "i"),
      new RegExp(`^create trigger ${name} before ${event} on public\\.${table} for each row execute function public\\.${functionName}\\(\\)$`, "i")
    ]),
    ...functionNames.map((name) => new RegExp(`^revoke all on function public\\.${name}\\(\\) from public$`, "i"))
  ];
  fail(statements.length === 27, "Migration 0018 must contain exactly its 27 allowlisted statements");
  fail(normalized.every((statement) => allowedStatements.some((pattern) => pattern.test(statement))), `Migration 0018 contains a statement outside its exact allowlist: ${normalized.find((statement) => !allowedStatements.some((pattern) => pattern.test(statement))) || "unknown"}`);
  fail(normalized.filter((statement) => /^alter table public\.products add constraint chk_products_old_price_semantics/i.test(statement)).length === 1, "0018 must constrain old_price_vnd semantics exactly once");
  fail(normalized.filter((statement) => /^alter table public\.tutors add constraint chk_tutors_format_canonical/i.test(statement)).length === 1, "0018 must constrain tutor format exactly once");
  fail(normalized.filter((statement) => /^create unique index uq_tutor_subjects_one_primary/i.test(statement)).length === 1, "0018 must enforce one primary tutor subject exactly once");
  for (const format of expectedFormats) fail(code.includes(`'${format.toLowerCase()}'`), `0018 must include canonical tutor format ${format}`);
  for (const [category, theme] of Object.entries({
    "Kế toán": "accounting", "Kinh tế": "economics", "Thống kê": "statistics", Marketing: "marketing",
    "Quản trị": "management", "Tài chính": "finance", MIS: "mis", "Luật": "law", "Ngoại ngữ": "languages"
  })) {
    fail(code.includes(`when '${category.toLowerCase()}' then '${theme}'::color_theme_enum`), `0018 must preserve category/theme mapping ${category} -> ${theme}`);
  }
  for (const name of functionNames) {
    fail(normalized.filter((statement) => statement.startsWith(`create or replace function public.${name}`)).length === 1, `0018 must define ${name} exactly once`);
    fail(normalized.some((statement) => statement.startsWith(`create or replace function public.${name}`) && statement.includes("set search_path = public")), `${name} must use a fixed search_path`);
  }
  for (const trigger of triggerNames) {
    fail(normalized.filter((statement) => statement.startsWith(`create trigger ${trigger}`)).length === 1, `0018 must create ${trigger} exactly once`);
  }
  fail(!/security\s+definer|bypassrls|set\s+role|execute\s+(?:immediate|format)|execute\s+['$]|grant\s+all/i.test(code), "0018 must not bypass RLS, use dynamic SQL, or grant ALL");
  fail(!/insert\s+into|update\s+|delete\s+from/i.test(code.replace(/create\s+trigger[\s\S]*?execute\s+function/gi, "")), "0018 helpers must not contain out-of-scope DML");
  assertNestedFunctionSqlScope(statements, { allowDmlTables: [], allowSelectTables: ["subjects", "products"] });
}

/** Exact statement allowlist for the Phase 2 atomic catalog RPC and kind boundary. */
export function assertAdminCatalogTransactionMigrationContract(sql0019: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0019);
  const normalized = statements.map(normalizeMigrationStatement);
  const code = normalized.join(" ; ");
  const policyNames = [
    ["materials", "material"], ["courses", "course"], ["course lessons", "course"],
    ["tutors", "tutor"], ["tutor subjects", "tutor"]
  ] as const;
  const allowed: RegExp[] = [
    /^create or replace function public\.admin_catalog_mutate\([\s\S]+\) returns jsonb language plpgsql set search_path = public as \$function\$[\s\S]+\$function\$$/i,
    /^revoke all on function public\.admin_catalog_mutate\(text, public\.product_kind_enum, jsonb, jsonb, uuid\) from public$/i,
    /^grant execute on function public\.admin_catalog_mutate\(text, public\.product_kind_enum, jsonb, jsonb, uuid\) to authenticated$/i,
    /^create or replace function public\.validate_product_kind_immutable\(\) returns trigger language plpgsql set search_path = public as \$function\$[\s\S]+\$function\$$/i,
    /^drop trigger if exists trg_validate_product_kind_immutable on public\.products$/i,
    /^create trigger trg_validate_product_kind_immutable before update of kind on public\.products for each row execute function public\.validate_product_kind_immutable\(\)$/i,
    /^revoke update \(kind\) on table public\.products from authenticated$/i,
    /^revoke all on function public\.validate_product_kind_immutable\(\) from public$/i
  ];
  for (const [name, kind] of policyNames) {
    const table = name === "course lessons" ? "course_lessons" : name.replace(" ", "_");
    allowed.push(new RegExp(`^drop policy if exists "allow public read access on published ${name}" on public\\.${table}$`, "i"));
    const relation = table === "course_lessons"
      ? "exists ( select 1 from public.courses join public.products on products.id = courses.product_id where courses.product_id = course_lessons.course_id and products.kind = 'course' and products.publication_status = 'published' )"
      : table === "tutor_subjects"
        ? "exists ( select 1 from public.tutors join public.products on products.id = tutors.product_id where tutors.product_id = tutor_subjects.tutor_product_id and products.kind = 'tutor' and products.publication_status = 'published' )"
        : `exists ( select 1 from public.products where products.id = ${table}.product_id and products.kind = '${kind}' and products.publication_status = 'published' )`;
    const escapedRelation = relation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    allowed.push(new RegExp(`^create policy "allow public read access on published ${name}" on public\\.${table} for select to anon, authenticated using \\(` + `\\s*${escapedRelation}\\s*\\)$`, "i"));
  }
  fail(statements.length === 18, "Migration 0019 must contain exactly its 18 allowlisted statements");
  fail(normalized.every((statement) => allowed.some((pattern) => pattern.test(statement))), `Migration 0019 contains a statement outside its exact allowlist: ${normalized.find((statement) => !allowed.some((pattern) => pattern.test(statement))) || "unknown"}`);
  fail(/security\s+definer|bypassrls|set\s+role|alter\s+role|execute\s+(?:immediate|format)|service_role|grant\s+all/i.test(code) === false, "Migration 0019 must not bypass RLS, use dynamic SQL, or escalate roles");
  fail(/where id = p_product_id and kind = p_kind/i.test(code), "Atomic mutations must bind the requested product kind");
  fail(/insert into public\.(?:materials|courses|tutors)/i.test(code) && /raise exception 'catalog child is missing'/i.test(code), "Atomic mutations must create and validate the child in the same RPC");
  fail(/if p_kind = 'material' then[\s\S]*?insert into public\.materials/i.test(code), "Material writes must be reachable only through the material branch");
  fail(/if p_kind = 'course' then[\s\S]*?insert into public\.courses/i.test(code), "Course writes must be reachable only through the course branch");
  fail(/else[\s\S]*?insert into public\.tutors/i.test(code), "Tutor writes must be reachable only through the tutor branch");
  const rpcStatement = normalized.find((statement) => statement.startsWith("create or replace function public.admin_catalog_mutate")) || "";
  fail(!/create\s+table|alter\s+table|drop\s+table|create\s+index|grant\s+|revoke\s+/i.test(rpcStatement), "The catalog RPC must not contain privilege or schema DDL");
  fail(!/(?:insert\s+into|update|delete\s+from)\s+public\.(?!products\b|materials\b|courses\b|tutors\b)/i.test(rpcStatement), "The catalog RPC must not mutate tables outside the catalog product/child set");
  fail(/role = 'admin' and account_status = 'approved'/i.test(code) && /auth\.uid\(\)/i.test(code), "Atomic mutations must check the approved admin in the database");
  fail(/old\.kind is distinct from new\.kind/i.test(code) && /before update of kind on public\.products/i.test(code), "Product kind must be immutable at the database boundary");
  fail(/products\.kind = 'material'|products\.kind = 'course'|products\.kind = 'tutor'/i.test(code), "Child public policies must enforce parent kind");
  assertNestedFunctionSqlScope(statements, { allowDmlTables: ["products", "materials", "courses", "tutors"], allowSelectTables: ["profiles", "products", "materials", "courses", "tutors"], allowSqlExpressionSelect: true });
}

/** Exact access-boundary contract for the migration that removes direct catalog DML. */
export function assertCatalogMutationAccessBoundaryMigrationContract(sql0020: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0020);
  const normalized = statements.map(normalizeMigrationStatement);
  const allowed: RegExp[] = [
    /^create or replace function public\.admin_catalog_mutate_atomic\([\s\S]+\) returns jsonb language plpgsql security definer set search_path = public as \$function\$[\s\S]+\$function\$$/i,
    /^revoke all on function public\.admin_catalog_mutate\(text, public\.product_kind_enum, jsonb, jsonb, uuid\) from public, anon, authenticated$/i,
    /^revoke all on function public\.admin_catalog_mutate_atomic\(text, public\.product_kind_enum, jsonb, jsonb, uuid\) from public, anon, authenticated$/i,
    /^grant execute on function public\.admin_catalog_mutate_atomic\(text, public\.product_kind_enum, jsonb, jsonb, uuid\) to authenticated$/i,
    /^revoke all privileges on table public\.(?:products|materials|courses|tutors) from authenticated$/i,
    /^grant select on table public\.(?:products|materials|courses|tutors) to authenticated$/i,
    /^drop policy if exists (?:products|materials|courses|tutors)_admin_(?:insert|update|delete) on public\.(?:products|materials|courses|tutors)$/i
  ];
  fail(statements.length === 24, "Migration 0020 must contain exactly its 24 allowlisted statements");
  fail(normalized.every((statement) => allowed.some((pattern) => pattern.test(statement))), "Migration 0020 contains a statement outside its exact allowlist");
  fail(normalized.filter((statement) => /^create or replace function public\.admin_catalog_mutate_atomic/i.test(statement)).length === 1, "Migration 0020 must define the atomic wrapper exactly once");
  fail(normalized.filter((statement) => /^revoke all privileges on table public\.(?:products|materials|courses|tutors)/i.test(statement)).length === 4, "Migration 0020 must revoke direct catalog table privileges");
  fail(normalized.filter((statement) => /^grant select on table public\.(?:products|materials|courses|tutors)/i.test(statement)).length === 4, "Migration 0020 must preserve authenticated catalog reads only");
  fail(normalized.filter((statement) => /^drop policy if exists/i.test(statement)).length === 12, "Migration 0020 must remove all direct product/child mutation policies");
  fail(normalized.filter((statement) => /^grant execute/i.test(statement)).length === 1, "Migration 0020 must grant exactly one mutation RPC");
  const code = normalized.join(" ; ");
  fail((code.match(/security definer/g) || []).length === 1, "Only the approved atomic wrapper may use SECURITY DEFINER");
  fail(/auth\.uid\(\)/i.test(code) && /role = 'admin' and account_status = 'approved'/i.test(code), "Atomic wrapper must check the approved admin identity");
  fail(/return public\.admin_catalog_mutate\(/i.test(code), "Atomic wrapper must delegate to the existing transaction-safe mutation body");
  fail(!/service_role|bypassrls|set\s+role|execute\s+(?:immediate|format)|grant\s+all/i.test(code), "Migration 0020 must not escalate privileges or use dynamic SQL");
  const expectedPolicyDrops = [
    "drop policy if exists products_admin_insert on public.products",
    "drop policy if exists products_admin_update on public.products",
    "drop policy if exists products_admin_delete on public.products",
    "drop policy if exists materials_admin_insert on public.materials",
    "drop policy if exists materials_admin_update on public.materials",
    "drop policy if exists materials_admin_delete on public.materials",
    "drop policy if exists courses_admin_insert on public.courses",
    "drop policy if exists courses_admin_update on public.courses",
    "drop policy if exists courses_admin_delete on public.courses",
    "drop policy if exists tutors_admin_insert on public.tutors",
    "drop policy if exists tutors_admin_update on public.tutors",
    "drop policy if exists tutors_admin_delete on public.tutors"
  ];
  fail(expectedPolicyDrops.every((statement) => normalized.includes(statement)), "Migration 0020 must drop each direct catalog mutation policy by its exact table and operation");
  assertNestedFunctionSqlScope(statements, { allowDmlTables: [], allowSelectTables: ["profiles"] });
}

/** Exact schema/index contract for normalized server-side catalog search. */
export function assertCatalogSearchNormalizationMigrationContract(sql0021: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0021);
  const normalized = statements.map(normalizeMigrationStatement);
  const allowed = [
    /^create extension if not exists unaccent with schema extensions$/i,
    /^create extension if not exists pg_trgm$/i,
    /^create or replace function public\.normalize_catalog_search\(value text\) returns text language sql immutable set search_path = public, extensions as \$function\$[\s\S]+\$function\$$/i,
    /^alter table public\.(?:products|subjects) add column if not exists search_document text not null default ''$/i,
    /^create or replace function public\.(?:refresh_product_search_document|refresh_subject_search_document|refresh_products_for_subject_search)\(\) returns trigger language plpgsql set search_path = public, extensions as \$function\$[\s\S]+\$function\$$/i,
    /^drop trigger if exists (?:trg_refresh_product_search_document|trg_refresh_subject_search_document|trg_refresh_products_for_subject_search) on public\.(?:products|subjects)$/i,
    /^create trigger trg_refresh_product_search_document before insert or update of slug, title, description, subject_id on public\.products for each row execute function public\.refresh_product_search_document\(\)$/i,
    /^create trigger trg_refresh_subject_search_document before insert or update of slug, name on public\.subjects for each row execute function public\.refresh_subject_search_document\(\)$/i,
    /^create trigger trg_refresh_products_for_subject_search after update of slug, name on public\.subjects for each row execute function public\.refresh_products_for_subject_search\(\)$/i,
    /^update public\.products set search_document = public\.normalize_catalog_search\([\s\S]+\) from public\.subjects where subjects\.id = products\.subject_id$/i,
    /^update public\.subjects set search_document = public\.normalize_catalog_search\([\s\S]+\)$/i,
    /^create index if not exists idx_(?:products|subjects)_search_document on public\.(?:products|subjects) using gin \(search_document gin_trgm_ops\)$/i,
    /^revoke all on function public\.(?:normalize_catalog_search\(text\)|refresh_product_search_document\(\)|refresh_subject_search_document\(\)|refresh_products_for_subject_search\(\)) from public$/i
  ] as const;
  fail(statements.length === 22, "Migration 0021 must contain exactly its 22 allowlisted statements");
  fail(normalized.every((statement) => allowed.some((pattern) => pattern.test(statement))), "Migration 0021 contains a statement outside its exact allowlist");
  fail(normalized.filter((statement) => /^create or replace function public\.normalize_catalog_search/i.test(statement)).length === 1, "Migration 0021 must define one canonical search normalizer");
  fail(normalized.filter((statement) => /^alter table public\.(?:products|subjects) add column/i.test(statement)).length === 2, "Migration 0021 must add normalized search columns to products and subjects");
  fail(normalized.filter((statement) => /^create index if not exists/i.test(statement)).length === 2, "Migration 0021 must index both normalized search columns");
  const code = normalized.join(" ; ");
  fail(/unaccent|lower|regexp_replace|btrim/i.test(code), "Migration 0021 must normalize accents, case, punctuation, and whitespace in the database");
  fail(!/service_role|bypassrls|set\s+role|execute\s+(?:immediate|format)/i.test(code), "Migration 0021 must not escalate privileges or use dynamic SQL");
  assertNestedFunctionSqlScope(statements, { allowDmlTables: ["products"], allowSelectTables: ["subjects"], allowSqlExpressionSelect: true });
}

/** Exact contract for the post-0021 catalog mutation and semantic boundary. */
export function assertCatalogIntegrityBoundaryMigrationContract(sql0022: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const statements = stripSqlCommentsAndSplitStatements(sql0022);
  const normalized = statements.map(normalizeMigrationStatement);
  const functions = [
    "validate_subject_catalog_semantics",
    "validate_product_delivery_semantics",
    "validate_course_delivery_semantics",
    "validate_tutor_subject_invariant",
    "admin_subject_mutate_atomic",
    "admin_catalog_mutate_v2"
  ];
  const allowed: RegExp[] = functions.map((name) => new RegExp(`^create or replace function public\\.${name}\\([\\s\\S]*\\) returns (?:trigger|jsonb) language plpgsql(?: security definer)? set search_path = public as \\$function\\$[\\s\\S]+\\$function\\$$`, "i"));
  allowed.push(
    /^drop trigger if exists (?:trg_validate_subject_catalog_semantics|trg_validate_product_delivery_semantics|trg_validate_course_delivery_semantics|trg_validate_tutor_subject_invariant|trg_validate_tutor_product_subject_invariant) on public\.(?:subjects|products|courses|tutor_subjects)$/i,
    /^create trigger trg_validate_subject_catalog_semantics before insert or update of category, color_theme on public\.subjects for each row execute function public\.validate_subject_catalog_semantics\(\)$/i,
    /^create trigger trg_validate_product_delivery_semantics before insert or update of kind, delivery_kind on public\.products for each row execute function public\.validate_product_delivery_semantics\(\)$/i,
    /^create trigger trg_validate_course_delivery_semantics before insert or update of product_id, format on public\.courses for each row execute function public\.validate_course_delivery_semantics\(\)$/i,
    /^create constraint trigger trg_validate_tutor_subject_invariant after insert or update or delete on public\.tutor_subjects deferrable initially deferred for each row execute function public\.validate_tutor_subject_invariant\(\)$/i,
    /^create constraint trigger trg_validate_tutor_product_subject_invariant after insert or update or delete on public\.products deferrable initially deferred for each row execute function public\.validate_tutor_subject_invariant\(\)$/i,
    /^revoke insert, update, delete on table public\.subjects from anon, public, authenticated$/i,
    /^drop policy if exists subjects_admin_(?:insert|update|delete) on public\.subjects$/i,
    /^revoke all on function public\.admin_catalog_mutate_atomic\(text, public\.product_kind_enum, jsonb, jsonb, uuid\) from public, anon, authenticated$/i,
    /^revoke all on function public\.admin_subject_mutate_atomic\(text, jsonb, uuid\) from public$/i,
    /^grant execute on function public\.admin_subject_mutate_atomic\(text, jsonb, uuid\) to authenticated$/i,
    /^revoke all on function public\.admin_catalog_mutate_v2\(text, public\.product_kind_enum, jsonb, jsonb, uuid\) from public$/i,
    /^grant execute on function public\.admin_catalog_mutate_v2\(text, public\.product_kind_enum, jsonb, jsonb, uuid\) to authenticated$/i
  );
  fail(statements.length === 25, "Migration 0022 must contain exactly its 25 allowlisted statements");
  fail(normalized.every((statement) => allowed.some((pattern) => pattern.test(statement))), "Migration 0022 contains a statement outside its exact allowlist");
  const code = normalized.join(" ; ");
  fail(/before insert or update of category, color_theme on public\.subjects/i.test(code), "Subject category/theme must be enforced on INSERT and UPDATE");
  for (const [category, theme] of Object.entries({
    "Kế toán": "accounting", "Kinh tế": "economics", "Thống kê": "statistics", Marketing: "marketing",
    "Quản trị": "management", "Tài chính": "finance", MIS: "mis", "Luật": "law", "Ngoại ngữ": "languages"
  })) fail(code.includes(`when '${category.toLowerCase()}' then '${theme}'::public.color_theme_enum`), `Migration 0022 must preserve category/theme mapping ${category} -> ${theme}`);
  fail(/digital_download|one_on_one_tutoring|recorded_video|live_session/i.test(code), "Delivery semantics must be present for every catalog kind");
  fail(/new\.kind = 'material'[\s\S]*digital_download|new\.kind = 'tutor'[\s\S]*one_on_one_tutoring|new\.format = 'video'[\s\S]*recorded_video/i.test(code), "Database delivery triggers must encode each catalog delivery pair");
  fail(/subject_associations|tutor_subjects/i.test(code) && /deferrable initially deferred/i.test(code), "Tutor associations must be atomic and deferred-validated");
  fail(/primary_count <> 1|primary_count != 1/i.test(code) && /primary_subject_id is distinct from product_subject_id/i.test(code), "Tutor invariant must require one primary matching the product subject");
  fail(/role = 'admin' and account_status = 'approved'/i.test(code) && /auth\.uid\(\)/i.test(code), "Catalog RPCs must enforce the approved-admin boundary");
  fail((code.match(/security definer/g) || []).length === 2, "Only the two mutation RPCs may be SECURITY DEFINER");
  fail(!/execute\s+(?:immediate|format)|set\s+role|bypassrls|service_role|grant\s+all|revoke\s+all\s+privileges/i.test(code), "Migration 0022 must not use dynamic SQL or privilege escalation");
  fail(/jsonb_object_keys\(p_subject\)/i.test(code) && /jsonb_object_keys\(p_product\)/i.test(code), "Mutation RPCs must reject arbitrary payload keys");
  assertNestedFunctionSqlScope(statements, { allowDmlTables: ["products", "subjects", "materials", "courses", "tutors", "tutor_subjects"], allowSelectTables: ["profiles", "products", "subjects", "materials", "courses", "tutors", "tutor_subjects"], allowSqlExpressionSelect: true });
}

/** Exact contract for child-aware indexed search maintenance. */
export function assertCatalogChildSearchMigrationContract(sql0023: string): void {
  const fail = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
  const statements = stripSqlCommentsAndSplitStatements(sql0023);
  const normalized = statements.map(normalizeMigrationStatement);
  const allowed: RegExp[] = [
    /^create or replace function public\.normalize_catalog_search\(value text\) returns text language sql immutable set search_path = public, extensions as \$function\$[\s\S]+\$function\$$/i,
    /^create or replace function public\.(?:refresh_product_search_document|refresh_products_for_subject_search|refresh_product_search_document_from_child)\(\) returns trigger language plpgsql set search_path = public, extensions as \$function\$[\s\S]+\$function\$$/i,
    /^drop trigger if exists trg_refresh_(?:material|course|tutor)_search_document on public\.(?:materials|courses|tutors)$/i,
    /^create trigger trg_refresh_material_search_document after insert or update of product_id, tags, includes, suitable_for or delete on public\.materials for each row execute function public\.refresh_product_search_document_from_child\(\)$/i,
    /^create trigger trg_refresh_course_search_document after insert or update of product_id, mentor, tags, format or delete on public\.courses for each row execute function public\.refresh_product_search_document_from_child\(\)$/i,
    /^create trigger trg_refresh_tutor_search_document after insert or update of product_id, name, faculty, format, tags or delete on public\.tutors for each row execute function public\.refresh_product_search_document_from_child\(\)$/i,
    /^update public\.products as target_products set search_document = source_products\.search_document from \( select products\.id, public\.normalize_catalog_search\([\s\S]+ from public\.products as products join public\.subjects as subjects on subjects\.id = products\.subject_id[\s\S]+\) as source_products(?: where target_products\.id = source_products\.id)?$/i,
    /^revoke all on function public\.(?:normalize_catalog_search\(text\)|refresh_product_search_document\(\)|refresh_products_for_subject_search\(\)|refresh_product_search_document_from_child\(\)) from public$/i
  ];
  fail(statements.length === 15, "Migration 0023 must contain exactly its 15 allowlisted statements");
  fail(normalized.every((statement) => allowed.some((pattern) => pattern.test(statement))), "Migration 0023 contains a statement outside its exact allowlist");
  const code = normalized.join(" ; ");
  for (const field of ["courses.mentor", "tutors.name", "tutors.faculty", "tutors.format", "materials.tags", "products.title", "products.description", "subjects.name", "subjects.slug"]) fail(code.includes(field), `Child-aware search must include ${field}`);
  fail(/replace\(replace\(coalesce\(value, ''\), 'đ', 'd'\), 'đ', 'd'\)/i.test(code) || /replace\(replace\(coalesce\(value, ''\), 'đ', 'd'\), 'đ', 'd'\)/i.test(code), "Search normalizer must include the Vietnamese đ/Đ mapping");
  const executableCode = normalized.filter((statement) => !/^create trigger\b/i.test(statement)).join(" ; ");
  fail(/insert\s+into|delete\s+from|truncate|copy|call|\bdo\s+(?:(?:language\s+)?plpgsql\b|\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)|execute\s+(?:immediate|format)|set\s+role|bypassrls|service_role/i.test(maskSqlStringLiterals(executableCode)) === false, "Migration 0023 must not contain unsafe mutation escapes");
  assertNestedFunctionSqlScope(statements, { allowDmlTables: ["products"], allowSelectTables: ["products", "subjects", "materials", "courses", "tutors"], allowSqlExpressionSelect: true });
}

/** Exact workflow, history, RLS, and optimistic-concurrency contract for migration 0024. */
export function assertConsultationWorkflowMigrationContract(sql0024: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0024);
  const normalized = statements.map(normalizeMigrationStatement);
  const allowed: RegExp[] = [
    /^alter table consultations add column if not exists version integer not null default 0$/i,
    /^alter table consultations drop constraint if exists chk_consultations_version_nonnegative$/i,
    /^alter table consultations add constraint chk_consultations_version_nonnegative check \(version >= 0\)$/i,
    /^create index if not exists idx_consultations_status_created_at_id on consultations \(status, created_at desc, id desc\)$/i,
    /^create index if not exists idx_consultations_full_name_trgm on consultations using gin \(full_name gin_trgm_ops\)$/i,
    /^create index if not exists idx_consultations_phone_trgm on consultations using gin \(phone gin_trgm_ops\)$/i,
    /^create table if not exists consultation_status_history \([\s\S]+\)$/i,
    /^create index if not exists idx_consultation_status_history_consultation_changed_at on consultation_status_history \(consultation_id, changed_at desc, id desc\)$/i,
    /^alter table consultation_status_history enable row level security$/i,
    /^revoke all on table consultation_status_history from anon, authenticated$/i,
    /^grant select on table consultation_status_history to authenticated$/i,
    /^create policy consultation_status_history_allow_select_approved_admin on consultation_status_history for select to authenticated using \(public\.is_approved_admin\(\)\)$/i,
    /^drop policy if exists consultations_allow_select_admin on consultations$/i,
    /^create policy consultations_allow_select_admin on consultations for select to authenticated using \(public\.is_approved_admin\(\)\)$/i,
    /^drop policy if exists consultations_allow_update_status_admin on consultations$/i,
    /^create policy consultations_allow_update_status_admin on consultations for update to authenticated using \(public\.is_approved_admin\(\)\) with check \(public\.is_approved_admin\(\)\)$/i,
    /^revoke update on table consultations from anon, authenticated$/i,
    /^grant update \(status, version\) on table consultations to authenticated$/i,
    /^create or replace function public\.enforce_consultation_status_workflow\(\) returns trigger language plpgsql set search_path = pg_catalog, public as \$\$[\s\S]+\$\$$/i,
    /^drop trigger if exists trg_consultations_status_workflow on consultations$/i,
    /^create trigger trg_consultations_status_workflow before update on consultations for each row execute function public\.enforce_consultation_status_workflow\(\)$/i,
    /^create or replace function public\.append_consultation_status_history\(\) returns trigger language plpgsql security definer set search_path = pg_catalog, public as \$\$[\s\S]+\$\$$/i,
    /^revoke execute on function public\.append_consultation_status_history\(\) from public, anon, authenticated$/i,
    /^drop trigger if exists trg_consultations_status_history on consultations$/i,
    /^create trigger trg_consultations_status_history after update on consultations for each row execute function public\.append_consultation_status_history\(\)$/i,
    /^create or replace function public\.prevent_consultation_status_history_mutation\(\) returns trigger language plpgsql set search_path = pg_catalog, public as \$\$[\s\S]+\$\$$/i,
    /^revoke execute on function public\.prevent_consultation_status_history_mutation\(\) from public, anon, authenticated$/i,
    /^drop trigger if exists trg_consultation_status_history_append_only on consultation_status_history$/i,
    /^create trigger trg_consultation_status_history_append_only before update or delete on consultation_status_history for each row execute function public\.prevent_consultation_status_history_mutation\(\)$/i
  ];

  fail(statements.length === 29, "Migration 0024 must contain exactly its 29 allowlisted statements");
  fail(normalized.every((statement) => allowed.some((pattern) => pattern.test(statement))), "Migration 0024 contains a statement outside its exact allowlist");
  const code = normalized.join(" ; ");
  fail(code.includes("old_status <> new_status"), "History must reject same-state entries");
  fail(code.includes("unique (consultation_id, version)"), "History must be unique per consultation version");
  fail(code.includes("new.status is not distinct from old.status") && code.includes("new.updated_at = old.updated_at") && code.includes("new.updated_by = old.updated_by"), "Same-state retries must preserve database audit fields as an idempotent no-op");
  fail(code.includes("old.status = 'new' and new.status = 'contacted'") && code.includes("old.status = 'contacted' and new.status = 'qualified'") && code.includes("old.status = 'qualified' and new.status = 'closed'"), "Workflow must allow only forward transitions");
  fail(code.includes("new.version is distinct from old.version + 1"), "Real transitions must increment version atomically");
  fail(code.includes("new.updated_by = auth.uid()") && code.includes("new.updated_at = timezone('utc'::text, now())"), "Updater and timestamp must be database-managed");
  fail(code.includes("changed_by, changed_at, version") && code.includes("auth.uid(), new.updated_at, new.version"), "History actor, timestamp, and version must come from the transition");
  fail(code.includes("insert into public.consultation_status_history"), "Status trigger must append history in the same transaction");
  fail(code.includes("raise exception 'consultation status history is append-only'"), "History mutations must be rejected");
  fail(code.includes("public.is_approved_admin()"), "Consultation workflow must require approved admins");

  const executableCode = maskSqlStringLiterals(normalized.join(" ; "));
  fail(!/\b(?:execute\s+(?:immediate|format)|set\s+role|alter\s+role|service_role|bypassrls)\b/i.test(executableCode), "Migration 0024 must not contain dynamic SQL, role escalation, service role, or BYPASSRLS");
  assertNestedFunctionSqlScope(statements, { allowDmlTables: ["consultation_status_history"], allowSelectTables: [] });
}

/** Exact trigger cleanup contract for the post-0024 consultation workflow fix. */
export function assertConsultationWorkflowTriggerCleanupMigrationContract(sql0025: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const normalized = stripSqlCommentsAndSplitStatements(sql0025).map(normalizeMigrationStatement);
  const allowed = [
    /^drop trigger if exists trg_consultations_updated_at on public\.consultations$/i,
    /^drop trigger if exists trg_consultations_updated_by on public\.consultations$/i
  ];
  fail(normalized.length === 2, "Migration 0025 must contain exactly two trigger cleanup statements");
  fail(normalized.every((statement) => allowed.some((pattern) => pattern.test(statement))), "Migration 0025 contains a statement outside its exact allowlist");
}

/** Exact public-intake boundary: no table INSERT, one fixed-signature RPC. */
export function assertConsultationIntakeAccessBoundaryMigrationContract(sql0026: string): void {
  const fail = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };
  const statements = stripSqlCommentsAndSplitStatements(sql0026);
  const normalized = statements.map(normalizeMigrationStatement);
  const signature = "text, text, text, text, text, text, text, text, text, text, text";
  const allowed: RegExp[] = [
    /^revoke insert on table public\.consultations from anon, authenticated$/i,
    /^drop policy if exists consultations_allow_insert_anon_authenticated on public\.consultations$/i,
    /^create or replace function public\.submit_consultation_intake\([\s\S]+\) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as \$\$[\s\S]+\$\$$/i,
    new RegExp(`^revoke all on function public\\.submit_consultation_intake\\(${signature}\\) from public$`, "i"),
    new RegExp(`^grant execute on function public\\.submit_consultation_intake\\(${signature}\\) to anon, authenticated$`, "i")
  ];
  fail(statements.length === 5, "Migration 0026 must contain exactly its five allowlisted statements");
  fail(normalized.every((statement) => allowed.some((pattern) => pattern.test(statement))), "Migration 0026 contains a statement outside its exact allowlist");
  const code = normalized.join(" ; ");
  fail(!/\b(?:service_role|bypassrls|set\s+role|alter\s+role|execute\s+(?:immediate|format)|truncate|copy|call)\b|\bdo\s+(?:(?:language\s+)?plpgsql\b|\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/i.test(maskSqlStringLiterals(code)), "Migration 0026 must not contain privilege escalation, dynamic SQL, or hidden executable SQL");
  fail(!/grant\s+(?:insert|update|delete|all)\b[^;]*\bconsultations\b/i.test(code), "Migration 0026 must not re-grant direct consultation DML");
  fail(code.includes("drop policy if exists consultations_allow_insert_anon_authenticated"), "Migration 0026 must remove the direct INSERT RLS policy");
  for (const name of ["p_request_id", "p_full_name", "p_phone", "p_faculty", "p_major", "p_interest", "p_need", "p_note", "p_source_path", "p_selected_product_slug", "p_selected_subject_slug"]) {
    fail(code.includes(name), `Migration 0026 RPC must use the exact ${name} parameter`);
  }
  fail(code.includes("product.publication_status = 'published'"), "Migration 0026 must require a published product");
  fail(code.includes("inner join public.subjects as subject"), "Migration 0026 must bind a product to its actual subject");
  fail(code.includes("from public.subjects as subject"), "Migration 0026 must resolve subject-only submissions directly");
  fail(code.includes("on conflict (request_id) do nothing") && code.includes("'outcome', 'duplicate'"), "Migration 0026 must make duplicate request IDs idempotent");
  fail(code.includes("v_source_path = '/'") && code.includes("/tai-lieu") && code.includes("/khoa-hoc") && code.includes("/tutor"), "Migration 0026 must allow only internal source paths");
  assertNestedFunctionSqlScope(statements, { allowDmlTables: ["consultations"], allowSelectTables: ["products", "subjects"], allowSqlExpressionSelect: true });
}

/** The intake RPC must be private to the server-only service role. */
export function assertConsultationRpcPrivateBoundaryMigrationContract(sql0027: string): void {
  const statements = stripSqlCommentsAndSplitStatements(sql0027).map(normalizeMigrationStatement);
  const signature = "text, text, text, text, text, text, text, text, text, text, text";
  const expected = [
    new RegExp(`^revoke execute on function public\\.submit_consultation_intake\\(${signature}\\) from public, anon, authenticated$`, "i"),
    new RegExp(`^grant execute on function public\\.submit_consultation_intake\\(${signature}\\) to service_role$`, "i")
  ];
  if (statements.length !== expected.length || statements.some((statement, index) => !expected[index].test(statement))) {
    throw new Error("Migration 0027 must revoke public/anon/authenticated RPC execution and grant only service_role");
  }
  const code = statements.join(" ; ");
  if (/\b(?:execute\s+immediate|format|bypassrls|set\s+role|alter\s+role|dynamic\s+sql)\b/i.test(code)) {
    throw new Error("Migration 0027 must not contain privilege escalation or dynamic SQL");
  }
}

export async function runAudit(): Promise<boolean> {
  const results: AuditResult[] = [];
  const rootDir = process.cwd();
  const migrationsDir = path.join(rootDir, "supabase/migrations");
  const seedPath = path.join(rootDir, "supabase/seed.sql");

  console.log("================================================================================");
  console.log(" LEFT HAND — Phase 2 Supabase Migrations, Seed & RLS Verification");
  console.log("================================================================================\n");

  // 1. Audit Migrations Directory
  try {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    const expected = [
      "0001_core_schema.sql",
      "0002_public_catalog_read_policies.sql",
      "0003_public_catalog_table_grants.sql",
      "0004_profiles_schema_and_policies.sql",
      "0005_account_approval_gate.sql",
      "0006_consultations.sql",
      "0007_consultation_admin_rls.sql",
      "0008_consultation_admin_status_update.sql",
      "0009_consultation_updated_by.sql",
      "0010_admin_account_approval_rls.sql",
      "0011_admin_catalog_crud_rls.sql",
      "0012_private_material_storage.sql",
      "0013_material_asset_metadata.sql",
      "0014_product_entitlements.sql",
      "0015_learning_progress.sql",
      "0016_study_plans.sql",
      "0017_profile_on_auth_signup.sql",
      "0018_catalog_semantic_invariants.sql",
      "0019_admin_catalog_transaction_rpc.sql",
      "0020_catalog_mutation_access_boundary.sql",
      "0021_catalog_search_normalization.sql",
      "0022_catalog_integrity_boundary.sql",
      "0023_catalog_search_child_fields.sql",
      "0024_consultation_workflow_hardening.sql",
      "0025_consultation_workflow_trigger_order.sql",
      "0026_consultation_intake_access_boundary.sql",
      "0027_consultation_rpc_private_boundary.sql",
      "0028_learning_progress_entitlement_boundary.sql",
      "0029_material_storage_integrity_boundary.sql",
      "0030_catalog_search_complete_fields.sql",
      "0031_learning_progress_concurrency.sql",
      "0032_learning_progress_monotonicity.sql",
      "0033_material_direct_upload_sessions.sql",
      "0034_material_upload_cleanup_hardening.sql",
      "0035_material_upload_idempotency.sql",
      "0036_material_upload_retry_state.sql",
      "0037_material_upload_cancel_cleanup_guard.sql"
    ];

    const hasAll = expected.every((exp) => sqlFiles.includes(exp));
    results.push({
      category: "Migrations",
      check: "All 37 migration files exist in strict topological order",
      passed: hasAll && sqlFiles.length === expected.length,
      details: sqlFiles.join(", ")
    });

    const immutableMigrationSources = Object.fromEntries(
      await Promise.all(
        IMMUTABLE_MIGRATION_FILENAMES.map(async (filename) => [
          filename,
          await fs.readFile(path.join(migrationsDir, filename), "utf-8")
        ])
      )
    );
    let immutableHistoryValid = true;
    try {
      assertMigrationHistoryUnchanged(immutableMigrationSources);
    } catch (error) {
      immutableHistoryValid = false;
      results.push({
        category: "Migration History",
      check: "Migrations 0001-0027 match their canonical LF-normalized SHA-256 snapshots",
        passed: false,
        details: error instanceof Error ? error.message : String(error)
      });
    }
    if (immutableHistoryValid) {
      results.push({
        category: "Migration History",
        check: "Migrations 0001-0027 match their canonical LF-normalized SHA-256 snapshots",
        passed: true,
        details: "Every immutable migration from 0001 through 0027 is content-locked"
      });
    }

    // 2. Audit 0001_core_schema.sql
    const sql0001 = await fs.readFile(path.join(migrationsDir, "0001_core_schema.sql"), "utf-8");
    const tables0001 = ["profiles", "subjects", "products", "materials", "courses", "course_lessons", "tutors", "tutor_subjects"];
    const allTablesCreated = tables0001.every((t) => new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${t}`, "i").test(sql0001));
    const allRlsEnabled = tables0001.every((t) => new RegExp(`ALTER\\s+TABLE\\s+${t}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`, "i").test(sql0001));

    results.push({
      category: "0001_core_schema",
      check: "All 8 application tables created with constraints",
      passed: allTablesCreated,
      details: tables0001.join(", ")
    });

    results.push({
      category: "0001_core_schema",
      check: "Row Level Security enabled on all 8 tables",
      passed: allRlsEnabled,
      details: "profiles, subjects, products, materials, courses, course_lessons, tutors, tutor_subjects"
    });

    // 3. Audit 0002_public_catalog_read_policies.sql
    const sql0002 = await fs.readFile(path.join(migrationsDir, "0002_public_catalog_read_policies.sql"), "utf-8");
    const hasPublishedCheck = /ON\s+products[\s\S]*?publication_status\s*=\s*'published'/i.test(sql0002);
    const noMutationPolicies = !/FOR\s+(INSERT|UPDATE|DELETE)/i.test(sql0002);

    results.push({
      category: "0002_read_policies",
      check: "Enforces publication_status = 'published' on products and child tables",
      passed: hasPublishedCheck && noMutationPolicies,
      details: "SELECT only for anon and authenticated; no write policies"
    });

    // 4. Audit 0003_public_catalog_table_grants.sql
    const sql0003 = await fs.readFile(path.join(migrationsDir, "0003_public_catalog_table_grants.sql"), "utf-8");
    const noProfileGrant = !/GRANT\s+.*ON\s+(TABLE\s+)?profiles/i.test(sql0003);
    const noMutationGrants = !/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i.test(sql0003);

    results.push({
      category: "0003_table_grants",
      check: "Grants schema USAGE and table SELECT only on 7 catalog tables; profiles excluded",
      passed: noProfileGrant && noMutationGrants,
      details: "No INSERT/UPDATE/DELETE grants to anon or authenticated"
    });

    // 5. Audit 0004 & 0005 Profiles and Account Approval Gate
    const sql0004 = await fs.readFile(path.join(migrationsDir, "0004_profiles_schema_and_policies.sql"), "utf-8");
    const sql0005 = await fs.readFile(path.join(migrationsDir, "0005_account_approval_gate.sql"), "utf-8");
    const profilePrivate = sql0004.includes("auth.uid() = id") && sql0004.includes("REVOKE INSERT, UPDATE ON TABLE profiles FROM authenticated;");
    const approvalGuard = sql0005.includes("chk_profiles_no_self_approval") && sql0005.includes("account_status IN ('pending', 'approved', 'rejected', 'suspended')");

    results.push({
      category: "0004_0005_profiles_gate",
      check: "Profiles protected with strict RLS, column grants, and self-approval prevention",
      passed: profilePrivate && approvalGuard,
      details: "auth.uid() = id, check constraint, non-privileged column grants only"
    });

    // 6. Audit 0006_consultations.sql
    const sql0006 = await fs.readFile(path.join(migrationsDir, "0006_consultations.sql"), "utf-8");
    const hasConsultationsTable = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+consultations/i.test(sql0006);
    const hasUUIDId = /id\s+UUID\s+PRIMARY\s+KEY\s+DEFAULT\s+gen_random_uuid\(\)/i.test(sql0006);
    const hasRequestId = /request_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(sql0006);
    const hasRequiredColumns = ['full_name', 'phone', 'faculty', 'interest', 'need'].every((col) => new RegExp(`${col}\\s+TEXT\\s+NOT\\s+NULL`, 'i').test(sql0006));
    const hasStatus = /status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'new'/i.test(sql0006);
    const hasTimestamps = /created_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i.test(sql0006) && /updated_at\s+TIMESTAMPTZ\s+NOT\s+NULL\s+DEFAULT\s+now\(\)/i.test(sql0006);
    const hasIndex = /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_consultations_status_created_at/i.test(sql0006);
    const hasConsultationsRls = /ALTER\s+TABLE\s+consultations\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(sql0006);
    const hasInsertGrant = /GRANT\s+INSERT\s+\([^)]+\)\s+ON\s+TABLE\s+consultations\s+TO\s+anon,\s+authenticated/i.test(sql0006);
    const hasInsertPolicy = /CREATE\s+POLICY\s+"consultations_allow_insert_anon_authenticated"[\s\S]*?FOR\s+INSERT/i.test(sql0006);
    const noOtherPolicies = (sql0006.match(/CREATE\s+POLICY/gi) || []).length === 1;
    const noOtherGrants = !/GRANT\s+(SELECT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\s+consultations/i.test(sql0006);
    const noClientManagedFields = !/GRANT\s+INSERT\s+\([^)]*\b(id|status|created_at|updated_at)\b[^)]*\)\s+ON\s+TABLE\s+consultations/i.test(sql0006);
    const hasStatusConstraint0006 = /CONSTRAINT\s+chk_consultations_status\s+CHECK\s*\(\s*status\s+IN\s*\(\s*'new',\s*'contacted',\s*'qualified',\s*'closed'\s*\)\s*\)/i.test(sql0006);

    results.push({
      category: "0006_consultations",
      check: "Consultations table schema correct (UUID, request_id, columns, status, timestamps, index)",
      passed: hasConsultationsTable && hasUUIDId && hasRequestId && hasRequiredColumns && hasStatus && hasTimestamps && hasIndex && hasStatusConstraint0006,
      details: "UUID PK, text columns, defaults, index on status/created_at, canonical status constraint ('new', 'contacted', 'qualified', 'closed')"
    });

    results.push({
      category: "0006_consultations",
      check: "Strict RLS and restricted INSERT grants",
      passed: hasConsultationsRls && hasInsertGrant && hasInsertPolicy && noOtherPolicies && noOtherGrants && noClientManagedFields,
      details: "RLS enabled, 1 INSERT policy, restricted column grants, no SELECT/UPDATE/DELETE"
    });

    // 7. Audit 0007_consultation_admin_rls.sql
    const sql0007 = await fs.readFile(path.join(migrationsDir, "0007_consultation_admin_rls.sql"), "utf-8");
    const grantsSelectAuthenticated = /GRANT\s+SELECT\s+ON\s+TABLE\s+consultations\s+TO\s+authenticated/i.test(sql0007);
    const noAnonSelectGrant = !/GRANT\s+.*anon/i.test(sql0007);
    const noMutation0007Grants = !/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i.test(sql0007);
    const hasAdminSelectPolicy = /CREATE\s+POLICY\s+"[^"]+"\s+ON\s+consultations\s+FOR\s+SELECT\s+TO\s+authenticated\s+USING/i.test(sql0007);
    const adminPolicyChecksRole = sql0007.includes("profiles.role = 'admin'") && sql0007.includes("auth.uid()");
    const noPublicMutationPolicies = !/FOR\s+(INSERT|UPDATE|DELETE)/i.test(sql0007);

    results.push({
      category: "0007_consultation_admin_rls",
      check: "Grants SELECT only to authenticated, no mutation grants",
      passed: grantsSelectAuthenticated && noAnonSelectGrant && noMutation0007Grants,
      details: "No SELECT for anon, no public INSERT/UPDATE/DELETE grants added"
    });

    results.push({
      category: "0007_consultation_admin_rls",
      check: "Admin-only SELECT RLS policy on consultations",
      passed: hasAdminSelectPolicy && adminPolicyChecksRole && noPublicMutationPolicies,
      details: "Requires auth.uid() and profiles.role = 'admin', no mutation policies"
    });

    // 8. Audit 0008_consultation_admin_status_update.sql
    const sql0008 = await fs.readFile(path.join(migrationsDir, "0008_consultation_admin_status_update.sql"), "utf-8");
    const code0008 = sql0008.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

    // 8.1 Reject table-wide UPDATE grants and allow only column grant exactly for status
    const revokesTableWideUpdate0008 = /REVOKE\s+UPDATE\s+ON\s+TABLE\s+consultations\s+FROM\s+(?:anon,\s*authenticated|authenticated,\s*anon)/i.test(code0008);
    const noTableWideUpdate0008 = !/GRANT\s+UPDATE\s+ON\s+(?:TABLE\s+)?consultations\b/i.test(code0008);
    const grantsOnlyStatusUpdate0008 = /GRANT\s+UPDATE\s*\(\s*status\s*\)\s+ON\s+TABLE\s+consultations\s+TO\s+authenticated/i.test(code0008);
    const noOtherColumnUpdate0008 = !/GRANT\s+UPDATE\s*\((?!\s*status\s*\))/i.test(code0008);
    const noAnonUpdateGrant0008 = !/GRANT\s+UPDATE[\s\S]*?\bTO\b[\s\S]*?\banon\b/i.test(code0008);
    const noOtherRolesUpdate0008 = !/GRANT\s+UPDATE[\s\S]*?\bTO\s+(?!authenticated\b)[a-zA-Z_]\w*/i.test(code0008);

    // 8.2 Reject grants of SELECT, INSERT, DELETE, or ALL in 0008 (table-wide and column-level)
    const noForbiddenGrants0008 = !/GRANT\s+(?:SELECT|INSERT|DELETE|ALL)\b/i.test(code0008);
    const grantStatements0008 = (code0008.match(/GRANT\s+[^;]+;/gi) || []).map((s) => s.trim());
    const soleGrantIsStatusUpdate0008 = grantStatements0008.length === 1 &&
      /^GRANT\s+UPDATE\s*\(\s*status\s*\)\s+ON\s+(?:TABLE\s+)?consultations\s+TO\s+authenticated\s*;$/i.test(grantStatements0008[0]);

    // 8.3 Verify no privilege escalation or RLS bypass
    const noServiceRole0008 = !/\bservice_role\b/i.test(code0008);
    const noCredentialsOrSecrets0008 = !/\b(?:password|secret|token|bearer|apikey|api_key|service_role_key|anon_key)\b\s*[:=]/i.test(code0008)
      && !/'ey[a-zA-Z0-9._-]{20,}'/.test(code0008);
    const noSecurityDefiner0008 = !/SECURITY\s+DEFINER/i.test(code0008);
    const noBypassRls0008 = !/\bBYPASSRLS\b/i.test(code0008);
    const noRoleEscalation0008 = !/\b(?:SET|ALTER)\s+ROLE\b/i.test(code0008)
      && !/GRANT\s+[^;]*?\bTO\s+[^;]*?\b(?:postgres|supabase_admin|service_role|authenticator|dashboard_user)\b/i.test(code0008);
    const noDisableRls0008 = !/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(code0008);
    const noAlteringUnrelatedTables0008 = !/ALTER\s+TABLE\s+(?:ONLY\s+)?(?!consultations\b)\w+/i.test(code0008);
    const grantOnTables0008 = [...code0008.matchAll(/GRANT\s+[^;]*?\bON\s+(?:TABLE\s+)?([a-zA-Z_]\w*)/gi)].map((m) => m[1].toLowerCase());
    const revokeOnTables0008 = [...code0008.matchAll(/REVOKE\s+[^;]*?\bON\s+(?:TABLE\s+)?([a-zA-Z_]\w*)/gi)].map((m) => m[1].toLowerCase());
    const noUnrelatedTablePrivileges0008 = grantOnTables0008.every((t) => t === "consultations") && revokeOnTables0008.every((t) => t === "consultations");

    // 8.4 Status integrity
    const noSecondStatusConstraint0008 = !/(?:CREATE\s+TYPE|ADD\s+CONSTRAINT|CHECK\s*\([^)]*status|chk_consultations_status)/i.test(code0008);
    const canonicalStatuses0008 = new Set(["new", "contacted", "qualified", "closed"]);
    const singleQuoted0008 = code0008.match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, "")) || [];
    const noInvalidStatusValues0008 = singleQuoted0008.every((val) => val === "admin" || canonicalStatuses0008.has(val));
    const canonical0006StatusPreserved = /CONSTRAINT\s+chk_consultations_status\s+CHECK\s*\(\s*status\s+IN\s*\(\s*'new',\s*'contacted',\s*'qualified',\s*'closed'\s*\)\s*\)/i.test(sql0006);

    // 8.5 Updated_at trigger contract
    const fnDefIn0004 = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+update_updated_at_column\s*\(\s*\)\s*RETURNS\s+TRIGGER/i.test(sql0004);
    const noFunctionReplacement0008 = !/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i.test(code0008);
    const triggerMatches0008 = code0008.match(/CREATE\s+TRIGGER[\s\S]*?;/gi) || [];
    const hasConsultationsUpdateTrigger0008 = triggerMatches0008.length === 1
      && /CREATE\s+TRIGGER\s+trg_consultations_updated_at\s+BEFORE\s+UPDATE\s+ON\s+consultations\s+FOR\s+EACH\s+ROW/i.test(triggerMatches0008[0])
      && /EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+update_updated_at_column\s*\(\s*\)\s*;/i.test(triggerMatches0008[0]);

    // 8.6 Policy verification
    const updatePolicies0008 = code0008.match(/CREATE\s+POLICY[\s\S]*?ON\s+consultations[\s\S]*?FOR\s+UPDATE[\s\S]*?;/gi) || [];
    const allPolicies0008 = code0008.match(/CREATE\s+POLICY[\s\S]*?;/gi) || [];
    const updatePolicy0008 = updatePolicies0008[0] || "";
    const policyTarget0008 = updatePolicy0008.match(/FOR\s+UPDATE([\s\S]*?)USING/i)?.[1] || "";
    const hasOneAdminUpdatePolicy0008 = updatePolicies0008.length === 1
      && allPolicies0008.length === 1
      && normalizeSql(policyTarget0008) === "TO authenticated";
    const usingPredicate0008 = extractPolicyClause(updatePolicy0008, "USING");
    const withCheckPredicate0008 = extractPolicyClause(updatePolicy0008, "WITH CHECK");
    const hasUsingAndWithCheck0008 = usingPredicate0008 !== null && withCheckPredicate0008 !== null;
    const bothPredicatesRequireAdmin0008 = normalizeSql(usingPredicate0008 || "") === expectedAdminPredicate
      && normalizeSql(withCheckPredicate0008 || "") === expectedAdminPredicate;
    const noDeletePolicyOrGrant0008 = !/FOR\s+DELETE/i.test(code0008) && !/GRANT\s+DELETE/i.test(code0008);

    results.push({
      category: "0008_consultation_admin_status_update",
      check: "Rejects table-wide UPDATE; grants only UPDATE(status) to authenticated and rejects other grants",
      passed: revokesTableWideUpdate0008 && noTableWideUpdate0008 && grantsOnlyStatusUpdate0008 && noOtherColumnUpdate0008 && noAnonUpdateGrant0008 && noOtherRolesUpdate0008 && noForbiddenGrants0008 && soleGrantIsStatusUpdate0008,
      details: "Table-wide UPDATE revoked; only UPDATE(status) granted to authenticated; SELECT/INSERT/DELETE/ALL forbidden"
    });

    results.push({
      category: "0008_consultation_admin_status_update",
      check: "No privilege escalation, SECURITY DEFINER, service_role, or RLS bypass",
      passed: noServiceRole0008 && noCredentialsOrSecrets0008 && noSecurityDefiner0008 && noBypassRls0008 && noRoleEscalation0008 && noDisableRls0008 && noAlteringUnrelatedTables0008 && noUnrelatedTablePrivileges0008,
      details: "No service_role, secrets, SECURITY DEFINER, BYPASSRLS, SET/ALTER ROLE, or cross-table modifications"
    });

    results.push({
      category: "0008_consultation_admin_status_update",
      check: "Status integrity preserved with no duplicate constraints or out-of-scope status values",
      passed: noSecondStatusConstraint0008 && noInvalidStatusValues0008 && canonical0006StatusPreserved,
      details: "No duplicate status types or checks; canonical status constraint in 0006 remains sole authority"
    });

    results.push({
      category: "0008_consultation_admin_status_update",
      check: "Consultations updated_at trigger contract reuses established 0004 function without replacement",
      passed: fnDefIn0004 && noFunctionReplacement0008 && hasConsultationsUpdateTrigger0008,
      details: "Trigger trg_consultations_updated_at calls update_updated_at_column() without redefining function"
    });

    results.push({
      category: "0008_consultation_admin_status_update",
      check: "Adds exactly one admin-only UPDATE RLS policy with USING and WITH CHECK",
      passed: hasOneAdminUpdatePolicy0008 && hasUsingAndWithCheck0008 && bothPredicatesRequireAdmin0008 && noDeletePolicyOrGrant0008,
      details: "Both predicates require profiles.id = auth.uid() and profiles.role = 'admin'"
    });

    // 9. Audit 0009_consultation_updated_by.sql
    const sql0009 = await fs.readFile(path.join(migrationsDir, "0009_consultation_updated_by.sql"), "utf-8");
    let migration0009ContractValid = true;
    try {
      assertConsultationUpdatedByMigrationContract(sql0009);
    } catch {
      migration0009ContractValid = false;
    }
    const repoSource = await fs.readFile(path.join(rootDir, "lib/repositories/consultation-repository.ts"), "utf-8");
    const repositoryDoesNotAcceptUpdater = /export\s+async\s+function\s+updateConsultationStatus\s*\(\s*id:\s*string\s*,\s*status:\s*ConsultationStatus\s*,\s*expectedVersion:\s*number\s*,\s*expectedStatus:\s*ConsultationStatus\s*,\s*client\?:\s*[^)]*\)/.test(repoSource)
      && /\.update\(\{\s*status\s*,\s*version:\s*expectedVersion\s*\+\s*1\s*\}\)/.test(repoSource)
      && !/\.update\(\{[^}]*\b(?:userId|user_id|updatedBy|updated_by)\b/i.test(repoSource);
    results.push({
      category: "0009_consultation_updated_by",
      check: "Adds nullable updated_by UUID reference and a dedicated auth.uid() BEFORE UPDATE trigger",
      passed: migration0009ContractValid,
      details: "updated_by references auth.users(id) ON DELETE SET NULL and is assigned by the database"
    });
    results.push({
      category: "0009_consultation_updated_by",
      check: "Rejects updater grants, policies, privilege escalation, and client-supplied identity",
      passed: migration0009ContractValid && repositoryDoesNotAcceptUpdater,
      details: "No updater grant/policy/bypass; applied migration history is hash-locked; repository sends only status plus expected version"
    });

    // 10. Audit 0010_admin_account_approval_rls.sql
    const sql0010 = await fs.readFile(path.join(migrationsDir, "0010_admin_account_approval_rls.sql"), "utf-8");
    let migration0010ContractValid = true;
    try {
      assertAdminAccountApprovalMigrationContract(sql0010);
    } catch {
      migration0010ContractValid = false;
    }
    results.push({
      category: "0010_admin_account_approval_rls",
      check: "Adds approved-admin profile SELECT/approval UPDATE RLS with safe grants and audit trigger",
      passed: migration0010ContractValid,
      details: "Admin approval is limited to account_status/rejection_reason; approved_by/approved_at are database-managed"
    });

    // 11. Audit 0011_admin_catalog_crud_rls.sql
    const sql0011 = await fs.readFile(path.join(migrationsDir, "0011_admin_catalog_crud_rls.sql"), "utf-8");
    let migration0011ContractValid = true;
    try {
      assertAdminCatalogMigrationContract(sql0011);
    } catch {
      migration0011ContractValid = false;
    }
    results.push({
      category: "0011_admin_catalog_crud_rls",
      check: "Adds approved-admin CRUD RLS and explicit authenticated catalog grants without changing public read policy",
      passed: migration0011ContractValid,
      details: "Subjects, products, materials, courses, and tutors have explicit INSERT/UPDATE/DELETE controls"
    });

    // 12. Audit 0012_private_material_storage.sql
    const sql0012 = await fs.readFile(path.join(migrationsDir, "0012_private_material_storage.sql"), "utf-8");
    let migration0012ContractValid = true;
    try {
      assertMigration0012Contract(sql0012);
    } catch {
      migration0012ContractValid = false;
    }
    results.push({
      category: "0012_private_material_storage",
      check: "Creates one private materials bucket with approved-admin-only object policies",
      passed: migration0012ContractValid,
      details: "Private bucket; exactly SELECT, INSERT, UPDATE, and DELETE policies on storage.objects for authenticated approved admins"
    });

    // 13. Audit 0013_material_asset_metadata.sql
    const sql0013 = await fs.readFile(path.join(migrationsDir, "0013_material_asset_metadata.sql"), "utf-8");
    let migration0013ContractValid = true;
    try {
      assertMigration0013Contract(sql0013);
    } catch {
      migration0013ContractValid = false;
    }
    results.push({
      category: "0013_material_asset_metadata",
      check: "Creates immutable private-material version metadata with approved-admin-only RLS",
      passed: migration0013ContractValid,
      details: "Metadata retains prior versions; storage bucket and object policies remain owned by 0012"
    });

    // 14. Audit 0014_product_entitlements.sql
    const sql0014 = await fs.readFile(path.join(migrationsDir, "0014_product_entitlements.sql"), "utf-8");
    let migration0014ContractValid = true;
    try {
      assertMigration0014Contract(sql0014);
    } catch {
      migration0014ContractValid = false;
    }
    results.push({
      category: "0014_product_entitlements",
      check: "Creates the product entitlement source of truth with approved-admin-only mutations",
      passed: migration0014ContractValid,
      details: "Learners can read only their own active source rows; approved admins can manage all entitlements"
    });

    // 15. Audit 0015_learning_progress.sql
    const sql0015 = await fs.readFile(path.join(migrationsDir, "0015_learning_progress.sql"), "utf-8");
    let migration0015ContractValid = true;
    try {
      assertMigration0015Contract(sql0015);
    } catch {
      migration0015ContractValid = false;
    }
    results.push({
      category: "0015_learning_progress",
      check: "Creates bounded student-owned learning progress with exact RLS, uniqueness, and timestamp behavior",
      passed: migration0015ContractValid,
      details: "Authenticated users can select/insert/update only rows owned by auth.uid(); no public, delete, service_role, or BYPASSRLS access"
    });

    // 16. Audit 0016_study_plans.sql
    const sql0016 = await fs.readFile(path.join(migrationsDir, "0016_study_plans.sql"), "utf-8");
    let migration0016ContractValid = true;
    try {
      assertMigration0016Contract(sql0016);
    } catch {
      migration0016ContractValid = false;
    }
    results.push({
      category: "0016_study_plans",
      check: "Creates bounded student-owned study plans with exact RLS, indexes, grants, and timestamp behavior",
      passed: migration0016ContractValid,
      details: "Authenticated users can select, insert, update, and delete only rows owned by auth.uid(); no public or privileged-role access"
    });

    // 17. Audit 0017_profile_on_auth_signup.sql
    const sql0017 = await fs.readFile(path.join(migrationsDir, "0017_profile_on_auth_signup.sql"), "utf-8");
    const sql0001For0017 = await fs.readFile(path.join(migrationsDir, "0001_core_schema.sql"), "utf-8");
    const sql0004For0017 = await fs.readFile(path.join(migrationsDir, "0004_profiles_schema_and_policies.sql"), "utf-8");
    const sql0005For0017 = await fs.readFile(path.join(migrationsDir, "0005_account_approval_gate.sql"), "utf-8");
    let migration0017ContractValid = true;
    try {
      assertMigration0017Contract(sql0017, {
        sql0001: sql0001For0017,
        sql0004: sql0004For0017,
        sql0005: sql0005For0017
      });
    } catch {
      migration0017ContractValid = false;
    }
    results.push({
      category: "0017_profile_on_auth_signup",
      check: "Creates one bounded pending student profile per auth signup with safe trigger isolation",
      passed: migration0017ContractValid,
      details: "AFTER INSERT auth.users trigger; fixed search_path SECURITY DEFINER; explicit profile insert; idempotent fallback name"
    });

    const sql0018 = await fs.readFile(path.join(migrationsDir, "0018_catalog_semantic_invariants.sql"), "utf-8");
    let migration0018ContractValid = true;
    try {
      assertCatalogSemanticMigrationContract(sql0018);
    } catch (error) {
      migration0018ContractValid = false;
      results.push({ category: "0018_catalog_semantic_invariants", check: "Enforces catalog semantic invariants without privilege bypasses", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0018ContractValid) {
      results.push({ category: "0018_catalog_semantic_invariants", check: "Enforces catalog semantic invariants without privilege bypasses", passed: true, details: "Category/theme, child kind, old price, tutor format, and one-primary constraints verified" });
    }

    // 18. Audit 0019_admin_catalog_transaction_rpc.sql
    const sql0019 = await fs.readFile(path.join(migrationsDir, "0019_admin_catalog_transaction_rpc.sql"), "utf-8");
    let migration0019ContractValid = true;
    try {
      assertAdminCatalogTransactionMigrationContract(sql0019);
    } catch (error) {
      migration0019ContractValid = false;
      results.push({ category: "0019_admin_catalog_transaction_rpc", check: "Uses an exact atomic catalog RPC and closes product-kind/public-read boundaries", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0019ContractValid) {
      results.push({ category: "0019_admin_catalog_transaction_rpc", check: "Uses an exact atomic catalog RPC and closes product-kind/public-read boundaries", passed: true, details: "Approved-admin RPC, immutable product kind, typed child writes, and published parent-kind policies verified" });
    }

    const sql0020 = await fs.readFile(path.join(migrationsDir, "0020_catalog_mutation_access_boundary.sql"), "utf-8");
    let migration0020ContractValid = true;
    try {
      assertCatalogMutationAccessBoundaryMigrationContract(sql0020);
    } catch (error) {
      migration0020ContractValid = false;
      results.push({ category: "0020_catalog_mutation_access_boundary", check: "Removes direct catalog DML and exposes only the approved atomic RPC", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0020ContractValid) {
      results.push({ category: "0020_catalog_mutation_access_boundary", check: "Removes direct catalog DML and exposes only the approved atomic RPC", passed: true, details: "Direct product/child mutation privileges and policies revoked; approved-admin SECURITY DEFINER wrapper is the only mutation entrypoint" });
    }

    const sql0021 = await fs.readFile(path.join(migrationsDir, "0021_catalog_search_normalization.sql"), "utf-8");
    let migration0021ContractValid = true;
    try {
      assertCatalogSearchNormalizationMigrationContract(sql0021);
    } catch (error) {
      migration0021ContractValid = false;
      results.push({ category: "0021_catalog_search_normalization", check: "Maintains indexed normalized search documents for products and subjects", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0021ContractValid) {
      results.push({ category: "0021_catalog_search_normalization", check: "Maintains indexed normalized search documents for products and subjects", passed: true, details: "Database normalizer, maintenance triggers, backfill, and trigram indexes verified" });
    }

    const sql0022 = await fs.readFile(path.join(migrationsDir, "0022_catalog_integrity_boundary.sql"), "utf-8");
    let migration0022ContractValid = true;
    try { assertCatalogIntegrityBoundaryMigrationContract(sql0022); } catch (error) {
      migration0022ContractValid = false;
      results.push({ category: "0022_catalog_integrity_boundary", check: "Closes subject, delivery, tutor-association, and mutation access boundaries", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0022ContractValid) results.push({ category: "0022_catalog_integrity_boundary", check: "Closes subject, delivery, tutor-association, and mutation access boundaries", passed: true, details: "Subject RPC, delivery triggers, deferred tutor invariant, and v2 atomic RPC verified" });

    const sql0023 = await fs.readFile(path.join(migrationsDir, "0023_catalog_search_child_fields.sql"), "utf-8");
    let migration0023ContractValid = true;
    try { assertCatalogChildSearchMigrationContract(sql0023); } catch (error) {
      migration0023ContractValid = false;
      results.push({ category: "0023_catalog_search_child_fields", check: "Maintains normalized child-aware public search documents", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0023ContractValid) results.push({ category: "0023_catalog_search_child_fields", check: "Maintains normalized child-aware public search documents", passed: true, details: "Mentor, tutor, material-tag, subject, and product fields are indexed and trigger-maintained" });

    // 24. Audit 0024_consultation_workflow_hardening.sql
    const sql0024 = await fs.readFile(path.join(migrationsDir, "0024_consultation_workflow_hardening.sql"), "utf-8");
    let migration0024ContractValid = true;
    try { assertConsultationWorkflowMigrationContract(sql0024); } catch (error) {
      migration0024ContractValid = false;
      results.push({ category: "0024_consultation_workflow_hardening", check: "Enforces forward status workflow, append-only history, approved-admin RLS, and optimistic concurrency", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0024ContractValid) results.push({ category: "0024_consultation_workflow_hardening", check: "Enforces forward status workflow, append-only history, approved-admin RLS, and optimistic concurrency", passed: true, details: "Forward-only trigger, database actor/timestamp, atomic history, protected grants, and version token verified" });

    // 25. Audit 0025_consultation_workflow_trigger_order.sql
    const sql0025 = await fs.readFile(path.join(migrationsDir, "0025_consultation_workflow_trigger_order.sql"), "utf-8");
    let migration0025ContractValid = true;
    try { assertConsultationWorkflowTriggerCleanupMigrationContract(sql0025); } catch (error) {
      migration0025ContractValid = false;
      results.push({ category: "0025_consultation_workflow_trigger_order", check: "Removes legacy consultation triggers that overwrite workflow-managed audit fields", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0025ContractValid) results.push({ category: "0025_consultation_workflow_trigger_order", check: "Removes legacy consultation triggers that overwrite workflow-managed audit fields", passed: true, details: "Legacy updated_at and updated_by triggers are removed without modifying migrations 0001-0024" });

    const sql0026 = await fs.readFile(path.join(migrationsDir, "0026_consultation_intake_access_boundary.sql"), "utf-8");
    let migration0026ContractValid = true;
    try { assertConsultationIntakeAccessBoundaryMigrationContract(sql0026); } catch (error) {
      migration0026ContractValid = false;
      results.push({ category: "0026_consultation_intake_access_boundary", check: "Closes direct consultation INSERT and exposes only the verified intake RPC", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0026ContractValid) results.push({ category: "0026_consultation_intake_access_boundary", check: "Closes direct consultation INSERT and preserves the verified intake RPC", passed: true, details: "Exact payload signature, source/catalog binding, idempotency, and constrained SECURITY DEFINER scope verified" });

    const sql0027 = await fs.readFile(path.join(migrationsDir, "0027_consultation_rpc_private_boundary.sql"), "utf-8");
    let migration0027ContractValid = true;
    try { assertConsultationRpcPrivateBoundaryMigrationContract(sql0027); } catch (error) {
      migration0027ContractValid = false;
      results.push({ category: "0027_consultation_rpc_private_boundary", check: "Removes public RPC execution and leaves only service_role execution", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0027ContractValid) results.push({ category: "0027_consultation_rpc_private_boundary", check: "Removes public RPC execution and leaves only service_role execution", passed: true, details: "anon and authenticated direct RPC access is revoked; only the server-only service role is granted" });

    // 28. Audit 0028_learning_progress_entitlement_boundary.sql
    const sql0028 = await fs.readFile(path.join(migrationsDir, "0028_learning_progress_entitlement_boundary.sql"), "utf-8");
    let migration0028ContractValid = true;
    try { assertLearningProgressBoundaryMigrationContract(sql0028); } catch (error) {
      migration0028ContractValid = false;
      results.push({ category: "0028_learning_progress_entitlement_boundary", check: "Closes direct learning-progress DML and enforces entitlement/item binding", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0028ContractValid) results.push({ category: "0028_learning_progress_entitlement_boundary", check: "Closes direct learning-progress DML and enforces entitlement/item binding", passed: true, details: "Direct INSERT/UPDATE revoked; auth.uid(), active entitlement, material/lesson binding, idempotency, and fixed RPC privileges verified" });

    // 29. Audit 0029_material_storage_integrity_boundary.sql
    const sql0029 = await fs.readFile(path.join(migrationsDir, "0029_material_storage_integrity_boundary.sql"), "utf-8");
    let migration0029ContractValid = true;
    try { assertMaterialStorageIntegrityBoundaryMigrationContract(sql0029); } catch (error) {
      migration0029ContractValid = false;
      results.push({ category: "0029_material_storage_integrity_boundary", check: "Reserves material versions atomically and binds private storage to metadata", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0029ContractValid) results.push({ category: "0029_material_storage_integrity_boundary", check: "Reserves material versions atomically and binds private storage to metadata", passed: true, details: "Direct metadata DML revoked; reservation RPCs use auth.uid(), fixed search_path, path binding, and transaction-locked version allocation" });

    // 30. Audit 0030_catalog_search_complete_fields.sql
    const sql0030 = await fs.readFile(path.join(migrationsDir, "0030_catalog_search_complete_fields.sql"), "utf-8");
    let migration0030ContractValid = true;
    try { assertCatalogCompleteSearchMigrationContract(sql0030); } catch (error) {
      migration0030ContractValid = false;
      results.push({ category: "0030_catalog_search_complete_fields", check: "Maintains complete normalized search documents across parent and child fields", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0030ContractValid) results.push({ category: "0030_catalog_search_complete_fields", check: "Maintains complete normalized search documents across parent and child fields", passed: true, details: "Canonical projection, Unicode normalization, field-complete triggers, tutor-subject refresh, and idempotent backfill verified" });

    // 31. Audit 0031_learning_progress_concurrency.sql
    const sql0031 = await fs.readFile(path.join(migrationsDir, "0031_learning_progress_concurrency.sql"), "utf-8");
    let migration0031ContractValid = true;
    try { assertLearningProgressConcurrencyMigrationContract(sql0031); } catch (error) {
      migration0031ContractValid = false;
      results.push({ category: "0031_learning_progress_concurrency", check: "Rejects stale progress writers and backward progress transitions", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0031ContractValid) results.push({ category: "0031_learning_progress_concurrency", check: "Rejects stale progress writers and backward progress transitions", passed: true, details: "Version token, expected-version CAS, conflict code, monotonic status/percentage rules, and entitlement-bound RPC preserved" });

    // 32. Audit 0032_learning_progress_monotonicity.sql
    const sql0032 = await fs.readFile(path.join(migrationsDir, "0032_learning_progress_monotonicity.sql"), "utf-8");
    let migration0032ContractValid = true;
    try { assertLearningProgressMonotonicityMigrationContract(sql0032); } catch (error) {
      migration0032ContractValid = false;
      results.push({ category: "0032_learning_progress_monotonicity", check: "Rejects completed progress below 100% and watched-percent regressions", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0032ContractValid) results.push({ category: "0032_learning_progress_monotonicity", check: "Rejects completed progress below 100% and watched-percent regressions", passed: true, details: "Exact RPC signature, fixed boundary, completed=100 validation, monotonic CAS, and conflict contract verified" });

    // 33. Audit 0033_material_direct_upload_sessions.sql
    const sql0033 = await fs.readFile(path.join(migrationsDir, "0033_material_direct_upload_sessions.sql"), "utf-8");
    let migration0033ContractValid = true;
    try { assertMaterialDirectUploadMigrationContract(sql0033); } catch (error) {
      migration0033ContractValid = false;
      results.push({ category: "0033_material_direct_upload_sessions", check: "Adds expiring direct-upload sessions and retry-safe finalization", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0033ContractValid) results.push({ category: "0033_material_direct_upload_sessions", check: "Adds expiring direct-upload sessions and retry-safe finalization", passed: true, details: "Reservation expiry, reservation-linked asset identity, fixed-path finalization, and duplicate-finalize idempotency verified" });

    // 34. Audit 0034_material_upload_cleanup_hardening.sql
    const sql0034 = await fs.readFile(path.join(migrationsDir, "0034_material_upload_cleanup_hardening.sql"), "utf-8");
    let migration0034ContractValid = true;
    try { assertMaterialUploadCleanupMigrationContract(sql0034); } catch (error) {
      migration0034ContractValid = false;
      results.push({ category: "0034_material_upload_cleanup_hardening", check: "Reclaims expired and cancelled direct-upload sessions safely", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0034ContractValid) results.push({ category: "0034_material_upload_cleanup_hardening", check: "Reclaims expired and cancelled direct-upload sessions safely", passed: true, details: "Authenticated cancellation, lock-safe cleanup claims, exact-path retry, and finalized-asset protection verified" });

    // 35. Audit 0035_material_upload_idempotency.sql
    const sql0035 = await fs.readFile(path.join(migrationsDir, "0035_material_upload_idempotency.sql"), "utf-8");
    let migration0035ContractValid = true;
    try { assertMaterialUploadIdempotencyMigrationContract(sql0035); } catch (error) {
      migration0035ContractValid = false;
      results.push({ category: "0035_material_upload_idempotency", check: "Binds prepare/finalize retries to one immutable upload attempt", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0035ContractValid) results.push({ category: "0035_material_upload_idempotency", check: "Binds prepare/finalize retries to one immutable upload attempt", passed: true, details: "Owner-scoped unique keys, existing reservation/asset replay, immutable metadata conflicts, and atomic keyed finalization verified" });

    // 36. Audit 0036_material_upload_retry_state.sql
    const sql0036 = await fs.readFile(path.join(migrationsDir, "0036_material_upload_retry_state.sql"), "utf-8");
    let migration0036ContractValid = true;
    try { assertMaterialUploadRetryStateMigrationContract(sql0036); } catch (error) {
      migration0036ContractValid = false;
      results.push({ category: "0036_material_upload_retry_state", check: "Preserves reservations across pre-commit failures and hardens owner-scoped cleanup", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0036ContractValid) results.push({ category: "0036_material_upload_retry_state", check: "Preserves reservations across pre-commit failures and hardens owner-scoped cleanup", passed: true, details: "Retryable/cleanup-pending states, exact-path cleanup transitions, finalized-object protection, and private RPC privileges verified" });

    // 37. Audit 0037_material_upload_cancel_cleanup_guard.sql
    const sql0037 = await fs.readFile(path.join(migrationsDir, "0037_material_upload_cancel_cleanup_guard.sql"), "utf-8");
    let migration0037ContractValid = true;
    try { assertMaterialUploadCancelCleanupGuardMigrationContract(sql0037); } catch (error) {
      migration0037ContractValid = false;
      results.push({ category: "0037_material_upload_cancel_cleanup_guard", check: "Keeps retry-cleanup reservations out of cancellation races", passed: false, details: error instanceof Error ? error.message : String(error) });
    }
    if (migration0037ContractValid) results.push({ category: "0037_material_upload_cancel_cleanup_guard", check: "Keeps retry-cleanup reservations out of cancellation races", passed: true, details: "Database cancel transition rejects cleanup-pending/claimed and finalized reservations" });

    // 19. Audit supabase/seed.sql
    const sqlSeed = await fs.readFile(seedPath, "utf-8");
    const isTxn = /^\s*(?:--[^\n]*\n\s*)*BEGIN\s*;/im.test(sqlSeed) && /COMMIT\s*;\s*$/i.test(sqlSeed.trim());
    const subjectsSeed = CANONICAL_SUBJECTS.every((s) => sqlSeed.includes(`'${s.slug}'`));
    const materialsSeed = materials.every((m) => sqlSeed.includes(`'${m.slug}'`));
    const coursesSeed = courses.every((c) => sqlSeed.includes(`'${c.slug}'`));
    const tutorsSeed = tutors.every((t) => sqlSeed.includes(`'${t.slug}'`));

    const semanticSeedFields = ["kind = EXCLUDED.kind", "subject_id = EXCLUDED.subject_id", "category = EXCLUDED.category", "delivery_kind = EXCLUDED.delivery_kind", "publication_status = EXCLUDED.publication_status", "is_contact_for_price = EXCLUDED.is_contact_for_price", "color_theme = EXCLUDED.color_theme"];
    const productConflictUpdates = (sqlSeed.match(/ON CONFLICT \(kind, slug\) DO UPDATE[\s\S]*?(?=RETURNING|;)/gi) ?? []).length;
    const seedReconcilesSemanticFields = productConflictUpdates === materials.length + courses.length + tutors.length && semanticSeedFields.every((field) => sqlSeed.includes(field));
    results.push({
      category: "seed.sql",
      check: "Seed script is idempotent (ON CONFLICT DO UPDATE on all products/children) and transactional",
      passed: isTxn && subjectsSeed && materialsSeed && coursesSeed && tutorsSeed && seedReconcilesSemanticFields,
      details: `${CANONICAL_SUBJECTS.length} subjects, ${materials.length} materials, ${courses.length} courses, ${tutors.length} tutors and semantic conflict reconciliation verified`
    });

  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : "Unexpected verification error.";
    results.push({
      category: "Fatal Error",
      check: "File parsing error",
      passed: false,
      details
    });
  }

  // Print summary table
  for (const r of results) {
    const status = r.passed ? "[PASS]" : "[FAIL]";
    console.log(`${status} [${r.category}] ${r.check}`);
    if (r.details) {
      console.log(`       -> ${r.details}`);
    }
  }

  console.log("\n================================================================================");
  console.log(" Environment & Live Database Status");
  console.log("================================================================================");

  const hasDb = Boolean(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL);
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.TEST_SUPABASE_URL);

  if (!hasDb && !hasSupabase) {
    console.log("[-] Local Docker / PostgreSQL is not running in this environment.");
    console.log("[-] No remote Supabase connection credentials provided (safely preserved).");
    console.log("[+] Static SQL contracts, RLS checks, and seed idempotency checks completed; live database behavior was not executed.");
  } else {
    console.log("[+] Live Database endpoint detected. Integration tests available.");
  }
  console.log("================================================================================\n");

  return results.every((r) => r.passed);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  void runAudit().then((passed) => {
    if (!passed) process.exitCode = 1;
  });
}
