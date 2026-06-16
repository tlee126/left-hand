export interface DemoStudent {
  name: string;
  email: string;
  password?: string;
  faculty: string;
  major: string;
  gpaGoal: number;
  avatarInitials: string;
  currentGpa: number;
  streakDays: number;
  nextExamDays: number;
}

export interface StudentStats {
  completedMaterials: number;
  studyHours: number;
  currentGpa: number;
  targetGpa: number;
  daysActive: number;
  todayStudyTime: string;
  weeklyProgress: number;
}

export interface TaskItem {
  id: string;
  title: string;
  duration: string;
  subjectSlug: string;
  category: string;
  status: "done" | "current" | "todo";
}

export interface SubjectDocument {
  id: string;
  title: string;
  type: string;
  status: "đã học" | "chưa học" | "đang học";
}

export interface TutorOption {
  id: string;
  tutor: string;
  format: string;
  availability: string;
  strengths: string[];
}

export interface StudyRoom {
  id: string;
  name: string;
  schedule: string;
  platform: string;
  description: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  duration: string;
  status: "đã học" | "đang học" | "chưa học";
}

export interface VideoItem {
  id: string;
  title: string;
  duration: string;
  status: "đã học" | "đang học" | "chưa học";
  watchedPercent: number;
}

export interface PurchasedSubject {
  id: string;
  slug: string;
  title: string;
  category: string;
  purchasedTypes: Array<"tài liệu" | "khóa học" | "tutor" | "video">;
  progressPercent: number;
  lastStudied: string;
  nextAction: string;
  colorTheme: "accounting" | "economics" | "statistics" | "marketing" | "management" | "finance" | "law" | "mis" | "languages";
  goal: string;
  studySummary: string;
  documents: SubjectDocument[];
  tutorOptions: TutorOption[];
  studyRooms: StudyRoom[];
  courseLessons: CourseLesson[];
  videos: VideoItem[];
  weakPoints: string[];
  examCountdownDays: number;
}

export const demoStudent: DemoStudent = {
  name: "Minh Anh",
  email: "demo@lefthand.vn",
  password: "123456",
  faculty: "Kế toán - Kiểm toán",
  major: "Kế toán",
  gpaGoal: 3.6,
  avatarInitials: "MA",
  currentGpa: 3.25,
  streakDays: 5,
  nextExamDays: 12
};

export const studentStats: StudentStats = {
  completedMaterials: 18,
  studyHours: 42,
  currentGpa: 3.25,
  targetGpa: 3.6,
  daysActive: 24,
  todayStudyTime: "1h 25m",
  weeklyProgress: 65
};

export const todayPlan: TaskItem[] = [
  {
    id: "task-1",
    title: "Ôn Chương 3: Hàng tồn kho",
    duration: "20 phút",
    subjectSlug: "ke-toan-tai-chinh-1",
    category: "Kế toán",
    status: "done"
  },
  {
    id: "task-2",
    title: "Xem tiếp video bài giảng",
    duration: "30 phút",
    subjectSlug: "kinh-te-vi-mo",
    category: "Kinh tế",
    status: "done"
  },
  {
    id: "task-3",
    title: "Làm 10 câu trắc nghiệm",
    duration: "25 phút",
    subjectSlug: "xac-suat-thong-ke",
    category: "Thống kê",
    status: "current"
  },
  {
    id: "task-4",
    title: "Đọc checklist ôn tập chương 1",
    duration: "15 phút",
    subjectSlug: "marketing-can-ban",
    category: "Marketing",
    status: "todo"
  },
  {
    id: "task-5",
    title: "Chốt phần yếu cần hỏi tutor",
    duration: "10 phút",
    subjectSlug: "xac-suat-thong-ke",
    category: "Thống kê",
    status: "todo"
  }
];

