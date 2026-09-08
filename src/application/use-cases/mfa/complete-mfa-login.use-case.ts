import { v4 as uuidv4 } from "uuid";
import { LoginHistory } from "../../../domain/entities/login-history.entity.js";
import { RefreshToken } from "../../../domain/entities/refresh-token.entity.js";
import {
	LoginMethod,
	LoginStatus,
} from "../../../domain/entities/role.entity.js";
import { Session } from "../../../domain/entities/session.entity.js";
import { WebhookEvent } from "../../../domain/entities/webhook.entity.js";
import {
	InvalidMfaCodeError,
	UserInactiveError,
} from "../../../domain/errors/domain-errors.js";
import type { ILoginHistoryRepository } from "../../../domain/repositories/login-history.repository.js";
import type { IRefreshTokenRepository } from "../../../domain/repositories/refresh-token.repository.js";
import type { ISessionRepository } from "../../../domain/repositories/session.repository.js";
import type { IUserRepository } from "../../../domain/repositories/user.repository.js";
import type { IGeoIpService } from "../../ports/geo-ip.port.js";
import type { ISecureTokenService } from "../../ports/secure-token.port.js";
import type { ITokenManager } from "../../ports/token-manager.port.js";
import { parseDeviceName } from "../../services/device-name.service.js";
import type { MfaChallengeService } from "../../services/mfa-challenge.service.js";
import type { DispatchEventUseCase } from "../webhook/dispatch-event.use-case.js";
import type {
	MfaValidationMethod,
	ValidateMfaCodeUseCase,
} from "./validate-mfa-code.use-case.js";

export interface CompleteMfaLoginInput {
	mfaToken: string;
	code: string;
	method: MfaValidationMethod;
	userAgent?: string;
	ipAddress?: string;
}

export interface CompleteMfaLoginOutput {
	type: "authenticated";
	accessToken: string;
	refreshToken: string;
	user: {
		id: string;
		name: string;
		email: string;
		role: string;
		emailVerified: boolean;
	};
}

export class CompleteMfaLoginUseCase {
	constructor(
		private readonly validateMfaCodeUseCase: ValidateMfaCodeUseCase,
		private readonly mfaChallengeService: MfaChallengeService,
		private readonly tokenManager: ITokenManager,
		private readonly userRepository: IUserRepository,
		private readonly refreshTokenRepository: IRefreshTokenRepository,
		private readonly refreshTokenExpiryDays: number,
		private readonly loginHistoryRepository?: ILoginHistoryRepository,
		private readonly dispatchEventUseCase?: DispatchEventUseCase,
		private readonly sessionRepository?: ISessionRepository,
		private readonly geoIpService?: IGeoIpService,
		private readonly secureTokenService?: ISecureTokenService,
	) {}

	async execute(input: CompleteMfaLoginInput): Promise<CompleteMfaLoginOutput> {
		const challenge = await this.mfaChallengeService.getActive(input.mfaToken);
		this.mfaChallengeService.assertMethodAllowed(challenge, input.method);

		try {
			await this.validateMfaCodeUseCase.execute({
				userId: challenge.userId,
				code: input.code,
				method: input.method,
			});
		} catch (error) {
			if (error instanceof InvalidMfaCodeError) {
				await this.mfaChallengeService.rejectInvalidCode(challenge.challengeId);
			}
			throw error;
		}

		await this.mfaChallengeService.consume(challenge.challengeId);

		const user = await this.userRepository.findById(challenge.userId);
		if (!user || !user.isActive) throw new UserInactiveError();

		const family = uuidv4();
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);
		const deviceName = parseDeviceName(input.userAgent);
		const ipAddress = input.ipAddress ?? null;
		const location = this.geoIpService?.lookup(ipAddress ?? "") ?? null;

		let sessionId: string | undefined;
		if (this.sessionRepository) {
			const session = new Session({
				id: uuidv4(),
				userId: user.id,
				family,
				deviceName,
				userAgent: input.userAgent ?? null,
				ipAddress,
				location,
				createdAt: new Date(),
				lastSeenAt: new Date(),
				expiresAt,
				revokedAt: null,
			});
			await this.sessionRepository.create(session);
			sessionId = session.id;
		}

		const accessToken = await this.tokenManager.generateAccessToken({
			sub: user.id,
			email: user.email,
			role: user.role,
			sid: sessionId,
		});
		const refreshTokenValue = this.tokenManager.generateRefreshToken();
		await this.refreshTokenRepository.create(
			new RefreshToken({
				id: uuidv4(),
				token:
					this.secureTokenService?.digest(refreshTokenValue) ??
					refreshTokenValue,
				userId: user.id,
				family,
				userAgent: input.userAgent ?? null,
				ipAddress,
				deviceName,
				expiresAt,
				createdAt: new Date(),
				revokedAt: null,
			}),
		);

		if (this.loginHistoryRepository) {
			const entry = new LoginHistory({
				id: uuidv4(),
				userId: user.id,
				email: user.email,
				status: LoginStatus.SUCCESS,
				method: LoginMethod.EMAIL_PASSWORD,
				ipAddress,
				userAgent: input.userAgent ?? null,
				deviceName,
				failReason: null,
				createdAt: new Date(),
			});
			await this.loginHistoryRepository.create(entry).catch(() => undefined);
		}

		this.dispatchEventUseCase
			?.execute({
				event: WebhookEvent.USER_LOGIN,
				payload: {
					userId: user.id,
					email: user.email,
					mfaVerified: true,
					ipAddress,
					timestamp: new Date().toISOString(),
				},
			})
			.catch(() => undefined);

		return {
			type: "authenticated",
			accessToken,
			refreshToken: refreshTokenValue,
			user: {
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				emailVerified: user.emailVerified,
			},
		};
	}
}
