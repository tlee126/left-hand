import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type StudyPlanRow = Database["public"]["Tables"]["study_plans"]["Row"];
type StudyPlanInsert = Database["public"]["Tables"]["study_plans"]["Insert"];
type StudyPlanUpdate = Database["public"]["Tables"]["study_plans"]["Update"];
type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];

export type StudyPlanStatus = "pending" | "in_progress" | "completed";

export type StudyPlan = Omit<StudyPlanRow, "status"> & { status: StudyPlanStatus };
export type StudyPlanSubject = Pick<SubjectRow, "id" | "slug" | "name" | "category" | "color_theme">;

export interface ListStudyPlansOptions {
  startDate?: string;
  endDate?: string;
  status?: StudyPlanStatus;
  subjectId?: string;
  limit?: number;
}

export interface CreateStudyPlanInput {
  taskDate: string;
  title: string;
  subjectId: string;
  durationMinutes: number;
  status?: StudyPlanStatus;
}

export interface UpdateStudyPlanInput {
  taskDate: string;
  title: string;
  subjectId: string;
  durationMinutes: number;
  status: StudyPlanStatus;
}

export interface DailyStudyPlanProgress {
  date: string;
  totalTasks: number;
  completedTasks: number;
  totalMinutes: number;
  completedMinutes: number;
  percentage: number;
}

export const STUDY_PLAN_COLUMNS = [
  "id",
  "user_id",
  "task_date",
  "title",
  "subject_id",
  "duration_minutes",
  "status",
  "completed_at",
  "created_at",
  "updated_at"
] as const;

export const STUDY_PLAN_SELECT = STUDY_PLAN_COLUMNS.join(", ");
export const STUDY_PLAN_SUBJECT_COLUMNS = ["id", "slug", "name", "category", "color_theme"] as const;
export const STUDY_PLAN_SUBJECT_SELECT = STUDY_PLAN_SUBJECT_COLUMNS.join(", ");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const STATUSES = new Set<StudyPlanStatus>(["pending", "in_progress", "completed"]);
const MAX_STUDY_PLANS = 500;
const MAX_SUBJECTS = 100;

const LIST_KEYS = new Set(["startDate", "endDate", "status", "subjectId", "limit"]);
const CREATE_REQUIRED_KEYS = new Set(["taskDate", "title", "subjectId", "durationMinutes"]);
const CREATE_OPTIONAL_KEYS = new Set(["status"]);
const UPDATE_REQUIRED_KEYS = new Set(["taskDate", "title", "subjectId", "durationMinutes", "status"]);

export class StudyPlanInputError extends Error {
  constructor(message = "Invalid study plan input.") {
    super(message);
    this.name = "StudyPlanInputError";
  }
}

export class StudyPlanRepositoryError extends Error {
  constructor(message = "Study plan operation failed.") {
    super(message);
    this.name = "StudyPlanRepositoryError";
  }
}

function repositoryFailure(): never {
  throw new StudyPlanRepositoryError();
}

function canonicalUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new StudyPlanInputError();
  return value.toLowerCase();
}

export function isValidStudyPlanDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
}

export function getVietnamDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function hasExactKeys(record: object, required: ReadonlySet<string>, optional: ReadonlySet<string> = new Set()): boolean {
  const keys = Reflect.ownKeys(record);
  return [...required].every((key) => Object.prototype.hasOwnProperty.call(record, key))
    && keys.every((key) => typeof key === "string" && (required.has(key) || optional.has(key)));
}

function validateTitle(value: unknown): string {
  if (typeof value !== "string") throw new StudyPlanInputError();
  const title = value.trim();
  if (title.length < 1 || title.length > 200) throw new StudyPlanInputError();
  return title;
}

function validateDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 1440) {
    throw new StudyPlanInputError();
  }
  return value;
}

function validateStatus(value: unknown): StudyPlanStatus {
  if (typeof value !== "string" || !STATUSES.has(value as StudyPlanStatus)) throw new StudyPlanInputError();
  return value as StudyPlanStatus;
}

function validateDate(value: unknown): string {
  if (!isValidStudyPlanDate(value)) throw new StudyPlanInputError();
  return value;
}

