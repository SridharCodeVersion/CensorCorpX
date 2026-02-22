import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

export interface ChatRequest {
  question: string
  context: Record<string, unknown>
}

export interface ChatResponse {
  answer: string
}

export async function chatWithAssistant(payload: ChatRequest): Promise<ChatResponse> {
  const res = await api.post<ChatResponse>('/chat', payload)
  return res.data
}

