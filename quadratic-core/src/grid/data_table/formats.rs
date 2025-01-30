use crate::{grid::Format, Pos};

use super::DataTable;

impl DataTable {
    pub fn try_format(&self, pos: Pos) -> Option<Format> {
        let pos = self.get_format_pos_from_display_buffer(pos);
        self.formats.try_format(pos)
    }

    pub(crate) fn get_format_pos_from_display_buffer(&self, mut pos: Pos) -> Pos {
        // adjust for y-axis offset
        pos.y -= self.y_adjustment();

        match &self.display_buffer {
            Some(display_buffer) => {
                if pos.y >= 0 && pos.y < display_buffer.len() as i64 {
                    pos.y = display_buffer[pos.y as usize] as i64;
                }
                // translate to 1-based pos, required for formats
                pos.translate(1, 1, 1, 1)
            }

            None => {
                // translate to 1-based pos, required for formats
                pos.translate(1, 1, 1, 1)
            }
        }
    }
}

#[cfg(test)]
#[serial_test::parallel]
pub mod test {
    #[test]
    fn add_tests() {
        todo!("todo(ayush): add tests");
    }
}
