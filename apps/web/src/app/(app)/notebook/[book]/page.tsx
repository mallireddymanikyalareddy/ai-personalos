import type { Metadata } from "next";

import { NotebookPagesModule } from "@/modules/notebook/notebook-pages-module";

export const metadata: Metadata = { title: "Notebook" };

export default async function NotebookPagesPage({
  params,
}: {
  params: Promise<{ book: string }>;
}) {
  const { book } = await params;
  return <NotebookPagesModule notebookId={book} />;
}