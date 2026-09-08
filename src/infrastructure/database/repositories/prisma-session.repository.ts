// ─── Prisma Session Repository ────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import { Session } from '../../../domain/entities/session.entity.js';
import type { GeoLocation } from '../../../domain/entities/session.entity.js';

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(session: Session): Promise<Session> {
    const record = await this.prisma.session.create({
      data: {
        id: session.id,
        userId: session.userId,
        family: session.family,
        deviceName: session.deviceName,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        locationCity: session.location?.city ?? null,
        locationRegion: session.location?.region ?? null,
        locationCountryCode: session.location?.countryCode ?? null,
        locationCountryName: session.location?.countryName ?? null,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
      },
    });

    return this.toDomain(record);
  }

  async findById(id: string): Promise<Session | null> {
    const record = await this.prisma.session.findUnique({
      where: { id },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findByFamily(family: string): Promise<Session | null> {
    const record = await this.prisma.session.findUnique({
      where: { family },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    const now = new Date();
    const records = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    return records.map((r) => this.toDomain(r));
  }

  async updateActivity(id: string, data: {
    ipAddress: string | null;
    location: GeoLocation | null;
    lastSeenAt: Date;
  }): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: {
        ipAddress: data.ipAddress,
        locationCity: data.location?.city ?? null,
        locationRegion: data.location?.region ?? null,
        locationCountryCode: data.location?.countryCode ?? null,
        locationCountryName: data.location?.countryName ?? null,
        lastSeenAt: data.lastSeenAt,
      },
    });
  }

  async revokeById(id: string): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByFamily(family: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toDomain(record: any): Session {
    const location: GeoLocation | null =
      record.locationCity || record.locationRegion || record.locationCountryCode
        ? {
            city: record.locationCity ?? null,
            region: record.locationRegion ?? null,
            countryCode: record.locationCountryCode ?? null,
            countryName: record.locationCountryName ?? null,
          }
        : null;

    return new Session({
      id: record.id,
      userId: record.userId,
      family: record.family,
      deviceName: record.deviceName ?? null,
      userAgent: record.userAgent ?? null,
      ipAddress: record.ipAddress ?? null,
      location,
      createdAt: record.createdAt,
      lastSeenAt: record.lastSeenAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
    });
  }
}
