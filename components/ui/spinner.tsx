'use client'

import { useTranslation } from 'react-i18next'
import { Loader2Icon } from 'lucide-react'

import { cn } from '@/lib/utils'

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  const { t } = useTranslation(["ui", "common"])
  return (
    <Loader2Icon
      role="status"
      aria-label={t("common:status.loading")}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
