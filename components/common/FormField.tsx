"use client"

import * as React from "react"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"

interface FormFieldProps extends Omit<React.ComponentProps<typeof Field>, "children"> {
  label?: React.ReactNode
  /** id of the control; wires the label's `htmlFor`. */
  htmlFor?: string
  description?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  children: React.ReactNode
}

/** Label + control + hint/error stack built on shadcn Field. Replaces `<div className="flex flex-col gap-1.5"><Label/>…</div>`. */
export function FormField({ label, htmlFor, description, error, required, children, ...props }: FormFieldProps) {
  return (
    <Field data-invalid={error ? true : undefined} {...props}>
      {label && (
        <FieldLabel htmlFor={htmlFor}>
          {label}
          {required && <span aria-hidden="true" className="text-destructive">*</span>}
        </FieldLabel>
      )}
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}
