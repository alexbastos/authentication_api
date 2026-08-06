// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain enums — no external dependencies

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum SocialProvider {
  GOOGLE = 'GOOGLE',
  APPLE = 'APPLE',
  FACEBOOK = 'FACEBOOK',
  GITHUB = 'GITHUB',
}

export enum VerificationTokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}
