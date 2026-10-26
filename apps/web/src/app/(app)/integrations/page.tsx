import type { Metadata } from "next";

import { IntegrationsModule } from "@/modules/integrations/integrations-module";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return <IntegrationsModule />;
}
