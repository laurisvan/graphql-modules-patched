import { ModuleConfig } from './types';
import { ModuleMetadata } from './metadata';
import { ResolveFn, ID } from './../shared/types';
import { MiddlewareMap } from '../shared/middleware';
interface ResolverMetadata {
  moduleId: ID;
}
export declare function createResolvers(
  config: ModuleConfig,
  metadata: ModuleMetadata,
  app: {
    middlewareMap: MiddlewareMap;
  }
): Record<string, any>;
export declare function readResolverMetadata(
  resolver: ResolveFn
): ResolverMetadata;
export {};
