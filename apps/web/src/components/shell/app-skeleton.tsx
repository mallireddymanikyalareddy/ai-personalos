import { Skeleton } from "@/components/ui/skeleton";
import { Wordmark } from "@/components/ui/logo";

function SidebarSkeleton() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w,16rem)] flex-col border-r border-line bg-bg md:flex">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Wordmark />
      </div>
      <nav className="flex-1 space-y-6 px-3 pb-4" aria-hidden="true">
        {[2, 4, 2, 2].map((rows, sectionIndex) => (
          <div key={sectionIndex}>
            <Skeleton className="mb-2 ml-3 h-3 w-14 opacity-70" />
            <div className="space-y-1.5">
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <Skeleton key={rowIndex} className="h-9 w-full" />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 space-y-2 border-t border-line p-3" aria-hidden="true">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </aside>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5" aria-hidden="true">
      <Skeleton className="size-[18px] shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3 opacity-70" />
      </div>
    </div>
  );
}

export function AppSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading AI PersonalOS">
      <SidebarSkeleton />

      <div className="md:pl-[var(--sidebar-w,16rem)]">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
            <div className="lg:hidden">
              <Wordmark />
            </div>
            <Skeleton className="hidden h-9 w-full max-w-md lg:block" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
          <div className="mb-6" aria-hidden="true">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-2.5 h-4 w-56 opacity-70" />
          </div>
          <div className="space-y-2.5">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        </main>
      </div>

      <nav
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex flex-1 flex-col items-center justify-center gap-1.5">
              <Skeleton className="size-5 rounded-md" />
              <Skeleton className="h-2.5 w-8 rounded" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
