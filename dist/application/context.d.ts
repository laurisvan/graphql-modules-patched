import { Injector, ReflectiveInjector } from '../di';
import { ResolvedProvider } from '../di/resolution';
import type { InternalAppContext, ModulesMap } from './application';
export declare type ExecutionContextBuilder<
  TContext extends {
    [key: string]: any;
  } = {}
> = (context: TContext) => {
  context: InternalAppContext;
  ɵdestroy(): void;
  ɵinjector: Injector;
};
export declare function createContextBuilder({
  appInjector,
  modulesMap,
  appLevelOperationProviders,
  singletonGlobalProvidersMap,
  operationGlobalProvidersMap,
}: {
  appInjector: ReflectiveInjector;
  appLevelOperationProviders: ResolvedProvider[];
  singletonGlobalProvidersMap: {
    [key: string]: string;
  };
  operationGlobalProvidersMap: {
    [key: string]: string;
  };
  modulesMap: ModulesMap;
}): ExecutionContextBuilder<GraphQLModules.GlobalContext>;