export function validateListStudyPlansOptions(input: unknown = {}): ListStudyPlansOptions {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new StudyPlanInputError();
  const record = input as Record<string, unknown>;
  if (!Reflect.ownKeys(record).every((key) => typeof key === "string" && LIST_KEYS.has(key))) throw new StudyPlanInputError();

  const startDate = record.startDate === undefined ? undefined : validateDate(record.startDate);
  const endDate = record.endDate === undefined ? undefined : validateDate(record.endDate);
  if (startDate && endDate && startDate > endDate) throw new StudyPlanInputError();
  const status = record.status === undefined ? undefined : validateStatus(record.status);
  const subjectId = record.subjectId === undefined ? undefined : canonicalUuid(record.subjectId);
  const limit = record.limit === undefined ? MAX_STUDY_PLANS : record.limit;
  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > MAX_STUDY_PLANS) throw new StudyPlanInputError();
  return { startDate, endDate, status, subjectId, limit };
}

export function validateCreateStudyPlanInput(input: unknown): CreateStudyPlanInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new StudyPlanInputError();
  const record = input as Record<string, unknown>;
  if (!hasExactKeys(record, CREATE_REQUIRED_KEYS, CREATE_OPTIONAL_KEYS)) throw new StudyPlanInputError();
  const status = record.status === undefined ? "pending" : validateStatus(record.status);
  if (status === "completed") throw new StudyPlanInputError();
  return {
    taskDate: validateDate(record.taskDate),
    title: validateTitle(record.title),
    subjectId: canonicalUuid(record.subjectId),
    durationMinutes: validateDuration(record.durationMinutes),
    status
  };
}

export function validateUpdateStudyPlanInput(input: unknown): UpdateStudyPlanInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new StudyPlanInputError();
  const record = input as Record<string, unknown>;
  if (!hasExactKeys(record, UPDATE_REQUIRED_KEYS)) throw new StudyPlanInputError();
  return {
    taskDate: validateDate(record.taskDate),
    title: validateTitle(record.title),
    subjectId: canonicalUuid(record.subjectId),
    durationMinutes: validateDuration(record.durationMinutes),
    status: validateStatus(record.status)
  };
}

function isValidStudyPlanRow(value: unknown): value is StudyPlan {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (!UUID_PATTERN.test(String(row.id))
    || !UUID_PATTERN.test(String(row.user_id))
    || !UUID_PATTERN.test(String(row.subject_id))
    || !isValidStudyPlanDate(row.task_date)
    || typeof row.title !== "string"
    || row.title !== row.title.trim()
    || row.title.length < 1
    || row.title.length > 200
    || typeof row.duration_minutes !== "number"
    || !Number.isInteger(row.duration_minutes)
    || row.duration_minutes < 1
    || row.duration_minutes > 1440
    || typeof row.status !== "string"
    || !STATUSES.has(row.status as StudyPlanStatus)
    || (row.completed_at !== null && typeof row.completed_at !== "string")
    || typeof row.created_at !== "string"
    || typeof row.updated_at !== "string") return false;
  return row.status === "completed" ? row.completed_at !== null : row.completed_at === null;
}

function compareStudyPlans(left: StudyPlan, right: StudyPlan): number {
  return left.task_date.localeCompare(right.task_date)
    || left.created_at.localeCompare(right.created_at)
    || left.id.localeCompare(right.id);
}

function validateUserAndId(userId: string, id: string): { userId: string; id: string } {
  return { userId: canonicalUuid(userId), id: canonicalUuid(id) };
}

