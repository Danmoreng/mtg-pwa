declare module 'threads/worker' {
  export function expose(worker: any): void;
}

declare module 'threads' {
  export class Thread {
    static terminate(thread: any): Promise<void>;
  }
  export function spawn(worker: any, options?: any): Promise<any>;
}
