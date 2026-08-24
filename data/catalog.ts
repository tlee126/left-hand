import type { Category, ColorTheme } from "@/lib/domain/subjects";
import type { EnrollmentStatus } from "@/lib/domain/product-types";

export type CourseFormat = "online" | "offline" | "video" | "zoom";

export type TutorFormat =
  | "1:1 & Nhóm nhỏ (Online/Offline)"
  | "1:1 (Online/Offline quận 7)"
  | "1:1 & Nhóm nhỏ (Online)"
  | "1:1 (Online qua Google Meet)"
  | "1:1 & Nhóm nhỏ (Offline/Online)"
  | "1:1 (Online)"
  | "1:1 & Nhóm nhỏ (Online/Offline Q7)";

export interface MaterialItem {
  id: string;
  slug: string;
  title: string;
  subject: string;
  facultyGroup: string;
  category: Category;
  type: "TÀI LIỆU";
  description: string;
  price: string;
  oldPrice?: string;
  pages: number;
  tags: string[];
  rating: number;
  isHot: boolean;
  colorTheme: ColorTheme;
  includes?: string[];
  suitableFor?: string[];
}

export interface CourseItem {
  id: string;
  slug: string;
  title: string;
  subject: string;
  category: Category;
  format: CourseFormat;
  sessions: number;
  duration: string;
  schedule: string;
  description: string;
  price: string;
  oldPrice?: string;
  status: EnrollmentStatus;
  mentor: string;
  tags: string[];
  rating: number;
  colorTheme: ColorTheme;
  curriculum?: string[];
  suitableFor?: string[];
  preparation?: string[];
}

export interface TutorItem {
  id: string;
  slug: string;
  name: string;
  subjects: string[];
  faculty: string;
  strengths: string[];
  format: TutorFormat | string;
  price: string;
  availability: string;
  rating: number;
  shortBio: string;
  tags: string[];
  colorTheme: ColorTheme;
  suitableFor?: string[];
  supportMethods?: string[];
}

