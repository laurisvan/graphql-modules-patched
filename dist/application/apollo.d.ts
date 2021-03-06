import { DocumentNode, GraphQLSchema } from 'graphql';
import { ExecutionContextBuilder } from './context';
import { Application } from './types';
export interface ApolloRequestContext {
  document: DocumentNode;
  operationName?: string | null;
  context?: any;
  schema: GraphQLSchema;
  request: {
    variables?: {
      [name: string]: any;
    } | null;
  };
}
export declare function apolloExecutorCreator({
  createExecution,
}: {
  createExecution: Application['createExecution'];
}): Application['createApolloExecutor'];
export declare function apolloSchemaCreator({
  createSubscription,
  contextBuilder,
  schema,
}: {
  createSubscription: Application['createSubscription'];
  contextBuilder: ExecutionContextBuilder;
  schema: GraphQLSchema;
}): () => GraphQLSchema;
