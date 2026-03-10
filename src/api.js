// Ganti URL ini setelah deploy backend ke Railway
const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const h = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { "x-admin-token": token } : {}),
});

export const api = {
  // Public
  getProducts : (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`${BASE}/api/products${q ? "?" + q : ""}`).then(r => r.json());
  },
  getCategories: () => fetch(`${BASE}/api/categories`).then(r => r.json()),

  // Auth
  verifyPin : (pin)      => fetch(`${BASE}/api/auth/verify-pin`, { method:"POST", headers:h(), body:JSON.stringify({ pin }) }).then(r => r.json()),
  login     : (password) => fetch(`${BASE}/api/auth/login`,      { method:"POST", headers:h(), body:JSON.stringify({ password }) }).then(r => r.json()),
  logout    : (token)    => fetch(`${BASE}/api/auth/logout`,     { method:"POST", headers:h(token) }).then(r => r.json()),

  // Admin
  addProduct : (data, token) => fetch(`${BASE}/api/products`,       { method:"POST",   headers:h(token), body:JSON.stringify(data) }).then(r => r.json()),
  editProduct: (id, data, token) => fetch(`${BASE}/api/products/${id}`, { method:"PUT", headers:h(token), body:JSON.stringify(data) }).then(r => r.json()),
  delProduct : (id, token)   => fetch(`${BASE}/api/products/${id}`, { method:"DELETE", headers:h(token) }).then(r => r.json()),
};