export const materials: MaterialItem[] = [
  {
    id: "mat-kttc1",
    slug: "ke-toan-tai-chinh-1",
    title: "Tóm tắt & Bài giải Kế toán tài chính 1",
    subject: "Kế toán tài chính 1",
    facultyGroup: "Kế toán - Kiểm toán",
    category: "Kế toán",
    type: "TÀI LIỆU",
    description: "Hệ thống hóa toàn bộ định khoản tài sản cố định, hàng tồn kho, nợ phải trả kèm lời giải chi tiết cho các dạng bài thi cuối kỳ UFM.",
    price: "29.000đ",
    oldPrice: "59.000đ",
    pages: 48,
    tags: ["Lý thuyết + Bài tập", "Bám sát đề thi"],
    rating: 4.9,
    isHot: true,
    colorTheme: "accounting",
    includes: [
      "48 trang PDF lý thuyết & bài giải chi tiết",
      "Bảng tóm tắt các tài khoản phát sinh hay gặp",
      "Bộ đề thi thử cuối kỳ sát sườn kèm đáp án"
    ],
    suitableFor: [
      "Sinh viên UFM chuẩn bị bước vào kỳ thi cuối kỳ",
      "Học viên cần hệ thống lại định khoản TSCĐ, nợ phải trả",
      "Sinh viên bị hổng kiến thức từ giữa kỳ học"
    ]
  },
  {
    id: "mat-nlkt",
    slug: "nguyen-ly-ke-toan",
    title: "Cẩm nang Nguyên lý kế toán từ con số 0",
    subject: "Nguyên lý kế toán",
    facultyGroup: "Kế toán - Kiểm toán",
    category: "Kế toán",
    type: "TÀI LIỆU",
    description: "Sơ đồ chữ T trực quan, cách lập bảng cân đối kế toán nhanh và mẹo phân biệt các tài khoản dễ nhầm lẫn nhất cho sinh viên năm 1, 2.",
    price: "25.000đ",
    oldPrice: "50.000đ",
    pages: 40,
    tags: ["Mất gốc", "Sơ đồ chữ T"],
    rating: 4.8,
    isHot: false,
    colorTheme: "accounting",
    includes: [
      "40 trang PDF sơ đồ chữ T vẽ tay trực quan",
      "Bảng đối chiếu nợ - có chi tiết từng loại tài khoản",
      "Hệ thống bài tập thực hành định khoản từ dễ đến khó"
    ],
    suitableFor: [
      "Sinh viên năm 1, năm 2 mới bắt đầu tiếp cận môn kế toán",
      "Học viên cần lấy lại căn bản định khoản nợ - có nhanh chóng",
      "Người học muốn hệ thống lý thuyết để ôn tập cuối kỳ"
    ]
  },
  {
    id: "mat-ktqt",
    slug: "ke-toan-quan-tri",
    title: "Đề cương ôn thi Kế toán quản trị UFM",
    subject: "Kế toán quản trị",
    facultyGroup: "Kế toán - Kiểm toán",
    category: "Kế toán",
    type: "TÀI LIỆU",
    description: "Phân tích biến động chi phí, điểm hòa vốn, lập dự toán ngân sách và các phương án ra quyết định kinh doanh ngắn hạn.",
    price: "29.000đ",
    oldPrice: "49.000đ",
    pages: 36,
    tags: ["Tổng hợp công thức", "Case study"],
    rating: 4.7,
    isHot: false,
    colorTheme: "accounting",
    includes: [
      "36 trang PDF chuyên đề phân loại và biến động chi phí",
      "Tóm tắt công thức tính điểm hòa vốn CVP",
      "Các case study giải mẫu tình huống quản trị thực tế"
    ],
    suitableFor: [
      "Học viên ngành Kế toán - Kiểm toán chuẩn bị thi cuối kỳ",
      "Sinh viên ngành Quản trị kinh doanh muốn hiểu báo cáo nội bộ",
      "Sinh viên cần củng cố bài tập ra quyết định ngắn hạn"
    ]
  },
  {
    id: "mat-ktvm",
    slug: "kinh-te-vi-mo",
    title: "Sổ tay thực chiến Kinh tế vi mô UFM",
    subject: "Kinh tế vi mô",
    facultyGroup: "Kinh tế - Định lượng",
    category: "Kinh tế",
    type: "TÀI LIỆU",
    description: "Phương pháp vẽ đồ thị cung cầu, cách tính thặng dư tiêu dùng, thặng dư sản xuất và các mô hình thị trường cạnh tranh/độc quyền.",
    price: "25.000đ",
    oldPrice: "45.000đ",
    pages: 35,
    tags: ["Mẹo đồ thị", "Tóm gọn chương"],
    rating: 4.9,
    isHot: true,
    colorTheme: "economics",
    includes: [
      "35 trang PDF hướng dẫn vẽ đồ thị cung cầu",
      "Tóm tắt công thức thặng dư tiêu dùng và sản xuất nhanh",
      "Bộ câu hỏi trắc nghiệm tự luyện kèm giải thích đáp án"
    ],
    suitableFor: [
      "Học viên cần vượt qua nỗi sợ vẽ đồ thị vi mô",
      "Sinh viên năm nhất tất cả các khối ngành kinh tế",
      "Sinh viên chuẩn bị thi trắc nghiệm giữa kỳ & cuối kỳ"
    ]
  },
  {
    id: "mat-ktvmo",
    slug: "kinh-te-vi-mo-tong-on",
    title: "Bí kíp trắc nghiệm & Tự luận Kinh tế vĩ mô",
    subject: "Kinh tế vĩ mô",
    facultyGroup: "Kinh tế - Định lượng",
    category: "Kinh tế",
    type: "TÀI LIỆU",
    description: "Giải thích các khái niệm GDP, lạm phát, thất nghiệp kèm phân tích mô hình IS-LM và AD-AS cực kỳ chi tiết, dễ hiểu.",
    price: "29.000đ",
    oldPrice: "59.000đ",
    pages: 45,
    tags: ["Mô hình IS-LM", "Bài giải mẫu"],
    rating: 4.8,
    isHot: false,
    colorTheme: "economics",
    includes: [
      "45 trang lý thuyết và phân tích mô hình vĩ mô",
      "Hướng dẫn giải tự luận mô hình IS-LM chuẩn khung UFM",
      "Tóm tắt công thức tính toán GDP, lạm phát, thất nghiệp"
    ],
    suitableFor: [
      "Sinh viên ôn thi tự luận giữa kỳ và cuối kỳ",
      "Sinh viên cần gỡ điểm môn Kinh tế vĩ mô",
      "Học viên tự học muốn nắm bắt nhanh các chính sách vĩ mô"
    ]
  },
  {
    id: "mat-xstk",
    slug: "xac-suat-thong-ke",
    title: "Phá đảo Xác suất thống kê (Kèm Casio)",
    subject: "Xác suất thống kê",
    facultyGroup: "Kinh tế - Định lượng",
    category: "Thống kê",
    type: "TÀI LIỆU",
    description: "Công thức xác suất đầy đủ, ước lượng, kiểm định giả thuyết và hướng dẫn bấm máy tính Casio để giải trắc nghiệm siêu tốc.",
    price: "25.000đ",
    oldPrice: "50.000đ",
    pages: 32,
    tags: ["Casio thần tốc", "Kiểm định giả thuyết"],
    rating: 5.0,
    isHot: true,
    colorTheme: "statistics",
    includes: [
      "32 trang tóm tắt công thức xác suất từ cơ bản đến nâng cao",
      "Hướng dẫn thao tác bấm máy Casio FX 580 chi tiết từng bước",
      "Bộ đề trắc nghiệm thi thử kèm đáp án giải thích cụ thể"
    ],
    suitableFor: [
      "Sinh viên ôn thi trắc nghiệm Xác suất thống kê UFM",
      "Học viên gặp khó khăn với công thức tổ hợp, chỉnh hợp",
      "Người học cần tóm tắt nhanh để ôn thi cấp tốc"
    ]
  },
  {
    id: "mat-mkcb",
    slug: "marketing-can-ban",
    title: "Tóm tắt cốt lõi 10 chương Marketing căn bản",
    subject: "Marketing căn bản",
    facultyGroup: "Marketing - Quản trị",
    category: "Marketing",
    type: "TÀI LIỆU",
    description: "Mindmap tóm gọn hành vi khách hàng, chiến lược 4P/7P và các ví dụ thực tế tại Việt Nam để làm bài thi tự luận điểm cao.",
    price: "20.000đ",
    oldPrice: "40.000đ",
    pages: 30,
    tags: ["Sơ đồ Mindmap", "Case Việt Nam"],
    rating: 4.8,
    isHot: false,
    colorTheme: "marketing",
    includes: [
      "30 trang PDF sơ đồ tư duy trực quan 10 chương học",
      "Tóm tắt mô hình vi mô, vĩ mô và chiến lược marketing",
      "Tập hợp các ví dụ case study thương hiệu Việt Nam điểm cao"
    ],
    suitableFor: [
      "Sinh viên ôn thi tự luận cuối kỳ môn Marketing căn bản",
      "Học viên cần chuẩn bị bài thuyết trình nhóm/tiểu luận",
      "Sinh viên ngành Marketing hoặc Quản trị muốn ôn nhanh kiến thức"
    ]
  },
  {
    id: "mat-qth",
    slug: "quan-tri-hoc",
    title: "Đề cương tóm tắt môn Quản trị học",
    subject: "Quản trị học",
    facultyGroup: "Marketing - Quản trị",
    category: "Quản trị",
    type: "TÀI LIỆU",
    description: "Tổng hợp 4 chức năng quản trị: Hoạch định, Tổ chức, Lãnh đạo, Kiểm tra cùng ngân hàng câu hỏi tình huống thường gặp.",
    price: "20.000đ",
    oldPrice: "35.000đ",
    pages: 28,
    tags: ["4 chức năng", "Câu hỏi tình huống"],
    rating: 4.7,
    isHot: false,
    colorTheme: "management",
    includes: [
      "28 trang PDF tóm gọn lý thuyết cốt lõi quản trị",
      "Hệ thống hóa 4 chức năng quản trị kinh điển",
      "Ngân hàng câu hỏi xử lý tình huống thực tế thường ra thi"
    ],
    suitableFor: [
      "Sinh viên chuẩn bị làm bài thi tự luận hoặc trắc nghiệm",
      "Sinh viên cần tài liệu tham khảo làm bài tập tình huống",
      "Người học cần hệ thống nhanh lý thuyết để thi qua môn"
    ]
  },
  {
    id: "mat-lkt",
    slug: "luat-kinh-te",
    title: "Hệ thống hóa Luật kinh tế dễ nhớ",
    subject: "Luật kinh tế",
    facultyGroup: "Luật / Ngoại ngữ / Khác",
    category: "Luật",
    type: "TÀI LIỆU",
    description: "Tóm gọn Luật doanh nghiệp, Luật hợp đồng thương mại và cách phân tích tình huống tranh chấp thực tế trong đề thi.",
    price: "20.000đ",
    oldPrice: "40.000đ",
    pages: 25,
    tags: ["Luật Doanh nghiệp", "Tóm tắt điều khoản"],
    rating: 4.7,
    isHot: false,
    colorTheme: "law",
    includes: [
      "25 trang tóm gọn điều luật kinh doanh cốt lõi",
      "Sơ đồ tư duy về các loại hình doanh nghiệp tại Việt Nam",
      "Các bài giải mẫu tình huống tranh chấp thương mại"
    ],
    suitableFor: [
      "Sinh viên khối kinh tế không chuyên luật cần ôn thi nhanh",
      "Sinh viên ôn thi tự luận cuối kỳ Luật kinh tế UFM",
      "Học viên cần củng cố phương pháp trả lời tình huống luật"
    ]
  },
  {
    id: "mat-tctt",
    slug: "tai-chinh-tien-te",
    title: "Ôn tập cốt lõi môn Tài chính tiền tệ",
    subject: "Tài chính tiền tệ",
    facultyGroup: "Tài chính - Ngân hàng",
    category: "Tài chính",
    type: "TÀI LIỆU",
    description: "Kiến thức về lãi suất, cung cầu tiền tệ, ngân hàng thương mại và vai trò của ngân hàng trung ương trong việc điều hành chính sách.",
    price: "29.000đ",
    oldPrice: "49.000đ",
    pages: 35,
    tags: ["Chính sách tiền tệ", "Đề cương chi tiết"],
    rating: 4.6,
    isHot: false,
    colorTheme: "finance",
    includes: [
      "35 trang tóm gọn cấu trúc tài chính vĩ mô",
      "Slide tổng hợp tiền tệ, lạm phát và lãi suất",
      "Bộ câu hỏi trắc nghiệm tự luyện cuối kỳ"
    ],
    suitableFor: [
      "Sinh viên chuyên ngành Tài chính - Ngân hàng ôn thi cuối kỳ",
      "Học viên cần hệ thống lại cung cầu tiền tệ vĩ mô",
      "Sinh viên các khối ngành kinh tế bổ trợ kiến thức"
    ]
  },
  {
    id: "mat-tcdn",
    slug: "tai-chinh-doanh-nghiep",
    title: "Sổ tay bài tập Tài chính doanh nghiệp",
    subject: "Tài chính doanh nghiệp",
    facultyGroup: "Tài chính - Ngân hàng",
    category: "Tài chính",
    type: "TÀI LIỆU",
    description: "Các công thức tính NPV, IRR, WACC, mô hình định giá tài sản vốn CAPM kèm bài giải mẫu các chương ngân sách vốn đầu tư.",
    price: "35.000đ",
    oldPrice: "65.000đ",
    pages: 42,
    tags: ["Công thức NPV/IRR", "Bài tập thực hành"],
    rating: 4.9,
    isHot: true,
    colorTheme: "finance",
    includes: [
      "42 trang PDF công thức tài chính doanh nghiệp cô đọng",
      "Bộ bài giải mẫu chương hoạch định ngân sách vốn đầu tư",
      "Bài tập định giá tài sản CAPM có giải chi tiết"
    ],
    suitableFor: [
      "Học viên chuẩn bị thi cuối kỳ ngành Tài chính - Ngân hàng",
      "Sinh viên cần củng cố bài tập NPV, IRR trước kiểm tra",
      "Học viên cần hệ thống hóa công thức tính WACC phức tạp"
    ]
  },
  {
    id: "mat-csdl",
    slug: "co-so-du-lieu",
    title: "Sổ tay mô hình ERD & Truy vấn SQL căn bản",
    subject: "Cơ sở dữ liệu",
    facultyGroup: "MIS / Công nghệ / Dữ liệu",
    category: "MIS",
    type: "TÀI LIỆU",
    description: "Cách vẽ sơ đồ ERD, chuẩn hóa dữ liệu 1NF, 2NF, 3NF và tổng hợp câu lệnh SQL từ SELECT đơn giản đến JOIN phức tạp.",
    price: "30.000đ",
    oldPrice: "60.000đ",
    pages: 38,
    tags: ["Truy vấn SQL", "Mẹo chuẩn hóa"],
    rating: 4.8,
    isHot: false,
    colorTheme: "mis",
    includes: [
      "38 trang hướng dẫn vẽ sơ đồ ERD và chuẩn hóa dữ liệu",
      "Tổng hợp cú pháp câu lệnh SQL thông dụng kèm ví dụ",
      "File bài tập mẫu kèm cơ sở dữ liệu mẫu để thực hành"
    ],
    suitableFor: [
      "Sinh viên ngành Hệ thống thông tin quản lý, CNTT",
      "Học viên chuẩn bị thi thực hành SQL cuối kỳ UFM",
      "Học viên muốn nắm vững bản chất chuẩn hóa cơ sở dữ liệu"
    ]
  },
  {
    id: "mat-httnql",
    slug: "he-thong-thong-tin-quan-ly",
    title: "Đề cương Hệ thống thông tin quản lý UFM",
    subject: "Hệ thống thông tin quản lý",
    facultyGroup: "MIS / Công nghệ / Dữ liệu",
    category: "MIS",
    type: "TÀI LIỆU",
    description: "Tóm tắt cấu trúc hạ tầng CNTT, hệ thống ERP, CRM và các phương pháp phát triển hệ thống thông tin trong doanh nghiệp.",
    price: "25.000đ",
    oldPrice: "45.000đ",
    pages: 34,
    tags: ["Hạ tầng CNTT", "ERP & CRM"],
    rating: 4.7,
    isHot: false,
    colorTheme: "mis",
    includes: [
      "34 trang PDF tổng hợp lý thuyết hạ tầng hệ thống số",
      "Sơ đồ tích hợp chức năng ERP & quản trị quan hệ CRM",
      "Bộ câu hỏi trắc nghiệm ôn tập nhanh chương học"
    ],
    suitableFor: [
      "Sinh viên ngành Hệ thống thông tin quản lý ôn thi cuối kỳ",
      "Sinh viên ngành Kinh tế cần tìm hiểu chuyển đổi số doanh nghiệp",
      "Học viên cần tài liệu tóm gọn để ôn thi lý thuyết nhanh"
    ]
  },
  {
    id: "mat-tatm",
    slug: "tieng-anh-thuong-mai",
    title: "Sổ từ vựng & Mẫu câu Tiếng Anh thương mại",
    subject: "Tiếng Anh thương mại",
    facultyGroup: "Luật / Ngoại ngữ / Khác",
    category: "Ngoại ngữ",
    type: "TÀI LIỆU",
    description: "Tổng hợp thuật ngữ chuyên ngành kinh tế, mẫu thư điện tử giao dịch và hội thoại đàm phán thương mại thông dụng.",
    price: "29.000đ",
    oldPrice: "59.000đ",
    pages: 40,
    tags: ["Từ vựng chuyên ngành", "Mẫu câu email"],
    rating: 4.8,
    isHot: false,
    colorTheme: "languages",
    includes: [
      "40 trang từ vựng chuyên ngành kinh tế và thương mại",
      "Bộ mẫu thư tín thương mại chuẩn gửi đối tác",
      "Hệ thống mẫu câu giao tiếp đàm phán công sở thông dụng"
    ],
    suitableFor: [
      "Sinh viên khối ngành kinh tế chuẩn bị làm việc thực tế",
      "Học viên ôn luyện chuẩn đầu ra tiếng Anh thương mại UFM",
      "Người đi làm muốn nâng cao năng lực viết email chuyên nghiệp"
    ]
  }
];

