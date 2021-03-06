import { InjectableParamMetadata } from './metadata';
import { Type, InjectionToken } from './providers';
import { ReflectiveInjector } from './injector';
import { Key } from './registry';
export declare function invalidProviderError(provider: any): Error;
export declare function noInjectableError(type: Type<any>): Error;
export declare function noAnnotationError(
  typeOrFunc: Type<any> | InjectionToken<any> | Function,
  params: InjectableParamMetadata[]
): Error;
export declare function cyclicDependencyError(
  injector: ReflectiveInjector,
  key: Key
): InjectionError;
export declare function noProviderError(
  injector: ReflectiveInjector,
  key: Key
): InjectionError;
export declare function instantiationError(
  injector: ReflectiveInjector,
  originalException: any,
  key: Key
): InjectionError;
export interface InjectionError extends Error {
  keys: Key[];
  injectors: ReflectiveInjector[];
  constructResolvingMessage: (this: InjectionError) => string;
  addKey(key: Key): void;
}
