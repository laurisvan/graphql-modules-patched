/// <reference types="node" />
export declare const ERROR_TYPE = 'diType';
export declare const ERROR_ORIGINAL_ERROR = 'diOriginalError';
export declare const ERROR_LOGGER = 'diErrorLogger';
export declare function getType(error: Error): Function;
export declare function getOriginalError(error: Error): Error;
export declare function getErrorLogger(
  error: Error
): (console: Console, ...values: any[]) => void;
export declare function wrappedError(
  message: string,
  originalError: any
): Error;
export declare function stringify(token: any): string;