export const courses: CourseItem[] = [
  {
    id: "crs-mkt-final",
    slug: "lop-on-thi-cuoi-ky-marketing",
    title: "Lớp ôn thi cuối kỳ Marketing căn bản UFM",
    subject: "Marketing căn bản",
    category: "Marketing",
    format: "zoom",
    sessions: 4,
    duration: "8 giờ học + tài liệu ôn tập",
    schedule: "Tối Thứ 4 & Thứ 6 (19:30 - 21:30)",
    description: "Hệ thống hóa toàn bộ lý thuyết cốt lõi, hướng dẫn làm bài tự luận đạt điểm tối đa và thực chiến phân tích case study của thầy cô UFM.",
    price: "129.000đ",
    oldPrice: "250.000đ",
    status: "open",
    mentor: "Chị Minh Thư (Cựu SV Marketing xuất sắc UFM)",
    tags: ["Cam kết qua môn", "Live Zoom tương tác"],
    rating: 4.9,
    colorTheme: "marketing",
    curriculum: [
      "Buổi 1: Hệ thống lý thuyết cốt lõi & Phân tích môi trường Marketing vĩ mô/vi mô",
      "Buổi 2: Nghiên cứu hành vi người tiêu dùng & Chiến lược STP (Phân khúc, Định vị)",
      "Buổi 3: Triển khai chiến lược hỗn hợp Marketing Mix 4P & 7P",
      "Buổi 4: Kỹ thuật viết bài giải tự luận tình huống đạt điểm tối đa & Sửa đề thi UFM"
    ],
    suitableFor: [
      "Sinh viên đang học môn Marketing căn bản chuẩn bị thi cuối kỳ UFM",
      "Sinh viên cần củng cố kỹ năng làm bài tập tự luận thực tế",
      "Học viên bị mất gốc hoặc điểm giữa kỳ chưa tốt"
    ],
    preparation: [
      "Giấy, bút để ghi chú ý giảng viên",
      "Chuẩn bị trước các thắc mắc về bài học trên lớp để hỏi đáp trực tiếp"
    ]
  },
  {
    id: "crs-micro-mid",
    slug: "on-thi-giua-ky-kinh-te-vi-mo",
    title: "Khóa video ôn thi giữa kỳ Kinh tế vi mô",
    subject: "Kinh tế vi mô",
    category: "Kinh tế",
    format: "video",
    sessions: 6,
    duration: "6 video bài giảng + slide tóm gọn",
    schedule: "Tự học linh hoạt 24/7",
    description: "Giúp bạn làm quen đồ thị cung cầu, phân tích tác động của thuế/trợ cấp và gỡ rối bài tập tối đa hóa hữu dụng cực nhanh.",
    price: "99.000đ",
    oldPrice: "199.000đ",
    status: "open",
    mentor: "Anh Hoàng Nam (Tutor Kinh tế định lượng)",
    tags: ["Video quay sẵn", "Học mọi lúc mọi nơi"],
    rating: 4.8,
    colorTheme: "economics",
    curriculum: [
      "Chuyên đề 1: Lý thuyết cung - cầu, thặng dư sản xuất, thặng dư tiêu dùng",
      "Chuyên đề 2: Tác động của chính sách giá trần, giá sàn, thuế và trợ cấp",
      "Chuyên đề 3: Độ co giãn của cung cầu và ứng dụng thực tế",
      "Chuyên đề 4: Lý thuyết lựa chọn của người tiêu dùng (Tối đa hóa hữu dụng)",
      "Chuyên đề 5: Lý thuyết sản xuất & phân tích các loại chi phí doanh nghiệp",
      "Chuyên đề 6: Giải bài tập mẫu đồ thị & Bộ đề ôn thi giữa kỳ chuẩn UFM"
    ],
    suitableFor: [
      "Sinh viên UFM chuẩn bị thi giữa kỳ môn Kinh tế vi mô",
      "Học viên cần tự học linh hoạt theo thời gian biểu cá nhân",
      "Học viên muốn lấy lại gốc vi mô cấp tốc để không bị đuối"
    ],
    preparation: [
      "Máy tính bỏ túi Casio",
      "Giấy nháp và bút thước để vẽ đồ thị cùng giảng viên"
    ]
  },
  {
    id: "crs-xstk-final",
    slug: "lop-on-xac-suat-thong-ke",
    title: "Lớp ôn cấp tốc Xác suất thống kê cuối kỳ",
    subject: "Xác suất thống kê",
    category: "Thống kê",
    format: "zoom",
    sessions: 5,
    duration: "10 giờ học + bộ đề trắc nghiệm",
    schedule: "Chiều Thứ 7 & Chủ Nhật (14:00 - 16:00)",
    description: "Đi thẳng vào phương pháp nhận diện dạng đề, công thức bấm máy Casio thần tốc và giải chi tiết bộ đề thi 3 học kỳ gần nhất.",
    price: "149.000đ",
    oldPrice: "280.000đ",
    status: "open",
    mentor: "Thầy Hữu Lộc (Giảng viên ôn thi Đại học & Đại học)",
    tags: ["Casio thực chiến", "Tài liệu tặng kèm"],
    rating: 5.0,
    colorTheme: "statistics",
    curriculum: [
      "Buổi 1: Đại số tổ hợp, công thức xác suất cơ bản, xác suất đầy đủ & Bayes",
      "Buổi 2: Biến ngẫu nhiên, quy luật phân phối xác suất (Nhị thức, Chuẩn, Poisson)",
      "Buổi 3: Ước lượng tham số (Kèm thủ thuật bấm máy Casio nhanh)",
      "Buổi 4: Kiểm định giả thuyết thống kê (Kiểm định 1 mẫu, 2 mẫu)",
      "Buổi 5: Giải chi tiết bộ đề thi trắc nghiệm cuối kỳ UFM mới nhất"
    ],
    suitableFor: [
      "Sinh viên UFM chuẩn bị thi trắc nghiệm môn Xác suất thống kê cuối kỳ",
      "Sinh viên gặp khó khăn với toán định lượng hoặc muốn lấy điểm số tối đa",
      "Học viên cần lấy lại gốc định lượng trong thời gian ngắn"
    ],
    preparation: [
      "Máy tính Casio FX 570VN Plus hoặc FX 580VN X trở lên",
      "Bộ tài liệu in sẵn do LEFT HAND gửi tặng trước buổi học"
    ]
  },
  {
    id: "crs-qth-video",
    slug: "video-bai-giang-quan-tri-hoc",
    title: "Trọn gói Video bài giảng Quản trị học",
    subject: "Quản trị học",
    category: "Quản trị",
    format: "video",
    sessions: 8,
    duration: "8 bài học + ngân hàng câu hỏi trắc nghiệm",
    schedule: "Tự học linh hoạt 24/7",
    description: "Tổng hợp trực quan 10 chương học dưới dạng video ngắn 15-20 phút, giải thích cặn kẽ các tình huống quản trị thực tế.",
    price: "89.000đ",
    oldPrice: "150.000đ",
    status: "open",
    mentor: "Chị Khánh Linh (Cựu thủ khoa Quản trị UFM)",
    tags: ["Trắc nghiệm chọn lọc", "Xem lại không giới hạn"],
    rating: 4.7,
    colorTheme: "management",
    curriculum: [
      "Chương 1: Tổng quan về quản trị, nhà quản trị & vai trò quản trị",
      "Chương 2: Sự phát triển lịch sử của các lý thuyết quản trị doanh nghiệp",
      "Chương 3: Môi trường kinh doanh và quản trị trong môi trường biến động",
      "Chương 4: Chức năng Hoạch định & Thiết lập mục tiêu kinh doanh",
      "Chương 5: Chức năng Tổ chức bộ máy quản trị & Phân quyền",
      "Chương 6: Chức năng Lãnh đạo, động viên & thúc đẩy nhân viên",
      "Chương 7: Chức năng Kiểm tra & Giám sát hoạt động quản lý",
      "Chương 8: Giải đáp hệ thống câu hỏi trắc nghiệm & Tình huống quản lý thực tế"
    ],
    suitableFor: [
      "Học viên bận rộn muốn tự chủ thời gian ôn tập",
      "Sinh viên cần củng cố lý thuyết nhanh trước các đợt kiểm tra trắc nghiệm",
      "Học viên tự ôn tập qua điện thoại, máy tính dễ dàng"
    ],
    preparation: [
      "Kết nối Internet ổn định để xem video trên Drive",
      "Sổ tay tóm gọn để lưu trữ từ khóa chính"
    ]
  },
  {
    id: "crs-kttc1-final",
    slug: "lop-on-ke-toan-tai-chinh-1",
    title: "Lớp ôn cuối kỳ Kế toán tài chính 1",
    subject: "Kế toán tài chính 1",
    category: "Kế toán",
    format: "zoom",
    sessions: 6,
    duration: "12 giờ học + bài tập giải sẵn",
    schedule: "Tối Thứ 3 & Thứ 5 (19:30 - 21:30)",
    description: "Luyện sâu các dạng bài định khoản nghiệp vụ TSCĐ, ngoại tệ, nợ phải trả và cách lập báo cáo tài chính không lo lệch số.",
    price: "169.000đ",
    oldPrice: "300.000đ",
    status: "coming-soon",
    mentor: "Cô Ngọc Mai (Kế toán trưởng & Giảng viên thỉnh giảng)",
    tags: ["Thực chiến định khoản", "Sắp mở đăng ký"],
    rating: 4.9,
    colorTheme: "accounting",
    curriculum: [
      "Buổi 1: Định khoản nghiệp vụ Kế toán Tài sản cố định (Khấu hao, trao đổi, thanh lý)",
      "Buổi 2: Kế toán Hàng tồn kho theo phương pháp kê khai thường xuyên & kiểm kê định kỳ",
      "Buổi 3: Kế toán Nợ phải trả, dự phòng nợ phải trả & Các khoản vay ngắn hạn/dài hạn",
      "Buổi 4: Kế toán Giao dịch ngoại tệ, chênh lệch tỷ giá cuối kỳ kinh doanh",
      "Buổi 5: Hướng dẫn lập Báo cáo tài chính (Bảng cân đối kế toán & Báo cáo KQKD)",
      "Buổi 6: Thực chiến giải đề thi cuối kỳ thực tế UFM mới nhất"
    ],
    suitableFor: [
      "Sinh viên chuẩn bị thi cuối kỳ môn Kế toán tài chính 1",
      "Học viên muốn thực hành sâu các dạng định khoản Thông tư 200",
      "Học viên cần phương pháp lập báo cáo tài chính không bị lệch"
    ],
    preparation: [
      "Bảng hệ thống tài khoản Thông tư 200",
      "Máy tính bỏ túi để bấm phép tính khấu hao nhanh"
    ]
  },
  {
    id: "crs-sql-basic",
    slug: "sql-can-ban-cho-co-so-du-lieu",
    title: "Lớp thực hành SQL căn bản cho Cơ sở dữ liệu",
    subject: "Cơ sở dữ liệu",
    category: "MIS",
    format: "zoom",
    sessions: 4,
    duration: "8 giờ học online + file bài tập",
    schedule: "Tối Thứ 7 (18:30 - 20:30)",
    description: "Giảng dạy thực hành câu lệnh SQL trực tiếp trên máy tính. Tập trung vào viết các câu truy vấn phức tạp hỗ trợ thi thực hành UFM.",
    price: "129.000đ",
    oldPrice: "220.000đ",
    status: "open",
    mentor: "Anh Minh Quân (Kỹ sư dữ liệu & Cựu SV MIS)",
    tags: ["Thực hành máy tính", "Hỗ trợ 1:1 qua Zalo"],
    rating: 4.8,
    colorTheme: "mis",
    curriculum: [
      "Buổi 1: Cài đặt công cụ, làm quen cấu trúc CSDL SQL Server & câu lệnh SELECT cơ bản",
      "Buổi 2: Truy vấn có điều kiện lọc phức tạp (WHERE, AND/OR, LIKE, BETWEEN, IN)",
      "Buổi 3: Gom nhóm dữ liệu, lọc nhóm & Sử dụng các hàm gộp (GROUP BY, HAVING, SUM, COUNT, AVG)",
      "Buổi 4: Viết câu lệnh JOIN liên kết nhiều bảng, truy vấn con Subquery & Thủ thuật phòng thi"
    ],
    suitableFor: [
      "Sinh viên ngành MIS, CNTT chuẩn bị thi thực hành CSDL trên máy",
      "Người học muốn bắt đầu làm quen với kỹ năng truy vấn dữ liệu",
      "Học viên cần người sửa lỗi cú pháp SQL tận tình"
    ],
    preparation: [
      "Laptop chạy Windows hoặc macOS cài sẵn công cụ SQL Server/DBeaver",
      "Kiến thức cơ bản về thiết kế cơ sở dữ liệu quan hệ"
    ]
  },
  {
    id: "crs-lkt-fast",
    slug: "on-tap-luat-kinh-te",
    title: "Lớp tổng ôn Luật kinh tế cấp tốc",
    subject: "Luật kinh tế",
    category: "Luật",
    format: "zoom",
    sessions: 2,
    duration: "4 giờ học Zoom + tài liệu tóm tắt",
    schedule: "Tối Thứ 2 & Thứ 4 trước kỳ thi",
    description: "Cách tra cứu nhanh các điều luật Doanh nghiệp & Hợp đồng, phân tích chuẩn xác tình huống tranh chấp để làm tự luận.",
    price: "79.000đ",
    oldPrice: "140.000đ",
    status: "open",
    mentor: "Luật sư Tiến Đạt (Cố vấn pháp lý doanh nghiệp)",
    tags: ["Tập trung giải đề", "Tài liệu cô đọng"],
    rating: 4.7,
    colorTheme: "law",
    curriculum: [
      "Buổi 1: Kỹ năng tra cứu luật & Tổng ôn Luật Doanh nghiệp (Các loại hình doanh nghiệp, quản trị nội bộ)",
      "Buổi 2: Tổng ôn Luật Hợp đồng thương mại & Các phương thức giải quyết tranh chấp kinh doanh thực tế"
    ],
    suitableFor: [
      "Sinh viên UFM chuẩn bị thi tự luận cuối kỳ môn Luật kinh tế",
      "Học viên cần phương pháp viết bài giải tự luận tình huống luật rõ ràng, thuyết phục",
      "Học viên muốn rút gọn thời gian học thuộc lòng điều luật"
    ],
    preparation: [
      "Văn bản Luật Doanh nghiệp & Luật Thương mại hiện hành (in sẵn hoặc PDF)",
      "Bút highlight để đánh dấu các từ khóa chính"
    ]
  },
  {
    id: "crs-tctt-fast",
    slug: "tai-chinh-tien-te-cap-toc",
    title: "Lớp ôn cấp tốc Tài chính tiền tệ UFM",
    subject: "Tài chính tiền tệ",
    category: "Tài chính",
    format: "zoom",
    sessions: 3,
    duration: "6 giờ học + slide tóm tắt",
    schedule: "Tối Thứ 6 & Chủ Nhật (19:30 - 21:30)",
    description: "Giải quyết các câu hỏi hóc búa về chính sách tiền tệ, công cụ kiểm soát lạm phát và các dạng bài tập tính lãi suất đơn giản.",
    price: "99.000đ",
    oldPrice: "180.000đ",
    status: "full",
    mentor: "Anh Trung Kiên (Thạc sĩ Tài chính ngân hàng)",
    tags: ["Đầy slot", "Lớp học tương tác nhanh"],
    rating: 4.6,
    colorTheme: "finance",
    curriculum: [
      "Buổi 1: Bản chất của tài chính, tiền tệ & hệ thống hóa công thức tính lãi suất",
      "Buổi 2: Cung cầu tiền tệ, vai trò Ngân hàng thương mại & tạo tiền của hệ thống",
      "Buổi 3: Ngân hàng trung ương, chính sách tiền tệ & các giải pháp kiểm soát lạm phát vĩ mô"
    ],
    suitableFor: [
      "Sinh viên UFM chuẩn bị thi trắc nghiệm hoặc tự luận môn Tài chính tiền tệ cuối kỳ",
      "Sinh viên cần củng cố kiến thức kinh tế vĩ mô tài chính",
      "Học viên muốn tổng ôn nhanh lý thuyết trong 3 buổi học"
    ],
    preparation: [
      "Slide bài giảng lý thuyết của trường",
      "Sổ tay để ghi chép tóm tắt ý chính"
    ]
  }
];

