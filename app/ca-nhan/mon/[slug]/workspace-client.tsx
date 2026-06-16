"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDemoAuth } from "@/hooks/use-demo-auth";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { FloatingActions } from "@/components/site/floating-actions";
import { PurchasedSubject, SubjectDocument, CourseLesson, VideoItem } from "@/data/student-demo";
import { MotionReveal } from "@/components/site/motion-reveal";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen, 
  Calendar, 
  CheckCircle, 
  CheckSquare, 
  Clock, 
  Download, 
  ExternalLink,
  FileText, 
  HelpCircle,
  Home,
  MessageSquare, 
  Play,
  PlayCircle, 
  Sparkles, 
  Star,
  Trophy, 
  User, 
  X
} from "lucide-react";
import Link from "next/link";

interface SubjectWorkspaceClientProps {
  slug: string;
  initialSubject: PurchasedSubject;
}

type TabKey = "overview" | "documents" | "tutors" | "rooms" | "courses" | "videos";

export function SubjectWorkspaceClient({ slug, initialSubject }: SubjectWorkspaceClientProps) {
  const router = useRouter();
  const { isLoggedIn, user, loading } = useDemoAuth();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  
  // Interactive Local States
  const [documents, setDocuments] = useState<SubjectDocument[]>(initialSubject.documents);
  const [lessons, setLessons] = useState<CourseLesson[]>(initialSubject.courseLessons);
  const [videos, setVideos] = useState<VideoItem[]>(initialSubject.videos);
  
  // Toast notification state
  const [toast, setToast] = useState<string | null>(null);
  
  // Video player modal state
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !isLoggedIn) {
      router.push("/dang-nhap");
    }
  }, [mounted, loading, isLoggedIn, router]);

  // Show self-dismissing toast
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  // Toggle document status (unlearned -> in-progress -> completed -> unlearned)
  const toggleDocStatus = (docId: string) => {
    setDocuments(prevDocs => 
      prevDocs.map(doc => {
        if (doc.id === docId) {
          let nextStatus: "chưa học" | "đang học" | "đã học" = "chưa học";
          if (doc.status === "chưa học") nextStatus = "đang học";
          else if (doc.status === "đang học") nextStatus = "đã học";
          
          showToast(`Đã cập nhật trạng thái tài liệu sang: "${nextStatus.toUpperCase()}"`);
          return { ...doc, status: nextStatus };
        }
        return doc;
      })
    );
  };

  // Toggle lesson status
  const toggleLessonStatus = (lessonId: string) => {
    setLessons(prevLessons =>
      prevLessons.map(les => {
        if (les.id === lessonId) {
          let nextStatus: "chưa học" | "đang học" | "đã học" = "chưa học";
          if (les.status === "chưa học") nextStatus = "đang học";
          else if (les.status === "đang học") nextStatus = "đã học";
          
          showToast(`Đã lưu tiến độ buổi học: "${les.title}"`);
          return { ...les, status: nextStatus };
        }
        return les;
      })
    );
  };

  // Trigger quick play overlay
  const handlePlayVideo = (video: VideoItem) => {
    setActiveVideo(video);
    showToast(`Đang phát: ${video.title}`);
  };

  // Mark video as watched/completed
  const handleCompleteVideo = (videoId: string) => {
    setVideos(prevVids =>
      prevVids.map(v => {
        if (v.id === videoId) {
          const nextStatus = v.status === "đã học" ? "chưa học" : "đã học";
          const nextPercent = nextStatus === "đã học" ? 100 : 0;
          showToast(nextStatus === "đã học" ? "Đã đánh dấu xem xong video!" : "Đã đưa video về danh sách chưa xem.");
          return { ...v, status: nextStatus, watchedPercent: nextPercent };
        }
        return v;
      })
    );
    if (activeVideo?.id === videoId) {
      setActiveVideo(null);
    }
  };

  // Dynamic tabs mapping
  const tabsList: Array<{ id: TabKey; label: string; icon: any; badge?: string }> = [
    { id: "overview", label: "Tổng quan", icon: Sparkles },
    { id: "documents", label: "Tài liệu", icon: FileText, badge: `${documents.length}` },
    { id: "tutors", label: "Đăng ký kèm", icon: User },
    { id: "rooms", label: "Room ôn tập", icon: Calendar, badge: initialSubject.studyRooms.length > 0 ? "Hot" : undefined },
    { id: "courses", label: "Khóa học", icon: BookOpen },
    { id: "videos", label: "Video bài giảng", icon: PlayCircle }
  ];

  // Mapped badges for types
  const badgeColors = {
    "tài liệu": "bg-blue-50 text-blue-600 border border-blue-100",
    "khóa học": "bg-violet-50 text-violet-600 border border-violet-100",
    "tutor": "bg-rose-50 text-rose-600 border border-rose-100",
    "video": "bg-amber-50 text-amber-600 border border-amber-100"
  };

  const statusLabel = {
    "chưa học": { text: "Chưa học", class: "bg-slate-100 text-[#5f6d8f]" },
    "đang học": { text: "Đang học", class: "bg-amber-50 text-amber-600 border border-amber-100" },
    "đã học": { text: "Đã hoàn thành", class: "bg-emerald-50 text-emerald-600 border border-emerald-100" }
  };

  // Compute overall progress percent dynamically from local states
  const computedProgress = useMemo(() => {
    const totalDocs = documents.length;
    const completedDocs = documents.filter(d => d.status === "đã học").length;
    const inProgressDocs = documents.filter(d => d.status === "đang học").length;

    const totalLessons = lessons.length;
    const completedLessons = lessons.filter(l => l.status === "đã học").length;

    const totalVideos = videos.length;
    const completedVideos = videos.filter(v => v.status === "đã học").length;

    const totalItems = totalDocs + totalLessons + totalVideos;
    if (totalItems === 0) return 0;

    const completedScore = (completedDocs * 1) + (inProgressDocs * 0.5) + (completedLessons * 1) + (completedVideos * 1);
    return Math.round((completedScore / totalItems) * 100);
  }, [documents, lessons, videos]);

  // Handle CTA Continue study
  const handleContinueStudy = () => {
    // Determine the next tab depending on next action description
    const action = initialSubject.nextAction.toLowerCase();
    if (action.includes("video") || action.includes("xem")) {
      setActiveTab("videos");
      showToast("Chuyển sang Tab Bài giảng Video để học chương mới.");
    } else if (action.includes("đề") || action.includes("tài liệu") || action.includes("công thức")) {
      setActiveTab("documents");
      showToast("Chuyển sang Tab Tài liệu để tiếp tục ôn tập.");
    } else {
      setActiveTab("courses");
      showToast("Chuyển sang Tab Khóa học để học bài giảng mới.");
    }
  };

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffdf9]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-sm font-semibold text-[#8091b8]">Đang mở phòng học...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.14),transparent_28%)]" />
      
      <Header />

      <main className="container mx-auto px-4 py-8 md:px-8">
        
        {/* Navigation panel */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <Link
            href="/ca-nhan"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent transition hover:-translate-x-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại Cá nhân
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8a97b4] hover:text-accent"
          >
            <Home className="h-3.5 w-3.5" />
            Trang chủ
          </Link>
        </div>

        {/* Header môn học */}
        <MotionReveal className="mb-8 rounded-[28px] border border-[#1b2e7428] bg-white p-6 shadow-[0_12px_36px_rgba(19,37,79,0.05)]">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
            <div className="space-y-4 flex-1">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-[#edf2ff] px-3 py-1 text-[11px] font-extrabold text-[#3657d7] border border-blue-100">
                  {initialSubject.category}
                </span>
                {initialSubject.purchasedTypes.map(type => (
                  <span
                    key={type}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeColors[type]}`}
                  >
                    {type}
                  </span>
                ))}
              </div>

              <h2 className="text-2xl font-black text-[#132a67] sm:text-3xl">
                {initialSubject.title}
              </h2>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-[#617092]">
                <span className="flex items-center gap-1.5 text-[#e00071]">
                  <Trophy className="h-4 w-4" />
                  Mục tiêu: {initialSubject.goal}
                </span>
                <span className="text-slate-300 hidden sm:inline">|</span>
                <span>Học lần cuối: <strong>{initialSubject.lastStudied}</strong></span>
              </div>
            </div>

            {/* Progress status card & CTA */}
            <div className="w-full shrink-0 rounded-2xl bg-slate-50/70 p-4 border border-slate-100 lg:w-[280px]">
              <div className="flex items-end justify-between text-xs font-bold text-[#617092] mb-1.5">
                <span>Tiến trình hoàn thành</span>
                <span className="text-sm font-black text-accent">{computedProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
                  style={{ width: `${computedProgress}%` }}
                />
              </div>

              <button
                type="button"
                onClick={handleContinueStudy}
                className="mt-4 w-full inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-xs font-extrabold text-white shadow-sm hover:opacity-95 transition"
              >
                Tiếp tục học
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </MotionReveal>

        {/* Tabs navigation list (Horizontal scroll on mobile) */}
        <MotionReveal className="mb-6">
          <div className="overflow-hidden rounded-[20px] border border-[#1b2e7420] bg-white p-2 shadow-sm">
            <div className="flex overflow-x-auto gap-1.5 scrollbar-none pb-0.5 scroll-smooth">
              {tabsList.map(tab => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-extrabold shrink-0 transition ${
                      isActive
                        ? "bg-[#132a67] text-white"
                        : "text-[#617092] hover:bg-slate-50 hover:text-[#132a67]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <span className={`ml-1 rounded-full px-2 py-0.5 text-[9px] font-black ${
                        isActive ? "bg-white text-[#132a67]" : "bg-red-50 text-red-500"
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </MotionReveal>

        {/* 2-Column Desktop Grid Layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_310px] xl:grid-cols-[1fr_340px]">
          {/* Left Column: Tab contents */}
          <div className="min-w-0">
            {/* TAB 1: TỔNG QUAN */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <MotionReveal>
                  <div className="rounded-[24px] border border-[#1b2e7422] bg-white p-6 shadow-sm">
                    <h3 className="text-base font-extrabold text-[#132a67] mb-4 flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-accent" />
                      Nhiệm vụ đề xuất cho hôm nay
                    </h3>
                    
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
                      <div className="flex gap-3">
                        <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-[#132a67]">{initialSubject.nextAction}</h4>
                          <p className="mt-1 text-xs text-[#5f6d8f] leading-relaxed">
                            Hoàn thành nhiệm vụ này để theo sát lộ trình đã đặt ra. Đề kiểm tra và tài liệu ôn tập đều được mở sẵn cho bạn ở các tab tương ứng.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </MotionReveal>

                {/* Study overview tips */}
                <MotionReveal delay={0.05}>
                  <div className="rounded-[24px] border border-[#1b2e7422] bg-white p-6 shadow-sm space-y-4">
                    <h3 className="text-base font-extrabold text-[#132a67]">Lưu ý ôn thi hiệu quả</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="p-4 rounded-2xl border border-slate-100 bg-[#fffdf9]/50">
                        <span className="text-xl">📚</span>
                        <h4 className="mt-2 text-xs font-black text-[#132a67] uppercase tracking-wide">Tài liệu cốt lõi</h4>
                        <p className="mt-1 text-[11px] leading-relaxed text-[#5f6d8f]">Hệ thống hóa định khoản chữ T và in file PDF của LEFT HAND ra giấy nháp để luyện phản xạ định khoản nhanh nhất.</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-slate-100 bg-[#fffdf9]/50">
                        <span className="text-xl">🎥</span>
                        <h4 className="mt-2 text-xs font-black text-[#132a67] uppercase tracking-wide">Video thực hành</h4>
                        <p className="mt-1 text-[11px] leading-relaxed text-[#5f6d8f]">Vừa xem video quay sẵn vừa thao tác bấm máy tính Casio cùng giảng viên để ghi nhớ bước làm bài trắc nghiệm.</p>
                      </div>
                    </div>
                  </div>
                </MotionReveal>
              </div>
            )}

            {/* TAB 2: TÀI LIỆU */}
            {activeTab === "documents" && (
              <MotionReveal>
                <div className="rounded-[24px] border border-[#1b2e7422] bg-white p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-[#132a67] mb-4">Danh mục tài liệu</h3>
                  <div className="space-y-3">
                    {documents.map((doc) => {
                      const stat = statusLabel[doc.status];
                      return (
                        <div key={doc.id} className="flex flex-col gap-4 p-4 rounded-2xl border border-slate-100 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/50 transition">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-[#132a67] leading-tight">{doc.title}</h4>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                                <span className="text-[#8091b8] uppercase tracking-wider">{doc.type}</span>
                                <span className="text-slate-300">•</span>
                                <span className={`rounded-full px-2 py-0.5 ${stat.class}`}>{stat.text}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 shrink-0 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => showToast(`Đang tải xuống: ${doc.title}`)}
                              className="inline-flex h-8 items-center gap-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-600 transition px-3.5 text-[11px] font-bold text-[#132a67]"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Tải về
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleDocStatus(doc.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-full border border-[#132a67]/10 hover:bg-slate-50 transition px-3.5 text-[11px] font-bold text-[#132a67]"
                            >
                              Đổi trạng thái
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </MotionReveal>
            )}

            {/* TAB 3: ĐĂNG KÝ KÈM (TUTOR) */}
            {activeTab === "tutors" && (
              <MotionReveal>
                <div className="rounded-[24px] border border-[#1b2e7422] bg-white p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-[#132a67] mb-4">Gợi ý Tutor đồng hành</h3>
                  <div className="space-y-4">
                    {initialSubject.tutorOptions.map((tut) => (
                      <div key={tut.id} className="p-5 rounded-2xl border border-slate-100 bg-[#fffdf9]/40 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                              {tut.tutor.split(" ").slice(-1)[0].substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-[#132a67]">{tut.tutor}</h4>
                              <p className="text-[11px] font-semibold text-[#8091b8]">{tut.format}</p>
                            </div>
                          </div>

                          <div className="mt-4 space-y-2 text-xs font-semibold text-[#617092]">
                            <div>
                              <span className="text-[#8091b8] block">Thế mạnh:</span>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {tut.strengths.map(s => (
                                  <span key={s} className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-[#5f6d8f]">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="pt-2">
                              <span>Lịch trống: <strong className="text-[#132a67]">{tut.availability}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <Link
                            href={`/?interest=${slug}&type=tutor#contact`}
                            className="flex-1 min-w-[120px] inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-xs font-extrabold text-white hover:opacity-95 transition"
                          >
                            Đăng ký học
                          </Link>
                          <button
                            type="button"
                            onClick={() => showToast("Yêu cầu tư vấn tutor đã được gửi! LEFT HAND sẽ nhắn tin Zalo kết nối bạn trong 15 phút.")}
                            className="flex-1 min-w-[120px] inline-flex h-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#132a67] hover:bg-slate-200 transition"
                          >
                            Tư vấn Zalo
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </MotionReveal>
            )}

            {/* TAB 4: ROOM ÔN TẬP */}
            {activeTab === "rooms" && (
              <MotionReveal>
                <div className="rounded-[24px] border border-[#1b2e7422] bg-white p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-[#132a67] mb-4">Các buổi Group Study / Room ôn tập</h3>
                  {initialSubject.studyRooms.length > 0 ? (
                    <div className="space-y-4">
                      {initialSubject.studyRooms.map((rm) => (
                        <div key={rm.id} className="p-5 rounded-2xl border border-violet-100 bg-violet-50/15">
                          <div className="flex items-start gap-3">
                            <Calendar className="h-5 w-5 text-[#8b5cf6] shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-extrabold text-[#132a67]">{rm.name}</h4>
                              <p className="mt-1 text-xs text-[#5f6d8f] leading-relaxed">{rm.description}</p>
                              
                              <div className="mt-4 space-y-2 text-xs font-semibold text-[#617092] border-t border-slate-100/80 pt-3">
                                <div>Lịch mở: <strong className="text-[#132a67]">{rm.schedule}</strong></div>
                                <div>Nền tảng: <strong className="text-[#8b5cf6]">{rm.platform}</strong></div>
                              </div>

                              <button
                                type="button"
                                onClick={() => showToast("LEFT HAND sẽ gửi link phòng học qua Email/Zalo 30 phút trước khi bắt đầu!")}
                                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-5 text-xs font-extrabold text-white hover:opacity-95 transition shadow-sm"
                              >
                                Nhận link room
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-semibold text-[#8091b8]">Hiện chưa có lịch phòng học nhóm mở gần đây cho môn học này.</p>
                  )}
                </div>
              </MotionReveal>
            )}

            {/* TAB 5: KHÓA HỌC */}
            {activeTab === "courses" && (
              <MotionReveal>
                <div className="rounded-[24px] border border-[#1b2e7422] bg-white p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-[#132a67] mb-4">Chương trình bài giảng chi tiết</h3>
                  <div className="space-y-3">
                    {lessons.map((les) => {
                      const stat = statusLabel[les.status];
                      return (
                        <div key={les.id} className="flex flex-col gap-4 p-4 rounded-2xl border border-slate-100 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/50 transition">
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center text-[#8b5cf6] shrink-0 mt-0.5 font-black text-xs">
                              {les.id.split("-").slice(-1)[0]}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-[#132a67] leading-tight">{les.title}</h4>
                              <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-[#8091b8]">
                                <span>Thời lượng: {les.duration}</span>
                                <span>•</span>
                                <span className={`rounded-full px-2 py-0.5 ${stat.class}`}>{stat.text}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 shrink-0 self-start sm:self-center">
                            <button
                              type="button"
                              onClick={() => toggleLessonStatus(les.id)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition px-3.5 text-[11px] font-bold text-[#132a67]"
                            >
                              Tiến độ
                            </button>
                            <button
                              type="button"
                              onClick={() => showToast(`Đang truy cập tài nguyên lớp học: ${les.title}`)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#132a67] text-white hover:opacity-95 transition px-3.5 text-[11px] font-bold"
                            >
                              Học tiếp
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </MotionReveal>
            )}

            {/* TAB 6: VIDEO BÀI GIẢNG */}
            {activeTab === "videos" && (
              <MotionReveal>
                <div className="rounded-[24px] border border-[#1b2e7422] bg-white p-6 shadow-sm">
                  <h3 className="text-base font-extrabold text-[#132a67] mb-4">Danh sách Video quay sẵn</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {videos.map((vid) => {
                      const stat = statusLabel[vid.status];
                      return (
                        <div key={vid.id} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-[#fffdf9]/50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                          {/* Video Thumbnail mockup placeholder */}
                          <div className="relative aspect-video rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center text-white mb-3 shadow-[inset_0_4px_12px_rgba(0,0,0,0.4)]">
                            <Play className="h-8 w-8 text-white/90 group-hover:scale-110 transition duration-300 drop-shadow" />
                            {vid.watchedPercent > 0 && (
                              <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-700/60 overflow-hidden">
                                <div className="h-full bg-accent" style={{ width: `${vid.watchedPercent}%` }} />
                              </div>
                            )}
                          </div>
                          
                          <h4 className="text-xs font-bold text-[#132a67] line-clamp-1 group-hover:text-blue-600 transition">
                            {vid.title}
                          </h4>
                          
                          <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-[#8091b8]">
                            <span>Thời lượng: {vid.duration}</span>
                            <span className={`rounded-full px-2 py-0.5 ${stat.class}`}>{stat.text}</span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => handlePlayVideo(vid)}
                              className="inline-flex h-8 items-center justify-center rounded-full bg-[#132a67] text-[11px] font-bold text-white hover:opacity-95"
                            >
                              Xem video
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCompleteVideo(vid.id)}
                              className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-bold text-[#132a67] hover:bg-slate-50"
                            >
                              {vid.status === "đã học" ? "Xem lại" : "Xong"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </MotionReveal>
            )}
          </div>

          {/* Right Column: Sticky Study Diary Sidebar (Notebook tape pattern) */}
          <div className="relative">
            <MotionReveal delay={0.15} className="sticky top-28">
              <div className="relative overflow-hidden rounded-3xl border border-[#1b2e7428] bg-[#fffdf9] p-6 shadow-[0_16px_36px_rgba(19,37,79,0.06)]">
                {/* Washi tape decoration */}
                <div className="absolute -left-1 -top-1 h-3 w-16 bg-[#2948f2]/20 rotate-[-12deg]" />
                
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1b2e74] flex items-center gap-1.5 mb-4">
                  <Clock className="h-4 w-4 text-accent" />
                  Nhật ký tự học
                </h3>

                <div 
                  className="absolute inset-0 -z-10 opacity-[0.03] pointer-events-none" 
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, #1b2e74 1px, transparent 1px),
                      linear-gradient(to bottom, #1b2e74 1px, transparent 1px)
                    `,
                    backgroundSize: '16px 16px'
                  }}
                />

                <div className="space-y-4 text-xs font-semibold leading-relaxed text-[#5f6d8f]">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-[#8091b8] mb-1">Mục tiêu ôn thi:</span>
                    <p className="text-[#132a67] font-bold">{initialSubject.goal}</p>
                  </div>

                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-[#8091b8] mb-1">Tóm tắt tiến độ:</span>
                    <p className="text-slate-600 text-justify">{initialSubject.studySummary}</p>
                  </div>

                  <div className="border-t border-slate-100/60 pt-4">
                    <span className="block text-[10px] font-black uppercase tracking-wider text-[#8091b8] mb-2">Kế hoạch tiếp theo:</span>
                    <div className="rounded-xl bg-white border border-slate-100 p-3 text-[11px] text-[#132a67] font-bold flex items-start gap-1.5 shadow-sm">
                      <CheckSquare className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <span>{initialSubject.nextAction}</span>
                    </div>
                  </div>
                </div>
              </div>
            </MotionReveal>
          </div>
        </div>
      </main>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 z-[100] w-auto max-w-[90vw] -translate-x-1/2 rounded-full bg-[#132a67] px-6 py-3 text-xs font-extrabold text-white shadow-xl flex items-center justify-center gap-2 border border-white/10"
          >
            <Sparkles className="h-4 w-4 text-yellow-300 shrink-0" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Player Mock Modal */}
      <AnimatePresence>
        {activeVideo && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-[24px] border-2 border-[#1b2e74] bg-[#fffdf9] p-5 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setActiveVideo(null)}
                className="absolute right-4 top-4 h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-[#132a67] hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-accent">Phát video học liệu</span>
                <h3 className="text-base font-extrabold text-[#132a67] mt-0.5 pr-8 truncate">
                  {activeVideo.title}
                </h3>
              </div>

              {/* Fake Video Canvas Screen */}
              <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden flex flex-col justify-between p-4 shadow-[inset_0_4px_24px_rgba(0,0,0,0.8)] border border-slate-900">
                <div className="flex justify-between items-center text-white/50 text-[10px] font-bold font-mono">
                  <span>LEFT HAND STUDIOS</span>
                  <span>1080P HD</span>
                </div>
                
                {/* Center play state */}
                <div className="flex flex-col items-center justify-center gap-3 self-center">
                  <div className="h-14 w-14 rounded-full bg-accent text-white flex items-center justify-center shadow-lg animate-pulse">
                    <Play className="h-6 w-6 fill-current translate-x-0.5" />
                  </div>
                  <span className="text-xs text-white/80 font-bold tracking-wide">Video đang phát demo...</span>
                </div>

                {/* Progress bar player */}
                <div className="space-y-2">
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: "35%" }} />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-white/60 font-mono">
                    <span>08:15 / {activeVideo.duration}</span>
                    <span>35% watched</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => handleCompleteVideo(activeVideo.id)}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[#132a67] text-xs font-bold text-white px-5 hover:opacity-95"
                >
                  Đánh dấu xem xong
                </button>
                <button
                  type="button"
                  onClick={() => setActiveVideo(null)}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-[#132a67] px-5 hover:bg-slate-200"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
      <FloatingActions />
    </div>
  );
}

// Arrow icon component helper
function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
