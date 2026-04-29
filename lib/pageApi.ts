import axios from 'axios'
import { getCompanyId } from './utils/apiInterceptor'

const API_URL = '/api/proxy'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      const companyId = getCompanyId()
      if (companyId) {
        if (!config.params) config.params = {}
        config.params.company_id = companyId
      }
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export type PageTemplate = 'about' | 'faq' | 'policy'

export interface PageSeo {
  title?: string
  description?: string
}

export interface PageHeroContent {
  kicker: string
  title: string
  description: string
}

export interface PageStatItem {
  label: string
  value: string
  icon: string
}

export interface PageValueItem {
  title: string
  description: string
  icon: string
}

export interface PageTeamItem {
  name: string
  role: string
  bio: string
}

export interface PageFaqItem {
  question: string
  answer: string
}

export interface PageFaqCategory {
  title: string
  items: PageFaqItem[]
}

export interface PageSection {
  title: string
  paragraphs: string[]
}

export interface AboutPageContent {
  template: 'about'
  hero: PageHeroContent
  valuesHeading: string
  teamHeading: string
  stats: PageStatItem[]
  values: PageValueItem[]
  team: PageTeamItem[]
  seo?: PageSeo
}

export interface FaqPageContent {
  template: 'faq'
  hero: PageHeroContent
  faqCategories: PageFaqCategory[]
  seo?: PageSeo
}

export interface PolicyPageContent {
  template: 'policy'
  hero: PageHeroContent
  sections: PageSection[]
  seo?: PageSeo
}

export type PageContent = AboutPageContent | FaqPageContent | PolicyPageContent

export interface ContentPage {
  id: number
  title: string
  slug: string
  summary: string | null
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  content: PageContent
}

export interface ContentPagePayload {
  title: string
  slug: string
  summary?: string
  isPublished?: boolean
  content: PageContent
}

export interface PagePreset {
  title: string
  slug: string
  summary: string
  content: PageContent
}

const serializePayload = (data: Partial<ContentPagePayload>) => {
  const payload: Record<string, unknown> = {}

  if (data.title !== undefined) payload.title = data.title
  if (data.slug !== undefined) payload.slug = data.slug
  if (data.summary !== undefined) payload.summary = data.summary
  if (data.content !== undefined) payload.content = data.content
  if (data.isPublished !== undefined) payload.is_published = data.isPublished

  return payload
}

export const defaultAboutPageContent: AboutPageContent = {
  template: 'about',
  hero: {
    kicker: 'Our Story',
    title: "We're Building the Future of Online Shopping",
    description:
      'Founded in 2020, Aura Shop started with a simple belief: everyone deserves access to high-quality products at fair prices, delivered with care and consistency.',
  },
  valuesHeading: 'What We Stand For',
  teamHeading: 'Meet the Team',
  stats: [
    { label: 'Happy Customers', value: '50K+', icon: 'users' },
    { label: 'Products Delivered', value: '200K+', icon: 'truck' },
    { label: 'Awards Won', value: '15+', icon: 'award' },
    { label: 'Countries Served', value: '30+', icon: 'globe' },
  ],
  values: [
    {
      title: 'Quality First',
      description:
        'We handpick every product to ensure it meets our quality standards before it reaches a customer.',
      icon: 'shield-check',
    },
    {
      title: 'Customer Love',
      description:
        'Support is part of the product experience. We optimize for trust, clarity, and fast help.',
      icon: 'heart',
    },
    {
      title: 'Fast Delivery',
      description:
        'From warehouse to doorstep, we focus on reliable fulfillment and transparent delivery expectations.',
      icon: 'zap',
    },
    {
      title: 'Our Mission',
      description:
        'We make premium products accessible through an experience that feels personal and effortless.',
      icon: 'target',
    },
  ],
  team: [
    {
      name: 'Sarah Johnson',
      role: 'Founder & CEO',
      bio: 'Leads the brand vision with a focus on customer trust and long-term growth.',
    },
    {
      name: 'Michael Chen',
      role: 'Head of Operations',
      bio: 'Owns logistics, supply chain execution, and on-time delivery performance.',
    },
    {
      name: 'Emily Rodriguez',
      role: 'Creative Director',
      bio: 'Shapes the visual identity, storytelling, and merchandising direction of Aura Shop.',
    },
    {
      name: 'David Kim',
      role: 'Lead Developer',
      bio: 'Builds the storefront and platform systems that keep the shopping experience fast and stable.',
    },
  ],
  seo: {
    title: 'About Aura Shop',
    description: 'Learn about Aura Shop, our story, team, values, and the people behind the brand.',
  },
}

