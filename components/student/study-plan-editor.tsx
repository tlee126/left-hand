"use client";

import { useEffect, useRef, useState } from "react";
import type { StudyPlan, StudyPlanStatus, StudyPlanSubject } from "@/lib/repositories/study-plan-repository";

interface StudyPlanEditorProps {
  task: StudyPlan;
  subjects: StudyPlanSubject[];
  pending?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  onSubmit: (input: { taskDate: string; title: string; subjectId: string; durationMinutes: number; status: StudyPlanStatus }) => void;
  onCancel: () => void;
}

export function StudyPlanEditor({ task, subjects, pending = false, errorMessage, successMessage, onSubmit, onCancel }: StudyPlanEditorProps) {
  const [taskDate, setTaskDate] = useState(task.task_date);
  const [title, setTitle] = useState(task.title);
  const [subjectId, setSubjectId] = useState(task.subject_id);
  const [durationMinutes, setDurationMinutes] = useState(String(task.duration_minutes));
  const [status, setStatus] = useState<StudyPlanStatus>(task.status);
  useEffect(() => { setTaskDate(task.task_date); setTitle(task.title); setSubjectId(task.subject_id); setDurationMinutes(String(task.duration_minutes)); setStatus(task.status); }, [task]);
  const hasCurrentSubject = subjects.some((subject) => subject.id.toLowerCase() === subjectId.toLowerCase());
  return <form className="mt-4 rounded-2xl border-2 border-[#1765e9]/20 bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); onSubmit({ taskDate, title, subjectId, durationMinutes: Number(durationMinutes), status }); }}><div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-black text-[#13245d]">Chỉnh sửa việc học</h4><button type="button" onClick={onCancel} className="text-xs font-bold text-[#8091b8] hover:text-[#13245d]">Đóng</button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-[#5f6d8f]">Ngày<input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]" required /></label><label className="text-xs font-bold text-[#5f6d8f]">Thời lượng (phút)<input type="number" min="1" max="1440" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]" required /></label><label className="text-xs font-bold text-[#5f6d8f] sm:col-span-2">Tên việc học<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]" required /></label><label className="text-xs font-bold text-[#5f6d8f]">Môn học<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]" required>{!hasCurrentSubject && <option value={task.subject_id}>Môn hiện tại</option>}{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="text-xs font-bold text-[#5f6d8f]">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as StudyPlanStatus)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]"><option value="pending">Chưa bắt đầu</option><option value="in_progress">Đang học</option><option value="completed">Đã hoàn thành</option></select></label></div>{errorMessage && <p role="alert" className="mt-3 text-xs font-bold text-red-600">{errorMessage}</p>}{successMessage && <p role="status" className="mt-3 text-xs font-bold text-emerald-600">{successMessage}</p>}<button type="submit" disabled={pending} className="mt-4 inline-flex rounded-full bg-[#1765e9] px-4 py-2 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Đang lưu..." : "Lưu thay đổi"}</button></form>;
}

interface StudyPlanCreateFormProps {
  subjects: StudyPlanSubject[];
  pending?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  onSubmit: (input: { requestKey: string; taskDate: string; title: string; subjectId: string; durationMinutes: number; status?: StudyPlanStatus }) => void;
  onCancel: () => void;
}

export function StudyPlanCreateForm({ subjects, pending = false, errorMessage, successMessage, onSubmit, onCancel }: StudyPlanCreateFormProps) {
  const requestKeyRef = useRef<string | null>(null);
  if (!requestKeyRef.current) requestKeyRef.current = globalThis.crypto.randomUUID();
  const [taskDate, setTaskDate] = useState("");
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [durationMinutes, setDurationMinutes] = useState("25");
  const [status, setStatus] = useState<StudyPlanStatus>("pending");
  return <form className="mt-4 rounded-2xl border-2 border-[#1765e9]/20 bg-white p-4 shadow-sm" onSubmit={(event) => { event.preventDefault(); onSubmit({ requestKey: requestKeyRef.current!, taskDate, title, subjectId, durationMinutes: Number(durationMinutes), status }); }}><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-[#5f6d8f]">Ngày<input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]" required /></label><label className="text-xs font-bold text-[#5f6d8f]">Thời lượng (phút)<input type="number" min="1" max="1440" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]" required /></label><label className="text-xs font-bold text-[#5f6d8f] sm:col-span-2">Tên việc học<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]" required /></label><label className="text-xs font-bold text-[#5f6d8f]">Môn học<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]" required disabled={subjects.length === 0}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="text-xs font-bold text-[#5f6d8f]">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as StudyPlanStatus)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#13245d]"><option value="pending">Chưa bắt đầu</option><option value="in_progress">Đang học</option></select></label></div>{subjects.length === 0 && <p className="mt-3 text-xs font-bold text-[#8091b8]">Chưa có môn học khả dụng từ máy chủ.</p>}{errorMessage && <p role="alert" className="mt-3 text-xs font-bold text-red-600">{errorMessage}</p>}{successMessage && <p role="status" className="mt-3 text-xs font-bold text-emerald-600">{successMessage}</p>}<div className="mt-4 flex gap-2"><button type="submit" disabled={pending || subjects.length === 0} className="inline-flex rounded-full bg-[#1765e9] px-4 py-2 text-xs font-black text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Đang lưu..." : "Thêm việc"}</button><button type="button" onClick={onCancel} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-[#13245d]">Hủy</button></div></form>;
}
