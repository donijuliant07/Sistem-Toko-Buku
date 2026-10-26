"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Camera, Upload } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GroupAvatar } from "@/components/community/GroupAvatar";
import { GROUP_CATEGORIES } from "@/lib/community";
import { createCommunityGroup, updateCommunityGroup } from "@/lib/api";
import type { GroupCategory, GroupDetail, GroupVisibility } from "@/lib/types";

// Client Supabase untuk mengunggah gambar ke Storage
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const schema = z.object({
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(80, "Nama maksimal 80 karakter"),
  description: z.string().trim().max(1000, "Deskripsi maksimal 1000 karakter"),
  category: z.string().min(1, "Pilih kategori"),
  visibility: z.enum(["public", "private"]),
});

type FormValues = z.infer<typeof schema>;

const CREATE_DEFAULTS: FormValues = { name: "", description: "", category: "book_club", visibility: "public" };

type CreateGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  onCreated: (group: GroupDetail) => void;
};

/** Pembuatan grup hanya untuk admin (backend juga menolak selain admin). */
export function CreateGroupDialog({ open, onOpenChange, accessToken, onCreated }: CreateGroupDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: CREATE_DEFAULTS,
  });

  const handleOpenChange = (next: boolean) => {
    if (next) {
      reset(CREATE_DEFAULTS);
      setServerError("");
    }
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError("");
    try {
      const group = await createCommunityGroup(
        {
          name: values.name,
          description: values.description,
          category: values.category as GroupCategory,
          visibility: values.visibility as GroupVisibility,
        },
        accessToken,
      );
      toast.success(`Grup ${group.name} dibuat.`);
      handleOpenChange(false);
      onCreated(group);
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : "Grup gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && handleOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Buat grup komunitas</DialogTitle>
          <DialogDescription>
            Anda otomatis menjadi pemilik grup. Anggota dapat ditambahkan setelah grup dibuat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div>
            <label htmlFor="group-name" className="mb-1 block text-xs font-medium text-gray-700">
              Nama grup
            </label>
            <Input id="group-name" placeholder="Mis. Klub Buku Fiksi Ilmiah" {...register("name")} />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div>
            <label htmlFor="group-description" className="mb-1 block text-xs font-medium text-gray-700">
              Deskripsi
            </label>
            <textarea
              id="group-description"
              rows={3}
              placeholder="Apa yang dibahas di grup ini?"
              className="flex w-full rounded-xl border border-zinc-200/90 bg-white px-3.5 py-2 text-xs sm:text-sm text-zinc-900 shadow-2xs placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400"
              {...register("description")}
            />
            {errors.description ? (
              <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="group-category" className="mb-1 block text-xs font-medium text-gray-700">
                Kategori
              </label>
              <select
                id="group-category"
                className="h-9 w-full rounded-xl border border-zinc-200/90 bg-white px-2 text-xs text-zinc-900"
                {...register("category")}
              >
                {GROUP_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="group-visibility" className="mb-1 block text-xs font-medium text-gray-700">
                Akses
              </label>
              <select
                id="group-visibility"
                className="h-9 w-full rounded-xl border border-zinc-200/90 bg-white px-2 text-xs text-zinc-900"
                {...register("visibility")}
              >
                <option value="public">Publik — siapa pun bisa bergabung</option>
                <option value="private">Privat — hanya lewat undangan anggota</option>
              </select>
            </div>
          </div>
          {serverError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{serverError}</p>
          ) : null}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
              Buat grup
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type EditGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accessToken: string;
  group: GroupDetail;
  onUpdated: (group: GroupDetail) => void;
};

/** Ubah nama/deskripsi/kategori/foto profil (owner atau admin). */
export function EditGroupDialog({ open, onOpenChange, accessToken, group, onUpdated }: EditGroupDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(group.avatar_url || "");
  const [serverError, setServerError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaults = (source: GroupDetail): FormValues => ({
    name: source.name,
    description: source.description || "",
    category: source.category,
    visibility: source.visibility,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(group),
  });

  const watchedName = watch("name");

  const handleOpenChange = (next: boolean) => {
    if (next) {
      reset(defaults(group));
      setAvatarUrl(group.avatar_url || "");
      setServerError("");
    }
    onOpenChange(next);
  };

  // Upload file gambar langsung ke Supabase Storage
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 2 MB.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${group.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("group-avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("group-avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
      toast.success("Foto profil diunggah. Klik Simpan untuk memperbarui.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Gagal mengunggah foto.");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setServerError("");
    try {
      const updated = await updateCommunityGroup(
        group.id,
        {
          name: values.name,
          description: values.description,
          category: values.category as GroupCategory,
          avatar_url: avatarUrl || null,
        },
        accessToken,
      );
      toast.success("Grup diperbarui.");
      handleOpenChange(false);
      onUpdated(updated);
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : "Grup gagal diperbarui.");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && !uploading && handleOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah informasi grup</DialogTitle>
          <DialogDescription>
            Visibilitas dan kepemilikan tidak berubah lewat formulir ini; gunakan panel anggota.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Upload Foto Profil */}
          <div className="flex flex-col items-center justify-center gap-2 pt-1">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <GroupAvatar
                name={watchedName || group.name}
                avatarUrl={avatarUrl}
                category={group.category}
                size="lg"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading || submitting}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || submitting}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Mengunggah..." : "Pilih foto dari perangkat"}
            </button>
          </div>

          <div>
            <label htmlFor="edit-group-name" className="mb-1 block text-xs font-medium text-gray-700 dark:text-zinc-300">
              Nama grup
            </label>
            <Input id="edit-group-name" {...register("name")} />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>

          <div>
            <label htmlFor="edit-group-description" className="mb-1 block text-xs font-medium text-gray-700 dark:text-zinc-300">
              Deskripsi
            </label>
            <textarea
              id="edit-group-description"
              rows={3}
              className="flex w-full rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400"
              {...register("description")}
            />
            {errors.description ? (
              <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="edit-group-category" className="mb-1 block text-xs font-medium text-gray-700 dark:text-zinc-300">
              Kategori
            </label>
            <select
              id="edit-group-category"
              className="h-9 w-full rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 text-xs text-zinc-900 dark:text-zinc-100"
              {...register("category")}
            >
              {GROUP_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {serverError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{serverError}</p>
          ) : null}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting || uploading}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting || uploading} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}