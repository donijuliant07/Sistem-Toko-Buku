"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MessagesSquare } from "lucide-react";
import { GroupBrowser } from "@/components/community/GroupBrowser";
import { ChatRoom } from "@/components/community/ChatRoom";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

function CommunityContent() {
  const { session, role, roleLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("g");
  const [listVersion, setListVersion] = useState(0);

  const selectGroup = useCallback(
    (groupId: string | null) => {
      router.push(groupId ? `/komunitas?g=${encodeURIComponent(groupId)}` : "/komunitas");
    },
    [router],
  );

  const accessToken = session?.access_token ?? null;
  const currentUserId = session?.user.id ?? null;
  const isAdmin = role === "admin";

  if (!accessToken || !currentUserId) {
    return (
      <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
        Memuat sesi…
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-4">
      <aside
        className={cn(
          "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 lg:sticky lg:top-[104px] lg:h-[calc(100vh-136px)] lg:overflow-y-auto",
          selectedId ? "hidden lg:block" : "block",
        )}
        aria-label="Daftar grup komunitas"
      >
        <GroupBrowser
          key={listVersion}
          accessToken={accessToken}
          selectedId={selectedId}
          isAdmin={!roleLoading && isAdmin}
          onSelect={(groupId) => selectGroup(groupId)}
          onChange={() => setListVersion((version) => version + 1)}
        />
      </aside>

      <section
        className={cn("h-[calc(100vh-136px)] min-h-[520px]", selectedId ? "block" : "hidden lg:block")}
        aria-label="Ruang diskusi"
      >
        {selectedId ? (
          <ChatRoom
            key={selectedId}
            groupId={selectedId}
            accessToken={accessToken}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onBack={() => selectGroup(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-8 text-center">
            <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--primary-deep)] shadow-xs">
              <MessagesSquare className="w-5 h-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Pilih grup untuk mulai berdiskusi</p>
              <p className="mx-auto mt-1 max-w-[42ch] text-xs leading-relaxed text-[var(--muted-foreground)]">
                Grup publik bisa langsung diikuti. Untuk grup privat, minta owner menambahkan Anda.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Memuat komunitas…
        </div>
      }
    >
      <CommunityContent />
    </Suspense>
  );
}
