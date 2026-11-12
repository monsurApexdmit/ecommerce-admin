"use client"

import { cn } from "@/lib/utils"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ArrowLeft, MessageSquare, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/common/FormField"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/common/PageHeader"
import { EmptyState } from "@/components/common/EmptyState"
import { useToast } from "@/hooks/use-toast"
import productApi, {
  type ProductResponse,
  type ProductReviewItemResponse,
  type ProductReviewListResponse,
  type ProductReviewSummaryResponse,
} from "@/lib/productApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { localeTag } from "@/lib/i18n"

function formatDate(value: string | null, lang: string) {
  if (!value) return "-"

  return new Date(value).toLocaleString(localeTag(lang))
}

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn("h-4 w-4", index < value ? "fill-current" : "text-muted-foreground/40")}
        />
      ))}
    </div>
  )
}

export default function ProductReviewsPage() {
  const { canRead } = useSaasAuth()
  const params = useParams<{ id: string }>()
  const productId = Number(params.id)
  const { toast } = useToast()
  const { t, i18n } = useTranslation(["products", "common"])

  const [product, setProduct] = useState<ProductResponse | null>(null)
  const [summary, setSummary] = useState<ProductReviewSummaryResponse | null>(null)
  const [reviews, setReviews] = useState<ProductReviewItemResponse[]>([])
  const [draftReplies, setDraftReplies] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [savingReviewId, setSavingReviewId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reviewCountLabel = useMemo(() => {
    const count = summary?.review_count ?? reviews.length
    return t("products:reviews.count", { count })
  }, [reviews.length, summary?.review_count, t])

  useEffect(() => {
    if (!Number.isFinite(productId) || productId <= 0) {
      setError(t("products:reviews.invalidId"))
      setIsLoading(false)
      return
    }

    void loadPageData(true)
  }, [productId])

  const blocked = useModuleGuard('Product Reviews')
  if (blocked) return blocked

  async function loadPageData(showInitialLoader = false) {
    if (showInitialLoader) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }

    setError(null)

    try {
      const [productResponse, reviewResponse] = await Promise.all([
        productApi.getById(productId),
        productApi.getReviews(productId, { per_page: 50 }),
      ])

      setProduct(productResponse.data)
      applyReviewResponse(reviewResponse)
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || t("products:reviews.loadFailed")
      setError(message)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  function applyReviewResponse(response: ProductReviewListResponse) {
    const nextReviews = response.data.reviews || []

    setSummary(response.data.summary)
    setReviews(nextReviews)
    setDraftReplies((prev) => {
      const next: Record<number, string> = {}
      nextReviews.forEach((review) => {
        next[review.id] = prev[review.id] ?? review.reply?.body ?? ""
      })
      return next
    })
  }

  async function handleReplySave(review: ProductReviewItemResponse) {
    const reply = (draftReplies[review.id] || "").trim()

    if (reply.length < 2) {
      toast({
        variant: "destructive",
        title: t("products:reviews.tooShort"),
        description: t("products:reviews.tooShortDesc"),
      })
      return
    }

    setSavingReviewId(review.id)

    try {
      await productApi.replyToReview(productId, review.id, reply)
      const reviewResponse = await productApi.getReviews(productId, { per_page: 50 })
      applyReviewResponse(reviewResponse)
      toast({
        title: t("products:reviews.saved"),
        description: t("products:reviews.savedDesc", { name: review.customer_name }),
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: t("products:reviews.saveFailed"),
        description: err?.response?.data?.message || err?.message || t("products:reviews.tryAgain"),
      })
    } finally {
      setSavingReviewId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex min-h-[240px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              {t("products:reviews.loading")}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" />
          {t("products:reviews.eyebrow")}
        </div>
        <PageHeader
          title={product?.name || t("products:reviews.title")}
          description={t("products:reviews.description")}
          actions={<>
            <Button variant="outline" asChild>
              <Link href="/dashboard/products">
                <ArrowLeft className="size-4" />
                {t("products:shared.backToProducts")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void loadPageData()} disabled={isRefreshing}>
              {isRefreshing ? <Spinner /> : null}
              {t("common:actions.refresh")}
            </Button>
          </>}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("products:reviews.unableToLoad")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("products:reviews.summary")}</CardTitle>
            <CardDescription>
              {summary ? t("products:reviews.summaryDesc", { rating: summary.average_rating.toFixed(1), reviews: reviewCountLabel }) : reviewCountLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-semibold">
                {summary?.average_rating?.toFixed(1) || "0.0"}
              </div>
              <div className="space-y-1 pb-1">
                <RatingStars value={Math.round(summary?.average_rating || 0)} />
                <div className="text-sm text-muted-foreground">{reviewCountLabel}</div>
              </div>
            </div>

            <div className="space-y-3">
              {(summary?.distribution || []).map((row) => (
                <div key={row.stars} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t("products:reviews.star", { stars: row.stars })}</span>
                    <span className="text-muted-foreground">
                      {row.count} / {row.percent}%
                    </span>
                  </div>
                  <Progress value={row.percent} aria-label={t("products:reviews.starShare", { stars: row.stars })} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {reviews.length === 0 ? (
            <EmptyState bordered icon={MessageSquare} title={t("products:reviews.empty")} />
          ) : (
            reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{review.customer_name}</CardTitle>
                        {review.verified_purchase ? (
                          <Badge variant="outline">
                            {t("products:reviews.verified")}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <RatingStars value={review.rating} />
                        <span>{formatDate(review.created_at, i18n.language)}</span>
                      </div>
                    </div>
                    <Badge variant="secondary">{review.rating}/5</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Card className="bg-muted/50 p-4 text-sm leading-6 shadow-none">
                    {review.comment}
                  </Card>

                  {review.reply ? (
                    <Alert>
                      <AlertTitle className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span>{t("products:reviews.existingReply", { name: review.reply.author_name })}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {formatDate(review.reply.replied_at, i18n.language)}
                        </span>
                      </AlertTitle>
                      <AlertDescription className="leading-6">{review.reply.body}</AlertDescription>
                    </Alert>
                  ) : null}

                  <FormField
                    label={review.reply ? t("products:reviews.update") : t("products:reviews.write")}
                    htmlFor={`reply-${review.id}`}
                    description={`${(draftReplies[review.id] || "").trim().length}/2000`}
                  >
                    <Textarea
                      id={`reply-${review.id}`}
                      value={draftReplies[review.id] || ""}
                      onChange={(event) =>
                        setDraftReplies((prev) => ({
                          ...prev,
                          [review.id]: event.target.value.slice(0, 2000),
                        }))
                      }
                      placeholder={t("products:reviews.placeholder")}
                      className="min-h-[120px]"
                    />
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={() => void handleReplySave(review)}
                        disabled={savingReviewId === review.id}
                      >
                        {savingReviewId === review.id ? <Spinner /> : null}
                        {review.reply ? t("products:reviews.update") : t("products:reviews.send")}
                      </Button>
                    </div>
                  </FormField>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
