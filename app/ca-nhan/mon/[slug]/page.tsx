import { notFound } from "next/navigation";
import { purchasedSubjects } from "@/data/student-demo";
import { SubjectWorkspaceClient } from "./workspace-client";

export async function generateStaticParams() {
  return purchasedSubjects.map((subject) => ({
    slug: subject.slug,
  }));
}

export default async function SubjectWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const subject = purchasedSubjects.find((s) => s.slug === slug);

  if (!subject) {
    notFound();
  }

  return <SubjectWorkspaceClient slug={slug} initialSubject={subject} />;
}
