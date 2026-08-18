// ─── Enterprise Business Rules ────────────────────────────────────────────
// Webhook domain entities

export enum WebhookEvent {
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_PASSWORD_CHANGED = 'USER_PASSWORD_CHANGED',
  USER_EMAIL_VERIFIED = 'USER_EMAIL_VERIFIED',
  ORG_CREATED = 'ORG_CREATED',
  ORG_MEMBER_ADDED = 'ORG_MEMBER_ADDED',
  ORG_MEMBER_REMOVED = 'ORG_MEMBER_REMOVED',
}

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  EXHAUSTED = 'EXHAUSTED',
}

// ─── Webhook Endpoint ─────────────────────────────────────────────────────

export interface WebhookEndpointProps {
  id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  organizationId: string | null;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookEndpoint {
  readonly id: string;
  private _url: string;
  private _secret: string;
  private _events: WebhookEvent[];
  readonly organizationId: string | null;
  private _isActive: boolean;
  private _description: string | null;
  readonly createdAt: Date;
  private _updatedAt: Date;

  constructor(props: WebhookEndpointProps) {
    this.id = props.id;
    this._url = props.url;
    this._secret = props.secret;
    this._events = props.events;
    this.organizationId = props.organizationId;
    this._isActive = props.isActive;
    this._description = props.description;
    this.createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  get url(): string { return this._url; }
  get secret(): string { return this._secret; }
  get events(): ReadonlyArray<WebhookEvent> { return this._events; }
  get isActive(): boolean { return this._isActive; }
  get description(): string | null { return this._description; }
  get updatedAt(): Date { return this._updatedAt; }

  isSubscribedTo(event: WebhookEvent): boolean {
    return this._events.includes(event);
  }

  update(data: { url?: string; events?: WebhookEvent[]; description?: string | null; isActive?: boolean }): void {
    if (data.url !== undefined) this._url = data.url;
    if (data.events !== undefined) this._events = data.events;
    if (data.description !== undefined) this._description = data.description;
    if (data.isActive !== undefined) this._isActive = data.isActive;
    this._updatedAt = new Date();
  }

  toJSON(): WebhookEndpointProps {
    return {
      id: this.id,
      url: this._url,
      secret: this._secret,
      events: [...this._events],
      organizationId: this.organizationId,
      isActive: this._isActive,
      description: this._description,
      createdAt: this.createdAt,
      updatedAt: this._updatedAt,
    };
  }
}

// ─── Webhook Delivery ─────────────────────────────────────────────────────

export interface WebhookDeliveryProps {
  id: string;
  endpointId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastAttempt: Date | null;
  nextRetry: Date | null;
  responseCode: number | null;
  responseBody: string | null;
  createdAt: Date;
}

const BACKOFF_SCHEDULE_MS = [1000, 5000, 30000, 120000, 600000]; // 1s, 5s, 30s, 2min, 10min

export class WebhookDelivery {
  readonly id: string;
  readonly endpointId: string;
  readonly event: WebhookEvent;
  readonly payload: Record<string, unknown>;
  private _status: WebhookDeliveryStatus;
  private _attempts: number;
  private _lastAttempt: Date | null;
  private _nextRetry: Date | null;
  private _responseCode: number | null;
  private _responseBody: string | null;
  readonly createdAt: Date;

  constructor(props: WebhookDeliveryProps) {
    this.id = props.id;
    this.endpointId = props.endpointId;
    this.event = props.event;
    this.payload = props.payload;
    this._status = props.status;
    this._attempts = props.attempts;
    this._lastAttempt = props.lastAttempt;
    this._nextRetry = props.nextRetry;
    this._responseCode = props.responseCode;
    this._responseBody = props.responseBody;
    this.createdAt = props.createdAt;
  }

  get status(): WebhookDeliveryStatus { return this._status; }
  get attempts(): number { return this._attempts; }
  get lastAttempt(): Date | null { return this._lastAttempt; }
  get nextRetry(): Date | null { return this._nextRetry; }
  get responseCode(): number | null { return this._responseCode; }
  get responseBody(): string | null { return this._responseBody; }

  recordSuccess(responseCode: number): void {
    this._status = WebhookDeliveryStatus.SUCCESS;
    this._attempts += 1;
    this._lastAttempt = new Date();
    this._nextRetry = null;
    this._responseCode = responseCode;
    this._responseBody = null;
  }

  recordFailure(responseCode: number | null, responseBody: string | null, maxRetries: number): void {
    this._attempts += 1;
    this._lastAttempt = new Date();
    this._responseCode = responseCode;
    this._responseBody = responseBody?.slice(0, 1000) ?? null;

    if (this._attempts >= maxRetries) {
      this._status = WebhookDeliveryStatus.EXHAUSTED;
      this._nextRetry = null;
    } else {
      this._status = WebhookDeliveryStatus.FAILED;
      const backoffMs = BACKOFF_SCHEDULE_MS[Math.min(this._attempts - 1, BACKOFF_SCHEDULE_MS.length - 1)];
      this._nextRetry = new Date(Date.now() + backoffMs);
    }
  }

  toJSON(): WebhookDeliveryProps {
    return {
      id: this.id,
      endpointId: this.endpointId,
      event: this.event,
      payload: this.payload,
      status: this._status,
      attempts: this._attempts,
      lastAttempt: this._lastAttempt,
      nextRetry: this._nextRetry,
      responseCode: this._responseCode,
      responseBody: this._responseBody,
      createdAt: this.createdAt,
    };
  }
}
