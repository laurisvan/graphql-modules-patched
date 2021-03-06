import { ModuleConfig } from './types';
/**
 * @api
 * Creates a Module, an element used by Application. Accepts `ModuleConfig`.
 *
 * @example
 *
 * ```typescript
 * import { createModule, gql } from 'graphql-modules';
 *
 * export const usersModule = createModule({
 *   id: 'users',
 *   typeDefs: gql`
 *     // GraphQL SDL
 *   `,
 *   resolvers: {
 *     // ...
 *   }
 * });
 * ```
 */
export declare function createModule(
  config: ModuleConfig
): import('./types').Module;
