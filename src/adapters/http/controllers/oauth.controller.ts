// ─── OAuth Controller ───────────────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthorizeUseCase } from '../../../application/use-cases/oauth/authorize.use-case.js';
import type { GrantConsentUseCase } from '../../../application/use-cases/oauth/grant-consent.use-case.js';
import type { TokenExchangeUseCase } from '../../../application/use-cases/oauth/token-exchange.use-case.js';
import type { UserInfoUseCase } from '../../../application/use-cases/oauth/userinfo.use-case.js';

export class OAuthController {
  constructor(
    private readonly authorizeUC: AuthorizeUseCase,
    private readonly grantConsentUC: GrantConsentUseCase,
    private readonly tokenExchangeUC: TokenExchangeUseCase,
    private readonly userInfoUC: UserInfoUseCase,
  ) {}

  async authorize(request: FastifyRequest<any>, reply: FastifyReply) {
    const { response_type, client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, nonce, prompt } = request.query as any;
    
    // In a real app, this endpoint might just render an HTML form if not authenticated,
    // but as an API, we expect the client to have a valid session/token to call this.
    // Assuming auth middleware is applied, we get user from request:
    const user = (request as any).user;
    if (!user) {
      return reply.status(401).send({ error: 'unauthenticated' });
    }

    try {
      const result = await this.authorizeUC.execute({
        userId: user.sub,
        clientId: client_id,
        responseType: response_type,
        redirectUri: redirect_uri,
        scope,
        state,
        codeChallenge: code_challenge,
        codeChallengeMethod: code_challenge_method,
        nonce,
        prompt,
      });

      // Instead of JSON, the spec requires a 302 redirect for the auth code
      return reply.redirect(result.redirectUri);
    } catch (err: any) {
      if (err.name === 'ConsentRequiredError') {
        // Return 403 or specific payload so frontend knows to prompt consent
        return reply.status(403).send({ error: 'consent_required', client_id, scope });
      }
      throw err;
    }
  }

  async grantConsent(request: FastifyRequest<any>, reply: FastifyReply) {
    const { client_id, scopes } = request.body as any;
    const user = (request as any).user;

    await this.grantConsentUC.execute({
      userId: user.sub,
      clientId: client_id,
      scopes,
    });

    return reply.status(200).send({ message: 'Consent granted' });
  }

  async token(request: FastifyRequest<any>, reply: FastifyReply) {
    const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = request.body as any;

    const result = await this.tokenExchangeUC.execute({
      grantType: grant_type,
      code,
      redirectUri: redirect_uri,
      clientId: client_id,
      clientSecret: client_secret,
      codeVerifier: code_verifier,
    });

    // Disable caching for tokens
    reply.header('Cache-Control', 'no-store');
    reply.header('Pragma', 'no-cache');
    return reply.status(200).send(result);
  }

  async userinfo(request: FastifyRequest<any>, reply: FastifyReply) {
    const user = (request as any).user;
    
    // The scopes are injected into the token in token exchange
    // We assume the token verify middleware decodes it into request.user.scopes
    const scopes = user.scopes || [];

    const result = await this.userInfoUC.execute({
      userId: user.sub,
      scopes,
    });

    return reply.status(200).send(result);
  }
}
