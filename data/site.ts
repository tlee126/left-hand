export type FeatureIconKey =
  | "book"
  | "users"
  | "question"
  | "play"
  | "search"
  | "pen"
  | "send"
  | "check"
  | "message";

export type SocialIconKey = "facebook" | "youtube" | "messenger";

export type ResourceCategory =
  | "Kế toán"
  | "Kinh tế"
  | "Thống kê"
  | "Marketing"
  | "Quản trị"
  | "Tài chính"
  | "MIS"
  | "Luật"
  | "Ngoại ngữ";

export type ResourceType = "TÀI LIỆU" | "KHÓA HỌC";

export type ResourceColorTheme =
  | "accounting"
  | "economics"
  | "statistics"
  | "marketing"
  | "management"
  | "finance"
  | "law"
  | "mis"
  | "languages";

export type ResourceItem = {
  id: string;
  title: string;
  category: ResourceCategory;
  type: ResourceType;
  description: string;
  price: string;
  oldPrice?: string;
  meta: string;
  bonus?: string;
  rating: number;
  isHot?: boolean;
  colorTheme: ResourceColorTheme;
};

export const navItems = [
  { label: "Dịch vụ", href: "/#services" },
  { label: "Tài liệu", href: "/#resources" },
  { label: "Tư vấn", href: "/#contact" },
  { label: "Cộng đồng", href: "/#ecosystem" }
];

export const aboutItems = [
  {
    title: "Tài liệu được chuẩn hóa theo môn",
    body: "Tài liệu ôn thi được tổng hợp theo học phần, có đề cương, bài tập mẫu và phần cần chú ý trước kỳ thi.",
    label: "Tài liệu",
    icon: "book" as FeatureIconKey
  },
  {
    title: "Có người gợi ý đúng thứ cần",
    body: "Khi chưa biết bắt đầu từ đâu, team sẽ giúp lọc ra tài liệu, tutor hoặc lớp ôn phù hợp với từng môn.",
    label: "Định hướng",
    icon: "search" as FeatureIconKey
  },
  {
    title: "Hỗ trợ sát nhu cầu sinh viên",
    body: "Không chỉ bán tài liệu, LEFT HAND ưu tiên hỗ trợ đúng lúc, đúng môn và đúng phần đang làm bạn kẹt.",
    label: "Hỗ trợ",
    icon: "message" as FeatureIconKey
  }
];

export const impactStats = [
  {
    numericValue: 300,
    suffix: "+",
    title: "học viên được đồng hành",
    detail: "LEFT HAND đã hỗ trợ một cộng đồng đủ lớn để nhìn thấy nhu cầu học thật, không còn là thử nghiệm nhỏ.",
    tag: "Mỗi học kỳ"
  },
  {
    numericValue: 10,
    suffix: "+",
    title: "lớp học được tổ chức",
    detail: "Lớp ôn được triển khai đều tay để bám kịp lịch học, lịch thi và các môn có nhu cầu cao.",
    tag: "Mỗi học kỳ"
  },
  {
    numericValue: 65,
    suffix: "+",
    title: "học viên tương tác trực tiếp",
    detail: "Team vẫn giữ được nhịp hỏi đáp tốt trong các buổi online kéo dài, không biến lớp học thành video một chiều.",
    tag: "Buổi online 2 giờ"
  },
  {
    numericValue: 3,
    suffix: "",
    padStart: 2,
    title: "cộng đồng đang vận hành",
    detail: "Ba cộng đồng học thuật giúp LEFT HAND duy trì kết nối, cập nhật nhu cầu và hỗ trợ theo nhóm môn rõ ràng.",
    tag: "Cộng đồng học thuật"
  }
];