/** Lists only bounded, deterministic study-plan rows owned by the supplied authenticated user. */
export async function listStudyPlans(userId: string, options: ListStudyPlansOptions = {}): Promise<StudyPlan[]> {
  if (arguments.length < 1 || arguments.length > 2) throw new StudyPlanInputError();
  const canonicalUserId = canonicalUuid(userId);
  const validated = validateListStudyPlansOptions(options);
  try {
    const supabase = await createClient();
    let query = supabase.from("study_plans").select(STUDY_PLAN_SELECT).eq("user_id", canonicalUserId);
    if (validated.startDate) query = query.gte("task_date", validated.startDate);
    if (validated.endDate) query = query.lte("task_date", validated.endDate);
    if (validated.status) query = query.eq("status", validated.status);
    if (validated.subjectId) query = query.eq("subject_id", validated.subjectId);
    const { data, error } = await query
      .order("task_date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(validated.limit ?? MAX_STUDY_PLANS);
    if (error || !Array.isArray(data) || data.length > (validated.limit ?? MAX_STUDY_PLANS)) return repositoryFailure();
    const rows = data as unknown[];
    if (!rows.every(isValidStudyPlanRow)) return repositoryFailure();
    if (!rows.every((row) => canonicalUuid(row.user_id) === canonicalUserId)) return repositoryFailure();
    return rows.slice().sort(compareStudyPlans);
  } catch (error) {
    if (error instanceof StudyPlanInputError || error instanceof StudyPlanRepositoryError) throw error;
    return repositoryFailure();
  }
}

/** Provides safe subject labels for the editor; subjects contain no user-owned data. */
export async function listStudyPlanSubjects(): Promise<StudyPlanSubject[]> {
  if (arguments.length !== 0) throw new StudyPlanInputError();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("subjects")
      .select(STUDY_PLAN_SUBJECT_SELECT)
      .order("name", { ascending: true })
      .limit(MAX_SUBJECTS);
    if (error || !Array.isArray(data) || data.length > MAX_SUBJECTS) return repositoryFailure();
    const rows = data as unknown[];
    if (!rows.every((value) => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
      const row = value as Record<string, unknown>;
      return UUID_PATTERN.test(String(row.id))
        && typeof row.slug === "string"
        && typeof row.name === "string"
        && typeof row.category === "string"
        && typeof row.color_theme === "string";
    })) return repositoryFailure();
    return rows as StudyPlanSubject[];
  } catch (error) {
    if (error instanceof StudyPlanInputError || error instanceof StudyPlanRepositoryError) throw error;
    return repositoryFailure();
  }
}

export async function createStudyPlan(userId: string, input: CreateStudyPlanInput): Promise<StudyPlan> {
  if (arguments.length !== 2) throw new StudyPlanInputError();
  const canonicalUserId = canonicalUuid(userId);
  const validated = validateCreateStudyPlanInput(input);
  try {
    const supabase = await createClient();
    const payload: StudyPlanInsert = {
      user_id: canonicalUserId,
      task_date: validated.taskDate,
      title: validated.title,
      subject_id: validated.subjectId,
      duration_minutes: validated.durationMinutes,
      status: validated.status
    };
    const { data, error } = await supabase
      .from("study_plans")
      .insert(payload)
      .select(STUDY_PLAN_SELECT)
      .single();
    if (error || !isValidStudyPlanRow(data)) return repositoryFailure();
    if (canonicalUuid(data.user_id) !== canonicalUserId
      || canonicalUuid(data.subject_id) !== validated.subjectId
      || data.task_date !== validated.taskDate
      || data.title !== validated.title
      || data.duration_minutes !== validated.durationMinutes
      || data.status !== validated.status) return repositoryFailure();
    return data;
  } catch (error) {
    if (error instanceof StudyPlanInputError || error instanceof StudyPlanRepositoryError) throw error;
    return repositoryFailure();
  }
}

