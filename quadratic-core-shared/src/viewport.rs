use bytemuck::{Pod, Zeroable};

use crate::{Pos, SheetId};

#[cfg(all(not(test), feature = "js"))]
use js_sys::{Int32Array, SharedArrayBuffer, Uint8Array};

#[cfg(not(test))]
use std::str::FromStr;

#[cfg(not(test))]
use std::sync::atomic::{AtomicI32, Ordering};

/// Layout for a single viewport slice in the ping-pong buffer.
/// Total size: 56 bytes (5 × i32 + 36 × u8 = 20 + 36)
#[derive(Debug, Clone, Copy, PartialEq, Pod, Zeroable)]
#[repr(C)]
pub struct ViewportSlice {
    /// Lock flag: 0 = uninitialized, 1 = ready to read, 2 = locked for reading
    pub flag: i32,
    /// Top-left hash position X
    pub top_left_x: i32,
    /// Top-left hash position Y
    pub top_left_y: i32,
    /// Bottom-right hash position X
    pub bottom_right_x: i32,
    /// Bottom-right hash position Y
    pub bottom_right_y: i32,
    /// Sheet ID as UUID string bytes (36 bytes)
    pub sheet_id: [u8; 36],
}

/// Layout for the complete viewport buffer with two slices (ping-pong pattern).
/// Total size: 112 bytes (56 × 2)
#[derive(Debug, Clone, Copy, PartialEq, Pod, Zeroable)]
#[repr(C)]
pub struct ViewportData {
    pub slice_a: ViewportSlice,
    pub slice_b: ViewportSlice,
}

impl ViewportData {
    pub const SIZE: usize = std::mem::size_of::<Self>();
}

#[derive(Debug, Clone)]
#[cfg(not(test))]
pub struct ViewportBuffer {
    buffer: SharedArrayBuffer,
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
    /// Create a ViewportBuffer from an existing SharedArrayBuffer.
    /// The buffer must be exactly ViewportData::SIZE bytes (112 bytes).
    pub fn from_buffer(buffer: SharedArrayBuffer) -> Self {
        ViewportBuffer { buffer }
    }

    pub fn get_viewport(&self) -> Option<(Pos, Pos, SheetId)> {
        // Create a view of the buffer as bytes
        let bytes = Uint8Array::new(&self.buffer);
        let mut data = [0u8; ViewportData::SIZE];
        bytes.copy_to(&mut data);

        let viewport: &ViewportData = bytemuck::from_bytes(&data);

        // Try to lock slice A first, then slice B
        let slice = if self.try_lock_slice(0, &viewport.slice_a) {
            let result = self.read_slice(&viewport.slice_a);
            self.unlock_slice(0);
            result
        } else if self.try_lock_slice(56, &viewport.slice_b) {
            let result = self.read_slice(&viewport.slice_b);
            self.unlock_slice(56);
            result
        } else {
            return None;
        };

        slice
    }

    /// Attempt to lock a slice for reading using compare-exchange.
    /// Returns true if lock was acquired.
    fn try_lock_slice(&self, byte_offset: usize, slice: &ViewportSlice) -> bool {
        // The flag is at the start of the slice
        let flag_ptr = Int32Array::new(&self.buffer);
        let flag_index = (byte_offset / 4) as u32;

        // Only try to lock if the flag indicates the slice is ready (1)
        if slice.flag != 1 {
            return false;
        }

        // Attempt atomic compare-exchange: 1 -> 2
        AtomicI32::new(flag_ptr.get_index(flag_index))
            .compare_exchange(1, 2, Ordering::Acquire, Ordering::Relaxed)
            .is_ok()
    }

    /// Unlock a slice by setting its flag back to 1.
    fn unlock_slice(&self, byte_offset: usize) {
        let flag_ptr = Int32Array::new(&self.buffer);
        let flag_index = (byte_offset / 4) as u32;

        let _ = AtomicI32::new(flag_ptr.get_index(flag_index)).compare_exchange(
            2,
            1,
            Ordering::Release,
            Ordering::Relaxed,
        );
    }

    /// Read viewport data from a slice.
    fn read_slice(&self, slice: &ViewportSlice) -> Option<(Pos, Pos, SheetId)> {
        let top_left = Pos {
            x: slice.top_left_x as i64,
            y: slice.top_left_y as i64,
        };
        let bottom_right = Pos {
            x: slice.bottom_right_x as i64,
            y: slice.bottom_right_y as i64,
        };

        let sheet_id = std::str::from_utf8(&slice.sheet_id)
            .ok()
            .and_then(|uuid_str| SheetId::from_str(uuid_str).ok());

        match sheet_id {
            Some(sheet_id) => Some((top_left, bottom_right, sheet_id)),
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
    buffer: Box<ViewportData>,
}

#[cfg(test)]
impl Default for ViewportBuffer {
    fn default() -> Self {
        ViewportBuffer {
            buffer: Box::new(ViewportData::zeroed()),
        }
    }
}

#[cfg(test)]
impl ViewportBuffer {
    pub fn get_buffer(&self) -> ViewportData {
        *self.buffer
    }

    pub fn get_viewport(&self) -> Option<(Pos, Pos, SheetId)> {
        Some((Pos { x: -10, y: -10 }, Pos { x: 10, y: 10 }, SheetId::TEST))
    }
}
