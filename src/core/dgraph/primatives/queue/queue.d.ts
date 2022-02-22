export class Queue<T> {
  constructor(elements?: T[]);
  isEmpty(): boolean;
  size(): number;
  enqueue(element: T): Queue<T>;
  dequeue(): T;
  front(): T;
  back(): T;
  toArray(): T[];
  clear(): void;
  clone(): Queue<T>;
  static fromArray<T>(elements: T[]): Queue<T>;
}