export const services = [
  {
    title: "Tài liệu ôn thi",
    body: "Tài liệu được tổng hợp theo môn, có đề cương, bài tập, ghi chú trọng tâm và phần cần chú ý trước kỳ thi.",
    label: "Tài liệu",
    icon: "book" as FeatureIconKey,
    href: "/tai-lieu",
    cta: "Xem tài liệu"
  },
  {
    title: "Peer Tutor",
    body: "Học cùng tutor là sinh viên hoặc cựu sinh viên đã qua môn, phù hợp khi cần người giải thích lại phần chưa hiểu.",
    label: "Peer Tutor",
    icon: "users" as FeatureIconKey,
    href: "/tutor",
    cta: "Tìm tutor"
  },
  {
    title: "Hỏi bài 24/7",
    body: "Gửi câu hỏi hoặc bài tập, team hỗ trợ định hướng cách làm và nhắc lại phần kiến thức liên quan.",
    label: "Hỗ trợ nhanh",
    icon: "question" as FeatureIconKey,
    href: "/#contact",
    cta: "Gửi câu hỏi"
  },
  {
    title: "Video bài giảng / lớp ôn",
    body: "Video ngắn và lớp ôn giúp bạn học lại nhanh các phần dễ gặp trong kiểm tra mà không phải tự ghép quá nhiều nguồn.",
    label: "Video & lớp ôn",
    icon: "play" as FeatureIconKey,
    href: "/khoa-hoc",
    cta: "Xem lớp ôn"
  }
];



export const processSteps = [
  {
    step: "1",
    title: "Chọn môn học hoặc phần đang kẹt",
    body: "Ghi rõ học phần để team biết bạn đang cần ôn giữa kỳ, cuối kỳ hay chỉ cần gỡ một đoạn kiến thức.",
    icon: "search" as FeatureIconKey
  },
  {
    step: "2",
    title: "Ghi nhu cầu thật rõ",
    body: "Chọn tài liệu, peer tutor, hỏi bài 24/7 hoặc video bài giảng / lớp ôn để nhận đúng gợi ý.",
    icon: "pen" as FeatureIconKey
  },
  {
    step: "3",
    title: "Team lọc và sắp xếp",
    body: "Chúng mình xem nhu cầu, đối chiếu với môn học và đề xuất tài nguyên phù hợp nhất trong thời điểm đó.",
    icon: "check" as FeatureIconKey
  },
  {
    step: "4",
    title: "Nhận tài liệu hoặc lịch lớp",
    body: "Bạn được gửi đúng tài liệu, đúng lịch lớp hoặc được ghép vào tutor phù hợp để theo kịp tiến độ.",
    icon: "send" as FeatureIconKey
  }
];

export const testimonials = [
  {
    quote:
      "Tài liệu được gom sẵn nên mình đỡ mất thời gian tìm lại trong Drive trước ngày thi.",
    author: "Sinh viên Kế toán",
    detail: "Đã dùng tài liệu ôn giữa kỳ"
  },
  {
    quote:
      "Tutor giải thích dễ hiểu, nhất là mấy phần mình bị mất gốc từ đầu kỳ.",
    author: "Sinh viên Marketing",
    detail: "Đã học kèm 1:1"
  },
  {
    quote:
      "Mình thích nhất là phần tóm tắt chương, đọc lại nhanh trước khi vào phòng thi.",
    author: "Sinh viên Quản trị",
    detail: "Đã dùng tài liệu cuối kỳ"
  },
  {
    quote:
      "Lớp ôn đi đúng trọng tâm, không lan man, có bài tập để luyện lại liền.",
    author: "Sinh viên Kinh tế",
    detail: "Đã tham gia lớp ôn"
  },
  {
    quote:
      "Hỏi bài nhanh, được gợi ý cách làm chứ không chỉ gửi đáp án.",
    author: "Sinh viên MIS",
    detail: "Đã dùng hỏi bài 24/7"
  },
  {
    quote:
      "Slide và video ngắn dễ xem lại, phù hợp lúc mình cần ôn gấp.",
    author: "Sinh viên Marketing",
    detail: "Đã xem video bài giảng"
  },
  {
    quote:
      "Team tư vấn đúng môn mình đang kẹt, không bị rối giữa quá nhiều tài liệu.",
    author: "Sinh viên Tài chính",
    detail: "Đã đăng ký tư vấn"
  },
  {
    quote:
      "Tài liệu trình bày gọn, có checklist nên dễ biết phần nào cần ưu tiên.",
    author: "Sinh viên Kế toán",
    detail: "Đã dùng bộ ôn thi"
  }
];

