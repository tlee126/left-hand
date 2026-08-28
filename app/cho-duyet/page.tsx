import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserX,
  LogIn,
  Home,
  ShieldCheck,
  Headphones
} from "lucide-react";
import { FloatingActions } from "@/components/site/floating-actions";

export interface StatusConfig {
  badge: string;
  badgeClass: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  tipTitle: string;
  tipDescription: string;
}

export const STATUS_CONFIGS: Record<string, StatusConfig> = {
  pending: {
    badge: "Đang chờ quản trị viên duyệt",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    title: "Tài khoản đang chờ phê duyệt",
    description:
      "Email của bạn đã được xác thực thành công! Để đảm bảo an toàn học thuật và quyền lợi thành viên, ban quản trị LEFT HAND sẽ kiểm duyệt và kích hoạt tài khoản trong vòng 24 giờ làm việc.",
    icon: Clock,
    iconBg: "bg-amber-500/10 border-amber-300",
    iconColor: "text-amber-600",
    tipTitle: "Quy trình kích hoạt",
    tipDescription:
      "Sau khi admin phê duyệt, bạn có thể đăng nhập ngay để truy cập toàn bộ tài liệu, khóa học và góc học tập cá nhân."
  },
  rejected: {
    badge: "Không được phê duyệt",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    title: "Yêu cầu đăng ký không được phê duyệt",
    description:
      "Rất tiếc, yêu cầu kích hoạt tài khoản của bạn đã bị từ chối. Vui lòng liên hệ trực tiếp ban quản trị LEFT HAND qua hotline hoặc fanpage để được giải đáp chi tiết.",
    icon: XCircle,
    iconBg: "bg-red-500/10 border-red-300",
    iconColor: "text-red-600",
    tipTitle: "Cần hỗ trợ?",
    tipDescription:
      "Nếu bạn đã mua khóa học hoặc tài liệu nhưng gặp sự cố khi duyệt, hãy gửi mã đơn hàng cho tư vấn viên để được hỗ trợ nhanh nhất.",
  },
  suspended: {
    badge: "Tài khoản bị tạm khóa",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    title: "Tài khoản đang bị tạm dừng",
    description:
      "Tài khoản học tập của bạn đang tạm thời bị khóa. Vui lòng liên hệ ban quản trị LEFT HAND để được kiểm tra và hỗ trợ mở lại quyền truy cập.",
    icon: AlertTriangle,
    iconBg: "bg-orange-500/10 border-orange-300",
    iconColor: "text-orange-600",
    tipTitle: "Lưu ý bảo mật",
    tipDescription:
      "Việc tạm dừng có thể do thay đổi thiết bị bất thường hoặc rà soát định kỳ chính sách chia sẻ tài nguyên học tập."
  },
  "missing-profile": {
    badge: "Chưa tìm thấy hồ sơ",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    title: "Chưa tìm thấy hồ sơ học tập",
    description:
      "Hệ thống chưa tìm thấy dữ liệu hồ sơ liên kết với tài khoản này. Vui lòng thử đăng nhập lại hoặc liên hệ quản trị viên nếu sự cố vẫn tiếp diễn.",
    icon: UserX,
    iconBg: "bg-slate-500/10 border-slate-300",
    iconColor: "text-slate-600",
    tipTitle: "Gợi ý khắc phục",
    tipDescription:
      "Hãy đăng xuất và đăng nhập lại bằng email bạn đã đăng ký để hệ thống tự động khởi tạo hồ sơ."
  }
};

