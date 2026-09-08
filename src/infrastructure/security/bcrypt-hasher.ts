// ─── Bcrypt Hasher ────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import type { IHasher } from '../../application/ports/hasher.port.js';

export class BcryptHasher implements IHasher {
  private readonly dummyHash: string;

  constructor(private readonly saltRounds: number = 12) {
    this.dummyHash = bcrypt.hashSync('constant-time-dummy-password', saltRounds);
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }

  async dummyCompare(plain: string): Promise<boolean> {
    return bcrypt.compare(plain, this.dummyHash);
  }

  needsRehash(hashed: string): boolean {
    return bcrypt.getRounds(hashed) < this.saltRounds;
  }
}
