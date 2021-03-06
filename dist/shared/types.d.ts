import { GraphQLFieldResolver, GraphQLTypeResolver } from 'graphql';
import { Injector } from '../di';
export declare type ID = string;
export declare type Nil = undefined | null;
export declare type Maybe<T> = T | Nil;
export declare type Plural<T> = T | T[];
export declare type Single<T> = T extends Array<infer R> ? R : T;
export declare type ValueOrPromise<T> = T | Promise<T>;
export declare type ResolveFn<TContext = GraphQLModules.Context> =
  GraphQLFieldResolver<any, TContext, Record<string, any>>;
export declare type ResolveTypeFn<TContext = GraphQLModules.Context> =
  GraphQLTypeResolver<any, TContext>;
declare global {
  namespace GraphQLModules {
    type ModuleContext = {
      injector: Injector;
      moduleId: ID;
    } & GlobalContext;
    type AppContext = Omit<ModuleContext, 'moduleId'>;
    type Context = ModuleContext;
    interface GlobalContext {}
  }
}
