import type { Application } from './types';
import type { ExecutionContextBuilder } from './context';
export declare function operationControllerCreator(options: {
  contextBuilder: ExecutionContextBuilder<GraphQLModules.GlobalContext>;
}): Application['createOperationController'];
