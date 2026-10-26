"use client";

import * as React from "react";

import { useSearchParams } from "next/navigation";

import { NotebookEditorModule } from "@/modules/notebook/notebook-editor";
import { NotebookPagesModule } from "@/modules/notebook/notebook-pages-module";

function NotebookView() {
  const params = useSearchParams();
  const book = params.get("book") ?? "";
  const page = params.get("page");
  return page ? <NotebookEditorModule notebookId={book} pageId={page} /> : <NotebookPagesModule notebookId={book} />;
}

export default function NotebookViewPage() {
  return (
    <React.Suspense fallback={null}>
      <NotebookView />
    </React.Suspense>
  );
}
