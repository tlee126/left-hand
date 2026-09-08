import { materials, courses, tutors, type CourseItem, type MaterialItem, type TutorItem } from "../../data/catalog";
import type { PublishedCourse, PublishedMaterial, PublishedTutor } from "../../lib/domain/catalog";
import { parseVND } from "../../lib/domain/product-types";
import { findSubjectByName } from "../../lib/domain/subjects";

function subjectFor(name: string) {
  const subject = findSubjectByName(name);
  if (!subject) throw new Error(`Unknown fixture subject: ${name}`);
  return subject;
}

export function materialFixture(item: MaterialItem = materials[0]): PublishedMaterial {
  const subject = subjectFor(item.subject);
  return {
    id: item.id,
    slug: item.slug,
    kind: "material",
    title: item.title,
    description: item.description,
    subject,
    category: item.category,
    deliveryKind: "digital_download",
    publicationStatus: "published",
    pricing: {
      amountVND: parseVND(item.price),
      originalAmountVND: parseVND(item.oldPrice),
      isContactForPrice: false
    },
    rating: item.rating,
    isHot: item.isHot,
    colorTheme: item.colorTheme,
    material: {
      pages: item.pages,
      tags: item.tags,
      includes: item.includes ?? [],
      suitableFor: item.suitableFor ?? []
    }
  };
}

export function courseFixture(item: CourseItem = courses[0]): PublishedCourse {
  const subject = subjectFor(item.subject);
  return {
    id: item.id,
    slug: item.slug,
    kind: "course",
    title: item.title,
    description: item.description,
    subject,
    category: item.category,
    deliveryKind: item.format === "video" ? "recorded_video" : "live_session",
    publicationStatus: "published",
    pricing: {
      amountVND: parseVND(item.price),
      originalAmountVND: parseVND(item.oldPrice),
      isContactForPrice: false
    },
    rating: item.rating,
    isHot: false,
    colorTheme: item.colorTheme,
    course: {
      format: item.format,
      sessions: item.sessions,
      duration: item.duration,
      schedule: item.schedule,
      enrollmentStatus: item.status,
      mentor: item.mentor,
      tags: item.tags,
      curriculum: item.curriculum ?? [],
      suitableFor: item.suitableFor ?? [],
      preparation: item.preparation ?? []
    }
  };
}

export function tutorFixture(item: TutorItem = tutors[0]): PublishedTutor {
  const subjects = item.subjects.map(subjectFor);
  return {
    id: item.id,
    slug: item.slug,
    kind: "tutor",
    title: item.name,
    description: item.shortBio,
    subject: subjects[0],
    category: subjects[0].category,
    deliveryKind: "one_on_one_tutoring",
    publicationStatus: "published",
    pricing: {
      amountVND: parseVND(item.price.replace(/\s*\/\s*giờ\s*$/i, "")),
      originalAmountVND: null,
      isContactForPrice: false
    },
    rating: item.rating,
    isHot: false,
    colorTheme: item.colorTheme,
    tutor: {
      name: item.name,
      faculty: item.faculty,
      format: item.format,
      availability: item.availability,
      shortBio: item.shortBio,
      strengths: item.strengths,
      tags: item.tags,
      suitableFor: item.suitableFor ?? [],
      supportMethods: item.supportMethods ?? [],
      subjects
    }
  };
}

export const publishedCatalogFixture = {
  materials: materials.map(materialFixture),
  courses: courses.map(courseFixture),
  tutors: tutors.map(tutorFixture)
};
