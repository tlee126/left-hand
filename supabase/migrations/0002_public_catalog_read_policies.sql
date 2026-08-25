-- 0002_public_catalog_read_policies.sql
-- Enable public SELECT policies for anonymous and authenticated users on catalog entities

-- 1. Subjects: Publicly readable for all catalog browsing
CREATE POLICY "Allow public read access on subjects"
ON subjects
FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Products: Publicly readable only when publication_status = 'published'
CREATE POLICY "Allow public read access on published products"
ON products
FOR SELECT
TO anon, authenticated
USING (publication_status = 'published');

-- 3. Materials: Publicly readable only when parent product is published
CREATE POLICY "Allow public read access on published materials"
ON materials
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM products
        WHERE products.id = materials.product_id
        AND products.publication_status = 'published'
    )
);

-- 4. Courses: Publicly readable only when parent product is published
CREATE POLICY "Allow public read access on published courses"
ON courses
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM products
        WHERE products.id = courses.product_id
        AND products.publication_status = 'published'
    )
);

-- 5. Course Lessons: Publicly readable only when parent course product is published
CREATE POLICY "Allow public read access on published course lessons"
ON course_lessons
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM courses
        JOIN products ON products.id = courses.product_id
        WHERE courses.product_id = course_lessons.course_id
        AND products.publication_status = 'published'
    )
);

-- 6. Tutors: Publicly readable only when parent product is published
CREATE POLICY "Allow public read access on published tutors"
ON tutors
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM products
        WHERE products.id = tutors.product_id
        AND products.publication_status = 'published'
    )
);

-- 7. Tutor Subjects: Publicly readable only when parent tutor product is published
CREATE POLICY "Allow public read access on published tutor subjects"
ON tutor_subjects
FOR SELECT
TO anon, authenticated
USING (
    EXISTS (
        SELECT 1 FROM tutors
        JOIN products ON products.id = tutors.product_id
        WHERE tutors.product_id = tutor_subjects.tutor_product_id
        AND products.publication_status = 'published'
    )
);
