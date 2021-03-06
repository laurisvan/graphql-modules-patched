import { Module, ModuleConfig, Resolvers } from './types';
import { ReflectiveInjector } from '../di';
import { ResolvedProvider } from './../di/resolution';
import { MiddlewareMap } from '../shared/middleware';
import { Single } from '../shared/types';
export declare type ResolvedModule = {
  injector: ReflectiveInjector;
  singletonProviders: Array<ResolvedProvider>;
  operationProviders: Array<ResolvedProvider>;
  resolvers?: Single<Resolvers>;
} & Omit<Module, 'factory'>;
export declare type ModuleFactory = (app: {
  injector: ReflectiveInjector;
  middlewares: MiddlewareMap;
}) => ResolvedModule;
export declare function moduleFactory(config: ModuleConfig): Module;
