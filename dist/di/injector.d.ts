import { Type, InjectionToken, Provider } from './providers';
import { ResolvedProvider, GlobalProviderMap } from './resolution';
import { Key } from './registry';
import { ExecutionContext } from './decorators';
declare type ExecutionContextGetter = () => ExecutionContext | never;
export declare abstract class Injector {
  abstract get<T>(token: Type<T> | InjectionToken<T>, notFoundValue?: any): T;
}
export declare class ReflectiveInjector implements Injector {
  displayName: string;
  _constructionCounter: number;
  _providers: ResolvedProvider[];
  _globalProvidersMap: GlobalProviderMap;
  private _executionContextGetter;
  private _fallbackParent;
  private _parent;
  private _keyIds;
  private _objs;
  constructor({
    name,
    providers,
    parent,
    fallbackParent,
    globalProvidersMap,
  }: {
    name: string;
    proxy?: boolean;
    providers: ResolvedProvider[];
    parent?: Injector | null;
    fallbackParent?: Injector | null;
    globalProvidersMap?: GlobalProviderMap;
  });
  static createFromResolved({
    name,
    providers,
    parent,
    fallbackParent,
    globalProvidersMap,
  }: {
    name: string;
    providers: ResolvedProvider[];
    parent?: Injector;
    fallbackParent?: Injector;
    globalProvidersMap?: GlobalProviderMap;
  }): ReflectiveInjector;
  static resolve(providers: Provider[]): ResolvedProvider[];
  get parent(): Injector | null;
  get fallbackParent(): Injector | null;
  get(token: any, notFoundValue?: any): any;
  setExecutionContextGetter(getter: ExecutionContextGetter): void;
  private _getByKey;
  _isObjectDefinedByKeyId(keyId: number): boolean;
  _getObjByKeyId(keyId: number): any;
  _throwOrNull(key: Key, notFoundValue: any): any;
  instantiateAll(): void;
  private _instantiateProvider;
  private _getByDependency;
  private _new;
  private _getMaxNumberOfObjects;
  toString(): string;
}
export {};