export const defaultFaqPageContent: FaqPageContent = {
  template: 'faq',
  hero: {
    kicker: 'Help Center',
    title: 'Frequently Asked Questions',
    description: 'Find quick answers about orders, delivery, returns, payments, and account support.',
  },
  faqCategories: [
    {
      title: 'Orders & Delivery',
      items: [
        {
          question: 'How can I track my order?',
          answer: 'After your order ships, you can open Track Order in Aura Shop and use your order number and phone or email to see status updates.',
        },
        {
          question: 'How long does delivery take?',
          answer: 'Delivery time depends on the shipping method selected at checkout. Standard delivery typically arrives within 2 to 5 business days.',
        },
        {
          question: 'Can I change my delivery address after placing an order?',
          answer: 'If your order has not been packed yet, our support team may still be able to update the address. Contact support as soon as possible.',
        },
      ],
    },
    {
      title: 'Payments & Returns',
      items: [
        {
          question: 'Which payment methods do you accept?',
          answer: 'Aura Shop supports the payment methods configured by your store, including cash on delivery, cards, and digital payment providers when enabled.',
        },
        {
          question: 'What if I receive a damaged or incorrect item?',
          answer: 'Please contact support within 48 hours of delivery with your order details and clear photos. We will review the case and guide you through the resolution process.',
        },
        {
          question: 'When will I receive my refund?',
          answer: 'Approved refunds are usually processed within 5 to 10 business days, depending on your original payment method and provider timelines.',
        },
      ],
    },
  ],
  seo: {
    title: 'FAQ | Aura Shop',
    description: 'Browse frequently asked questions about Aura Shop orders, delivery, returns, payments, and customer support.',
  },
}

export const defaultReturnsRefundsPageContent: PolicyPageContent = {
  template: 'policy',
  hero: {
    kicker: 'Customer Care',
    title: 'Returns & Refunds',
    description: 'Review the conditions, timelines, and process for requesting returns, exchanges, and refunds.',
  },
  sections: [
    {
      title: 'Eligibility for Returns',
      paragraphs: [
        'Items may be returned within 7 days of delivery unless marked as final sale, perishable, customized, or otherwise non-returnable.',
        'Returned items must be unused, in original packaging, and include all tags, accessories, manuals, and proof of purchase.',
      ],
    },
    {
      title: 'Damaged, Incorrect, or Missing Items',
      paragraphs: [
        'If your order arrives damaged, incomplete, or incorrect, contact support within 48 hours of delivery.',
        'Provide your order number and supporting photos so the team can verify the issue and arrange a replacement, refund, or store credit.',
      ],
    },
    {
      title: 'Refund Processing',
      paragraphs: [
        'Once a return is approved and received, refunds are processed back to the original payment method unless another resolution is agreed in writing.',
        'Banks and payment providers may take additional business days to reflect the refund after it has been issued.',
      ],
    },
  ],
  seo: {
    title: 'Returns & Refunds | Aura Shop',
    description: 'Read Aura Shop return eligibility, damaged item rules, and refund processing timelines.',
  },
}

