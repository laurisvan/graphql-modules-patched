import { subscribe } from 'graphql';
import { ExecutionContextBuilder } from './context';
export declare function subscriptionCreator({
  contextBuilder,
}: {
  contextBuilder: ExecutionContextBuilder;
}): (
  options?:
    | {
        subscribe?: typeof subscribe | undefined;
        controller?: import('./types').OperationController | undefined;
      }
    | undefined
) => typeof subscribe;
