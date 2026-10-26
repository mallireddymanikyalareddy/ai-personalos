import { ComingSoon } from "@/components/coming-soon";
import { PageHeader } from "@/components/page-header";
import type { AreaRoute } from "@/lib/ia/routes";

export function AreaPlaceholder({ area }: { area: AreaRoute }) {
  const p = area.placeholder;
  if (!p) {
    throw new Error(`Area "${area.key}" has no placeholder metadata`);
  }
  return (
    <>
      <PageHeader icon={area.icon} title={area.label} subtitle={p.description} />
      <ComingSoon
        icon={area.icon}
        title={p.title}
        description={p.description}
        stage={p.stage}
        bullets={p.bullets}
        untilThen={<span>{p.untilThen}</span>}
      />
    </>
  );
}