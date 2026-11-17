"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/EmptyState"
import { CollectionEditor } from "../CollectionEditor"

export default function EditCollectionPage() {
  const { t } = useTranslation(["catalog", "common"])
  const params = useParams()
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <EmptyState icon={Layers} bordered title={t("catalog:collections.editor.notFound")}
        action={<Button asChild variant="link"><Link href="/dashboard/collections">{t("catalog:collections.editor.back")}</Link></Button>} />
    )
  }
  // key: remount when navigating between collections (e.g. after creating one)
  return <CollectionEditor key={id} collectionId={id} />
}
