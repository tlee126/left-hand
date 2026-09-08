import { AboutSection } from "@/components/site/about-section";
import { ConsultationForm } from "@/components/site/consultation-form";
import { DecorativeDoodles } from "@/components/site/decorative-doodles";
import { EcosystemSection } from "@/components/site/ecosystem-section";
import { FeaturedResources } from "@/components/site/featured-resources";
import { FloatingActions } from "@/components/site/floating-actions";
import { Footer } from "@/components/site/footer";
import { Header } from "@/components/site/header";
import { Hero } from "@/components/site/hero";
import { ImpactStats } from "@/components/site/impact-stats";
import { ProcessSection } from "@/components/site/process-section";
import { ServicesSection } from "@/components/site/services-section";
import { TestimonialsSection } from "@/components/site/testimonials-section";
import {
  listPublishedCourses,
  listPublishedMaterials,
  listPublishedTutors
} from "@/lib/repositories/catalog-repository";
import type { CourseItem, MaterialItem, TutorItem } from "@/lib/domain/catalog";

export const revalidate = 60;

export interface HomepageCatalog {
  materials: MaterialItem[];
  courses: CourseItem[];
  tutors: TutorItem[];
}

export interface HomepageCatalogLoaders {
  listPublishedMaterials: () => Promise<MaterialItem[]>;
  listPublishedCourses: () => Promise<CourseItem[]>;
  listPublishedTutors: () => Promise<TutorItem[]>;
}

export async function loadPublishedHomepageCatalog(
  loaders: HomepageCatalogLoaders = {
    listPublishedMaterials,
    listPublishedCourses,
    listPublishedTutors
  }
): Promise<{ catalog: HomepageCatalog; loadError: boolean }> {
  try {
    const [materials, courses, tutors] = await Promise.all([
      loaders.listPublishedMaterials(),
      loaders.listPublishedCourses(),
      loaders.listPublishedTutors()
    ]);

    return {
      catalog: { materials, courses, tutors },
      loadError: false
    };
  } catch {
    return {
      catalog: { materials: [], courses: [], tutors: [] },
      loadError: true
    };
  }
}

export default async function HomePage() {
  const { catalog, loadError } = await loadPublishedHomepageCatalog();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,rgba(23,101,233,0.18),transparent_36%),radial-gradient(circle_at_top_right,rgba(233,87,255,0.14),transparent_28%),radial-gradient(circle_at_center_top,rgba(248,179,29,0.12),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[34rem] -z-10 h-[24rem] bg-[radial-gradient(circle_at_left,rgba(123,63,242,0.08),transparent_24%),radial-gradient(circle_at_right,rgba(23,101,233,0.08),transparent_26%)]" />
      <DecorativeDoodles />

      <Header />

      <main className="pb-12">
        <Hero />
        <AboutSection />
        <ImpactStats />
        <ServicesSection />
        <FeaturedResources
          materials={catalog.materials}
          courses={catalog.courses}
          loadError={loadError}
        />
        <ProcessSection />
        <ConsultationForm catalog={catalog} loadError={loadError} />
        <TestimonialsSection />
        <EcosystemSection />
      </main>

      <Footer />
      <FloatingActions />
    </div>
  );
}
