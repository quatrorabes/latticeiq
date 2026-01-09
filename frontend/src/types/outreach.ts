export interface CallScriptVariant {
  variant_number: number
  style: string
  style_description: string
  opener: string
  body: string
  closer: string
  quality_score: number
  quality_notes: string
}

export interface EmailVariant {
  subject: string
  body: string
}

export interface GenerateCallScriptsResponse {
  success: boolean
  scripts: CallScriptVariant[]
}

export interface GenerateEmailsResponse {
  success: boolean
  variants: EmailVariant[]
}
