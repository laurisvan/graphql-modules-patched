import { ResolvedModule } from '../module/factory';
import { ID } from '../shared/types';
import { ApplicationConfig, Application } from './types';
export declare type ModulesMap = Map<ID, ResolvedModule>;
/**
 * @internal
 */
export interface InternalAppContext {
  ɵgetModuleContext(
    moduleId: ID,
    context: GraphQLModules.GlobalContext
  ): GraphQLModules.ModuleContext;
}
/**
 * @api
 * Creates Application out of Modules. Accepts `ApplicationConfig`.
 *
 * @example
 *
 * ```typescript
 * import { createApplication } from 'graphql-modules';
 * import { usersModule } from './users';
 * import { postsModule } from './posts';
 * import { commentsModule } from './comments';
 *
 * const app = createApplication({
 *   modules: [
 *     usersModule,
 *     postsModule,
 *     commentsModule
 *   ]
 * })
 * ```
 */
export declare function createApplication(
  applicationConfig: ApplicationConfig
): Application;
