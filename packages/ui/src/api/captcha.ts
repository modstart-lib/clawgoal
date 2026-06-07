import apiClient from './client'

export interface CaptchaGenerateResult {
  bgImg: string
  pieceImg: string
  token: string
}

export interface CaptchaVerifyResult {
  verifiedToken: string
}

export const captchaApi = {
  generate(): Promise<CaptchaGenerateResult> {
    return apiClient.post('/captcha/generate').then((res: any) => res.data.data)
  },
  verify(token: string, x: number): Promise<CaptchaVerifyResult> {
    return apiClient
      .post('/captcha/verify', { token, x })
      .then((res: any) => res.data.data)
  },
}
