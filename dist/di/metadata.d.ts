import { Type, ProviderOptions, InjectionToken } from './providers';
export declare const INJECTABLE: unique symbol;
export interface InjectableParamMetadata {
  type: Type<any> | InjectionToken<any>;
  optional: boolean;
}
export interface InjectableMetadata {
  params: InjectableParamMetadata[];
  options?: ProviderOptions;
}
export declare function readInjectableMetadata(
  type: Type<any>,
  throwOnMissing?: boolean
): InjectableMetadata;
export declare function ensureInjectableMetadata(type: Type<any>): void;
