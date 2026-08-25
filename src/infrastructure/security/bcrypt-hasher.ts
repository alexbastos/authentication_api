// ─── Bcrypt Hasher ────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import type { IHasher } from '../../application/ports/hasher.port.js';

export class BcryptHasher implements IHasher {
  constructor(private readonly saltRounds: number = 12) {}

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
