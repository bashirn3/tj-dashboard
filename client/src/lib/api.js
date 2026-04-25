import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchStats() {
  const { data } = await api.get('/stats');
  return data;
}

export async function fetchCustomers(params) {
  const { data } = await api.get('/customers', { params });
  return data;
}

export async function fetchCustomer(phone) {
  const { data } = await api.get(`/customers/${phone}`);
  return data;
}

export async function fetchChat(phone) {
  const { data } = await api.get(`/chat/${phone}`);
  return data;
}

export async function stopReminders(phone) {
  const { data } = await api.post(`/customers/${phone}/stop`);
  return data;
}

export async function triggerFeeder(maxLeads) {
  const { data } = await api.post('/feeder/trigger', { max_leads_to_send: maxLeads });
  return data;
}

export async function pollMessageStatuses() {
  const { data } = await api.post('/messages/poll');
  return data;
}
