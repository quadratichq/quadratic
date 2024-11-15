// TODO: replace this whole file with `bytemuck`

use crate::{grid::SheetId, Pos};

#[cfg(not(test))]
use js_sys::{Int32Array, SharedArrayBuffer, Uint8Array};

#[cfg(not(test))]
use std::str::FromStr;

#[cfg(not(test))]
use wasm_bindgen::prelude::*;

#[derive(Debug, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
#[cfg(not(test))]
pub struct ViewportBuffer {
    buffer: SharedArrayBuffer,
}

#[cfg(not(test))]
impl Default for ViewportBuffer {
    fn default() -> Self {
        // 5 int32 + 36 uint8
        // first int32 is flag
        // next 4 int32 are top_left_hash and bottom_right_hash
        // next 36 uint8 are sheet_id
        let buffer = SharedArrayBuffer::new(56);
        ViewportBuffer { buffer }
    }
}

#[cfg(not(test))]
impl PartialEq for ViewportBuffer {
    fn eq(&self, _: &Self) -> bool {
        true
    }
}

#[cfg(not(test))]
unsafe impl Send for ViewportBuffer {}

#[cfg(not(test))]
impl ViewportBuffer {
    pub fn get_buffer(&self) -> SharedArrayBuffer {
        self.buffer.clone()
    }

    pub fn get_viewport(&self) -> Option<(Pos, Pos, SheetId)> {
        let array = Int32Array::new(&self.buffer);
        let flag = array.get_index(0);
        if flag == 0 {
            return None;
        }

        let top_left_hash = Pos {
            x: array.get_index(1) as i64,
            y: array.get_index(2) as i64,
        };
        let bottom_right_hash = Pos {
            x: array.get_index(3) as i64,
            y: array.get_index(4) as i64,
        };

        let uuid_array = Uint8Array::new(&self.buffer);
        let mut uuid_bytes = [0u8; 36];
        uuid_array.slice(20, 56).copy_to(&mut uuid_bytes[..]);
        match std::str::from_utf8(&uuid_bytes) {
            Ok(uuid_str) => match SheetId::from_str(uuid_str) {
                Ok(sheet_id) => Some((top_left_hash, bottom_right_hash, sheet_id)),
                Err(_) => {
                    dbgjs!(format!(
                        "[controller.viewport] Invalid SheetId string: {:?}",
                        uuid_str
                    ));
                    None
                }
            },
            Err(_) => {
                dbgjs!(format!("[controller.viewport] Invalid SheetId bytes"));
                None
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
#[cfg(test)]
pub struct ViewportBuffer {
    buffer: [u8; 56],
}

#[cfg(test)]
impl Default for ViewportBuffer {
    fn default() -> Self {
        ViewportBuffer { buffer: [0u8; 56] }
    }
}

#[cfg(test)]
impl ViewportBuffer {
    pub fn get_buffer(&self) -> [u8; 56] {
        self.buffer
    }

    pub fn get_viewport(&self) -> Option<(Pos, Pos, SheetId)> {
        Some((Pos { x: 0, y: 0 }, Pos { x: 10, y: 10 }, SheetId::test()))
    }
}
