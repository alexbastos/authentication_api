// ─── Domain Errors ────────────────────────────────────────────────────────
// Typed errors that map to specific HTTP status codes at the adapter layer

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// ─── Authentication Errors ──────────────────────────────────────────────

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS');
  }
}

export class TokenExpiredError extends DomainError {
  constructor() {
    super('Token has expired', 'TOKEN_EXPIRED');
  }
}

export class TokenRevokedError extends DomainError {
  constructor() {
    super('Token has been revoked', 'TOKEN_REVOKED');
  }
}

export class InvalidTokenError extends DomainError {
  constructor(message = 'Invalid token') {
    super(message, 'INVALID_TOKEN');
  }
}

export class RefreshTokenReusedError extends DomainError {
  constructor() {
    super(
      'Refresh token reuse detected. All tokens in this family have been revoked for security.',
      'REFRESH_TOKEN_REUSED',
    );
  }
}

// ─── User Errors ────────────────────────────────────────────────────────

export class UserAlreadyExistsError extends DomainError {
  constructor(email: string) {
    super(`User with email "${email}" already exists`, 'USER_ALREADY_EXISTS');
  }
}

export class UserNotFoundError extends DomainError {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`, 'USER_NOT_FOUND');
  }
}

export class UserInactiveError extends DomainError {
  constructor() {
    super('User account is inactive', 'USER_INACTIVE');
  }
}

export class WeakPasswordError extends DomainError {
  constructor(details: string) {
    super(`Password does not meet requirements: ${details}`, 'WEAK_PASSWORD');
  }
}

// ─── Authorization Errors ───────────────────────────────────────────────

export class ForbiddenError extends DomainError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN');
  }
}

// ─── Social Auth Errors ─────────────────────────────────────────────────

export class SocialAuthError extends DomainError {
  constructor(provider: string, details: string) {
    super(`Social authentication failed for ${provider}: ${details}`, 'SOCIAL_AUTH_FAILED');
  }
}

// ─── Client App Errors ──────────────────────────────────────────────────

export class ClientAppNotFoundError extends DomainError {
  constructor(clientId: string) {
    super(`Client application not found: ${clientId}`, 'CLIENT_APP_NOT_FOUND');
  }
}

export class ClientAppAlreadyExistsError extends DomainError {
  constructor(name: string) {
    super(`Client application "${name}" already exists`, 'CLIENT_APP_ALREADY_EXISTS');
  }
}

// ─── Email Verification Errors ───────────────────────────────────────────

export class EmailNotVerifiedError extends DomainError {
  constructor() {
    super('Email address has not been verified. Please check your inbox.', 'EMAIL_NOT_VERIFIED');
  }
}

export class InvalidVerificationTokenError extends DomainError {
  constructor() {
    super('Invalid or already used verification token', 'INVALID_VERIFICATION_TOKEN');
  }
}

export class ExpiredVerificationTokenError extends DomainError {
  constructor() {
    super('Verification token has expired. Please request a new one.', 'EXPIRED_VERIFICATION_TOKEN');
  }
}

// ─── Brute Force Protection Errors ──────────────────────────────────────

export class AccountLockedError extends DomainError {
  constructor(minutesRemaining: number) {
    super(
      `Account temporarily locked due to too many failed login attempts. Try again in ${minutesRemaining} minute(s).`,
      'ACCOUNT_LOCKED',
    );
  }
}

// ─── Session Errors ─────────────────────────────────────────────────────

export class SessionNotFoundError extends DomainError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
  }
}

// ─── Social Account Errors ──────────────────────────────────────────────

export class CannotRemoveLastAuthMethodError extends DomainError {
  constructor() {
    super(
      'Cannot remove the last authentication method. Add a password or another social provider first.',
      'CANNOT_REMOVE_LAST_AUTH_METHOD',
    );
  }
}

export class SocialAccountNotLinkedError extends DomainError {
  constructor(provider: string) {
    super(`Social account not linked: ${provider}`, 'SOCIAL_ACCOUNT_NOT_LINKED');
  }
}
