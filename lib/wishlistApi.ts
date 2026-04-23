import axios from 'axios';
import { getCompanyId } from './utils/apiInterceptor';

const API_URL = '/api/proxy';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      const companyId = getCompanyId();
      if (companyId) {
        if (!config.params) config.params = {};
        config.params.company_id = companyId;
      }
    }
  }
  if (!config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface WishlistTopProduct {
  productId: number;
  name: string;
  price: number;
  salePrice: number | null;
  categoryName: string | null;
  wishlistCount: number;
}

export interface WishlistTopCustomer {
  customerId: number;
  name: string;
  email: string;
  wishlistCount: number;
}

export interface WishlistDailyTrend {
  date: string;
  count: number;
}

export interface WishlistAnalytics {
  summary: {
    totalItems: number;
    uniqueCustomers: number;
    uniqueProducts: number;
  };
  topProducts: WishlistTopProduct[];
  topCustomers: WishlistTopCustomer[];
  dailyTrend: WishlistDailyTrend[];
}

export const wishlistApi = {
  getAnalytics: async (): Promise<WishlistAnalytics> => {
    const res = await api.get('/wishlists/analytics');
    return res.data.data;
  },
};

export default wishlistApi;
