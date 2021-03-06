import { execute } from 'graphql';
import { ExecutionContextBuilder } from './context';
export declare function executionCreator({
  contextBuilder,
}: {
  contextBuilder: ExecutionContextBuilder;
}): (
  options?:
    | {
        execute?: typeof execute | undefined;
        controller?: import('./types').OperationController | undefined;
      }
    | undefined
) => typeof execute;
