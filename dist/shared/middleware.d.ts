import { GraphQLResolveInfo } from 'graphql';
import { ModuleMetadata } from './../module/metadata';
export declare type Next<T = any> = () => Promise<T>;
export declare type Middleware<TContext = MiddlewareContext> = (
  context: TContext,
  next: Next
) => Promise<any>;
export declare function compose<TContext>(
  middleware: Array<Middleware<TContext>>
): (context: TContext, next: Next) => Promise<any>;
export interface MiddlewareContext {
  root: any;
  args: {
    [argName: string]: any;
  };
  context: GraphQLModules.ModuleContext;
  info: GraphQLResolveInfo;
}
export declare type MiddlewareMap = {
  [type: string]: {
    [field: string]: Middleware[];
  };
};
export declare function createMiddleware(
  path: string[],
  middlewareMap?: MiddlewareMap
): (context: MiddlewareContext, next: Next<any>) => Promise<any>;
export declare function mergeMiddlewareMaps(
  app: MiddlewareMap,
  mod: MiddlewareMap
): MiddlewareMap;
export declare function validateMiddlewareMap(
  middlewareMap: MiddlewareMap,
  metadata: ModuleMetadata
): void;
