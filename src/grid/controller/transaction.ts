import { GridInteractionState } from '../../atoms/gridInteractionStateAtom';
import { Statement } from './statement';

export type Transaction = {
  statements: Statement[];
  cursor?: GridInteractionState;
};
