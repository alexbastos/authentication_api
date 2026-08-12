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

export enum LoginStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export enum LoginMethod {
  EMAIL_PASSWORD = 'EMAIL_PASSWORD',
  SOCIAL_GOOGLE = 'SOCIAL_GOOGLE',
  SOCIAL_APPLE = 'SOCIAL_APPLE',
  SOCIAL_FACEBOOK = 'SOCIAL_FACEBOOK',
  SOCIAL_GITHUB = 'SOCIAL_GITHUB',
}

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}