export default async function AccountPendingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const rawStatus = typeof resolvedParams.status === "string" ? resolvedParams.status : "pending";
  const config = STATUS_CONFIGS[rawStatus] || STATUS_CONFIGS.pending;
  const StatusIcon = config.icon;

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-transparent">
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.14),transparent_28%)]" />

      {/* Top back button */}
      <div className="container mx-auto px-4 pt-6 md:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[#132a67]/10 bg-white/90 px-4 py-2 text-sm font-extrabold text-[#132a67] transition-all hover:bg-slate-50 hover:border-[#132a67]/20 active:scale-95 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Về trang chủ
        </Link>
      </div>

      {/* Main card */}
      <main className="flex flex-1 items-center justify-center p-4 my-8">
        <div className="w-full max-w-lg">
          {/* Card Notebook shell */}
          <div className="relative overflow-hidden rounded-[28px] border-2 border-[#1b2e74] bg-[#fffdf9] p-6 shadow-[0_20px_50px_rgba(27,46,116,0.15)] sm:p-9">
            {/* Notebook grid line patterns */}
            <div
              className="absolute inset-0 -z-10 opacity-[0.04] pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #1b2e74 1px, transparent 1px),
                  linear-gradient(to bottom, #1b2e74 1px, transparent 1px)
                `,
                backgroundSize: "24px 24px"
              }}
            />

            {/* Logo */}
            <div className="mb-6 flex justify-center">
              <Link href="/">
                <Image
                  src="/assets/branding/logo-left-hand-onthidithoi.png"
                  alt="LEFT HAND"
                  width={190}
                  height={53}
                  className="h-auto w-[160px] object-contain"
                  priority
                />
              </Link>
            </div>

            {/* Status Icon Header */}
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border bg-white shadow-md">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${config.iconBg}`}>
                  <StatusIcon className={`h-6 w-6 ${config.iconColor}`} />
                </div>
              </div>

              {/* Status Badge */}
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-xs ${config.badgeClass}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${config.iconColor.replace("text-", "bg-")}`} />
                <span>{config.badge}</span>
              </div>

              {/* Title & Description */}
              <h1 className="mt-3 text-2xl font-black text-[#132a67] tracking-tight">
                {config.title}
              </h1>
              <p className="mt-2 text-xs sm:text-sm font-semibold leading-relaxed text-[#5f6d8f]">
                {config.description}
              </p>
            </div>

            {/* Progression checklist for pending status */}
            {rawStatus === "pending" && (
              <div className="mt-6 space-y-2.5 rounded-2xl border border-[#1b2e74]/10 bg-slate-50/70 p-4 text-xs font-medium text-[#22325f]">
                <div className="flex items-center gap-2.5 text-emerald-700 font-bold">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Bước 1: Đăng ký & Xác thực email (Đã hoàn tất)</span>
                </div>
                <div className="flex items-center gap-2.5 text-amber-700 font-bold">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600 animate-pulse" />
                  <span>Bước 2: Quản trị viên duyệt tài khoản (Đang xử lý)</span>
                </div>
                <div className="flex items-center gap-2.5 text-[#8091b8] font-semibold">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>Bước 3: Mở quyền truy cập khu học tập cá nhân</span>
                </div>
              </div>
            )}

            {/* Tip note box */}
            <div className="mt-5 rounded-2xl border border-dashed border-[#1b2e7430] bg-[#fcf9f2] p-4 text-xs text-[#5f6d8f]">
              <div className="flex items-center gap-1.5 font-bold text-[#132a67]">
                <Headphones className="h-3.5 w-3.5 text-blue-600" />
                {config.tipTitle}
              </div>
              <p className="mt-1 leading-relaxed">{config.tipDescription}</p>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href="/dang-nhap"
                className="relative flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-fuchsia-600 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(37,99,235,0.2)] transition-all hover:from-blue-700 hover:via-violet-700 hover:to-fuchsia-700 active:scale-[0.98]"
              >
                <LogIn className="h-4 w-4" />
                Đăng nhập tài khoản khác
              </Link>

              <Link
                href="/"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#1b2e74]/15 bg-white text-sm font-bold text-[#132a67] transition-all hover:bg-slate-50 hover:border-[#1b2e74]/30 active:scale-[0.98]"
              >
                <Home className="h-4 w-4" />
                Quay về trang chủ
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="py-6 text-center text-xs font-semibold text-[#8091b8]">
        © 2026 LEFT HAND. Thiết kế học thuật chất lượng cao.
      </footer>
      <FloatingActions />
    </div>
  );
}

