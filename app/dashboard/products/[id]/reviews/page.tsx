"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, MessageSquare, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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

function formatDate(value: string | null) {
  if (!value) return "-"

  return new Date(value).toLocaleString()
}

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < value ? "fill-current" : "text-gray-300"}`}
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
    return `${count} review${count === 1 ? "" : "s"}`
  }, [reviews.length, summary?.review_count])

  useEffect(() => {
    if (!Number.isFinite(productId) || productId <= 0) {
      setError("Invalid product id")
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
      const message = err?.response?.data?.message || err?.message || "Failed to load product reviews"
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
        title: "Reply is too short",
        description: "Please enter at least 2 characters.",
      })
      return
    }

    setSavingReviewId(review.id)

    try {
      await productApi.replyToReview(productId, review.id, reply)
      const reviewResponse = await productApi.getReviews(productId, { per_page: 50 })
      applyReviewResponse(reviewResponse)
      toast({
        title: "Reply saved",
        description: `The reply for ${review.customer_name} has been updated.`,
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Failed to save reply",
        description: err?.response?.data?.message || err?.message || "Please try again.",
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
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading product reviews...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            Product review replies
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{product?.name || "Product reviews"}</h1>
          <p className="text-sm text-muted-foreground">
            Review customer feedback and reply from the admin panel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/products">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to products
            </Link>
          </Button>
          <Button variant="outline" onClick={() => void loadPageData()} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Unable to load reviews</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Review summary</CardTitle>
            <CardDescription>
              {summary ? `${summary.average_rating.toFixed(1)} average rating across ${reviewCountLabel}.` : reviewCountLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-end gap-3">
              <div className="text-4xl font-semibold text-gray-900">
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
                    <span>{row.stars} star</span>
                    <span className="text-muted-foreground">
                      {row.count} / {row.percent}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                No customer reviews found for this product yet.
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader className="gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{review.customer_name}</CardTitle>
                        {review.verified_purchase ? (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            Verified purchase
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <RatingStars value={review.rating} />
                        <span>{formatDate(review.created_at)}</span>
                      </div>
                    </div>
                    <Badge variant="secondary">{review.rating}/5</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border bg-gray-50 p-4 text-sm leading-6 text-gray-700">
                    {review.comment}
                  </div>

                  {review.reply ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-medium text-emerald-900">
                          Existing reply from {review.reply.author_name}
                        </div>
                        <div className="text-xs text-emerald-700">
                          {formatDate(review.reply.replied_at)}
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-emerald-900">{review.reply.body}</p>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor={`reply-${review.id}`} className="text-sm font-medium text-gray-900">
                        {review.reply ? "Update reply" : "Write a reply"}
                      </label>
                      <div className="text-xs text-muted-foreground">
                        {(draftReplies[review.id] || "").trim().length}/2000
                      </div>
                    </div>
                    <Textarea
                      id={`reply-${review.id}`}
                      value={draftReplies[review.id] || ""}
                      onChange={(event) =>
                        setDraftReplies((prev) => ({
                          ...prev,
                          [review.id]: event.target.value.slice(0, 2000),
                        }))
                      }
                      placeholder="Write a reply that will appear under the customer review."
                      className="min-h-[120px]"
                    />
                    <div className="flex items-center justify-end">
                      <Button
                        onClick={() => void handleReplySave(review)}
                        disabled={savingReviewId === review.id}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {savingReviewId === review.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {review.reply ? "Update reply" : "Send reply"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
