import { api } from '../api/client'

export const authService = {
  session: () => api.get('/auth/session'),
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  updateProfile: (data) => api.patch('/auth/profile', data),
  logout: () => api.post('/auth/logout'),
}

export const monitoringService = {
  dashboard: () => api.get('/dashboard'),
  residence: () => api.get('/residence'),
  updateResidence: (data) => api.patch('/residence', data),
  rooms: () => api.get('/rooms'),
  devices: () => api.get('/devices'),
  addDevice: (data) => api.post('/devices', data),
  history: (params) => api.get('/history', { params }),
  alerts: (params = {}) => api.get('/alerts', { params }),
  acknowledgeAlert: (id) => api.post(`/alerts/${id}/acknowledge`),
  resolveAlert: (id, note) => api.post(`/alerts/${id}/resolve`, { note }),
  settings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
  contacts: () => api.get('/contacts'),
  addContact: (data) => api.post('/contacts', data),
  updateContact: (id, data) => api.patch(`/contacts/${id}`, data),
  deleteContact: (id) => api.delete(`/contacts/${id}`),
}

export const simulationService = {
  state: () => api.get('/simulation/state'),
  run: (scenario) => api.post('/simulation/run', { scenario }),
  pause: () => api.post('/simulation/pause'),
  resume: () => api.post('/simulation/resume'),
  restore: () => api.post('/simulation/restore'),
  reset: () => api.post('/simulation/reset'),
}

export const medicationService = {
  list: () => api.get('/medications'),
  create: (data) => api.post('/medications', data),
  update: (id, data) => api.put(`/medications/${id}`, data),
  remove: (id) => api.delete(`/medications/${id}`),
  confirm: (id, date, confirmed) => api.put(`/medications/${id}/confirmation`, { scheduled_date: date, confirmed }),
}

export const appointmentService = {
  list: () => api.get('/appointments'),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  remove: (id) => api.delete(`/appointments/${id}`),
}