export async function updateStudyPlan(userId: string, id: string, input: UpdateStudyPlanInput): Promise<StudyPlan> {
  if (arguments.length !== 3) throw new StudyPlanInputError();
  const identifiers = validateUserAndId(userId, id);
  const validated = validateUpdateStudyPlanInput(input);
  try {
    const supabase = await createClient();
    const payload: StudyPlanUpdate = {
      task_date: validated.taskDate,
      title: validated.title,
      subject_id: validated.subjectId,
      duration_minutes: validated.durationMinutes,
      status: validated.status,
      completed_at: validated.status === "completed" ? new Date().toISOString() : null
    };
    const { data, error } = await supabase
      .from("study_plans")
      .update(payload)
      .eq("user_id", identifiers.userId)
      .eq("id", identifiers.id)
      .select(STUDY_PLAN_SELECT)
      .single();
    if (error || !isValidStudyPlanRow(data)) return repositoryFailure();
    if (canonicalUuid(data.user_id) !== identifiers.userId
      || canonicalUuid(data.id) !== identifiers.id
      || canonicalUuid(data.subject_id) !== validated.subjectId
      || data.task_date !== validated.taskDate
      || data.title !== validated.title
      || data.duration_minutes !== validated.durationMinutes
      || data.status !== validated.status) return repositoryFailure();
    return data;
  } catch (error) {
    if (error instanceof StudyPlanInputError || error instanceof StudyPlanRepositoryError) throw error;
    return repositoryFailure();
  }
}

export async function markStudyPlanCompleted(userId: string, id: string): Promise<StudyPlan> {
  if (arguments.length !== 2) throw new StudyPlanInputError();
  const identifiers = validateUserAndId(userId, id);
  try {
    const supabase = await createClient();
    const payload: StudyPlanUpdate = { status: "completed", completed_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("study_plans")
      .update(payload)
      .eq("user_id", identifiers.userId)
      .eq("id", identifiers.id)
      .select(STUDY_PLAN_SELECT)
      .single();
    if (error || !isValidStudyPlanRow(data)) return repositoryFailure();
    if (canonicalUuid(data.user_id) !== identifiers.userId
      || canonicalUuid(data.id) !== identifiers.id
      || data.status !== "completed") return repositoryFailure();
    return data;
  } catch (error) {
    if (error instanceof StudyPlanInputError || error instanceof StudyPlanRepositoryError) throw error;
    return repositoryFailure();
  }
}

export const completeStudyPlan = markStudyPlanCompleted;

export function calculateDailyStudyPlanProgress(tasks: readonly StudyPlan[], date: string): DailyStudyPlanProgress {
  const targetDate = validateDate(date);
  const matchingTasks = tasks.filter((task) => task.task_date === targetDate);
  const completedTasks = matchingTasks.filter((task) => task.status === "completed");
  const totalMinutes = matchingTasks.reduce((sum, task) => sum + task.duration_minutes, 0);
  const completedMinutes = completedTasks.reduce((sum, task) => sum + task.duration_minutes, 0);
  return {
    date: targetDate,
    totalTasks: matchingTasks.length,
    completedTasks: completedTasks.length,
    totalMinutes,
    completedMinutes,
    percentage: matchingTasks.length === 0 ? 0 : Math.round((completedTasks.length / matchingTasks.length) * 100)
  };
}

function previousDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

export function calculateStudyPlanStreak(tasksOrDates: readonly StudyPlan[] | readonly string[], throughDate = getVietnamDate()): number {
  const targetDate = validateDate(throughDate);
  const completedDates = new Set(
    tasksOrDates.map((entry) => typeof entry === "string" ? entry : entry.status === "completed" ? entry.task_date : null)
      .filter((date): date is string => date !== null && isValidStudyPlanDate(date) && date <= targetDate)
  );
  let cursor = completedDates.has(targetDate) ? targetDate : previousDate(targetDate);
  let streak = 0;
  while (completedDates.has(cursor)) {
    streak += 1;
    cursor = previousDate(cursor);
  }
  return streak;
}

export async function getDailyStudyPlanProgress(userId: string, date: string): Promise<DailyStudyPlanProgress> {
  const targetDate = validateDate(date);
  const tasks = await listStudyPlans(userId, { startDate: targetDate, endDate: targetDate });
  return calculateDailyStudyPlanProgress(tasks, targetDate);
}

export async function getStudyPlanStreak(userId: string, throughDate = getVietnamDate()): Promise<number> {
  const targetDate = validateDate(throughDate);
  const tasks = await listStudyPlans(userId, { endDate: targetDate, status: "completed" });
  return calculateStudyPlanStreak(tasks, targetDate);
}

export const calculateDailyProgress = calculateDailyStudyPlanProgress;
export const calculateStreak = calculateStudyPlanStreak;
