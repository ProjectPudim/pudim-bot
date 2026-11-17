export interface RestAttachment {
  id: string
  filename: string
  title: string | null
  description: string | null
  content_type: string
  content_hash: string | null
  size: number
  url: string | null
  proxy_url: string | null
  width?: number
  height?: number
  placeholder?: string
  flags: number
  nsfw?: boolean
  duration?: number
  waveform?: string
  expires_at: string | null
  expired?: boolean
}
