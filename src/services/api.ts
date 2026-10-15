import axios from 'axios';
export const ACCESS_TOKEN_KEY='yms_access_token'; export const REFRESH_TOKEN_KEY='yms_refresh_token';
export const api=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL||'http://localhost:8080/api'});
api.interceptors.request.use(c=>{const t=localStorage.getItem(ACCESS_TOKEN_KEY);if(t)c.headers.Authorization=`Bearer ${t}`;return c});
api.interceptors.response.use(r=>r,async e=>{if(e.response?.status===401&&localStorage.getItem(REFRESH_TOKEN_KEY)){try{const r=await axios.post(`${import.meta.env.VITE_API_BASE_URL||'http://localhost:8080/api'}/auth/refresh`,{refreshToken:localStorage.getItem(REFRESH_TOKEN_KEY)});const d=r.data.data;localStorage.setItem(ACCESS_TOKEN_KEY,d.accessToken);localStorage.setItem(REFRESH_TOKEN_KEY,d.refreshToken);e.config.headers.Authorization=`Bearer ${d.accessToken}`;return api(e.config)}catch{localStorage.clear();window.location.href='/login'}}return Promise.reject(e)});
