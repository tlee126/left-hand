-- seed.sql
-- Idempotent seed data for LEFT HAND core subjects and catalog items
-- Derived directly from data/catalog.ts with integer numeric VND pricing
-- NOTE: All subject UUID variables (v_sub_*) used in DO blocks must be explicitly declared and selected from subjects by slug.

BEGIN;

-- 1. Insert Canonical Subjects
INSERT INTO subjects (slug, name, category, faculty_group, color_theme)
VALUES
    ('ke-toan-tai-chinh-1', 'Kế toán tài chính 1', 'Kế toán', 'Kế toán - Kiểm toán', 'accounting'),
    ('nguyen-ly-ke-toan', 'Nguyên lý kế toán', 'Kế toán', 'Kế toán - Kiểm toán', 'accounting'),
    ('ke-toan-quan-tri', 'Kế toán quản trị', 'Kế toán', 'Kế toán - Kiểm toán', 'accounting'),
    ('kinh-te-vi-mo', 'Kinh tế vi mô', 'Kinh tế', 'Kinh tế - Định lượng', 'economics'),
    ('kinh-te-vi-mo-macro', 'Kinh tế vĩ mô', 'Kinh tế', 'Kinh tế - Định lượng', 'economics'),
    ('xac-suat-thong-ke', 'Xác suất thống kê', 'Thống kê', 'Kinh tế - Định lượng', 'statistics'),
    ('toan-cao-cap', 'Toán cao cấp', 'Thống kê', 'Kinh tế - Định lượng', 'statistics'),
    ('marketing-can-ban', 'Marketing căn bản', 'Marketing', 'Marketing - Quản trị', 'marketing'),
    ('marketing-dich-vu', 'Marketing dịch vụ', 'Marketing', 'Marketing - Quản trị', 'marketing'),
    ('quan-tri-hoc', 'Quản trị học', 'Quản trị', 'Marketing - Quản trị', 'management'),
    ('quan-tri-nguon-nhan-luc', 'Quản trị nguồn nhân lực', 'Quản trị', 'Marketing - Quản trị', 'management'),
    ('tai-chinh-tien-te', 'Tài chính tiền tệ', 'Tài chính', 'Tài chính - Ngân hàng', 'finance'),
    ('tai-chinh-doanh-nghiep', 'Tài chính doanh nghiệp', 'Tài chính', 'Tài chính - Ngân hàng', 'finance'),
    ('co-so-du-lieu', 'Cơ sở dữ liệu', 'MIS', 'MIS / Công nghệ / Dữ liệu', 'mis'),
    ('he-thong-thong-tin-quan-ly', 'Hệ thống thông tin quản lý', 'MIS', 'MIS / Công nghệ / Dữ liệu', 'mis'),
    ('luat-kinh-te', 'Luật kinh tế', 'Luật', 'Luật / Ngoại ngữ / Khác', 'law'),
    ('tieng-anh-thuong-mai', 'Tiếng Anh thương mại', 'Ngoại ngữ', 'Luật / Ngoại ngữ / Khác', 'languages')
ON CONFLICT (slug) DO UPDATE
SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    faculty_group = EXCLUDED.faculty_group,
    color_theme = EXCLUDED.color_theme,
    updated_at = timezone('utc'::text, now());

-- 2. Insert Materials (Products + Materials Extension)
DO $$
DECLARE
    v_sub_kttc1 UUID;
    v_sub_nlkt UUID;
    v_sub_ktqt UUID;
    v_sub_ktvm UUID;
    v_sub_ktvmo UUID;
    v_sub_xstk UUID;
    v_sub_mkcb UUID;
    v_sub_qth UUID;
    v_sub_lkt UUID;
    v_sub_tctt UUID;
    v_sub_tcdn UUID;
    v_sub_csdl UUID;
    v_sub_htttql UUID;
    v_sub_tatm UUID;
    v_prod_id UUID;
