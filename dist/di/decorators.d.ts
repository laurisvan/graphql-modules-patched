import { Type, ProviderOptions, InjectionToken } from './providers';
import { Injector } from './injector';
export declare function Injectable(options?: ProviderOptions): ClassDecorator;
export declare function Optional(): ParameterDecorator;
export declare function Inject(
  type: Type<any> | InjectionToken<any>
): ParameterDecorator;
export declare type ExecutionContext = {
  injector: Injector;
} & GraphQLModules.ModuleContext;
export declare function ExecutionContext(): PropertyDecorator;
