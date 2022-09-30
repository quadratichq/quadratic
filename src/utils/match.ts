export const matched = <A> (a: A): Matched<A> => ({
  on: () => matched(a),
  otherwise: () => a
});

export const match = <A,B> (a: A): Match<A,B> => ({  
  on: (pred: (a: A) => boolean, fn: (a: A) => B) => (pred(a) ? matched(fn(a)) : match(a)),
  otherwise: (fn: (a: A) => B) => fn(a)
});

export type Matched<A> = {
  on: () => Matched<A>;
  otherwise: () => A;
};

export type Match<A,B> = {
  on: (pred: (a: A) => boolean, fn: (a: A) => B) => Match<A,B> | Matched<B>;
  otherwise: (fn: (a: A) => B) => B
};