export const socialLinks = [
  {
    name: "Facebook",
    description:
      "Cập nhật tài liệu mới, lịch lớp ôn và các thông báo hỗ trợ theo từng học kỳ.",
    href: "#",
    cta: "Theo dõi ngay",
    icon: "facebook" as SocialIconKey
  },
  {
    name: "YouTube",
    description:
      "Video ngắn, phần ôn tắt và các đoạn giải thích lại kiến thức nền dễ quên.",
    href: "#",
    cta: "Xem ngay",
    icon: "youtube" as SocialIconKey
  },
  {
    name: "Messenger",
    description:
      "Nơi sinh viên hỏi nhanh, nhận hỗ trợ và được gợi ý tài liệu hoặc lớp phù hợp.",
    href: "#",
    cta: "Nhắn tin ngay",
    icon: "messenger" as SocialIconKey
  }
];

export const faculties = [
  "Kế toán - Kiểm toán",
  "Khoa học dữ liệu",
  "Luật",
  "Marketing",
  "Quản trị kinh doanh",
  "Thương mại và Du lịch",
  "Ngoại ngữ",
  "Viện Công nghệ tài chính ngân hàng",
  "Viện Kinh tế chính trị quốc tế",
  "Viện Đào tạo Quốc tế",
  "Chưa rõ khoa/viện",
  "Khác"
];

export const majors = [
  "Quản trị kinh doanh",
  "Marketing",
  "Kinh doanh quốc tế",
  "Tài chính - Ngân hàng",
  "Công nghệ tài chính",
  "Trí tuệ nhân tạo",
  "Kế toán",
  "Kiểm toán",
  "Kinh tế",
  "Quản lý kinh tế",
  "Toán kinh tế",
  "Kinh tế chính trị",
  "Luật kinh tế",
  "Hệ thống thông tin quản lý",
  "Khoa học dữ liệu",
  "Ngôn ngữ Anh",
  "Bất động sản",
  "Quản trị dịch vụ du lịch và lữ hành",
  "Quản trị khách sạn",
  "Quản trị nhà hàng và dịch vụ ăn uống",
  "Khác / chưa rõ"
];

export const courseGroups = [
  {
    label: "Kế toán - Kiểm toán",
    items: [
      "Nguyên lý kế toán",
      "Kế toán tài chính 1",
      "Kế toán tài chính 2",
      "Kế toán quản trị",
      "Kiểm toán căn bản"
    ]
  },
  {
    label: "Kinh tế - Định lượng",
    items: [
      "Kinh tế vi mô",
      "Kinh tế vĩ mô",
      "Xác suất thống kê",
      "Toán cao cấp",
      "Toán kinh tế",
      "Kinh tế lượng"
    ]
  },
  {
    label: "Marketing - Quản trị",
    items: [
      "Marketing căn bản",
      "Marketing dịch vụ",
      "Hành vi người tiêu dùng",
      "Quản trị học",
      "Quản trị chiến lược",
      "Quản trị nguồn nhân lực"
    ]
  },
  {
    label: "Tài chính - Ngân hàng",
    items: [
      "Tài chính doanh nghiệp",
      "Tài chính tiền tệ",
      "Ngân hàng thương mại",
      "Thuế",
      "Thị trường tài chính"
    ]
  },
  {
    label: "MIS / Công nghệ / Dữ liệu",
    items: [
      "Cơ sở dữ liệu",
      "Hệ thống thông tin quản lý",
      "Phân tích thiết kế hệ thống",
      "Thương mại điện tử",
      "Khoa học dữ liệu cơ bản",
      "Trí tuệ nhân tạo cơ bản"
    ]
  },
  {
    label: "Luật / Ngoại ngữ / Khác",
    items: [
      "Luật kinh tế",
      "Tiếng Anh thương mại",
      "Môn khác / mình sẽ ghi rõ ở ghi chú",
      "Chưa rõ, cần tư vấn chọn môn"
    ]
  }
];

export const needs = [
  "Tài liệu ôn thi",
  "Khóa học / lớp ôn",
  "Peer Tutor 1:1",
  "Hỏi bài 24/7",
  "Video bài giảng",
  "Chưa rõ, cần tư vấn"
];
