// ─── Enterprise Business Rules ────────────────────────────────────────────
// Pure domain entity — no external dependencies

import { LoginStatus, LoginMethod } from './role.entity.js';

export interface LoginHistoryProps {
  id: string;
  userId: string | null;
  email: string;
  status: LoginStatus;
  method: LoginMethod;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  failReason: string | null;
  createdAt: Date;
}

export class LoginHistory {
  readonly id: string;
  readonly userId: string | null;
  readonly email: string;
  readonly status: LoginStatus;
  readonly method: LoginMethod;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly deviceName: string | null;
  readonly failReason: string | null;
  readonly createdAt: Date;

  constructor(props: LoginHistoryProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.email = props.email;
    this.status = props.status;
    this.method = props.method;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.deviceName = props.deviceName;
    this.failReason = props.failReason;
    this.createdAt = props.createdAt;
  }

  get isSuccess(): boolean {
    return this.status === LoginStatus.SUCCESS;
  }

  get isFailure(): boolean {
    return this.status === LoginStatus.FAILURE;
  }
}
