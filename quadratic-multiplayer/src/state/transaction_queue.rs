use std::collections::VecDeque;

use quadratic_core::controller::operation::Operation;
use uuid::Uuid;

#[derive(Debug)]
pub(crate) struct Transaction {
    pub(crate) file_id: Uuid,
    pub(crate) operations: Vec<Operation>,
    pub(crate) sequence: u64,
}

#[derive(Debug)]
pub(crate) struct TransactionQueue {
    pub(crate) queue: VecDeque<Transaction>,
    pub(crate) sequence: u64,
}

impl TransactionQueue {
    pub(crate) fn new(sequence: u64) -> Self {
        TransactionQueue {
            queue: VecDeque::new(),
            sequence,
        }
    }

    pub(crate) fn push(&mut self, transaction: Transaction) {
        self.sequence = transaction.sequence;
        self.queue.push_back(transaction);
    }

    pub(crate) fn pop(&mut self) -> Option<Transaction> {
        self.queue.pop_front()
    }
}
