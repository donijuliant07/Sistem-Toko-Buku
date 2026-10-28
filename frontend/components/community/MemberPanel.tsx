"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Crown, Loader2, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/community/GroupAvatar";
import { AddMemberDialog } from "@/components/community/AddMemberDialog";
import { ConfirmDialog } from "@/components/community/ConfirmDialog";
import { ROLE_LABELS, memberDisplayName } from "@/lib/community";
import {
  getCommunityGroup,
  listGroupMembers,
  removeGroupMember,
  transferGroupOwnership,
  updateGroupMemberRole,
} from "@/lib/api";
import type { GroupDetail, GroupMember } from "@/lib/types";

type MemberPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupDetail;
  accessToken: string;
  currentUserId: string;
  isAdmin: boolean;
  onGroupUpdated: (group: GroupDetail) => void;
};

type PendingAction =
  | { kind: "remove"; member: GroupMember }
  | { kind: "transfer"; member: GroupMember }
  | null;

const ROLE_BADGE = {
  owner: "border-amber-200 bg-amber-50 text-amber-700",
  moderator: "border-sky-200 bg-sky-50 text-sky-700",
  member: "border-gray-200 bg-gray-50 text-gray-600",
} as const;

export function MemberPanel({
  open,
  onOpenChange,
  group,
  accessToken,
  currentUserId,
  isAdmin,
  onGroupUpdated,
}: MemberPanelProps) {
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [error, setError] = useState("");
  const [loadKey, setLoadKey] = useState(0);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  const isOwner = group.my_role === "owner";
  const canManage = group.can_manage_members;
  const canSeeMembers = group.is_member || isAdmin;

  // Muat ulang setiap kali panel dibuka; panel yang tertutup tidak memfetch.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (!canSeeMembers) return;
    let active = true;
    if (!wasOpen.current) {
      wasOpen.current = true;
      setMembers(null);
      setError("");
    }
    listGroupMembers(group.id, accessToken)
      .then((rows) => active && setMembers(rows))
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Anggota gagal dimuat."));
    return () => {
      active = false;
    };
  }, [open, group.id, accessToken, canSeeMembers, loadKey]);

  const reload = async () => {
    const rows = await listGroupMembers(group.id, accessToken);
    setMembers(rows);
  };

  const retry = () => {
    setMembers(null);
    setError("");
    setLoadKey((key) => key + 1);
  };

  const refreshGroup = async () => {
    const detail = await getCommunityGroup(group.id, accessToken);
    onGroupUpdated(detail);
  };

  const changeRole = async (member: GroupMember, role: "moderator" | "member") => {
    setBusyUserId(member.user.id);
    try {
      await updateGroupMemberRole(group.id, member.user.id, role, accessToken);
      await reload();
      await refreshGroup();
      toast.success(
        role === "moderator"
          ? `${memberDisplayName(member.user)} kini moderator.`
          : `${memberDisplayName(member.user)} kini anggota.`,
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Role gagal diubah.");
    } finally {
      setBusyUserId(null);
    }
  };

  const removeMember = async (member: GroupMember) => {
    setBusyUserId(member.user.id);
    try {
      await removeGroupMember(group.id, member.user.id, accessToken);
      await reload();
      await refreshGroup();
      toast.success(`${memberDisplayName(member.user)} dikeluarkan dari grup.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Anggota gagal dikeluarkan.");
      throw cause;
    } finally {
      setBusyUserId(null);
    }
  };

  const transferOwner = async (member: GroupMember) => {
    setBusyUserId(member.user.id);
    try {
      const detail = await transferGroupOwnership(group.id, member.user.id, accessToken);
      onGroupUpdated(detail);
      await reload();
      toast.success(`Kepemilikan grup dipindahkan ke ${memberDisplayName(member.user)}.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Kepemilikan gagal dipindahkan.");
      throw cause;
    } finally {
      setBusyUserId(null);
    }
  };

  const canRemove = (member: GroupMember) => {
    if (member.user.id === currentUserId) return false;
    if (member.role === "owner") return false;
    if (isOwner) return true;
    return group.my_role === "moderator" && member.role === "member";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="font-community max-w-md max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anggota grup</DialogTitle>
            <DialogDescription>
              {group.member_count} anggota · {group.is_member ? `Anda ${ROLE_LABELS[group.my_role ?? "member"].toLowerCase()}` : "Anda bukan anggota"}
            </DialogDescription>
          </DialogHeader>

          {!canSeeMembers ? (
            <p className="rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-600">
              Daftar anggota hanya tersedia untuk anggota grup.
            </p>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
                Coba lagi
              </Button>
            </div>
          ) : members === null ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <ul className="max-h-[45dvh] space-y-1 overflow-y-auto pr-1">
              {members.map((member) => {
                const name = memberDisplayName(member.user);
                const isSelf = member.user.id === currentUserId;
                const busy = busyUserId === member.user.id;
                return (
                  <li key={member.user.id} className="rounded-xl px-2 py-2 hover:bg-gray-50">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={name} avatarUrl={member.user.avatar_url} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {name}
                          {isSelf ? <span className="ml-1 text-[11px] font-normal text-gray-400">(Anda)</span> : null}
                        </p>
                        {member.user.username ? (
                          <p className="truncate text-[11px] text-gray-500">@{member.user.username}</p>
                        ) : null}
                      </div>
                      <Badge variant="outline" className={`shrink-0 gap-1 ${ROLE_BADGE[member.role]}`}>
                        {member.role === "owner" ? <Crown className="w-3 h-3" aria-hidden /> : null}
                        {member.role === "moderator" ? <ShieldCheck className="w-3 h-3" aria-hidden /> : null}
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    </div>

                    {(canManage || isOwner) && !isSelf && member.role !== "owner" ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-10">
                        {isOwner ? (
                          member.role === "member" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => void changeRole(member, "moderator")}
                            >
                              Jadikan moderator
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => void changeRole(member, "member")}
                            >
                              Jadikan anggota
                            </Button>
                          )
                        ) : null}
                        {canRemove(member) ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => setPending({ kind: "remove", member })}
                            className="text-red-600 hover:bg-red-50"
                          >
                            <UserMinus className="w-3.5 h-3.5" aria-hidden />
                            Keluarkan
                          </Button>
                        ) : null}
                        {isOwner ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => setPending({ kind: "transfer", member })}
                          >
                            <Crown className="w-3.5 h-3.5" aria-hidden />
                            Pindahkan kepemilikan
                          </Button>
                        ) : null}
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" aria-hidden /> : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {canManage ? (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="w-full">
              <UserPlus className="w-4 h-4" aria-hidden />
              Tambah anggota
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        groupId={group.id}
        accessToken={accessToken}
        existingIds={(members ?? []).map((member) => member.user.id)}
        onAdded={async () => {
          await reload();
          await refreshGroup();
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "remove"}
        onOpenChange={(next) => !next && setPending(null)}
        title="Keluarkan anggota?"
        description={
          pending ? `${memberDisplayName(pending.member.user)} tidak akan bisa membaca pesan grup lagi.` : ""
        }
        confirmLabel="Keluarkan"
        destructive
        onConfirm={async () => {
          if (pending?.kind === "remove") await removeMember(pending.member);
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "transfer"}
        onOpenChange={(next) => !next && setPending(null)}
        title="Pindahkan kepemilikan?"
        description={
          pending
            ? `Anda menjadi moderator dan ${memberDisplayName(pending.member.user)} menjadi pemilik grup.`
            : ""
        }
        confirmLabel="Pindahkan"
        onConfirm={async () => {
          if (pending?.kind === "transfer") await transferOwner(pending.member);
        }}
      />
    </>
  );
}
