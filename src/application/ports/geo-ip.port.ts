import type { GeoLocation } from "../../domain/entities/session.entity.js";

export interface IGeoIpService {
	lookup(ip: string): GeoLocation | null;
}
