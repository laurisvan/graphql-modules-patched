import { Type } from './providers';
export declare class Key {
  token: Type<any>;
  id: number;
  constructor(token: Type<any>, id: number);
  /**
   * Returns a stringified token.
   */
  get displayName(): string;
  static get(token: Object): Key;
}
