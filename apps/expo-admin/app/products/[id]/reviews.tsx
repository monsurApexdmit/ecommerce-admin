import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { formatDateTime } from "@/lib/format";
import { getProductById, getProductReviews, replyToProductReview } from "@/services/products";
import type { ProductReview, ProductReviewListResult } from "@/types/product";

export default function ProductReviewsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [title, setTitle] = useState("Reviews");
  const [loading, setLoading] = useState(true);
  const [savingReviewId, setSavingReviewId] = useState<number | null>(null);
  const [reviewData, setReviewData] = useState<ProductReviewListResult | null>(null);
  const [draftReplies, setDraftReplies] = useState<Record<number, string>>({});

  const productId = Number(params.id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [product, reviews] = await Promise.all([
        getProductById(productId),
        getProductReviews(productId),
      ]);
      setTitle(product.name);
      setReviewData(reviews);
      setDraftReplies(
        Object.fromEntries(
          reviews.reviews.map((review) => [review.id, review.reply?.body ?? ""]),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  useEffect(() => {
    if (!Number.isFinite(productId)) return;
    void load();
  }, [load, productId]);

  const handleSaveReply = async (review: ProductReview) => {
    const reply = draftReplies[review.id]?.trim();
    if (!reply || reply.length < 2) return;

    try {
      setSavingReviewId(review.id);
      await replyToProductReview(productId, review.id, reply);
      await load();
    } finally {
      setSavingReviewId(null);
    }
  };

  if (loading || !reviewData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryDark} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.summaryCard}>
        <View>
          <Text style={styles.summaryLabel}>Average rating</Text>
          <Text style={styles.summaryValue}>
            {reviewData.summary.averageRating.toFixed(1)}
          </Text>
        </View>
        <View>
          <Text style={styles.summaryLabel}>Reviews</Text>
          <Text style={styles.summaryValue}>{reviewData.summary.reviewCount}</Text>
        </View>
      </View>

      <View style={styles.distribution}>
        {reviewData.summary.distribution.map((item) => (
          <View key={item.stars} style={styles.distributionRow}>
            <Text style={styles.distributionLabel}>{item.stars} star</Text>
            <View style={styles.distributionTrack}>
              <View style={[styles.distributionFill, { width: `${item.percent}%` }]} />
            </View>
            <Text style={styles.distributionValue}>{item.percent}%</Text>
          </View>
        ))}
      </View>

      {reviewData.reviews.map((review) => (
        <View key={review.id} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.reviewName}>{review.customerName}</Text>
              <View style={styles.reviewMeta}>
                <Stars rating={review.rating} />
                <Text style={styles.reviewDate}>{formatDateTime(review.createdAt)}</Text>
              </View>
            </View>
            {review.verifiedPurchase ? (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.reviewComment}>{review.comment}</Text>
          <TextInput
            value={draftReplies[review.id] ?? ""}
            onChangeText={(value) => setDraftReplies((current) => ({ ...current, [review.id]: value }))}
            placeholder="Write admin reply"
            style={styles.replyInput}
            multiline
          />
          <Pressable
            style={styles.replyButton}
            onPress={() => void handleSaveReply(review)}
            disabled={savingReviewId === review.id}
          >
            {savingReviewId === review.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.replyButtonText}>
                {review.reply ? "Update reply" : "Save reply"}
              </Text>
            )}
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, index) => (
        <Ionicons
          key={index}
          name={index < rating ? "star" : "star-outline"}
          size={14}
          color="#f59e0b"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
    backgroundColor: colors.background,
  },
  summaryCard: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  distribution: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
  },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  distributionLabel: {
    width: 48,
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  distributionTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
  },
  distributionFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#f59e0b",
  },
  distributionValue: {
    width: 48,
    color: colors.muted,
    fontSize: 12,
    textAlign: "right",
  },
  reviewCard: {
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
  },
  reviewHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  reviewName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  reviewMeta: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  stars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewDate: {
    color: colors.muted,
    fontSize: 12,
  },
  verifiedBadge: {
    borderRadius: 999,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedText: {
    color: "#166534",
    fontSize: 12,
    fontWeight: "800",
  },
  reviewComment: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
  replyInput: {
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    textAlignVertical: "top",
  },
  replyButton: {
    alignSelf: "flex-start",
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
});
