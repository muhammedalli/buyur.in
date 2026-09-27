"use client";

import { useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { useBusiness } from "@/components/panel/business-context";
import { Card, EmptyState, PageHeader } from "@/components/panel/ui";
import { StarIcon } from "@/components/icons";
import { useUiLocale } from "@/components/ui-locale-provider";
import type { Review } from "@/lib/types";

type RatingKey = "hygiene" | "satisfaction" | "revisit";

function average(reviews: Review[], key: RatingKey): number | null {
  const values = reviews.map((r) => r[key]).filter((v) => v > 0);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function StarsRow({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} size={size} filled={n <= rounded} className={n <= rounded ? "text-paprika" : "text-line"} />
      ))}
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className="text-center">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      {value === null ? (
        <p className="mt-2 text-sm text-ink-soft">—</p>
      ) : (
        <>
          <p className="mt-1 font-display text-2xl font-extrabold">{value.toFixed(1)}</p>
          <div className="mt-1 flex justify-center">
            <StarsRow value={value} />
          </div>
        </>
      )}
    </Card>
  );
}

export default function ReviewsPage() {
  const { business, isLoading: businessLoading } = useBusiness();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, tag } = useUiLocale();

  useEffect(() => {
    if (!business) return;
    pb.collection("buyur_reviews")
      .getFullList<Review>({
        filter: pb.filter("business = {:id}", { id: business.id }),
        requestKey: null,
        sort: "-created",
      })
      .then(setReviews)
      .finally(() => setLoading(false));
  }, [business]);

  if (businessLoading || loading) {
    return <p className="text-ink-soft">{t("Yükleniyor…")}</p>;
  }

  const firstVisitCount = reviews.filter((r) => r.is_first_visit).length;

  return (
    <div>
      <PageHeader
        title={t("Değerlendirmeler")}
        description={t("Müşterilerin menüden gönderdiği anket sonuçları. Sadece sen görebilirsin.")}
      />

      {reviews.length === 0 ? (
        <EmptyState
          title={t("Henüz değerlendirme yok")}
          description={t("Müşterilerin menüdeki “Değerlendir” sekmesinden gönderdikleri burada birikecek.")}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label={t("Genel memnuniyet")} value={average(reviews, "satisfaction")} />
            <SummaryCard label={t("Hijyen")} value={average(reviews, "hygiene")} />
            <SummaryCard label={t("Tekrar gelme")} value={average(reviews, "revisit")} />
            <Card className="text-center">
              <p className="text-xs font-medium text-ink-soft">{t("Toplam")}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{reviews.length}</p>
              <p className="mt-1 text-xs text-ink-soft">{t("%{percent} ilk ziyaret", { percent: Math.round((firstVisitCount / reviews.length) * 100) })}</p>
            </Card>
          </div>

          <div className="space-y-3">
            {reviews.map((r) => (
              <Card key={r.id}>
                <div className="flex items-center justify-between gap-3">
                  {r.satisfaction > 0 ? <StarsRow value={r.satisfaction} size={16} /> : <span className="text-xs text-ink-soft">{t("Puan yok")}</span>}
                  <span className="font-mono text-[11px] text-ink-soft">
                    {new Date(r.created).toLocaleDateString(tag, { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <p className="mt-2 text-xs font-medium text-ink-soft">
                  {[
                    r.hygiene > 0 && t("Hijyen {score}/5", { score: r.hygiene }),
                    r.revisit > 0 && t("Tekrar gelme {score}/5", { score: r.revisit }),
                    r.is_first_visit && t("İlk ziyaret"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {r.comment && <p className="mt-2 text-sm leading-relaxed text-ink">{r.comment}</p>}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
