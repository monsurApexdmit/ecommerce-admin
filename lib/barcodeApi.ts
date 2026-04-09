/**
 * Barcode API Service
 * Handles all barcode-related API calls
 */

import axios from 'axios'
import { getCompanyId } from './utils/apiInterceptor'

const API_URL = '/api/proxy'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token')
      if (token) config.headers.Authorization = `Bearer ${token}`

      const companyId = getCompanyId()
      if (companyId) {
        if (!config.params) config.params = {}
        config.params.company_id = companyId
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token')
      window.location.href = '/auth/login'
    }
    return Promise.reject(error)
  }
)

// ============ TYPE DEFINITIONS ============

export interface BarcodeData {
  barcode_number: string
  barcode_image_path: string
  barcode_type: string
}

export interface ProductWithBarcode {
  id: number
  name: string
  description?: string
  price: number
  sale_price: number
  cost_price: number
  stock: number
  sku?: string
  barcode: string
  barcode_image_path?: string
  image?: string
  published: boolean
  createdAt: string
  updatedAt: string
}

export interface FindBarcodeResponse {
  success: boolean
  message: string
  data: ProductWithBarcode
}

export interface RegenerateBarcodeResponse {
  success: boolean
  message: string
  data: BarcodeData
}

export interface GetBarcodeResponse {
  success: boolean
  message: string
  data: BarcodeData
}

export interface BulkGenerateResponse {
  success: boolean
  message: string
  data: {
    success: number
    failed: number
    errors: string[]
  }
}

// ============ API METHODS ============

export const barcodeApi = {
  /**
   * POST /products/barcode/search
   * Find product by barcode
   */
  findProductByBarcode: async (barcode: string): Promise<FindBarcodeResponse> => {
    const response = await api.post<FindBarcodeResponse>('/products/barcode/search', {
      barcode: barcode.trim(),
    })
    return response.data
  },

  /**
   * GET /products/{id}/barcode
   * Get barcode data for a specific product
   */
  getProductBarcode: async (productId: number): Promise<GetBarcodeResponse> => {
    const response = await api.get<GetBarcodeResponse>(`/products/${productId}/barcode`)
    return response.data
  },

  /**
   * POST /products/{id}/barcode/regenerate
   * Regenerate barcode for a product
   */
  regenerateProductBarcode: async (productId: number): Promise<RegenerateBarcodeResponse> => {
    const response = await api.post<RegenerateBarcodeResponse>(
      `/products/${productId}/barcode/regenerate`
    )
    return response.data
  },

  /**
   * POST /products/barcode/bulk-generate
   * Generate barcodes for multiple products
   */
  bulkGenerateBarcodes: async (productIds: number[]): Promise<BulkGenerateResponse> => {
    const response = await api.post<BulkGenerateResponse>('/products/barcode/bulk-generate', {
      product_ids: productIds,
    })
    return response.data
  },
}

export default barcodeApi