export const tutors: TutorItem[] = [
  {
    id: "tut-kttc1",
    slug: "tutor-ke-toan-tai-chinh-1",
    name: "Tutor Minh Thư",
    subjects: ["Kế toán tài chính 1", "Nguyên lý kế toán"],
    faculty: "Kế toán - Kiểm toán",
    strengths: ["Giải thích định khoản dễ hiểu", "Kiên nhẫn hỗ trợ người mất gốc"],
    format: "1:1 & Nhóm nhỏ (Online/Offline)",
    price: "120.000đ / giờ",
    availability: "Còn 2 slot tối Thứ 3, 5",
    rating: 4.9,
    shortBio: "Sinh viên năm cuối ngành Kế toán doanh nghiệp UFM. GPA môn Kế toán tài chính 1 đạt 9.2/10. Có kinh nghiệm dạy kèm cho hơn 30 bạn qua môn an toàn.",
    tags: ["Điểm môn 9.2", "Kinh nghiệm 1 năm"],
    colorTheme: "accounting",
    suitableFor: [
      "Học viên bị mất gốc định khoản kế toán hoàn toàn",
      "Học viên cần giảng viên giảng chậm, kiên nhẫn sửa bài",
      "Sinh viên chuẩn bị làm bài thi kiểm tra giữa kỳ, cuối kỳ"
    ],
    supportMethods: [
      "Dạy kèm online qua Zoom/Google Meet sử dụng bảng viết trực quan",
      "Hỗ trợ giải đáp nhanh các thắc mắc định khoản qua Zalo 24/7",
      "Biên soạn bài tập phụ phù hợp với năng lực hiện tại của học viên"
    ]
  },
  {
    id: "tut-nlkt",
    slug: "tutor-nguyen-ly-ke-toan",
    name: "Tutor Ngọc Vy",
    subjects: ["Nguyên lý kế toán"],
    faculty: "Kế toán - Kiểm toán",
    strengths: ["Lập bảng cân đối nhanh", "Sơ đồ chữ T siêu tốc"],
    format: "1:1 (Online/Offline quận 7)",
    price: "100.000đ / giờ",
    availability: "Còn slot sáng Thứ 7, Chủ Nhật",
    rating: 4.8,
    shortBio: "Sinh viên năm 3 chuyên ngành Kiểm toán. GPA tích lũy 3.65/4. Nhiệt tình, chỉ bài tỉ mỉ, giúp học viên hiểu bản chất tài khoản thay vì học vẹt.",
    tags: ["GPA 3.65", "Vui vẻ nhiệt tình"],
    colorTheme: "accounting",
    suitableFor: [
      "Sinh viên năm nhất mới tiếp cận kế toán chưa hiểu nợ - có",
      "Học viên cần phương pháp nhớ hệ thống tài khoản nhanh chóng",
      "Học viên muốn củng cố bài tập lập bảng cân đối kế toán"
    ],
    supportMethods: [
      "Sử dụng bảng viết ảo vẽ sơ đồ chữ T trực quan sinh động",
      "Chia sẻ mẹo phân biệt các tài khoản dễ nhầm lẫn (phát sinh nợ/có)",
      "Chữa bài tập về nhà và nhắc nhở kiến thức liên tục"
    ]
  },
  {
    id: "tut-micro",
    slug: "tutor-kinh-te-vi-mo",
    name: "Tutor Hoàng Nam",
    subjects: ["Kinh tế vi mô", "Kinh tế vĩ mô"],
    faculty: "Viện Kinh tế chính trị quốc tế",
    strengths: ["Mẹo nhớ đồ thị nhanh", "Giải bài tập tối ưu hóa"],
    format: "1:1 & Nhóm nhỏ (Online)",
    price: "110.000đ / giờ",
    availability: "Nhận lịch linh hoạt các buổi tối",
    rating: 4.9,
    shortBio: "Thành viên đội tuyển sinh viên giỏi UFM môn Kinh tế học. Điểm A+ cả hai môn Vi mô và Vĩ mô. Đã hỗ trợ nhiều bạn đạt điểm Giỏi.",
    tags: ["Điểm môn A+", "Đội tuyển SV Giỏi"],
    colorTheme: "economics",
    suitableFor: [
      "Học viên gặp khó khăn với đồ thị vi mô/vĩ mô phức tạp",
      "Sinh viên muốn giải các bài toán tối ưu hóa chi phí và lợi nhuận độc quyền",
      "Học viên ôn luyện hướng tới điểm Giỏi/Xuất sắc (A, A+)"
    ],
    supportMethods: [
      "Vẽ và phân tích đồ thị trực tiếp cùng học viên qua whiteboard online",
      "Tóm tắt công thức cốt lõi và gửi lại file note sau mỗi buổi học",
      "Luyện giải đề thi thực tế UFM các khóa trước"
    ]
  },
  {
    id: "tut-xstk",
    slug: "tutor-xac-suat-thong-ke",
    name: "Tutor Tiến Dũng",
    subjects: ["Xác suất thống kê", "Toán cao cấp"],
    faculty: "Khoa học dữ liệu",
    strengths: ["Bấm máy Casio trắc nghiệm", "Kiểm định giả thuyết"],
    format: "1:1 (Online qua Google Meet)",
    price: "130.000đ / giờ",
    availability: "Còn 1 slot tối Thứ 7",
    rating: 5.0,
    shortBio: "Cựu SV ngành Toán kinh tế. Có kinh nghiệm 2 năm ôn thi Xác suất thống kê cho SV khối ngành kinh tế UFM. Cam kết giúp hiểu sâu công thức khó.",
    tags: ["Kinh nghiệm 2 năm", "Casio thần tốc"],
    colorTheme: "statistics",
    suitableFor: [
      "Học viên sợ môn Toán định lượng hoặc muốn lấy điểm tối đa",
      "Học viên cần học nhanh mẹo bấm máy Casio để giải trắc nghiệm tốc độ",
      "Sinh viên cần củng cố chương kiểm định giả thuyết và ước lượng"
    ],
    supportMethods: [
      "Bật camera quay trực tiếp thao tác bấm máy tính Casio thực tế",
      "Cung cấp file tóm tắt công thức ngắn gọn, dễ tra cứu",
      "Luyện giải đề thi trắc nghiệm UFM dưới áp lực thời gian"
    ]
  },
  {
    id: "tut-mkt",
    slug: "tutor-marketing-can-ban",
    name: "Tutor Quỳnh Anh",
    subjects: ["Marketing căn bản", "Marketing dịch vụ"],
    faculty: "Marketing",
    strengths: ["Case study thực tế", "Sửa bài tiểu luận nhóm"],
    format: "1:1 & Nhóm nhỏ (Offline/Online)",
    price: "120.000đ / giờ",
    availability: "Nhận lịch các buổi chiều",
    rating: 4.8,
    shortBio: "Cựu SV chuyên ngành Quản trị thương hiệu UFM. Đạt giải nghiên cứu khoa học cấp trường. Hướng dẫn tư duy marketing ứng dụng thực tế.",
    tags: ["Giải NCKH", "Sửa bài tiểu luận"],
    colorTheme: "marketing",
    suitableFor: [
      "Học viên cần người hướng dẫn phân tích case study trong đề thi",
      "Sinh viên cần sửa bài tập nhóm hoặc bài tiểu luận đạt điểm cao",
      "Học viên cần hệ thống lại lý thuyết tự luận Marketing"
    ],
    supportMethods: [
      "Đọc và góp ý trực tiếp trên Google Docs nội dung bài viết của học viên",
      "Thảo luận, phân tích về các chiến dịch marketing thực tế tại Việt Nam",
      "Luyện tập trả lời các câu hỏi tự luận tình huống thực tế"
    ]
  },
  {
    id: "tut-qth",
    slug: "tutor-quan-tri-hoc",
    name: "Tutor Quốc Bảo",
    subjects: ["Quản trị học", "Quản trị nguồn nhân lực"],
    faculty: "Quản trị kinh doanh",
    strengths: ["Câu hỏi tình huống", "Tóm tắt lý thuyết Mindmap"],
    format: "1:1 (Online)",
    price: "100.000đ / giờ",
    availability: "Trống lịch tối Thứ 2, 4, 6",
    rating: 4.7,
    shortBio: "GPA tích lũy 3.58. Nhiệt tình, có phương pháp dạy bằng mindmap trực quan, hỗ trợ giải đáp bài tập 24/7 trong suốt quá trình ôn tập.",
    tags: ["Hỗ trợ 24/7", "GPA 3.58"],
    colorTheme: "management",
    suitableFor: [
      "Học viên cần học lý thuyết quản trị một cách sinh động, dễ nhớ",
      "Sinh viên ôn thi tự luận tình huống nhà quản lý UFM",
      "Học viên cần người đôn đốc, theo sát tiến độ học tập"
    ],
    supportMethods: [
      "Sử dụng sơ đồ tư duy Mindmap và hình ảnh minh họa sinh động",
      "Hỏi đáp nhanh lý thuyết qua flashcard ảo tự soạn",
      "Hỗ trợ giải đáp thắc mắc bài học qua Zalo liên tục"
    ]
  },
  {
    id: "tut-csdl",
    slug: "tutor-co-so-du-lieu",
    name: "Tutor Đức Huy",
    subjects: ["Cơ sở dữ liệu", "Hệ thống thông tin quản lý"],
    faculty: "Viện Công nghệ tài chính ngân hàng",
    strengths: ["Truy vấn SQL nâng cao", "Thiết kế ERD chuẩn hóa"],
    format: "1:1 & Nhóm nhỏ (Online/Offline Q7)",
    price: "130.000đ / giờ",
    availability: "Còn slot chiều Thứ Bảy, sáng Chủ Nhật",
    rating: 4.9,
    shortBio: "Sinh viên năm 4 ngành Hệ thống thông tin quản lý. Điểm thi thực hành SQL đạt điểm tuyệt đối 10/10. Có bộ slide tự soạn dễ hiểu.",
    tags: ["Thực hành 10/10", "Tài liệu tự soạn"],
    colorTheme: "mis",
    suitableFor: [
      "Sinh viên ngành MIS, CNTT gặp rắc rối với viết lệnh truy vấn SQL",
      "Học viên cần người sửa lỗi câu lệnh SQL thực tế trên máy tính",
      "Học viên cần hiểu nhanh thiết kế mô hình dữ liệu ERD"
    ],
    supportMethods: [
      "Chia sẻ màn hình viết SQL trực tiếp và phân tích lỗi cú pháp cùng học viên",
      "Cung cấp bộ slide tự soạn tóm tắt ngắn gọn quy tắc chuẩn hóa 1NF, 2NF, 3NF",
      "Hỗ trợ cài đặt và cấu hình SQL Server/DBeaver tận tình"
    ]
  },
  {
    id: "tut-lkt",
    slug: "tutor-luat-kinh-te",
    name: "Tutor Minh Hằng",
    subjects: ["Luật kinh tế"],
    faculty: "Luật",
    strengths: ["Giải quyết tranh chấp", "Cách nhớ điều luật nhanh"],
    format: "1:1 (Online)",
    price: "110.000đ / giờ",
    availability: "Nhận lịch tối Thứ 3, 5, 7",
    rating: 4.8,
    shortBio: "GPA tích lũy ngành Luật đạt 3.7. Kinh nghiệm làm trợ lý pháp lý bán thời gian. Hướng dẫn cách phân tích tình huống tranh chấp thương mại sát đề thi.",
    tags: ["GPA 3.7", "Thực chiến pháp lý"],
    colorTheme: "law",
    suitableFor: [
      "Học viên khối ngành kinh tế cần nhớ nhanh tinh thần điều luật",
      "Sinh viên ôn thi tự luận tình huống tranh chấp thương mại UFM",
      "Học viên cần học kỹ năng tra cứu luật hiệu quả"
    ],
    supportMethods: [
      "Hướng dẫn phân tích các case study tranh chấp thực tế trên báo chí",
      "Rèn luyện kỹ năng viết bài giải tự luận luật kinh tế mạch lạc, thuyết phục",
      "Tóm tắt các từ khóa cốt lõi của từng bộ luật lớn"
    ]
  }
];
