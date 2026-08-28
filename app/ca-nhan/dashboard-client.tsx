"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/floating-actions";
import { purchasedSubjects, studentStats, todayPlan, demoStudent, TaskItem, DemoStudent } from "@/data/student-demo";
import { StudentProfile } from "@/lib/repositories/profile-repository";
import { MotionReveal } from "@/components/site/motion-reveal";
import { Clock, Trophy, TrendingUp, BookOpen, Flame, Calendar, Settings, User } from "lucide-react";

// Import custom student components
import { DashboardHero } from "@/components/student/dashboard-hero";
import { DashboardStatCard } from "@/components/student/dashboard-stat-card";
import { TodayPlannerCard } from "@/components/student/today-planner-card";
import { SubjectFolderCard } from "@/components/student/subject-folder-card";
import { DashboardSidebar } from "@/components/student/dashboard-sidebar";

interface StudentDashboardClientProps {
  initialProfile?: StudentProfile | null;
  authUserEmail?: string | null;
}

export function StudentDashboardClient({
  initialProfile,
  authUserEmail
}: StudentDashboardClientProps) {
  const [mounted, setMounted] = useState(false);
  
  // Interactive checklist state
  const [tasks, setTasks] = useState<TaskItem[]>(todayPlan);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute active student identity from authenticated profile or fallback
  const currentStudent: DemoStudent = useMemo(() => {
    const fullName = initialProfile?.fullName || (authUserEmail ? authUserEmail.split("@")[0] : demoStudent.name);
    const initials = fullName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(-2)
      .join("")
      .toUpperCase() || "HV";

    return {
      name: fullName,
      email: initialProfile?.email || authUserEmail || demoStudent.email,
      faculty: initialProfile?.faculty || demoStudent.faculty,
      major: initialProfile?.major || demoStudent.major,
      gpaGoal:
        initialProfile?.gpaGoal !== undefined && initialProfile?.gpaGoal !== null
          ? Number(initialProfile.gpaGoal)
          : demoStudent.gpaGoal,
      avatarInitials: initials,
      currentGpa: demoStudent.currentGpa,
      streakDays: demoStudent.streakDays,
      nextExamDays: demoStudent.nextExamDays
    };
  }, [initialProfile, authUserEmail]);

  // Toggle task checkbox status (done / todo)
  const handleToggleTask = (taskId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id === taskId) {
          const nextStatus = task.status === "done" ? "todo" : "done";
          return { ...task, status: nextStatus };
        }
        return task;
      })
    );
  };

  // Compute lowest progress subject to dynamically link CTA
  const lowestProgressSubject = useMemo(() => {
    if (purchasedSubjects.length === 0) return null;
    return purchasedSubjects.reduce((prev, curr) => 
      prev.progressPercent < curr.progressPercent ? prev : curr
    );
  }, []);

  const lowestProgressSlug = lowestProgressSubject ? lowestProgressSubject.slug : null;

  // Compute dynamic quote based on data
  const dynamicQuote = useMemo(() => {
    if (currentStudent.nextExamDays <= 14) {
      return `Còn ${currentStudent.nextExamDays} ngày tới kỳ thi gần nhất — học các phần yếu trước sẽ hiệu quả hơn học dàn trải.`;
    }
    
    if (lowestProgressSubject && lowestProgressSubject.progressPercent < 45) {
      return `Môn "${lowestProgressSubject.title}" mới đạt ${lowestProgressSubject.progressPercent}% tiến độ. Hãy dành 25 phút học phần công thức hôm nay!`;
    }
    
    if (studentStats.weeklyProgress >= 60) {
      return `Bạn đã hoàn thành ${studentStats.weeklyProgress}% kế hoạch tuần này. Một phiên học ngắn nữa thôi là rất tốt!`;
    }

    return `Mỗi buổi học nhỏ hôm nay đang kéo GPA của bạn gần hơn mục tiêu ${currentStudent.gpaGoal}. Bắt đầu ngay nhé!`;
  }, [currentStudent, lowestProgressSubject]);

  // Stat Card configurations mapped to data
  const statsConfig = useMemo(() => [
    {
      label: "Hôm nay đã học",
      value: studentStats.todayStudyTime,
      microcopy: "+20 phút nữa là đủ một phiên học đẹp",
      icon: Clock,
      iconColor: "text-blue-500",
      borderColor: "border-blue-100",
      bgColor: "bg-blue-50/20"
    },
    {
      label: "Mục tiêu GPA",
      value: currentStudent.gpaGoal,
      microcopy: `Đang từ ${currentStudent.currentGpa} → ${currentStudent.gpaGoal}`,
      icon: Trophy,
      iconColor: "text-amber-500",
      borderColor: "border-amber-100",
      bgColor: "bg-amber-50/20"
    },
    {
      label: "Tiến độ tuần",
      value: `${studentStats.weeklyProgress}%`,
      microcopy: "Bạn đang giữ nhịp khá ổn",
      icon: TrendingUp,
      iconColor: "text-violet-500",
      borderColor: "border-violet-100",
      bgColor: "bg-violet-50/20"
    },
    {
      label: "Môn đã mua",
      value: purchasedSubjects.length,
      microcopy: "Sẵn sàng trong góc học tập",
      icon: BookOpen,
      iconColor: "text-rose-500",
      borderColor: "border-rose-100",
      bgColor: "bg-rose-50/20"
    },
    {
      label: "Streak học tập",
      value: `${currentStudent.streakDays} ngày`,
      microcopy: "Đừng để đứt mạch hôm nay",
      icon: Flame,
      iconColor: "text-orange-500",
      borderColor: "border-orange-100",
      bgColor: "bg-orange-50/20"
    },
    {
      label: "Kỳ thi gần nhất",
      value: `${currentStudent.nextExamDays} ngày`,
      microcopy: "Ưu tiên phần yếu trước",
      icon: Calendar,
      iconColor: "text-fuchsia-500",
      borderColor: "border-fuchsia-100",
      bgColor: "bg-fuchsia-50/20"
    }
  ], [currentStudent]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffdf9]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-sm font-semibold text-[#8091b8]">Đang tải dữ liệu học tập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent">
      {/* Soft background gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.14),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.12),transparent_28%),radial-gradient(circle_at_center_top,rgba(248,179,29,0.1),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[34rem] -z-10 h-[24rem] bg-[radial-gradient(circle_at_left,rgba(123,63,242,0.06),transparent_24%),radial-gradient(circle_at_right,rgba(23,101,233,0.06),transparent_26%)]" />
      
      <Header />

      <main className="mx-auto px-4 py-8 md:py-12 max-w-[1200px]">
        
        {/* Profile Settings Quick Link Bar */}
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#13245d]/10 bg-white/80 p-3.5 px-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2.5 text-xs font-bold text-[#13245d]">
            <User className="h-4 w-4 text-[#1765e9]" />
            <span>Khu học tập cá nhân &middot; {currentStudent.name}</span>
          </div>
          <Link
            href="/ca-nhan/cai-dat"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200/80 px-3 py-1.5 text-xs font-black text-[#13245d] transition hover:bg-[#13245d] hover:text-white"
          >
            <Settings className="h-3.5 w-3.5" />
            Cài đặt hồ sơ
          </Link>
        </div>

        {/* 1. Welcome Hero */}
        <MotionReveal className="mb-8">
          <DashboardHero
            student={currentStudent}
            stats={studentStats}
            tasks={tasks}
            lowestProgressSlug={lowestProgressSlug}
          />
        </MotionReveal>

        {/* 2. Stats Grid (6 cards) */}
        <MotionReveal className="mb-12">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {statsConfig.map((stat, i) => (
              <DashboardStatCard
                key={i}
                label={stat.label}
                value={stat.value}
                microcopy={stat.microcopy}
                icon={stat.icon}
                iconColor={stat.iconColor}
                borderColor={stat.borderColor}
                bgColor={stat.bgColor}
              />
            ))}
          </div>
        </MotionReveal>

        {/* 3. Main Body: 2 Columns */}
        <div className="grid gap-8 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_350px]">
          
          {/* Left column (Main content) */}
          <div className="space-y-12 min-w-0">
            {/* Checklist today */}
            <section id="plan" className="scroll-mt-28">
              <MotionReveal>
                <TodayPlannerCard 
                  tasks={tasks} 
                  onToggleTask={handleToggleTask} 
                  lowestProgressSlug={lowestProgressSlug}
                />
              </MotionReveal>
            </section>

            {/* Purchased Subjects Folder Grid */}
            <section className="space-y-6">
              <MotionReveal>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-[#13245d] tracking-tight">Môn học của bạn</h3>
                  <p className="text-xs text-[#8091b8] font-bold leading-normal mt-1">
                    Những môn/tài nguyên bạn đã được LEFT HAND cấp quyền truy cập.
                  </p>
                </div>
              </MotionReveal>

              <div className="grid gap-6 sm:grid-cols-2">
                {purchasedSubjects.map((subject) => (
                  <SubjectFolderCard 
                    key={subject.id} 
                    subject={subject} 
                  />
                ))}
              </div>
            </section>
          </div>

          {/* Right column (Widgets & mini profile) */}
          <div className="min-w-0">
            <MotionReveal>
              <DashboardSidebar
                student={currentStudent}
                stats={studentStats}
                lowestProgressSubject={lowestProgressSubject}
                dynamicQuote={dynamicQuote}
              />
            </MotionReveal>
          </div>

        </div>
      </main>

      <Footer />
      <FloatingActions />
    </div>
  );
}
