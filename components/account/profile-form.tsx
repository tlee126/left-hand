"use client";

import { useActionState, useState } from "react";
import { StudentProfile } from "@/lib/repositories/profile-repository";
import { updateProfileAction, ProfileActionResult } from "@/app/ca-nhan/cai-dat/actions";
import { User, BookOpen, GraduationCap, Trophy, CheckCircle, AlertCircle, Sparkles } from "lucide-react";

interface ProfileFormProps {
  initialProfile: StudentProfile | null;
  authUserEmail: string | null;
}

const initialState: ProfileActionResult = {
  success: false
};

export function ProfileForm({ initialProfile, authUserEmail }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  const [fullName, setFullName] = useState(initialProfile?.fullName || "");
  const [faculty, setFaculty] = useState(initialProfile?.faculty || "");
  const [major, setMajor] = useState(initialProfile?.major || "");
  const [gpaGoal, setGpaGoal] = useState(
    initialProfile?.gpaGoal !== null && initialProfile?.gpaGoal !== undefined
      ? String(initialProfile.gpaGoal)
      : "3.6"
  );

  return (
    <form action={formAction} className="space-y-6">
      {/* Email Display (Read-only) */}
      <div>
        <label className="block text-xs font-black uppercase tracking-wider text-[#13245d] mb-1.5">
          Email học tập (được cấp quyền)
        </label>
        <div className="relative">
          <input
            type="email"
            disabled
            value={authUserEmail || initialProfile?.email || "student@lefthand.vn"}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-100/80 px-4 text-sm font-bold text-slate-500 cursor-not-allowed outline-none"
          />
        </div>
        <p className="mt-1 text-[11px] font-semibold text-[#8091b8]">
          Email tài khoản được cố định để gắn liền với quyền truy cập tài liệu và khóa học đã mua.
        </p>
      </div>

      {/* Full Name */}
      <div>
        <label htmlFor="fullName" className="block text-xs font-black uppercase tracking-wider text-[#13245d] mb-1.5">
          Họ và tên <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8091b8]" />
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            disabled={isPending}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nguyễn Văn A"
            className="h-11 w-full rounded-2xl border border-[#d8deef] bg-white pl-10 pr-4 text-sm font-medium text-[#22325f] outline-none transition focus:border-[#13245d] focus:ring-4 focus:ring-[#13245d]/5 disabled:opacity-60"
          />
        </div>
        {state.errors?.fullName && (
          <p className="mt-1 text-xs font-bold text-red-500">{state.errors.fullName}</p>
        )}
      </div>

      {/* Faculty & Major (2 Columns) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="faculty" className="block text-xs font-black uppercase tracking-wider text-[#13245d] mb-1.5">
            Khoa / Viện
          </label>
          <div className="relative">
            <BookOpen className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8091b8]" />
            <input
              id="faculty"
              name="faculty"
              type="text"
              disabled={isPending}
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              placeholder="VD: Kế toán - Kiểm toán"
              className="h-11 w-full rounded-2xl border border-[#d8deef] bg-white pl-10 pr-4 text-sm font-medium text-[#22325f] outline-none transition focus:border-[#13245d] focus:ring-4 focus:ring-[#13245d]/5 disabled:opacity-60"
            />
          </div>
          {state.errors?.faculty && (
            <p className="mt-1 text-xs font-bold text-red-500">{state.errors.faculty}</p>
          )}
        </div>

        <div>
          <label htmlFor="major" className="block text-xs font-black uppercase tracking-wider text-[#13245d] mb-1.5">
            Chuyên ngành
          </label>
          <div className="relative">
            <GraduationCap className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8091b8]" />
            <input
              id="major"
              name="major"
              type="text"
              disabled={isPending}
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="VD: Kiểm toán"
              className="h-11 w-full rounded-2xl border border-[#d8deef] bg-white pl-10 pr-4 text-sm font-medium text-[#22325f] outline-none transition focus:border-[#13245d] focus:ring-4 focus:ring-[#13245d]/5 disabled:opacity-60"
            />
          </div>
          {state.errors?.major && (
            <p className="mt-1 text-xs font-bold text-red-500">{state.errors.major}</p>
          )}
        </div>
      </div>

      {/* GPA Goal */}
      <div>
        <label htmlFor="gpaGoal" className="block text-xs font-black uppercase tracking-wider text-[#13245d] mb-1.5">
          Mục tiêu GPA (Thang điểm 4.0)
        </label>
        <div className="relative">
          <Trophy className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8091b8]" />
          <input
            id="gpaGoal"
            name="gpaGoal"
            type="number"
            step="0.01"
            min="0"
            max="4.0"
            disabled={isPending}
            value={gpaGoal}
            onChange={(e) => setGpaGoal(e.target.value)}
            placeholder="3.6"
            className="h-11 w-full rounded-2xl border border-[#d8deef] bg-white pl-10 pr-4 text-sm font-medium text-[#22325f] outline-none transition focus:border-[#13245d] focus:ring-4 focus:ring-[#13245d]/5 disabled:opacity-60"
          />
        </div>
        <p className="mt-1 text-[11px] font-semibold text-[#8091b8]">
          Nhập số từ 0.0 đến 4.0 (ví dụ: 3.2, 3.6, 3.8).
        </p>
        {state.errors?.gpaGoal && (
          <p className="mt-1 text-xs font-bold text-red-500">{state.errors.gpaGoal}</p>
        )}
      </div>

      {/* Feedback alerts */}
      {state.success && state.message && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200/80 p-3.5 text-xs font-bold text-emerald-800 animate-in fade-in duration-200">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      {!state.success && state.message && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 border border-red-200/80 p-3.5 text-xs font-bold text-red-700 animate-in fade-in duration-200">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span>{state.message}</span>
        </div>
      )}

      {/* Submit button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="relative inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Đang lưu thay đổi...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Lưu thông tin hồ sơ</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
