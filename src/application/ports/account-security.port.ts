export interface IAccountSecurityRepository {
	/** Atomically consumes a verification token, verifies the user, and invalidates sibling tokens. */
	verifyEmailWithToken(tokenId: string, userId: string): Promise<boolean>;

	/** Atomically consumes the reset token, changes the password, and revokes every session. */
	resetPasswordAndRevokeSessions(input: {
		verificationTokenId: string;
		userId: string;
		passwordHash: string;
	}): Promise<boolean>;

	/** Atomically changes the password and revokes every session. */
	changePasswordAndRevokeSessions(
		userId: string,
		passwordHash: string,
	): Promise<void>;

	/** Atomically deactivates the account and revokes every session. */
	deactivateUserAndRevokeSessions(userId: string): Promise<void>;

	/** Atomically revokes an owned logical session and its refresh-token family. */
	revokeSessionAndTokens(userId: string, sessionId: string): Promise<void>;
}