export const defaultShippingPolicyPageContent: PolicyPageContent = {
  template: 'policy',
  hero: {
    kicker: 'Delivery Terms',
    title: 'Shipping Policy',
    description: 'Understand our fulfillment timeline, shipping options, address rules, and delivery exceptions.',
  },
  sections: [
    {
      title: 'Order Processing',
      paragraphs: [
        'Orders are processed after payment confirmation or order verification, depending on the payment method used.',
        'Processing may take longer during holidays, flash sales, severe weather events, or periods of unusually high order volume.',
      ],
    },
    {
      title: 'Shipping Methods & Delivery Windows',
      paragraphs: [
        'Available shipping methods and estimated delivery timelines are shown at checkout based on your company settings and service coverage.',
        'Delivery estimates are not guaranteed and may vary because of courier delays, remote locations, or force majeure events.',
      ],
    },
    {
      title: 'Address Accuracy',
      paragraphs: [
        'Customers are responsible for entering a complete and accurate shipping address, contact number, and recipient details at checkout.',
        'Aura Shop is not responsible for failed delivery attempts caused by incomplete addresses, unavailable recipients, or unreachable phone numbers.',
      ],
    },
  ],
  seo: {
    title: 'Shipping Policy | Aura Shop',
    description: 'Review Aura Shop shipping rules, processing timelines, delivery windows, and address requirements.',
  },
}

export const defaultPrivacyPolicyPageContent: PolicyPageContent = {
  template: 'policy',
  hero: {
    kicker: 'Trust & Transparency',
    title: 'Privacy Policy',
    description: 'Learn what data we collect, how it is used, and the controls available to customers.',
  },
  sections: [
    {
      title: 'Information We Collect',
      paragraphs: [
        'Aura Shop may collect account details, contact information, delivery addresses, order history, payment references, and support communications.',
        'We may also collect technical information such as device details, browser data, and usage activity needed to keep the storefront secure and functional.',
      ],
    },
    {
      title: 'How We Use Information',
      paragraphs: [
        'Customer data is used to process orders, coordinate delivery, provide support, improve service quality, and comply with legal or financial obligations.',
        'We do not sell customer personal data. Data may be shared with trusted service providers only when required to operate the service.',
      ],
    },
    {
      title: 'Retention & Customer Rights',
      paragraphs: [
        'We retain data only as long as needed for operational, legal, tax, fraud prevention, and support purposes.',
        'Customers may request access, correction, or deletion of eligible personal information by contacting the store support team.',
      ],
    },
  ],
  seo: {
    title: 'Privacy Policy | Aura Shop',
    description: 'Read Aura Shop privacy practices, data usage, retention, and customer rights.',
  },
}

export const PAGE_PRESETS: PagePreset[] = [
  {
    title: 'About Aura Shop',
    slug: 'about',
    summary: 'Content page for the Aura Shop About screen.',
    content: defaultAboutPageContent,
  },
  {
    title: 'FAQ',
    slug: 'faq',
    summary: 'Frequently asked questions page for customer support topics.',
    content: defaultFaqPageContent,
  },
  {
    title: 'Returns & Refunds',
    slug: 'returns',
    summary: 'Return eligibility and refund handling policy for customers.',
    content: defaultReturnsRefundsPageContent,
  },
  {
    title: 'Shipping Policy',
    slug: 'shipping',
    summary: 'Delivery, processing, and shipping terms for the storefront.',
    content: defaultShippingPolicyPageContent,
  },
  {
    title: 'Privacy Policy',
    slug: 'privacy',
    summary: 'Privacy and data handling policy for Aura Shop customers.',
    content: defaultPrivacyPolicyPageContent,
  },
]

export const inferPageTemplate = (slug: string, content?: Partial<PageContent> | null): PageTemplate => {
  if (content && typeof content === 'object' && 'template' in content && content.template) {
    return content.template as PageTemplate
  }

  if (slug === 'about') return 'about'
  if (slug === 'faq') return 'faq'
  return 'policy'
}

export const getPresetBySlug = (slug: string): PagePreset | undefined =>
  PAGE_PRESETS.find((preset) => preset.slug === slug)

export const pageApi = {
  getAll: async (): Promise<ContentPage[]> => {
    const response = await api.get('/pages')
    return response.data.data ?? []
  },

  create: async (data: ContentPagePayload): Promise<ContentPage> => {
    const response = await api.post('/pages', serializePayload(data))
    return response.data.data
  },

  update: async (id: number, data: Partial<ContentPagePayload>): Promise<ContentPage> => {
    const response = await api.put(`/pages/${id}`, serializePayload(data))
    return response.data.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/pages/${id}`)
  },
}

export default pageApi