BEGIN
    SELECT id INTO v_sub_kttc1 FROM subjects WHERE slug = 'ke-toan-tai-chinh-1';
    SELECT id INTO v_sub_nlkt FROM subjects WHERE slug = 'nguyen-ly-ke-toan';
    SELECT id INTO v_sub_ktqt FROM subjects WHERE slug = 'ke-toan-quan-tri';
    SELECT id INTO v_sub_ktvm FROM subjects WHERE slug = 'kinh-te-vi-mo';
    SELECT id INTO v_sub_ktvmo FROM subjects WHERE slug = 'kinh-te-vi-mo-macro';
    SELECT id INTO v_sub_xstk FROM subjects WHERE slug = 'xac-suat-thong-ke';
    SELECT id INTO v_sub_mkcb FROM subjects WHERE slug = 'marketing-can-ban';
    SELECT id INTO v_sub_qth FROM subjects WHERE slug = 'quan-tri-hoc';
    SELECT id INTO v_sub_lkt FROM subjects WHERE slug = 'luat-kinh-te';
    SELECT id INTO v_sub_tctt FROM subjects WHERE slug = 'tai-chinh-tien-te';
    SELECT id INTO v_sub_tcdn FROM subjects WHERE slug = 'tai-chinh-doanh-nghiep';
    SELECT id INTO v_sub_csdl FROM subjects WHERE slug = 'co-so-du-lieu';
    SELECT id INTO v_sub_htttql FROM subjects WHERE slug = 'he-thong-thong-tin-quan-ly';
    SELECT id INTO v_sub_tatm FROM subjects WHERE slug = 'tieng-anh-thuong-mai';

    -- mat-kttc1
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('ke-toan-tai-chinh-1', 'material', 'Tóm tắt & Bài giải Kế toán tài chính 1', 'Hệ thống hóa toàn bộ định khoản tài sản cố định, hàng tồn kho, nợ phải trả kèm lời giải chi tiết cho các dạng bài thi cuối kỳ UFM.', v_sub_kttc1, 'Kế toán', 'digital_download', 'published', 29000, 59000, 4.90, true, 'accounting')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 48, ARRAY['Lý thuyết + Bài tập', 'Bám sát đề thi'], ARRAY['48 trang PDF lý thuyết & bài giải chi tiết', 'Bảng tóm tắt các tài khoản phát sinh hay gặp', 'Bộ đề thi thử cuối kỳ sát sườn kèm đáp án'], ARRAY['Sinh viên UFM chuẩn bị bước vào kỳ thi cuối kỳ', 'Học viên cần hệ thống lại định khoản TSCĐ, nợ phải trả', 'Sinh viên bị hổng kiến thức từ giữa kỳ học'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-nlkt
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('nguyen-ly-ke-toan', 'material', 'Cẩm nang Nguyên lý kế toán từ con số 0', 'Sơ đồ chữ T trực quan, cách lập bảng cân đối kế toán nhanh và mẹo phân biệt các tài khoản dễ nhầm lẫn nhất cho sinh viên năm 1, 2.', v_sub_nlkt, 'Kế toán', 'digital_download', 'published', 25000, 50000, 4.80, false, 'accounting')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 40, ARRAY['Mất gốc', 'Sơ đồ chữ T'], ARRAY['40 trang PDF sơ đồ chữ T vẽ tay trực quan', 'Bảng đối chiếu nợ - có chi tiết từng loại tài khoản', 'Hệ thống bài tập thực hành định khoản từ dễ đến khó'], ARRAY['Sinh viên năm 1, năm 2 mới bắt đầu tiếp cận môn kế toán', 'Học viên cần lấy lại căn bản định khoản nợ - có nhanh chóng', 'Người học muốn hệ thống lý thuyết để ôn tập cuối kỳ'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-ktqt
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('ke-toan-quan-tri', 'material', 'Đề cương ôn thi Kế toán quản trị UFM', 'Phân tích biến động chi phí, điểm hòa vốn, lập dự toán ngân sách và các phương án ra quyết định kinh doanh ngắn hạn.', v_sub_ktqt, 'Kế toán', 'digital_download', 'published', 29000, 49000, 4.70, false, 'accounting')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 36, ARRAY['Tổng hợp công thức', 'Case study'], ARRAY['36 trang PDF chuyên đề phân loại và biến động chi phí', 'Tóm tắt công thức tính điểm hòa vốn CVP', 'Các case study giải mẫu tình huống quản trị thực tế'], ARRAY['Học viên ngành Kế toán - Kiểm toán chuẩn bị thi cuối kỳ', 'Sinh viên ngành Quản trị kinh doanh muốn hiểu báo cáo nội bộ', 'Sinh viên cần củng cố bài tập ra quyết định ngắn hạn'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-ktvm
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('kinh-te-vi-mo', 'material', 'Sổ tay thực chiến Kinh tế vi mô UFM', 'Phương pháp vẽ đồ thị cung cầu, cách tính thặng dư tiêu dùng, thặng dư sản xuất và các mô hình thị trường cạnh tranh/độc quyền.', v_sub_ktvm, 'Kinh tế', 'digital_download', 'published', 25000, 45000, 4.90, true, 'economics')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 35, ARRAY['Mẹo đồ thị', 'Tóm gọn chương'], ARRAY['35 trang PDF hướng dẫn vẽ đồ thị cung cầu', 'Tóm tắt công thức thặng dư tiêu dùng và sản xuất nhanh', 'Bộ câu hỏi trắc nghiệm tự luyện kèm giải thích đáp án'], ARRAY['Học viên cần vượt qua nỗi sợ vẽ đồ thị vi mô', 'Sinh viên năm nhất tất cả các khối ngành kinh tế', 'Sinh viên chuẩn bị thi trắc nghiệm giữa kỳ & cuối kỳ'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-ktvmo
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('kinh-te-vi-mo-tong-on', 'material', 'Bí kíp trắc nghiệm & Tự luận Kinh tế vĩ mô', 'Giải thích các khái niệm GDP, lạm phát, thất nghiệp kèm phân tích mô hình IS-LM và AD-AS cực kỳ chi tiết, dễ hiểu.', v_sub_ktvmo, 'Kinh tế', 'digital_download', 'published', 29000, 59000, 4.80, false, 'economics')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 45, ARRAY['Mô hình IS-LM', 'Bài giải mẫu'], ARRAY['45 trang lý thuyết và phân tích mô hình vĩ mô', 'Hướng dẫn giải tự luận mô hình IS-LM chuẩn khung UFM', 'Tóm tắt công thức tính toán GDP, lạm phát, thất nghiệp'], ARRAY['Sinh viên ôn thi tự luận giữa kỳ và cuối kỳ', 'Sinh viên cần gỡ điểm môn Kinh tế vĩ mô', 'Học viên tự học muốn nắm bắt nhanh các chính sách vĩ mô'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-xstk
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('xac-suat-thong-ke', 'material', 'Phá đảo Xác suất thống kê (Kèm Casio)', 'Công thức xác suất đầy đủ, ước lượng, kiểm định giả thuyết và hướng dẫn bấm máy tính Casio để giải trắc nghiệm siêu tốc.', v_sub_xstk, 'Thống kê', 'digital_download', 'published', 25000, 50000, 5.00, true, 'statistics')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 32, ARRAY['Casio thần tốc', 'Kiểm định giả thuyết'], ARRAY['32 trang tóm tắt công thức xác suất từ cơ bản đến nâng cao', 'Hướng dẫn thao tác bấm máy Casio FX 580 chi tiết từng bước', 'Bộ đề trắc nghiệm thi thử kèm đáp án giải thích cụ thể'], ARRAY['Sinh viên ôn thi trắc nghiệm Xác suất thống kê UFM', 'Học viên gặp khó khăn với công thức tổ hợp, chỉnh hợp', 'Người học cần tóm tắt nhanh để ôn thi cấp tốc'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-mkcb
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('marketing-can-ban', 'material', 'Tóm tắt cốt lõi 10 chương Marketing căn bản', 'Mindmap tóm gọn hành vi khách hàng, chiến lược 4P/7P và các ví dụ thực tế tại Việt Nam để làm bài thi tự luận điểm cao.', v_sub_mkcb, 'Marketing', 'digital_download', 'published', 20000, 40000, 4.80, false, 'marketing')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 30, ARRAY['Sơ đồ Mindmap', 'Case Việt Nam'], ARRAY['30 trang PDF sơ đồ tư duy trực quan 10 chương học', 'Tóm tắt mô hình vi mô, vĩ mô và chiến lược marketing', 'Tập hợp các ví dụ case study thương hiệu Việt Nam điểm cao'], ARRAY['Sinh viên ôn thi tự luận cuối kỳ môn Marketing căn bản', 'Học viên cần chuẩn bị bài thuyết trình nhóm/tiểu luận', 'Sinh viên ngành Marketing hoặc Quản trị muốn ôn nhanh kiến thức'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-qth
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('quan-tri-hoc', 'material', 'Đề cương tóm tắt môn Quản trị học', 'Tổng hợp 4 chức năng quản trị: Hoạch định, Tổ chức, Lãnh đạo, Kiểm tra cùng ngân hàng câu hỏi tình huống thường gặp.', v_sub_qth, 'Quản trị', 'digital_download', 'published', 20000, 35000, 4.70, false, 'management')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 28, ARRAY['4 chức năng', 'Câu hỏi tình huống'], ARRAY['28 trang PDF tóm gọn lý thuyết cốt lõi quản trị', 'Hệ thống hóa 4 chức năng quản trị kinh điển', 'Ngân hàng câu hỏi xử lý tình huống thực tế thường ra thi'], ARRAY['Sinh viên chuẩn bị làm bài thi tự luận hoặc trắc nghiệm', 'Sinh viên cần tài liệu tham khảo làm bài tập tình huống', 'Người học cần hệ thống nhanh lý thuyết để thi qua môn'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-lkt
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('luat-kinh-te', 'material', 'Hệ thống hóa Luật kinh tế dễ nhớ', 'Tóm gọn Luật doanh nghiệp, Luật hợp đồng thương mại và cách phân tích tình huống tranh chấp thực tế trong đề thi.', v_sub_lkt, 'Luật', 'digital_download', 'published', 20000, 40000, 4.70, false, 'law')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 25, ARRAY['Luật Doanh nghiệp', 'Tóm tắt điều khoản'], ARRAY['25 trang tóm gọn điều luật kinh doanh cốt lõi', 'Sơ đồ tư duy về các loại hình doanh nghiệp tại Việt Nam', 'Các bài giải mẫu tình huống tranh chấp thương mại'], ARRAY['Sinh viên khối kinh tế không chuyên luật cần ôn thi nhanh', 'Sinh viên ôn thi tự luận cuối kỳ Luật kinh tế UFM', 'Học viên cần củng cố phương pháp trả lời tình huống luật'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-tctt
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tai-chinh-tien-te', 'material', 'Ôn tập cốt lõi môn Tài chính tiền tệ', 'Kiến thức về lãi suất, cung cầu tiền tệ, ngân hàng thương mại và vai trò của ngân hàng trung ương trong việc điều hành chính sách.', v_sub_tctt, 'Tài chính', 'digital_download', 'published', 29000, 49000, 4.60, false, 'finance')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 35, ARRAY['Chính sách tiền tệ', 'Đề cương chi tiết'], ARRAY['35 trang tóm gọn cấu trúc tài chính vĩ mô', 'Slide tổng hợp tiền tệ, lạm phát và lãi suất', 'Bộ câu hỏi trắc nghiệm tự luyện cuối kỳ'], ARRAY['Sinh viên chuyên ngành Tài chính - Ngân hàng ôn thi cuối kỳ', 'Học viên cần hệ thống lại cung cầu tiền tệ vĩ mô', 'Sinh viên các khối ngành kinh tế bổ trợ kiến thức'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-tcdn
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tai-chinh-doanh-nghiep', 'material', 'Sổ tay bài tập Tài chính doanh nghiệp', 'Các công thức tính NPV, IRR, WACC, mô hình định giá tài sản vốn CAPM kèm bài giải mẫu các chương ngân sách vốn đầu tư.', v_sub_tcdn, 'Tài chính', 'digital_download', 'published', 35000, 65000, 4.90, true, 'finance')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 42, ARRAY['Công thức NPV/IRR', 'Bài tập thực hành'], ARRAY['42 trang PDF công thức tài chính doanh nghiệp cô đọng', 'Bộ bài giải mẫu chương hoạch định ngân sách vốn đầu tư', 'Bài tập định giá tài sản CAPM có giải chi tiết'], ARRAY['Học viên chuẩn bị thi cuối kỳ ngành Tài chính - Ngân hàng', 'Sinh viên cần củng cố bài tập NPV, IRR trước kiểm tra', 'Học viên cần hệ thống hóa công thức tính WACC phức tạp'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-csdl
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('co-so-du-lieu', 'material', 'Sổ tay mô hình ERD & Truy vấn SQL căn bản', 'Cách vẽ sơ đồ ERD, chuẩn hóa dữ liệu 1NF, 2NF, 3NF và tổng hợp câu lệnh SQL từ SELECT đơn giản đến JOIN phức tạp.', v_sub_csdl, 'MIS', 'digital_download', 'published', 30000, 60000, 4.80, false, 'mis')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 38, ARRAY['Truy vấn SQL', 'Mẹo chuẩn hóa'], ARRAY['38 trang hướng dẫn vẽ sơ đồ ERD và chuẩn hóa dữ liệu', 'Tổng hợp cú pháp câu lệnh SQL thông dụng kèm ví dụ', 'File bài tập mẫu kèm cơ sở dữ liệu mẫu để thực hành'], ARRAY['Sinh viên ngành Hệ thống thông tin quản lý, CNTT', 'Học viên chuẩn bị thi thực hành SQL cuối kỳ UFM', 'Học viên muốn nắm vững bản chất chuẩn hóa cơ sở dữ liệu'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-htttql
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('he-thong-thong-tin-quan-ly', 'material', 'Đề cương Hệ thống thông tin quản lý UFM', 'Tóm tắt cấu trúc hạ tầng CNTT, hệ thống ERP, CRM và các phương pháp phát triển hệ thống thông tin trong doanh nghiệp.', v_sub_htttql, 'MIS', 'digital_download', 'published', 25000, 45000, 4.70, false, 'mis')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 34, ARRAY['Hạ tầng CNTT', 'ERP & CRM'], ARRAY['34 trang PDF tổng hợp lý thuyết hạ tầng hệ thống số', 'Sơ đồ tích hợp chức năng ERP & quản trị quan hệ CRM', 'Bộ câu hỏi trắc nghiệm ôn tập nhanh chương học'], ARRAY['Sinh viên ngành Hệ thống thông tin quản lý ôn thi cuối kỳ', 'Sinh viên ngành Kinh tế cần tìm hiểu chuyển đổi số doanh nghiệp', 'Học viên cần tài liệu tóm gọn để ôn thi lý thuyết nhanh'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

    -- mat-tatm
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tieng-anh-thuong-mai', 'material', 'Sổ từ vựng & Mẫu câu Tiếng Anh thương mại', 'Tổng hợp thuật ngữ chuyên ngành kinh tế, mẫu thư điện tử giao dịch và hội thoại đàm phán thương mại thông dụng.', v_sub_tatm, 'Ngoại ngữ', 'digital_download', 'published', 29000, 59000, 4.80, false, 'languages')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, is_hot = EXCLUDED.is_hot, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO materials (product_id, pages, tags, includes, suitable_for)
    VALUES (v_prod_id, 40, ARRAY['Từ vựng chuyên ngành', 'Mẫu câu email'], ARRAY['40 trang từ vựng chuyên ngành kinh tế và thương mại', 'Bộ mẫu thư tín thương mại chuẩn gửi đối tác', 'Hệ thống mẫu câu giao tiếp đàm phán công sở thông dụng'], ARRAY['Sinh viên khối ngành kinh tế chuẩn bị làm việc thực tế', 'Học viên ôn luyện chuẩn đầu ra tiếng Anh thương mại UFM', 'Người đi làm muốn nâng cao năng lực viết email chuyên nghiệp'])
    ON CONFLICT (product_id) DO UPDATE
    SET pages = EXCLUDED.pages, tags = EXCLUDED.tags, includes = EXCLUDED.includes, suitable_for = EXCLUDED.suitable_for, updated_at = timezone('utc'::text, now());

END $$;

-- 3. Insert Courses (Products + Courses Extension + Lessons)
DO $$
DECLARE
    v_sub_mkcb UUID;
    v_sub_ktvm UUID;
    v_sub_xstk UUID;
    v_sub_qth UUID;
    v_sub_kttc1 UUID;
    v_sub_csdl UUID;
    v_sub_lkt UUID;
    v_sub_tctt UUID;
    v_prod_id UUID;
BEGIN
    SELECT id INTO v_sub_mkcb FROM subjects WHERE slug = 'marketing-can-ban';
    SELECT id INTO v_sub_ktvm FROM subjects WHERE slug = 'kinh-te-vi-mo';
    SELECT id INTO v_sub_xstk FROM subjects WHERE slug = 'xac-suat-thong-ke';
    SELECT id INTO v_sub_qth FROM subjects WHERE slug = 'quan-tri-hoc';
    SELECT id INTO v_sub_kttc1 FROM subjects WHERE slug = 'ke-toan-tai-chinh-1';
    SELECT id INTO v_sub_csdl FROM subjects WHERE slug = 'co-so-du-lieu';
    SELECT id INTO v_sub_lkt FROM subjects WHERE slug = 'luat-kinh-te';
    SELECT id INTO v_sub_tctt FROM subjects WHERE slug = 'tai-chinh-tien-te';

    -- crs-mkt-final
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('lop-on-thi-cuoi-ky-marketing', 'course', 'Lớp ôn thi cuối kỳ Marketing căn bản UFM', 'Hệ thống hóa toàn bộ lý thuyết cốt lõi, hướng dẫn làm bài tự luận đạt điểm tối đa và thực chiến phân tích case study của thầy cô UFM.', v_sub_mkcb, 'Marketing', 'live_session', 'published', 129000, 250000, 4.90, false, 'marketing')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
    VALUES (v_prod_id, 'zoom', 4, '8 giờ học + tài liệu ôn tập', 'Tối Thứ 4 & Thứ 6 (19:30 - 21:30)', 'open', 'Chị Minh Thư (Cựu SV Marketing xuất sắc UFM)', ARRAY['Cam kết qua môn', 'Live Zoom tương tác'], ARRAY['Buổi 1: Hệ thống lý thuyết cốt lõi & Phân tích môi trường Marketing vĩ mô/vi mô', 'Buổi 2: Nghiên cứu hành vi người tiêu dùng & Chiến lược STP (Phân khúc, Định vị)', 'Buổi 3: Triển khai chiến lược hỗn hợp Marketing Mix 4P & 7P', 'Buổi 4: Kỹ thuật viết bài giải tự luận tình huống đạt điểm tối đa & Sửa đề thi UFM'], ARRAY['Sinh viên đang học môn Marketing căn bản chuẩn bị thi cuối kỳ UFM', 'Sinh viên cần củng cố kỹ năng làm bài tập tự luận thực tế', 'Học viên bị mất gốc hoặc điểm giữa kỳ chưa tốt'], ARRAY['Giấy, bút để ghi chú ý giảng viên', 'Chuẩn bị trước các thắc mắc về bài học trên lớp để hỏi đáp trực tiếp'])
    ON CONFLICT (product_id) DO UPDATE
    SET format = EXCLUDED.format, sessions = EXCLUDED.sessions, duration = EXCLUDED.duration, schedule = EXCLUDED.schedule, enrollment_status = EXCLUDED.enrollment_status, mentor = EXCLUDED.mentor, tags = EXCLUDED.tags, curriculum = EXCLUDED.curriculum, suitable_for = EXCLUDED.suitable_for, preparation = EXCLUDED.preparation, updated_at = timezone('utc'::text, now());

    -- crs-micro-mid
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('on-thi-giua-ky-kinh-te-vi-mo', 'course', 'Khóa video ôn thi giữa kỳ Kinh tế vi mô', 'Giúp bạn làm quen đồ thị cung cầu, phân tích tác động của thuế/trợ cấp và gỡ rối bài tập tối đa hóa hữu dụng cực nhanh.', v_sub_ktvm, 'Kinh tế', 'recorded_video', 'published', 99000, 199000, 4.80, false, 'economics')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
    VALUES (v_prod_id, 'video', 6, '6 video bài giảng + slide tóm gọn', 'Tự học linh hoạt 24/7', 'open', 'Anh Hoàng Nam (Tutor Kinh tế định lượng)', ARRAY['Video quay sẵn', 'Học mọi lúc mọi nơi'], ARRAY['Chuyên đề 1: Lý thuyết cung - cầu, thặng dư sản xuất, thặng dư tiêu dùng', 'Chuyên đề 2: Tác động của chính sách giá trần, giá sàn, thuế và trợ cấp', 'Chuyên đề 3: Độ co giãn của cung cầu và ứng dụng thực tế', 'Chuyên đề 4: Lý thuyết lựa chọn của người tiêu dùng (Tối đa hóa hữu dụng)', 'Chuyên đề 5: Lý thuyết sản xuất & phân tích các loại chi phí doanh nghiệp', 'Chuyên đề 6: Giải bài tập mẫu đồ thị & Bộ đề ôn thi giữa kỳ chuẩn UFM'], ARRAY['Sinh viên UFM chuẩn bị thi giữa kỳ môn Kinh tế vi mô', 'Học viên cần tự học linh hoạt theo thời gian biểu cá nhân', 'Học viên muốn lấy lại gốc vi mô cấp tốc để không bị đuối'], ARRAY['Máy tính bỏ túi Casio', 'Giấy nháp và bút thước để vẽ đồ thị cùng giảng viên'])
    ON CONFLICT (product_id) DO UPDATE
    SET format = EXCLUDED.format, sessions = EXCLUDED.sessions, duration = EXCLUDED.duration, schedule = EXCLUDED.schedule, enrollment_status = EXCLUDED.enrollment_status, mentor = EXCLUDED.mentor, tags = EXCLUDED.tags, curriculum = EXCLUDED.curriculum, suitable_for = EXCLUDED.suitable_for, preparation = EXCLUDED.preparation, updated_at = timezone('utc'::text, now());

    -- crs-xstk-final
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('lop-on-xac-suat-thong-ke', 'course', 'Lớp ôn cấp tốc Xác suất thống kê cuối kỳ', 'Đi thẳng vào phương pháp nhận diện dạng đề, công thức bấm máy Casio thần tốc và giải chi tiết bộ đề thi 3 học kỳ gần nhất.', v_sub_xstk, 'Thống kê', 'live_session', 'published', 149000, 280000, 5.00, false, 'statistics')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
    VALUES (v_prod_id, 'zoom', 5, '10 giờ học + bộ đề trắc nghiệm', 'Chiều Thứ 7 & Chủ Nhật (14:00 - 16:00)', 'open', 'Thầy Hữu Lộc (Giảng viên ôn thi Đại học & Đại học)', ARRAY['Casio thực chiến', 'Tài liệu tặng kèm'], ARRAY['Buổi 1: Đại số tổ hợp, công thức xác suất cơ bản, xác suất đầy đủ & Bayes', 'Buổi 2: Biến ngẫu nhiên, quy luật phân phối xác suất (Nhị thức, Chuẩn, Poisson)', 'Buổi 3: Ước lượng tham số (Kèm thủ thuật bấm máy Casio nhanh)', 'Buổi 4: Kiểm định giả thuyết thống kê (Kiểm định 1 mẫu, 2 mẫu)', 'Buổi 5: Giải chi tiết bộ đề thi trắc nghiệm cuối kỳ UFM mới nhất'], ARRAY['Sinh viên UFM chuẩn bị thi trắc nghiệm môn Xác suất thống kê cuối kỳ', 'Sinh viên gặp khó khăn với toán định lượng hoặc muốn lấy điểm số tối đa', 'Học viên cần lấy lại gốc định lượng trong thời gian ngắn'], ARRAY['Máy tính Casio FX 570VN Plus hoặc FX 580VN X trở lên', 'Bộ tài liệu in sẵn do LEFT HAND gửi tặng trước buổi học'])
    ON CONFLICT (product_id) DO UPDATE
    SET format = EXCLUDED.format, sessions = EXCLUDED.sessions, duration = EXCLUDED.duration, schedule = EXCLUDED.schedule, enrollment_status = EXCLUDED.enrollment_status, mentor = EXCLUDED.mentor, tags = EXCLUDED.tags, curriculum = EXCLUDED.curriculum, suitable_for = EXCLUDED.suitable_for, preparation = EXCLUDED.preparation, updated_at = timezone('utc'::text, now());

    -- crs-qth-video
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('video-bai-giang-quan-tri-hoc', 'course', 'Trọn gói Video bài giảng Quản trị học', 'Tổng hợp trực quan 10 chương học dưới dạng video ngắn 15-20 phút, giải thích cặn kẽ các tình huống quản trị thực tế.', v_sub_qth, 'Quản trị', 'recorded_video', 'published', 89000, 150000, 4.70, false, 'management')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
    VALUES (v_prod_id, 'video', 8, '8 bài học + ngân hàng câu hỏi trắc nghiệm', 'Tự học linh hoạt 24/7', 'open', 'Chị Khánh Linh (Cựu thủ khoa Quản trị UFM)', ARRAY['Trắc nghiệm chọn lọc', 'Xem lại không giới hạn'], ARRAY['Chương 1: Tổng quan về quản trị, nhà quản trị & vai trò quản trị', 'Chương 2: Sự phát triển lịch sử của các lý thuyết quản trị doanh nghiệp', 'Chương 3: Môi trường kinh doanh và quản trị trong môi trường biến động', 'Chương 4: Chức năng Hoạch định & Thiết lập mục tiêu kinh doanh', 'Chương 5: Chức năng Tổ chức bộ máy quản trị & Phân quyền', 'Chương 6: Chức năng Lãnh đạo, động viên & thúc đẩy nhân viên', 'Chương 7: Chức năng Kiểm tra & Giám sát hoạt động quản lý', 'Chương 8: Giải đáp hệ thống câu hỏi trắc nghiệm & Tình huống quản lý thực tế'], ARRAY['Học viên bận rộn muốn tự chủ thời gian ôn tập', 'Sinh viên cần củng cố lý thuyết nhanh trước các đợt kiểm tra trắc nghiệm', 'Học viên tự ôn tập qua điện thoại, máy tính dễ dàng'], ARRAY['Kết nối Internet ổn định để xem video trên Drive', 'Sổ tay tóm gọn để lưu trữ từ khóa chính'])
    ON CONFLICT (product_id) DO UPDATE
    SET format = EXCLUDED.format, sessions = EXCLUDED.sessions, duration = EXCLUDED.duration, schedule = EXCLUDED.schedule, enrollment_status = EXCLUDED.enrollment_status, mentor = EXCLUDED.mentor, tags = EXCLUDED.tags, curriculum = EXCLUDED.curriculum, suitable_for = EXCLUDED.suitable_for, preparation = EXCLUDED.preparation, updated_at = timezone('utc'::text, now());

    -- crs-kttc1-final
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('lop-on-ke-toan-tai-chinh-1', 'course', 'Lớp ôn cuối kỳ Kế toán tài chính 1', 'Luyện sâu các dạng bài định khoản nghiệp vụ TSCĐ, ngoại tệ, nợ phải trả và cách lập báo cáo tài chính không lo lệch số.', v_sub_kttc1, 'Kế toán', 'live_session', 'published', 169000, 300000, 4.90, false, 'accounting')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
    VALUES (v_prod_id, 'zoom', 6, '12 giờ học + bài tập giải sẵn', 'Tối Thứ 3 & Thứ 5 (19:30 - 21:30)', 'coming-soon', 'Cô Ngọc Mai (Kế toán trưởng & Giảng viên thỉnh giảng)', ARRAY['Thực chiến định khoản', 'Sắp mở đăng ký'], ARRAY['Buổi 1: Định khoản nghiệp vụ Kế toán Tài sản cố định (Khấu hao, trao đổi, thanh lý)', 'Buổi 2: Kế toán Hàng tồn kho theo phương pháp kê khai thường xuyên & kiểm kê định kỳ', 'Buổi 3: Kế toán Nợ phải trả, dự phòng nợ phải trả & Các khoản vay ngắn hạn/dài hạn', 'Buổi 4: Kế toán Giao dịch ngoại tệ, chênh lệch tỷ giá cuối kỳ kinh doanh', 'Buổi 5: Hướng dẫn lập Báo cáo tài chính (Bảng cân đối kế toán & Báo cáo KQKD)', 'Buổi 6: Thực chiến giải đề thi cuối kỳ thực tế UFM mới nhất'], ARRAY['Sinh viên chuẩn bị thi cuối kỳ môn Kế toán tài chính 1', 'Học viên muốn thực hành sâu các dạng định khoản Thông tư 200', 'Học viên cần phương pháp lập báo cáo tài chính không bị lệch'], ARRAY['Bảng hệ thống tài khoản Thông tư 200', 'Máy tính bỏ túi để bấm phép tính khấu hao nhanh'])
    ON CONFLICT (product_id) DO UPDATE
    SET format = EXCLUDED.format, sessions = EXCLUDED.sessions, duration = EXCLUDED.duration, schedule = EXCLUDED.schedule, enrollment_status = EXCLUDED.enrollment_status, mentor = EXCLUDED.mentor, tags = EXCLUDED.tags, curriculum = EXCLUDED.curriculum, suitable_for = EXCLUDED.suitable_for, preparation = EXCLUDED.preparation, updated_at = timezone('utc'::text, now());

    -- crs-sql-basic
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('sql-can-ban-cho-co-so-du-lieu', 'course', 'Lớp thực hành SQL căn bản cho Cơ sở dữ liệu', 'Giảng dạy thực hành câu lệnh SQL trực tiếp trên máy tính. Tập trung vào viết các câu truy vấn phức tạp hỗ trợ thi thực hành UFM.', v_sub_csdl, 'MIS', 'live_session', 'published', 129000, 220000, 4.80, false, 'mis')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
    VALUES (v_prod_id, 'zoom', 4, '8 giờ học online + file bài tập', 'Tối Thứ 7 (18:30 - 20:30)', 'open', 'Anh Minh Quân (Kỹ sư dữ liệu & Cựu SV MIS)', ARRAY['Thực hành máy tính', 'Hỗ trợ 1:1 qua Zalo'], ARRAY['Buổi 1: Cài đặt công cụ, làm quen cấu trúc CSDL SQL Server & câu lệnh SELECT cơ bản', 'Buổi 2: Truy vấn có điều kiện lọc phức tạp (WHERE, AND/OR, LIKE, BETWEEN, IN)', 'Buổi 3: Gom nhóm dữ liệu, lọc nhóm & Sử dụng các hàm gộp (GROUP BY, HAVING, SUM, COUNT, AVG)', 'Buổi 4: Viết câu lệnh JOIN liên kết nhiều bảng, truy vấn con Subquery & Thủ thuật phòng thi'], ARRAY['Sinh viên ngành MIS, CNTT chuẩn bị thi thực hành CSDL trên máy', 'Người học muốn bắt đầu làm quen với kỹ năng truy vấn dữ liệu', 'Học viên cần người sửa lỗi cú pháp SQL tận tình'], ARRAY['Laptop chạy Windows hoặc macOS cài sẵn công cụ SQL Server/DBeaver', 'Kiến thức cơ bản về thiết kế cơ sở dữ liệu quan hệ'])
    ON CONFLICT (product_id) DO UPDATE
    SET format = EXCLUDED.format, sessions = EXCLUDED.sessions, duration = EXCLUDED.duration, schedule = EXCLUDED.schedule, enrollment_status = EXCLUDED.enrollment_status, mentor = EXCLUDED.mentor, tags = EXCLUDED.tags, curriculum = EXCLUDED.curriculum, suitable_for = EXCLUDED.suitable_for, preparation = EXCLUDED.preparation, updated_at = timezone('utc'::text, now());

    -- crs-lkt-fast
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('on-tap-luat-kinh-te', 'course', 'Lớp tổng ôn Luật kinh tế cấp tốc', 'Cách tra cứu nhanh các điều luật Doanh nghiệp & Hợp đồng, phân tích chuẩn xác tình huống tranh chấp để làm tự luận.', v_sub_lkt, 'Luật', 'live_session', 'published', 79000, 140000, 4.70, false, 'law')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
    VALUES (v_prod_id, 'zoom', 2, '4 giờ học Zoom + tài liệu tóm tắt', 'Tối Thứ 2 & Thứ 4 trước kỳ thi', 'open', 'Luật sư Tiến Đạt (Cố vấn pháp lý doanh nghiệp)', ARRAY['Tập trung giải đề', 'Tài liệu cô đọng'], ARRAY['Buổi 1: Kỹ năng tra cứu luật & Tổng ôn Luật Doanh nghiệp (Các loại hình doanh nghiệp, quản trị nội bộ)', 'Buổi 2: Tổng ôn Luật Hợp đồng thương mại & Các phương thức giải quyết tranh chấp kinh doanh thực tế'], ARRAY['Sinh viên UFM chuẩn bị thi tự luận cuối kỳ môn Luật kinh tế', 'Học viên cần phương pháp viết bài giải tự luận tình huống luật rõ ràng, thuyết phục', 'Học viên muốn rút gọn thời gian học thuộc lòng điều luật'], ARRAY['Văn bản Luật Doanh nghiệp & Luật Thương mại hiện hành (in sẵn hoặc PDF)', 'Bút highlight để đánh dấu các từ khóa chính'])
    ON CONFLICT (product_id) DO UPDATE
    SET format = EXCLUDED.format, sessions = EXCLUDED.sessions, duration = EXCLUDED.duration, schedule = EXCLUDED.schedule, enrollment_status = EXCLUDED.enrollment_status, mentor = EXCLUDED.mentor, tags = EXCLUDED.tags, curriculum = EXCLUDED.curriculum, suitable_for = EXCLUDED.suitable_for, preparation = EXCLUDED.preparation, updated_at = timezone('utc'::text, now());

    -- crs-tctt-fast
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tai-chinh-tien-te-cap-toc', 'course', 'Lớp ôn cấp tốc Tài chính tiền tệ UFM', 'Giải quyết các câu hỏi hóc búa về chính sách tiền tệ, công cụ kiểm soát lạm phát và các dạng bài tập tính lãi suất đơn giản.', v_sub_tctt, 'Tài chính', 'live_session', 'published', 99000, 180000, 4.60, false, 'finance')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, old_price_vnd = EXCLUDED.old_price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO courses (product_id, format, sessions, duration, schedule, enrollment_status, mentor, tags, curriculum, suitable_for, preparation)
    VALUES (v_prod_id, 'zoom', 3, '6 giờ học + slide tóm tắt', 'Tối Thứ 6 & Chủ Nhật (19:30 - 21:30)', 'full', 'Anh Trung Kiên (Thạc sĩ Tài chính ngân hàng)', ARRAY['Đầy slot', 'Lớp học tương tác nhanh'], ARRAY['Buổi 1: Bản chất của tài chính, tiền tệ & hệ thống hóa công thức tính lãi suất', 'Buổi 2: Cung cầu tiền tệ, vai trò Ngân hàng thương mại & tạo tiền của hệ thống', 'Buổi 3: Ngân hàng trung ương, chính sách tiền tệ & các giải pháp kiểm soát lạm phát vĩ mô'], ARRAY['Sinh viên UFM chuẩn bị thi trắc nghiệm hoặc tự luận môn Tài chính tiền tệ cuối kỳ', 'Sinh viên cần củng cố kiến thức kinh tế vĩ mô tài chính', 'Học viên muốn tổng ôn nhanh lý thuyết trong 3 buổi học'], ARRAY['Slide bài giảng lý thuyết của trường', 'Sổ tay để ghi chép tóm tắt ý chính'])
    ON CONFLICT (product_id) DO UPDATE
    SET format = EXCLUDED.format, sessions = EXCLUDED.sessions, duration = EXCLUDED.duration, schedule = EXCLUDED.schedule, enrollment_status = EXCLUDED.enrollment_status, mentor = EXCLUDED.mentor, tags = EXCLUDED.tags, curriculum = EXCLUDED.curriculum, suitable_for = EXCLUDED.suitable_for, preparation = EXCLUDED.preparation, updated_at = timezone('utc'::text, now());

END $$;

-- 4. Insert Tutors (Products + Tutors Extension + Tutor Subjects)
DO $$
DECLARE
    v_sub_kttc1 UUID;
    v_sub_nlkt UUID;
    v_sub_ktvm UUID;
    v_sub_ktvmo UUID;
    v_sub_xstk UUID;
    v_sub_tcc UUID;
    v_sub_mkcb UUID;
    v_sub_mkdv UUID;
    v_sub_qth UUID;
    v_sub_qtnnl UUID;
    v_sub_csdl UUID;
    v_sub_htttql UUID;
    v_sub_lkt UUID;
    v_prod_id UUID;
BEGIN
    SELECT id INTO v_sub_kttc1 FROM subjects WHERE slug = 'ke-toan-tai-chinh-1';
    SELECT id INTO v_sub_nlkt FROM subjects WHERE slug = 'nguyen-ly-ke-toan';
    SELECT id INTO v_sub_ktvm FROM subjects WHERE slug = 'kinh-te-vi-mo';
    SELECT id INTO v_sub_ktvmo FROM subjects WHERE slug = 'kinh-te-vi-mo-macro';
    SELECT id INTO v_sub_xstk FROM subjects WHERE slug = 'xac-suat-thong-ke';
    SELECT id INTO v_sub_tcc FROM subjects WHERE slug = 'toan-cao-cap';
    SELECT id INTO v_sub_mkcb FROM subjects WHERE slug = 'marketing-can-ban';
    SELECT id INTO v_sub_mkdv FROM subjects WHERE slug = 'marketing-dich-vu';
    SELECT id INTO v_sub_qth FROM subjects WHERE slug = 'quan-tri-hoc';
    SELECT id INTO v_sub_qtnnl FROM subjects WHERE slug = 'quan-tri-nguon-nhan-luc';
    SELECT id INTO v_sub_csdl FROM subjects WHERE slug = 'co-so-du-lieu';
    SELECT id INTO v_sub_htttql FROM subjects WHERE slug = 'he-thong-thong-tin-quan-ly';
    SELECT id INTO v_sub_lkt FROM subjects WHERE slug = 'luat-kinh-te';

    -- tut-kttc1
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tutor-ke-toan-tai-chinh-1', 'tutor', 'Tutor Minh Thư - Kế toán tài chính 1', 'Sinh viên năm cuối ngành Kế toán doanh nghiệp UFM. GPA môn Kế toán tài chính 1 đạt 9.2/10. Có kinh nghiệm dạy kèm cho hơn 30 bạn qua môn an toàn.', v_sub_kttc1, 'Kế toán', 'one_on_one_tutoring', 'published', 120000, NULL, 4.90, false, 'accounting')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
    VALUES (v_prod_id, 'Tutor Minh Thư', 'Kế toán - Kiểm toán', '1:1 & Nhóm nhỏ (Online/Offline)', 'Còn 2 slot tối Thứ 3, 5', 'Sinh viên năm cuối ngành Kế toán doanh nghiệp UFM. GPA môn Kế toán tài chính 1 đạt 9.2/10. Có kinh nghiệm dạy kèm cho hơn 30 bạn qua môn an toàn.', ARRAY['Giải thích định khoản dễ hiểu', 'Kiên nhẫn hỗ trợ người mất gốc'], ARRAY['Điểm môn 9.2', 'Kinh nghiệm 1 năm'], ARRAY['Học viên bị mất gốc định khoản kế toán hoàn toàn', 'Học viên cần giảng viên giảng chậm, kiên nhẫn sửa bài', 'Sinh viên chuẩn bị làm bài thi kiểm tra giữa kỳ, cuối kỳ'], ARRAY['Dạy kèm online qua Zoom/Google Meet sử dụng bảng viết trực quan', 'Hỗ trợ giải đáp nhanh các thắc mắc định khoản qua Zalo 24/7', 'Biên soạn bài tập phụ phù hợp với năng lực hiện tại của học viên'])
    ON CONFLICT (product_id) DO UPDATE
    SET name = EXCLUDED.name, faculty = EXCLUDED.faculty, format = EXCLUDED.format, availability = EXCLUDED.availability, short_bio = EXCLUDED.short_bio, strengths = EXCLUDED.strengths, tags = EXCLUDED.tags, suitable_for = EXCLUDED.suitable_for, support_methods = EXCLUDED.support_methods, updated_at = timezone('utc'::text, now());

    DELETE FROM tutor_subjects WHERE tutor_product_id = v_prod_id;
    INSERT INTO tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (v_prod_id, v_sub_kttc1, true), (v_prod_id, v_sub_nlkt, false);

    -- tut-nlkt
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tutor-nguyen-ly-ke-toan', 'tutor', 'Tutor Ngọc Vy - Nguyên lý kế toán', 'Sinh viên năm 3 chuyên ngành Kiểm toán. GPA tích lũy 3.65/4. Nhiệt tình, chỉ bài tỉ mỉ, giúp học viên hiểu bản chất tài khoản thay vì học vẹt.', v_sub_nlkt, 'Kế toán', 'one_on_one_tutoring', 'published', 100000, NULL, 4.80, false, 'accounting')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
    VALUES (v_prod_id, 'Tutor Ngọc Vy', 'Kế toán - Kiểm toán', '1:1 (Online/Offline quận 7)', 'Còn slot sáng Thứ 7, Chủ Nhật', 'Sinh viên năm 3 chuyên ngành Kiểm toán. GPA tích lũy 3.65/4. Nhiệt tình, chỉ bài tỉ mỉ, giúp học viên hiểu bản chất tài khoản thay vì học vẹt.', ARRAY['Lập bảng cân đối nhanh', 'Sơ đồ chữ T siêu tốc'], ARRAY['GPA 3.65', 'Vui vẻ nhiệt tình'], ARRAY['Sinh viên năm nhất mới tiếp cận kế toán chưa hiểu nợ - có', 'Học viên cần phương pháp nhớ hệ thống tài khoản nhanh chóng', 'Học viên muốn củng cố bài tập lập bảng cân đối kế toán'], ARRAY['Sử dụng bảng viết ảo vẽ sơ đồ chữ T trực quan sinh động', 'Chia sẻ mẹo phân biệt các tài khoản dễ nhầm lẫn (phát sinh nợ/có)', 'Chữa bài tập về nhà và nhắc nhở kiến thức liên tục'])
    ON CONFLICT (product_id) DO UPDATE
    SET name = EXCLUDED.name, faculty = EXCLUDED.faculty, format = EXCLUDED.format, availability = EXCLUDED.availability, short_bio = EXCLUDED.short_bio, strengths = EXCLUDED.strengths, tags = EXCLUDED.tags, suitable_for = EXCLUDED.suitable_for, support_methods = EXCLUDED.support_methods, updated_at = timezone('utc'::text, now());

    DELETE FROM tutor_subjects WHERE tutor_product_id = v_prod_id;
    INSERT INTO tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (v_prod_id, v_sub_nlkt, true);

    -- tut-micro
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tutor-kinh-te-vi-mo', 'tutor', 'Tutor Hoàng Nam - Kinh tế vi mô & vĩ mô', 'Thành viên đội tuyển sinh viên giỏi UFM môn Kinh tế học. Điểm A+ cả hai môn Vi mô và Vĩ mô. Đã hỗ trợ nhiều bạn đạt điểm Giỏi.', v_sub_ktvm, 'Kinh tế', 'one_on_one_tutoring', 'published', 110000, NULL, 4.90, false, 'economics')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
    VALUES (v_prod_id, 'Tutor Hoàng Nam', 'Viện Kinh tế chính trị quốc tế', '1:1 & Nhóm nhỏ (Online)', 'Nhận lịch linh hoạt các buổi tối', 'Thành viên đội tuyển sinh viên giỏi UFM môn Kinh tế học. Điểm A+ cả hai môn Vi mô và Vĩ mô. Đã hỗ trợ nhiều bạn đạt điểm Giỏi.', ARRAY['Mẹo nhớ đồ thị nhanh', 'Giải bài tập tối ưu hóa'], ARRAY['Điểm môn A+', 'Đội tuyển SV Giỏi'], ARRAY['Học viên gặp khó khăn với đồ thị vi mô/vĩ mô phức tạp', 'Sinh viên muốn giải các bài toán tối ưu hóa chi phí và lợi nhuận độc quyền', 'Học viên ôn luyện hướng tới điểm Giỏi/Xuất sắc (A, A+)'], ARRAY['Vẽ và phân tích đồ thị trực tiếp cùng học viên qua whiteboard online', 'Tóm tắt công thức cốt lõi và gửi lại file note sau mỗi buổi học', 'Luyện giải đề thi thực tế UFM các khóa trước'])
    ON CONFLICT (product_id) DO UPDATE
    SET name = EXCLUDED.name, faculty = EXCLUDED.faculty, format = EXCLUDED.format, availability = EXCLUDED.availability, short_bio = EXCLUDED.short_bio, strengths = EXCLUDED.strengths, tags = EXCLUDED.tags, suitable_for = EXCLUDED.suitable_for, support_methods = EXCLUDED.support_methods, updated_at = timezone('utc'::text, now());

    DELETE FROM tutor_subjects WHERE tutor_product_id = v_prod_id;
    INSERT INTO tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (v_prod_id, v_sub_ktvm, true), (v_prod_id, v_sub_ktvmo, false);

    -- tut-xstk
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tutor-xac-suat-thong-ke', 'tutor', 'Tutor Tiến Dũng - Xác suất thống kê & Toán cao cấp', 'Cựu SV ngành Toán kinh tế. Có kinh nghiệm 2 năm ôn thi Xác suất thống kê cho SV khối ngành kinh tế UFM. Cam kết giúp hiểu sâu công thức khó.', v_sub_xstk, 'Thống kê', 'one_on_one_tutoring', 'published', 130000, NULL, 5.00, false, 'statistics')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
    VALUES (v_prod_id, 'Tutor Tiến Dũng', 'Khoa học dữ liệu', '1:1 (Online qua Google Meet)', 'Còn 1 slot tối Thứ 7', 'Cựu SV ngành Toán kinh tế. Có kinh nghiệm 2 năm ôn thi Xác suất thống kê cho SV khối ngành kinh tế UFM. Cam kết giúp hiểu sâu công thức khó.', ARRAY['Bấm máy Casio trắc nghiệm', 'Kiểm định giả thuyết'], ARRAY['Kinh nghiệm 2 năm', 'Casio thần tốc'], ARRAY['Học viên sợ môn Toán định lượng hoặc muốn lấy điểm tối đa', 'Học viên cần học nhanh mẹo bấm máy Casio để giải trắc nghiệm tốc độ', 'Sinh viên cần củng cố chương kiểm định giả thuyết và ước lượng'], ARRAY['Bật camera quay trực tiếp thao tác bấm máy tính Casio thực tế', 'Cung cấp file tóm tắt công thức ngắn gọn, dễ tra cứu', 'Luyện giải đề thi trắc nghiệm UFM dưới áp lực thời gian'])
    ON CONFLICT (product_id) DO UPDATE
    SET name = EXCLUDED.name, faculty = EXCLUDED.faculty, format = EXCLUDED.format, availability = EXCLUDED.availability, short_bio = EXCLUDED.short_bio, strengths = EXCLUDED.strengths, tags = EXCLUDED.tags, suitable_for = EXCLUDED.suitable_for, support_methods = EXCLUDED.support_methods, updated_at = timezone('utc'::text, now());

    DELETE FROM tutor_subjects WHERE tutor_product_id = v_prod_id;
    INSERT INTO tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (v_prod_id, v_sub_xstk, true), (v_prod_id, v_sub_tcc, false);

    -- tut-mkt
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tutor-marketing-can-ban', 'tutor', 'Tutor Quỳnh Anh - Marketing căn bản & dịch vụ', 'Cựu SV chuyên ngành Quản trị thương hiệu UFM. Đạt giải nghiên cứu khoa học cấp trường. Hướng dẫn tư duy marketing ứng dụng thực tế.', v_sub_mkcb, 'Marketing', 'one_on_one_tutoring', 'published', 120000, NULL, 4.80, false, 'marketing')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
    VALUES (v_prod_id, 'Tutor Quỳnh Anh', 'Marketing', '1:1 & Nhóm nhỏ (Offline/Online)', 'Nhận lịch các buổi chiều', 'Cựu SV chuyên ngành Quản trị thương hiệu UFM. Đạt giải nghiên cứu khoa học cấp trường. Hướng dẫn tư duy marketing ứng dụng thực tế.', ARRAY['Case study thực tế', 'Sửa bài tiểu luận nhóm'], ARRAY['Giải NCKH', 'Sửa bài tiểu luận'], ARRAY['Học viên cần người hướng dẫn phân tích case study trong đề thi', 'Sinh viên cần sửa bài tập nhóm hoặc bài tiểu luận đạt điểm cao', 'Học viên cần hệ thống lại lý thuyết tự luận Marketing'], ARRAY['Đọc và góp ý trực tiếp trên Google Docs nội dung bài viết của học viên', 'Thảo luận, phân tích về các chiến dịch marketing thực tế tại Việt Nam', 'Luyện tập trả lời các câu hỏi tự luận tình huống thực tế'])
    ON CONFLICT (product_id) DO UPDATE
    SET name = EXCLUDED.name, faculty = EXCLUDED.faculty, format = EXCLUDED.format, availability = EXCLUDED.availability, short_bio = EXCLUDED.short_bio, strengths = EXCLUDED.strengths, tags = EXCLUDED.tags, suitable_for = EXCLUDED.suitable_for, support_methods = EXCLUDED.support_methods, updated_at = timezone('utc'::text, now());

    DELETE FROM tutor_subjects WHERE tutor_product_id = v_prod_id;
    INSERT INTO tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (v_prod_id, v_sub_mkcb, true), (v_prod_id, v_sub_mkdv, false);

    -- tut-qth
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tutor-quan-tri-hoc', 'tutor', 'Tutor Quốc Bảo - Quản trị học & nhân lực', 'GPA tích lũy 3.58. Nhiệt tình, có phương pháp dạy bằng mindmap trực quan, hỗ trợ giải đáp bài tập 24/7 trong suốt quá trình ôn tập.', v_sub_qth, 'Quản trị', 'one_on_one_tutoring', 'published', 100000, NULL, 4.70, false, 'management')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
    VALUES (v_prod_id, 'Tutor Quốc Bảo', 'Quản trị kinh doanh', '1:1 (Online)', 'Trống lịch tối Thứ 2, 4, 6', 'GPA tích lũy 3.58. Nhiệt tình, có phương pháp dạy bằng mindmap trực quan, hỗ trợ giải đáp bài tập 24/7 trong suốt quá trình ôn tập.', ARRAY['Câu hỏi tình huống', 'Tóm tắt lý thuyết Mindmap'], ARRAY['Hỗ trợ 24/7', 'GPA 3.58'], ARRAY['Học viên cần học lý thuyết quản trị một cách sinh động, dễ nhớ', 'Sinh viên ôn thi tự luận tình huống nhà quản lý UFM', 'Học viên cần người đôn đốc, theo sát tiến độ học tập'], ARRAY['Sử dụng sơ đồ tư duy Mindmap và hình ảnh minh họa sinh động', 'Hỏi đáp nhanh lý thuyết qua flashcard ảo tự soạn', 'Hỗ trợ giải đáp thắc mắc bài học qua Zalo liên tục'])
    ON CONFLICT (product_id) DO UPDATE
    SET name = EXCLUDED.name, faculty = EXCLUDED.faculty, format = EXCLUDED.format, availability = EXCLUDED.availability, short_bio = EXCLUDED.short_bio, strengths = EXCLUDED.strengths, tags = EXCLUDED.tags, suitable_for = EXCLUDED.suitable_for, support_methods = EXCLUDED.support_methods, updated_at = timezone('utc'::text, now());

    DELETE FROM tutor_subjects WHERE tutor_product_id = v_prod_id;
    INSERT INTO tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (v_prod_id, v_sub_qth, true), (v_prod_id, v_sub_qtnnl, false);

    -- tut-csdl
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tutor-co-so-du-lieu', 'tutor', 'Tutor Đức Huy - Cơ sở dữ liệu & HTTTQL', 'Sinh viên năm 4 ngành Hệ thống thông tin quản lý. Điểm thi thực hành SQL đạt điểm tuyệt đối 10/10. Có bộ slide tự soạn dễ hiểu.', v_sub_csdl, 'MIS', 'one_on_one_tutoring', 'published', 130000, NULL, 4.90, false, 'mis')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
    VALUES (v_prod_id, 'Tutor Đức Huy', 'Viện Công nghệ tài chính ngân hàng', '1:1 & Nhóm nhỏ (Online/Offline Q7)', 'Còn slot chiều Thứ Bảy, sáng Chủ Nhật', 'Sinh viên năm 4 ngành Hệ thống thông tin quản lý. Điểm thi thực hành SQL đạt điểm tuyệt đối 10/10. Có bộ slide tự soạn dễ hiểu.', ARRAY['Truy vấn SQL nâng cao', 'Thiết kế ERD chuẩn hóa'], ARRAY['Thực hành 10/10', 'Tài liệu tự soạn'], ARRAY['Sinh viên ngành MIS, CNTT gặp rắc rối với viết lệnh truy vấn SQL', 'Học viên cần người sửa lỗi câu lệnh SQL thực tế trên máy tính', 'Học viên cần hiểu nhanh thiết kế mô hình dữ liệu ERD'], ARRAY['Chia sẻ màn hình viết SQL trực tiếp và phân tích lỗi cú pháp cùng học viên', 'Cung cấp bộ slide tự soạn tóm tắt ngắn gọn quy tắc chuẩn hóa 1NF, 2NF, 3NF', 'Hỗ trợ cài đặt và cấu hình SQL Server/DBeaver tận tình'])
    ON CONFLICT (product_id) DO UPDATE
    SET name = EXCLUDED.name, faculty = EXCLUDED.faculty, format = EXCLUDED.format, availability = EXCLUDED.availability, short_bio = EXCLUDED.short_bio, strengths = EXCLUDED.strengths, tags = EXCLUDED.tags, suitable_for = EXCLUDED.suitable_for, support_methods = EXCLUDED.support_methods, updated_at = timezone('utc'::text, now());

    DELETE FROM tutor_subjects WHERE tutor_product_id = v_prod_id;
    INSERT INTO tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (v_prod_id, v_sub_csdl, true), (v_prod_id, v_sub_htttql, false);

    -- tut-lkt
    INSERT INTO products (slug, kind, title, description, subject_id, category, delivery_kind, publication_status, price_vnd, old_price_vnd, rating, is_hot, color_theme)
    VALUES ('tutor-luat-kinh-te', 'tutor', 'Tutor Minh Hằng - Luật kinh tế', 'GPA tích lũy ngành Luật đạt 3.7. Kinh nghiệm làm trợ lý pháp lý bán thời gian. Hướng dẫn cách phân tích tình huống tranh chấp thương mại sát đề thi.', v_sub_lkt, 'Luật', 'one_on_one_tutoring', 'published', 110000, NULL, 4.80, false, 'law')
    ON CONFLICT (kind, slug) DO UPDATE
    SET title = EXCLUDED.title, description = EXCLUDED.description, price_vnd = EXCLUDED.price_vnd, rating = EXCLUDED.rating, updated_at = timezone('utc'::text, now())
    RETURNING id INTO v_prod_id;

    INSERT INTO tutors (product_id, name, faculty, format, availability, short_bio, strengths, tags, suitable_for, support_methods)
    VALUES (v_prod_id, 'Tutor Minh Hằng', 'Luật', '1:1 (Online)', 'Nhận lịch tối Thứ 3, 5, 7', 'GPA tích lũy ngành Luật đạt 3.7. Kinh nghiệm làm trợ lý pháp lý bán thời gian. Hướng dẫn cách phân tích tình huống tranh chấp thương mại sát đề thi.', ARRAY['Giải quyết tranh chấp', 'Cách nhớ điều luật nhanh'], ARRAY['GPA 3.7', 'Thực chiến pháp lý'], ARRAY['Học viên khối ngành kinh tế cần nhớ nhanh tinh thần điều luật', 'Sinh viên ôn thi tự luận tình huống tranh chấp thương mại UFM', 'Học viên cần học kỹ năng tra cứu luật hiệu quả'], ARRAY['Hướng dẫn phân tích các case study tranh chấp thực tế trên báo chí', 'Rèn luyện kỹ năng viết bài giải tự luận luật kinh tế mạch lạc, thuyết phục', 'Tóm tắt các từ khóa cốt lõi của từng bộ luật lớn'])
    ON CONFLICT (product_id) DO UPDATE
    SET name = EXCLUDED.name, faculty = EXCLUDED.faculty, format = EXCLUDED.format, availability = EXCLUDED.availability, short_bio = EXCLUDED.short_bio, strengths = EXCLUDED.strengths, tags = EXCLUDED.tags, suitable_for = EXCLUDED.suitable_for, support_methods = EXCLUDED.support_methods, updated_at = timezone('utc'::text, now());

    DELETE FROM tutor_subjects WHERE tutor_product_id = v_prod_id;
    INSERT INTO tutor_subjects (tutor_product_id, subject_id, is_primary) VALUES (v_prod_id, v_sub_lkt, true);

END $$;

COMMIT;

