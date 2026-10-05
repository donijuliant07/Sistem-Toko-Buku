"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Product, ProductCategory, ProductStatus, ProductType } from "@/types"
import { productService } from "@/lib/services"
import { toast } from "sonner"

const productSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  author: z.string().min(2, "Penulis/Brand wajib diisi"),
  publisher: z.string().min(2, "Penerbit/Produsen wajib diisi"),
  isbn: z.string().min(3, "ISBN/SKU wajib diisi"),
  category: z.string().min(1, "Pilih kategori"),
  type: z.enum(["Buku", "Non-Buku"]),
  language: z.enum(["Indonesia", "Inggris", "Lainnya"]),
  pages: z.coerce.number().min(0, "Halaman tidak boleh negatif"),
  weight: z.coerce.number().min(1, "Berat minimal 1 gram"),
  normalPrice: z.coerce.number().min(1000, "Harga minimal Rp1.000"),
  discountPercent: z.coerce.number().min(0).max(100, "Diskon max 100%"),
  stock: z.coerce.number().min(0, "Stok tidak boleh negatif"),
  status: z.enum(["Aktif", "Draft", "Habis"]),
  description: z.string().min(10, "Deskripsi minimal 10 karakter"),
  coverUrl: z.string().url("URL Gambar tidak valid").or(z.string().min(1)),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
  onSuccess: () => void
}

const categories: ProductCategory[] = [
  "Fiksi",
  "Non-Fiksi",
  "Pendidikan & Referensi",
  "Bisnis & Keuangan",
  "Pengembangan Diri",
  "Anak-Anak & Remaja",
  "Komik & Graphic Novel",
  "Agama & Spiritual",
  "Alat Tulis & Kantor",
  "Aksesori & Merchandise",
]

export function ProductFormSheet({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ProductFormSheetProps) {
  const isEdit = !!product

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      title: "",
      author: "",
      publisher: "",
      isbn: "",
      category: "Fiksi",
      type: "Buku",
      language: "Indonesia",
      pages: 300,
      weight: 350,
      normalPrice: 100000,
      discountPercent: 0,
      stock: 10,
      status: "Aktif",
      description: "",
      coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&auto=format&fit=crop&q=80",
    },
  })

  React.useEffect(() => {
    if (product) {
      reset({
        title: product.title,
        author: product.author,
        publisher: product.publisher,
        isbn: product.isbn,
        category: product.category,
        type: product.type,
        language: product.language,
        pages: product.pages,
        weight: product.weight,
        normalPrice: product.normalPrice,
        discountPercent: product.discountPercent,
        stock: product.stock,
        status: product.status,
        description: product.description,
        coverUrl: product.coverUrl,
      })
    } else {
      reset({
        title: "",
        author: "",
        publisher: "",
        isbn: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
        category: "Fiksi",
        type: "Buku",
        language: "Indonesia",
        pages: 200,
        weight: 300,
        normalPrice: 95000,
        discountPercent: 0,
        stock: 25,
        status: "Aktif",
        description: "Buku berkualitas tinggi terbitan terbaru dengan bahasan komprehensif.",
        coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&auto=format&fit=crop&q=80",
      })
    }
  }, [product, reset, open])

  const onSubmit = async (data: ProductFormValues) => {
    try {
      if (isEdit && product) {
        await productService.update(product.id, data as Partial<Product>)
        toast.success(`Produk "${data.title}" berhasil diperbarui`)
      } else {
        await productService.create({
          ...data,
          category: data.category as ProductCategory,
          type: data.type as ProductType,
          status: data.status as ProductStatus,
        })
        toast.success(`Produk baru "${data.title}" berhasil ditambahkan`)
      }
      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error("Gagal menyimpan data produk")
    }
  }

  const normalPrice = watch("normalPrice")
  const discountPercent = watch("discountPercent")
  const calculatedFinal = Math.round((normalPrice || 0) * (1 - (discountPercent || 0) / 100))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Informasi Produk" : "Tambah Produk Baru"}</SheetTitle>
          <SheetDescription className="text-xs">
            Isi detail katalog produk Gramedia di bawah ini.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4 text-xs">
          {/* Judul */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200">Judul Produk / Buku *</label>
            <Input {...register("title")} placeholder="Contoh: Laut Bercerita" />
            {errors.title && <p className="text-[11px] text-red-500">{errors.title.message}</p>}
          </div>

          {/* Grid 2 Kolom: Penulis & Penerbit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Penulis / Brand *</label>
              <Input {...register("author")} placeholder="Leila S. Chudori" />
              {errors.author && <p className="text-[11px] text-red-500">{errors.author.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Penerbit *</label>
              <Input {...register("publisher")} placeholder="KPG" />
              {errors.publisher && <p className="text-[11px] text-red-500">{errors.publisher.message}</p>}
            </div>
          </div>

          {/* Grid 3 Kolom: ISBN/SKU, Kategori, Tipe */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">ISBN / SKU *</label>
              <Input {...register("isbn")} />
              {errors.isbn && <p className="text-[11px] text-red-500">{errors.isbn.message}</p>}
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Kategori *</label>
              <Select
                value={watch("category")}
                onValueChange={(val) => setValue("category", val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Tipe produk *</label>
              <Select
                value={watch("type")}
                onValueChange={(val) => setValue("type", val as ProductType)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Buku" className="text-xs">Buku</SelectItem>
                  <SelectItem value="Non-Buku" className="text-xs">Non-Buku</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid 3 Kolom: Bahasa, Halaman, Berat */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Bahasa</label>
              <Select
                value={watch("language")}
                onValueChange={(val) => setValue("language", val as "Indonesia" | "Inggris" | "Lainnya")}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indonesia" className="text-xs">Indonesia</SelectItem>
                  <SelectItem value="Inggris" className="text-xs">Inggris</SelectItem>
                  <SelectItem value="Lainnya" className="text-xs">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Hal / Halaman</label>
              <Input type="number" {...register("pages")} />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Berat (gram) *</label>
              <Input type="number" {...register("weight")} />
            </div>
          </div>

          {/* Grid Harga & Diskon */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-200">Harga Normal (Rp)</label>
                <Input type="number" {...register("normalPrice")} />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-200">Diskon (%)</label>
                <Input type="number" {...register("discountPercent")} />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-200">Harga Akhir</label>
                <div className="h-9 px-3 flex items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md font-bold text-blue-600 dark:text-blue-400">
                  Rp{calculatedFinal.toLocaleString("id-ID")}
                </div>
              </div>
            </div>
          </div>

          {/* Grid Stok & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Jumlah Stok *</label>
              <Input type="number" {...register("stock")} />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">Status Publikasi *</label>
              <Select
                value={watch("status")}
                onValueChange={(val) => setValue("status", val as ProductStatus)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aktif" className="text-xs">Aktif</SelectItem>
                  <SelectItem value="Draft" className="text-xs">Draft</SelectItem>
                  <SelectItem value="Habis" className="text-xs">Habis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cover Image URL */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200">URL Sampul Cover (Mock Image)</label>
            <Input {...register("coverUrl")} placeholder="https://..." />
          </div>

          {/* Deskripsi */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-200">Deskripsi Ringkas *</label>
            <textarea
              {...register("description")}
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 dark:border-slate-800 dark:bg-slate-950"
              placeholder="Penjelasan sinopsis atau keunggulan produk..."
            />
            {errors.description && <p className="text-[11px] text-red-500">{errors.description.message}</p>}
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Produk"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
