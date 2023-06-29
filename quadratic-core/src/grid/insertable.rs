#![allow(unused)] // TODO: just for testing/demo

use lib0::any::Any;
use yrs::{updates::decoder::Decode, *};

use crate::{BasicValue, Pos};

pub struct Grid {
    doc: Doc,
    cells: MapRef,
    rows: PosNegIdArray,
    cols: PosNegIdArray,
}

impl Grid {
    pub fn new(id: u64) -> Self {
        let doc = Doc::with_client_id(id);
        let cells = doc.get_or_insert_map("cells");
        Grid { doc, cells }
    }

    pub fn set_cell(&self, pos: Pos, value: impl Into<BasicValue>) {
        let key = pos_key(pos);
        let value = value.into();

        let mut txn = self.doc.transact_mut();

        if value.is_blank() {
            self.cells.remove(&mut txn, &key);
        } else {
            self.cells.insert(
                &mut txn,
                key,
                Any::from_json(&value.to_json()).expect("failed to deserialize cell value"),
            );
        }
    }
    pub fn get_cell(&self, pos: Pos) -> BasicValue {
        let key = pos_key(pos);

        let txn = self.doc.transact();

        match self.cells.get(&txn, &key) {
            None => BasicValue::Blank,
            Some(v) => match v {
                types::Value::Any(v) => {
                    let mut s = String::new();
                    v.to_json(&mut s);
                    BasicValue::from_json(&s)
                }
                _ => BasicValue::Blank, // change this if we want simultaneous editing of a single cell
            },
        }
    }
    pub fn state_vector(&self) -> StateVector {
        self.doc.transact().state_vector()
    }
    pub fn encode_update_from(&self, sv: &StateVector) -> Vec<u8> {
        self.doc.transact().encode_state_as_update_v1(sv)
    }
    pub fn apply_update(&self, update: &[u8]) -> Result<(), lib0::error::Error> {
        self.doc
            .transact_mut()
            .apply_update(Update::decode_v1(update)?);
        Ok(())
    }
}

fn pos_key(Pos { x, y }: Pos) -> String {
    format!("{x},{y}")
}

struct PosNegIdArray {
    pos: yrs::ArrayRef,
    neg: yrs::ArrayRef,
}
impl PosNegIdArray {
    fn new(doc: &Doc, name: &str) -> Self {
        PosNegIdArray {
            pos: doc.get_or_insert_array(&format!("{name}_pos")),
            neg: doc.get_or_insert_array(&format!("{name}_neg")),
        }
    }
    fn get(&mut self, txn: &impl ReadTxn, i: i64) -> StickyIndex {
        let (array, i) = match i {
            0.. => (&self.pos, i as u32),
            _ => (&self.neg, (-i - 1) as u32),
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_multiplayer_grid() {
        let mut alice = Grid::new(101);
        alice.set_cell(pos![C2], "a");

        let mut bob = Grid::new(102);
        let bob_initial_sv = bob.state_vector();
        bob.set_cell(pos![C4], "b");
        let bob_update = bob.encode_update_from(&bob_initial_sv);

        alice.apply_update(&bob_update);
        assert_eq!(alice.get_cell(pos![C2]), "a".into());
        assert_eq!(alice.get_cell(pos![C4]), "b".into());
        assert_eq!(alice.get_cell(pos![C3]), BasicValue::Blank);
    }
}
