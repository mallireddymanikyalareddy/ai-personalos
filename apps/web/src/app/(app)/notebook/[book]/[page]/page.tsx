import type { Metadata } from "next";

import { NotebookEditorModule } from "@/modules/notebook/notebook-editor";

export const metadata: Metadata = { title: "Page" };

export default async function NotebookPageRoute({
  params,
}: {
  params: Promise<{ book: string; page: string }>;
}) {
  const { book, page } = await params;
  return <NotebookEditorModule notebookId={book} pageId={page} />;
}