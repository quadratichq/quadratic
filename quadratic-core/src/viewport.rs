#[cfg(not(test))]
use wasm_bindgen::prelude::*;
// TODO: replace this whole file with `bytemuck`

use crate::{Pos, grid::SheetId};

#[cfg(not(test))]
use js_sys::{Int32Array, SharedArrayBuffer, Uint8Array};

#[cfg(not(test))]
use std::str::FromStr;

#[cfg(not(test))]
use std::sync::atomic::{AtomicI32, Ordering};

#[derive(Debug, Clone)]
#[cfg_attr(feature = "js", wasm_bindgen)]
#[cfg(not(test))]
pub struct ViewportBuffer {
    buffer: Box<SharedArrayBuffer>,
}

#[cfg(not(test))]
/// SharedArrayBuffer for the live viewport information, implemented using Ping-Pong Buffer pattern
impl Default for ViewportBuffer {
    fn default() -> Self {
        // (5 int32 + 36 uint8) * 2 (reader and writer) = 112
        // in each slice:
        // first int32 is flag
        // next 4 int32 are top_left_hash and bottom_right_hash
        // next 36 uint8 are sheet_id
        let buffer = Box::new(SharedArrayBuffer::new(112));
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
    pub(crate) fn get_buffer(&self) -> SharedArrayBuffer {
        (*self.buffer).clone()
    }

    pub(crate) fn get_viewport(&self) -> Option<(Pos, Pos, SheetId)> {
        let array = Int32Array::new(&self.buffer);

        // Determine which slice is the reader slice, and lock it
        // initial flag value should be 1, change flag to 2 to lock
        let reader_start = if AtomicI32::new(array.get_index(0))
            .compare_exchange(1, 2, Ordering::Acquire, Ordering::Relaxed)
            .is_ok()
        {
            0
        } else if AtomicI32::new(array.get_index(14))
            .compare_exchange(1, 2, Ordering::Acquire, Ordering::Relaxed)
            .is_ok()
        {
            14
        } else {
            return None;
        };

        // Read all values from the locked reader slice
        let top_left_hash = Pos {
            x: array.get_index(reader_start + 1) as i64,
            y: array.get_index(reader_start + 2) as i64,
        };
        let bottom_right_hash = Pos {
            x: array.get_index(reader_start + 3) as i64,
            y: array.get_index(reader_start + 4) as i64,
        };

        let uuid_array = Uint8Array::new(&self.buffer);
        let mut uuid_bytes = [0u8; 36];

        uuid_array
            .slice(reader_start * 4 + 20, reader_start * 4 + 56)
            .copy_to(&mut uuid_bytes[..]);

        let sheet_id = std::str::from_utf8(&uuid_bytes)
            .ok()
            .and_then(|uuid_str| SheetId::from_str(uuid_str).ok());

        // Unlock the slice by setting the flag back to 1, if the flag is still 2
        let _ = AtomicI32::new(array.get_index(reader_start)).compare_exchange(
            2,
            1,
            Ordering::Release,
            Ordering::Relaxed,
        );

        match sheet_id {
            Some(sheet_id) => Some((top_left_hash, bottom_right_hash, sheet_id)),
            None => {
                dbgjs!("[controller.viewport] Invalid SheetId");
                None
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
#[cfg(test)]
pub struct ViewportBuffer {
    buffer: Box<[u8; 112]>,
}

#[cfg(test)]
impl Default for ViewportBuffer {
    fn default() -> Self {
        ViewportBuffer {
            buffer: Box::new([0u8; 112]),
        }
    }
}

#[cfg(test)]
impl ViewportBuffer {
    pub(crate) fn get_buffer(&self) -> [u8; 112] {
        *self.buffer
    }

    pub(crate) fn get_viewport(&self) -> Option<(Pos, Pos, SheetId)> {
        Some((Pos { x: -10, y: -10 }, Pos { x: 10, y: 10 }, SheetId::TEST))
    }
}