export const purchasedSubjects: PurchasedSubject[] = [
  {
    id: "sub-kttc1",
    slug: "ke-toan-tai-chinh-1",
    title: "Kế toán tài chính 1",
    category: "Kế toán",
    purchasedTypes: ["tài liệu", "khóa học"],
    progressPercent: 75,
    lastStudied: "Hôm qua",
    nextAction: "Luyện đề thi thử cuối kỳ",
    colorTheme: "accounting",
    goal: "Ôn thi cuối kỳ đạt điểm 8.5+",
    studySummary: "Tập trung nắm chắc lý thuyết các chương định khoản tài sản cố định, nợ phải trả, ngoại tệ và thực hành lập báo cáo tài chính cuối kỳ.",
    documents: [
      { id: "kttc1-doc-1", title: "Tóm tắt & Định khoản tài sản cố định", type: "PDF tổng ôn", status: "đã học" },
      { id: "kttc1-doc-2", title: "Checklist 15 dạng định khoản ngoại tệ thường thi", type: "Checklist công thức", status: "đang học" },
      { id: "kttc1-doc-3", title: "Đề thi thử cuối kỳ UFM kèm lời giải chi tiết", type: "Đề ôn mẫu", status: "chưa học" },
      { id: "kttc1-doc-4", title: "Sơ đồ chữ T tổng hợp tài khoản Thông tư 200", type: "Mindmap chương", status: "đã học" }
    ],
    tutorOptions: [
      { id: "kttc1-tut-1", tutor: "Tutor Minh Thư", format: "1:1 / Nhóm nhỏ (Online/Offline)", availability: "Tối Thứ 3, Thứ 5", strengths: ["Kế toán trưởng GPA 9.2", "Kiên nhẫn dạy mất gốc"] }
    ],
    studyRooms: [
      { id: "kttc1-rm-1", name: "Room thực chiến đề cuối kỳ Kế toán TC1", schedule: "Tối Thứ 6 lúc 19:30 trước kỳ thi", platform: "Google Meet", description: "Cùng giải nhanh đề thi năm trước và giải đáp nóng các định khoản khó nhầm lẫn." }
    ],
    courseLessons: [
      { id: "kttc1-les-1", title: "Buổi 1: Định khoản TSCĐ (Khấu hao, mua bán, thanh lý)", duration: "120 phút", status: "đã học" },
      { id: "kttc1-les-2", title: "Buổi 2: Kế toán ngoại tệ & chênh lệch tỷ giá cuối kỳ", duration: "120 phút", status: "đang học" },
      { id: "kttc1-les-3", title: "Buổi 3: Nghiệp vụ Nợ phải trả và Dự phòng nợ phải trả", duration: "120 phút", status: "chưa học" },
      { id: "kttc1-les-4", title: "Buổi 4: Hướng dẫn lập Báo cáo tài chính UFM & Chữa đề thi", duration: "120 phút", status: "chưa học" }
    ],
    videos: [
      { id: "kttc1-vid-1", title: "Phương pháp phân bổ khấu hao TSCĐ UFM", duration: "25 phút", status: "đã học", watchedPercent: 100 },
      { id: "kttc1-vid-2", title: "Bản chất định khoản tỷ giá mua/bán ngoại tệ", duration: "30 phút", status: "đang học", watchedPercent: 60 },
      { id: "kttc1-vid-3", title: "Luyện bài tập lập bảng cân đối kế toán", duration: "45 phút", status: "chưa học", watchedPercent: 0 }
    ],
    weakPoints: ["Định khoản tỷ giá ngoại tệ", "Lập bảng cân đối phát sinh"],
    examCountdownDays: 14
  },
  {
    id: "sub-ktvm",
    slug: "kinh-te-vi-mo",
    title: "Kinh tế vi mô",
    category: "Kinh tế",
    purchasedTypes: ["tài liệu", "video"],
    progressPercent: 40,
    lastStudied: "3 ngày trước",
    nextAction: "Xem video ôn tập chương 3",
    colorTheme: "economics",
    goal: "Nắm vững đồ thị cung cầu đạt điểm A",
    studySummary: "Lấy lại căn bản đồ thị cung cầu, sự co giãn cung cầu, thặng dư sản xuất/tiêu dùng và các mô hình độc quyền/cạnh tranh.",
    documents: [
      { id: "ktvm-doc-1", title: "Cẩm nang vẽ đồ thị cung cầu thần tốc", type: "PDF tổng ôn", status: "đã học" },
      { id: "ktvm-doc-2", title: "Tổng hợp công thức tính thặng dư & độ co giãn", type: "Checklist công thức", status: "đang học" },
      { id: "ktvm-doc-3", title: "Bộ câu hỏi trắc nghiệm giữa kỳ & cuối kỳ", type: "Đề ôn mẫu", status: "chưa học" }
    ],
    tutorOptions: [
      { id: "ktvm-tut-1", tutor: "Tutor Hoàng Nam", format: "1:1 / Online", availability: "Tối Thứ Bảy", strengths: ["Điểm môn A+ xuất sắc", "Vẽ đồ thị trực quan"] }
    ],
    studyRooms: [
      { id: "ktvm-rm-1", name: "Room gỡ rối đồ thị Vi mô", schedule: "Tối Chủ Nhật lúc 20:00 hàng tuần", platform: "Zoom Cloud Meeting", description: "Thực chiến vẽ các dạng đồ thị trần giá, sàn giá và tính toán tổn thất vô ích." }
    ],
    courseLessons: [
      { id: "ktvm-les-1", title: "Buổi 1: Lý thuyết cung cầu & thặng dư xã hội", duration: "90 phút", status: "đã học" },
      { id: "ktvm-les-2", title: "Buổi 2: Tác động của chính sách thuế và trợ cấp", duration: "90 phút", status: "chưa học" },
      { id: "ktvm-les-3", title: "Buổi 3: Lý thuyết sản xuất và chi phí doanh nghiệp", duration: "90 phút", status: "chưa học" }
    ],
    videos: [
      { id: "ktvm-vid-1", title: "Mẹo nhớ chiều dịch chuyển đồ thị Cung Cầu", duration: "18 phút", status: "đã học", watchedPercent: 100 },
      { id: "ktvm-vid-2", title: "Tính độ co giãn cung cầu bằng đạo hàm", duration: "22 phút", status: "đang học", watchedPercent: 30 },
      { id: "ktvm-vid-3", title: "Tối đa hóa hữu dụng bằng phương pháp Lagrange", duration: "35 phút", status: "chưa học", watchedPercent: 0 }
    ],
    weakPoints: ["Vẽ đồ thị độc quyền bán", "Tính tổn thất vô ích (DWL)"],
    examCountdownDays: 12
  },
  {
    id: "sub-mkcb",
    slug: "marketing-can-ban",
    title: "Marketing căn bản",
    category: "Marketing",
    purchasedTypes: ["tài liệu"],
    progressPercent: 90,
    lastStudied: "Hôm nay",
    nextAction: "Ôn tập slide mindmap 10 chương",
    colorTheme: "marketing",
    goal: "Thuộc lòng 10 chương để làm tự luận điểm cao",
    studySummary: "Ôn tập hệ thống lý thuyết cốt lõi qua Mindmap, phân tích hành vi người tiêu dùng và lập kế hoạch Marketing Mix 4P/7P.",
    documents: [
      { id: "mkcb-doc-1", title: "Mindmap tóm gọn cốt lõi 10 chương học", type: "Mindmap chương", status: "đã học" },
      { id: "mkcb-doc-2", title: "Tổng hợp các case study Việt Nam nổi tiếng đạt điểm cao", type: "PDF tổng ôn", status: "đã học" },
      { id: "mkcb-doc-3", title: "Ngân hàng câu hỏi ôn tập tự luận cuối kỳ UFM", type: "Đề ôn mẫu", status: "đang học" }
    ],
    tutorOptions: [
      { id: "mkcb-tut-1", tutor: "Tutor Ngọc Vy", format: "Nhóm nhỏ / Offline Quận 7", availability: "Sáng Thứ Bảy", strengths: ["GPA thủ khoa ngành Marketing", "Kỹ năng làm tiểu luận nhóm xuất sắc"] }
    ],
    studyRooms: [
      { id: "mkcb-rm-1", name: "Room phân tích tình huống tự luận Marketing", schedule: "Tối Thứ Năm trước kỳ thi", platform: "Google Meet", description: "Luyện cách trình bày bài tự luận theo khung chấm điểm của giáo viên UFM." }
    ],
    courseLessons: [
      { id: "mkcb-les-1", title: "Buổi 1: Tổng quan Marketing Mix & Phân tích môi trường", duration: "100 phút", status: "đã học" },
      { id: "mkcb-les-2", title: "Buổi 2: Nghiên cứu STP & Định vị thương hiệu", duration: "100 phút", status: "đã học" },
      { id: "mkcb-les-3", title: "Buổi 3: Triển khai 4P (Product, Price, Place, Promotion)", duration: "100 phút", status: "đang học" }
    ],
    videos: [
      { id: "mkcb-vid-1", title: "Phân biệt Marketing vi mô và vĩ mô", duration: "15 phút", status: "đã học", watchedPercent: 100 },
      { id: "mkcb-vid-2", title: "Ma trận BCG trong hoạch định danh mục sản phẩm", duration: "20 phút", status: "đã học", watchedPercent: 100 },
      { id: "mkcb-vid-3", title: "Kỹ năng lập kế hoạch truyền thông tích hợp IMC", duration: "28 phút", status: "đang học", watchedPercent: 70 }
    ],
    weakPoints: ["Phân biệt 4P và 7P", "Viết case study thực tế"],
    examCountdownDays: 18
  },
  {
    id: "sub-xstk",
    slug: "xac-suat-thong-ke",
    title: "Xác suất thống kê",
    category: "Thống kê",
    purchasedTypes: ["tài liệu", "tutor"],
    progressPercent: 30, // Lowered progress to 30% as requested in study quote example: "Xác suất thống kê mới 30%"
    lastStudied: "2 ngày trước",
    nextAction: "Bấm máy Casio chương ước lượng",
    colorTheme: "statistics",
    goal: "Thi trắc nghiệm đạt 8.0+ cuối kỳ",
    studySummary: "Bao quát toàn bộ lý thuyết xác suất cơ bản, phân phối nhị thức/chuẩn, ước lượng khoảng, kiểm định giả thuyết và mẹo Casio giải nhanh.",
    documents: [
      { id: "xstk-doc-1", title: "Cẩm nang bấm máy tính Casio trắc nghiệm siêu tốc", type: "PDF tổng ôn", status: "đã học" },
      { id: "xstk-doc-2", title: "Bảng tổng hợp công thức ước lượng & kiểm định", type: "Checklist công thức", status: "đang học" },
      { id: "xstk-doc-3", title: "Bộ đề trắc nghiệm thi thử kèm lời giải chi tiết", type: "Đề ôn mẫu", status: "chưa học" }
    ],
    tutorOptions: [
      { id: "xstk-tut-1", tutor: "Thầy Hữu Lộc", format: "1:1 / Online hoặc Offline", availability: "Linh hoạt các tối", strengths: ["Giảng viên dạy Casio thực chiến", "Tài liệu tặng kèm độc quyền"] }
    ],
    studyRooms: [
      { id: "xstk-rm-1", name: "Room giải bộ đề trắc nghiệm cuối kỳ XSTK", schedule: "Tối Thứ Bảy trước ngày thi", platform: "Zoom Cloud Meeting", description: "Thực hành bấm Casio giải trắc nghiệm 40 câu hỏi trong 60 phút." }
    ],
    courseLessons: [
      { id: "xstk-les-1", title: "Buổi 1: Lý thuyết xác suất cổ điển, Bayes & Bayes nâng cao", duration: "120 phút", status: "đã học" },
      { id: "xstk-les-2", title: "Buổi 2: Các quy luật phân phối xác suất quan trọng", duration: "120 phút", status: "đang học" },
      { id: "xstk-les-3", title: "Buổi 3: Ước lượng khoảng & Cách bấm máy Casio tương ứng", duration: "120 phút", status: "chưa học" }
    ],
    videos: [
      { id: "xstk-vid-1", title: "Cách phân biệt Tổ hợp, Chỉnh hợp, Hoán vị", duration: "15 phút", status: "đã học", watchedPercent: 100 },
      { id: "xstk-vid-2", title: "Bấm Casio tìm kì vọng, phương sai đại lượng ngẫu nhiên", duration: "25 phút", status: "đang học", watchedPercent: 80 },
      { id: "xstk-vid-3", title: "Mẹo nhớ các điều kiện bác bỏ giả thuyết H0", duration: "30 phút", status: "chưa học", watchedPercent: 0 }
    ],
    weakPoints: ["Ước lượng khoảng bằng Casio", "Nhận diện phân phối nhị thức"],
    examCountdownDays: 15
  }
];
