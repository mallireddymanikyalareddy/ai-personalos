import type { Metadata } from "next";

import { JournalModule } from "@/modules/journal/journal-module";

export const metadata: Metadata = { title: "Journal" };

export default function JournalPage() {
  return <JournalModule />;
}
