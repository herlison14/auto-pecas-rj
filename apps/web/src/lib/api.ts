import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
})

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sellsync:token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('sellsync:token')
      localStorage.removeItem('sellsync:auth')
      document.cookie = 'sellsync:token=; path=/; max-age=0'
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)
