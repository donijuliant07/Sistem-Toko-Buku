"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Loader2, RefreshCw, Save, SlidersHorizontal, UserCog, History } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/AuthProvider";
import {
  adjustUserPoints,
  getRewardActivities,
  getRewardReconcile,
  getRewardRules,
  runRewardBackfill,
  updateRewardRules,
  type RewardRule,
} from "@/lib/api";
import type { RewardActivityPage } from "@/lib/types";

/** Label manusiawi untuk key aturan; key yang belum dikenal tampil apa adanya. */
const RULE_LABELS: Record<string, string> = {
  purchase_points_per_10000: "Poin per Rp10.000 belanja",
  review_points: "Poin ulasan disetujui",
  community_contribution_points: "Poin kontribusi komunitas",
  community_contribution_daily_cap: "Maks. kontribusi berpoin per hari",
  helpful_answer_points: "Poin jawaban membantu",
  helpful_answer_min_marks: "Tanda 'membantu' minimum",
  helpful_answer_daily_cap: "Maks. jawaban berpoin per hari",
  spoiler_medium_points: "Biaya poin spoiler medium",
  spoiler_heavy_points: "Biaya poin spoiler berat",
  spoiler_medium_min_units: "Unit dibeli untuk medium gratis",
  spoiler_heavy_min_units: "Unit dibeli untuk berat gratis",
};

const ACTIVITY_LABELS: Record<string, string> = {
  review: "Ulasan buku",
  community_contribution: "Kontribusi komunitas",
  helpful_answer: "Jawaban membantu",
};

