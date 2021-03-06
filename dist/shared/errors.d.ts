import { ID } from './types';
declare const ModuleNonUniqueIdError_base: ErrorConstructor;
export declare class ModuleNonUniqueIdError extends ModuleNonUniqueIdError_base {
  constructor(message: string, ...rest: string[]);
}
declare const ModuleDuplicatedError_base: ErrorConstructor;
export declare class ModuleDuplicatedError extends ModuleDuplicatedError_base {
  constructor(message: string, ...rest: string[]);
}
declare const ExtraResolverError_base: ErrorConstructor;
export declare class ExtraResolverError extends ExtraResolverError_base {
  constructor(message: string, ...rest: string[]);
}
declare const ExtraMiddlewareError_base: ErrorConstructor;
export declare class ExtraMiddlewareError extends ExtraMiddlewareError_base {
  constructor(message: string, ...rest: string[]);
}
declare const ResolverDuplicatedError_base: ErrorConstructor;
export declare class ResolverDuplicatedError extends ResolverDuplicatedError_base {
  constructor(message: string, ...rest: string[]);
}
declare const ResolverInvalidError_base: ErrorConstructor;
export declare class ResolverInvalidError extends ResolverInvalidError_base {
  constructor(message: string, ...rest: string[]);
}
declare const NonDocumentNodeError_base: ErrorConstructor;
export declare class NonDocumentNodeError extends NonDocumentNodeError_base {
  constructor(message: string, ...rest: string[]);
}
export declare function useLocation({
  dirname,
  id,
}: {
  id: ID;
  dirname?: string;
}): string;
export declare function ExtendableBuiltin<T extends Function>(cls: T): T;
export declare function composeMessage(...lines: string[]): string;
export {};