const STATUS_STYLES: Record<string, string> = {
  rewarded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

function ruleLabel(key: string): string {
  return RULE_LABELS[key] ?? key;
}

export default function AdminRewardsPage() {
  const { session } = useAuth();
  const token = session?.access_token;

  const [rules, setRules] = useState<RewardRule[]>([]);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [rulesBusy, setRulesBusy] = useState(false);
  const [rulesMessage, setRulesMessage] = useState("");
  const [rulesError, setRulesError] = useState("");

  const [adjustment, setAdjustment] = useState({
    user_id: "",
    delta: "",
    reason: "",
    reference: "",
  });
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [adjustMessage, setAdjustMessage] = useState("");
  const [adjustError, setAdjustError] = useState("");

  const [activities, setActivities] = useState<RewardActivityPage | null>(null);
  const [activityFilter, setActivityFilter] = useState("rewarded");
  const [activitiesError, setActivitiesError] = useState("");

  const [toolBusy, setToolBusy] = useState(false);
  const [toolMessage, setToolMessage] = useState("");
  const [toolError, setToolError] = useState("");

  const loadRules = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getRewardRules(token);
      setRules(data);
      setDraft(Object.fromEntries(data.map((rule) => [rule.key, rule.value])));
      setRulesError("");
    } catch (cause) {
      setRulesError(cause instanceof Error ? cause.message : "Aturan gagal dimuat.");
    }
  }, [token]);

  const loadActivities = useCallback(async () => {
    if (!token) return;
    try {
      const data = await getRewardActivities(token, { status: activityFilter || undefined, limit: 50 });
      setActivities(data);
      setActivitiesError("");
    } catch (cause) {
      setActivitiesError(cause instanceof Error ? cause.message : "Aktivitas gagal dimuat.");
    }
  }, [token, activityFilter]);

  // Muat awal: setState hanya di callback promise, bukan sinkron di badan effect.
  useEffect(() => {
    if (!token) return;
    getRewardRules(token)
      .then((data) => {
        setRules(data);
        setDraft(Object.fromEntries(data.map((rule) => [rule.key, rule.value])));
      })
      .catch((cause) => {
        setRulesError(cause instanceof Error ? cause.message : "Aturan gagal dimuat.");
      });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getRewardActivities(token, { status: activityFilter || undefined, limit: 50 })
      .then(setActivities)
      .catch((cause) => {
        setActivitiesError(cause instanceof Error ? cause.message : "Aktivitas gagal dimuat.");
      });
  }, [token, activityFilter]);

  const changed = rules.some((rule) => draft[rule.key] !== rule.value);

  const handleSaveRules = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setRulesBusy(true);
    setRulesMessage("");
    setRulesError("");
    try {
      const values = Object.fromEntries(
        rules
          .filter((rule) => draft[rule.key] !== rule.value)
          .map((rule) => [rule.key, Number(draft[rule.key])])
      );
      if (Object.keys(values).length === 0) {
        setRulesMessage("Tidak ada perubahan.");
        return;
      }
      const updated = await updateRewardRules(values, token);
      setRules(updated);
      setDraft(Object.fromEntries(updated.map((rule) => [rule.key, rule.value])));
      setRulesMessage("Aturan tersimpan dan tercatat di audit.");
    } catch (cause) {
      setRulesError(cause instanceof Error ? cause.message : "Aturan gagal disimpan.");
    } finally {
      setRulesBusy(false);
    }
  };

  const handleAdjust = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setAdjustBusy(true);
    setAdjustMessage("");
    setAdjustError("");
    try {
      const result = await adjustUserPoints(
        {
          user_id: adjustment.user_id.trim(),
          delta: Number(adjustment.delta),
          reason: adjustment.reason.trim(),
          ...(adjustment.reference.trim() ? { reference: adjustment.reference.trim() } : {}),
        },
        token
      );
      setAdjustMessage(
        `Tercatat: ${result.points_delta >= 0 ? "+" : ""}${result.points_delta} poin, saldo sekarang ${result.balance_after}.`
      );
      setAdjustment((prev) => ({ ...prev, delta: "", reason: "", reference: "" }));
    } catch (cause) {
      setAdjustError(cause instanceof Error ? cause.message : "Penyesuaian gagal.");
    } finally {
      setAdjustBusy(false);
    }
  };

  const handleTool = async (kind: "backfill" | "reconcile") => {
    if (!token) return;
    setToolBusy(true);
    setToolMessage("");
    setToolError("");
    try {
      if (kind === "backfill") {
        const report = await runRewardBackfill(token);
        setToolMessage(
          `Backfill: ${report.rewarded_orders ?? 0} pesanan diberi poin (${report.total_points ?? 0} poin), ${report.reviewed_reviews ?? 0} ulasan & ${report.approved_messages ?? 0} pesan diperiksa.`
        );
        void loadActivities();
      } else {
        const report = await getRewardReconcile(token);
        setToolMessage(
          report.mismatched.length === 0
            ? `Rekonsiliasi: ${report.users_checked} pengguna, saldo semua cocok.`
            : `Rekonsiliasi: ${report.mismatched.length} dari ${report.users_checked} pengguna tidak cocok — periksa detail di respons API.`
        );
      }
    } catch (cause) {
      setToolError(cause instanceof Error ? cause.message : "Proses gagal.");
    } finally {
      setToolBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Poin & Reward"
        description="Atur nilai poin, catat penyesuaian manual, dan pantau aktivitas reward."
      />

      <Tabs defaultValue="aturan" className="space-y-4">
        <TabsList className="bg-zinc-100 p-1 rounded-xl inline-flex gap-1 border border-zinc-200/60">
          <TabsTrigger value="aturan" className="text-xs gap-1.5 rounded-lg text-zinc-600 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 cursor-pointer">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Aturan</span>
          </TabsTrigger>
          <TabsTrigger value="penyesuaian" className="text-xs gap-1.5 rounded-lg text-zinc-600 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 cursor-pointer">
            <UserCog className="h-3.5 w-3.5" />
            <span>Penyesuaian</span>
          </TabsTrigger>
          <TabsTrigger value="aktivitas" className="text-xs gap-1.5 rounded-lg text-zinc-600 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 cursor-pointer">
            <History className="h-3.5 w-3.5" />
            <span>Aktivitas</span>
          </TabsTrigger>
        </TabsList>

        {/* Aturan */}
        <TabsContent value="aturan">
          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-tight text-zinc-900">
                Nilai Poin
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Perubahan berlaku seketika dan tercatat di audit. Batas atas tiap aturan mengikuti katalog backend.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rulesError && (
                <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {rulesError}
                </p>
              )}
              {rules.length === 0 ? (
                <div className="flex items-center gap-2 py-6 text-xs text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat aturan…
                </div>
              ) : (
                <form onSubmit={handleSaveRules} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {rules.map((rule) => (
                      <div key={rule.key} className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-800">
                          {ruleLabel(rule.key)}
                        </label>
                        <Input
                          type="number"
                          min={0}
                          max={rule.max_value}
                          value={draft[rule.key] ?? rule.value}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              [rule.key]: Number(event.target.value),
                            }))
                          }
                          className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
                        />
                        <p className="text-[10px] text-zinc-400">
                          Default {rule.default} · maks {rule.max_value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={rulesBusy || !changed} size="sm" className="gap-1.5">
                      {rulesBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Simpan Aturan
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void loadRules()}>
                      Muat Ulang
                    </Button>
                    {rulesMessage && <span className="text-xs text-emerald-700">{rulesMessage}</span>}
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Penyesuaian */}
        <TabsContent value="penyesuaian">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold tracking-tight text-zinc-900">
                  Penyesuaian Saldo
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Untuk koreksi yang tidak berasal dari pesanan/ulasan. Alasan wajib; isi referensi agar retry tidak menggandakan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAdjust} className="space-y-3 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-zinc-800">ID Pengguna *</label>
                    <Input
                      required
                      value={adjustment.user_id}
                      onChange={(event) => setAdjustment((p) => ({ ...p, user_id: event.target.value }))}
                      placeholder="UUID profil"
                      className="rounded-xl border-zinc-200/80 bg-zinc-50/70 font-mono text-[11px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-zinc-800">Perubahan Poin *</label>
                    <Input
                      required
                      type="number"
                      value={adjustment.delta}
                      onChange={(event) => setAdjustment((p) => ({ ...p, delta: event.target.value }))}
                      placeholder="Positif menambah, negatif mengurangi"
                      className="rounded-xl border-zinc-200/80 bg-zinc-50/70"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-zinc-800">Alasan * (min. 5 karakter)</label>
                    <Input
                      required
                      minLength={5}
                      maxLength={255}
                      value={adjustment.reason}
                      onChange={(event) => setAdjustment((p) => ({ ...p, reason: event.target.value }))}
                      placeholder="mis. koreksi poin ganda pesanan #123"
                      className="rounded-xl border-zinc-200/80 bg-zinc-50/70"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-zinc-800">Referensi (opsional)</label>
                    <Input
                      maxLength={80}
                      value={adjustment.reference}
                      onChange={(event) => setAdjustment((p) => ({ ...p, reference: event.target.value }))}
                      placeholder="mis. tiket-4711"
                      className="rounded-xl border-zinc-200/80 bg-zinc-50/70"
                    />
                  </div>
                  {adjustError && (
                    <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-rose-700">
                      {adjustError}
                    </p>
                  )}
                  {adjustMessage && (
                    <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
                      {adjustMessage}
                    </p>
                  )}
                  <Button type="submit" disabled={adjustBusy} size="sm" className="gap-1.5">
                    {adjustBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                    Catat Penyesuaian
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-bold tracking-tight text-zinc-900">
                  Alat Pemeliharaan
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Aman diulang. Backfill hanya menambah yang belum pernah diberi poin; rekonsiliasi tidak mengubah saldo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={toolBusy}
                    onClick={() => void handleTool("backfill")}
                    className="gap-1.5"
                  >
                    {toolBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Jalankan Backfill
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={toolBusy}
                    onClick={() => void handleTool("reconcile")}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Rekonsiliasi Saldo
                  </Button>
                </div>
                {toolError && (
                  <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {toolError}
                  </p>
                )}
                {toolMessage && (
                  <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {toolMessage}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Aktivitas */}
        <TabsContent value="aktivitas">
          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
            <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div>
                <CardTitle className="text-base font-bold tracking-tight text-zinc-900">
                  Aktivitas Reward
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500">
                  Jejak ulasan dan kontribusi komunitas yang sudah diberi poin.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={activityFilter}
                  onChange={(event) => setActivityFilter(event.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-700"
                >
                  <option value="">Semua status</option>
                  <option value="rewarded">Rewarded</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadActivities()}>
                  Muat Ulang
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activitiesError && (
                <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {activitiesError}
                </p>
              )}
              {!activities ? (
                <div className="flex items-center gap-2 py-6 text-xs text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat aktivitas…
                </div>
              ) : activities.items.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  Belum ada aktivitas untuk filter ini.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100">
                        <th className="py-2 pr-3 font-semibold">Jenis</th>
                        <th className="py-2 pr-3 font-semibold">Pengguna</th>
                        <th className="py-2 pr-3 font-semibold">Status</th>
                        <th className="py-2 pr-3 font-semibold text-right">Poin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {activities.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2 pr-3 text-zinc-800">
                            {ACTIVITY_LABELS[item.activity_type] ?? item.activity_type}
                          </td>
                          <td className="py-2 pr-3 font-mono text-[10px] text-zinc-500">
                            {item.user_id.slice(0, 8)}…
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                STATUS_STYLES[item.status] ?? "bg-zinc-50 text-zinc-600 border-zinc-200"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-zinc-800">
                            {item.points_awarded ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
