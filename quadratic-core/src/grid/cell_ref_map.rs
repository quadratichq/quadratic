pub struct GlobalCellsAccessed {
    sheet_rects: HashMap<SheetId, rstar::RTree<AccessedRect>>,
    tables: HashMap<String, Pos>,
}
impl GlobalCellsAccessed {
    pub fn test(&self) {
        self.sheet_rects
            .entry(SheetId::TEST)
            .or_default()
            .locate_in_envelope_int_mut(envelope, |v| ControlFlow);
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct AccessedRect {
    region: RefRangeBounds,
    referencer: Pos,
}

impl rstar::RTreeObject for AccessedRect {
    type Envelope = rstar::AABB<Pos>;

    fn envelope(&self) -> Self::Envelope {
        let r = self.region.to_rect_unbounded();
        rstar::AABB::from_corners(r.min, r.max)
    }
}

impl rstar::Point for Pos {
    type Scalar = i64;

    const DIMENSIONS: usize = 2;

    fn generate(mut generator: impl FnMut(usize) -> Self::Scalar) -> Self {
        Pos {
            x: generator(0),
            y: generator(1),
        }
    }

    fn nth(&self, index: usize) -> Self::Scalar {
        match index {
            0 => self.x,
            1 => self.y,
            _ => panic!("invalid index {index} into Pos"),
        }
    }

    fn nth_mut(&mut self, index: usize) -> &mut Self::Scalar {
        match index {
            0 => &mut self.x,
            1 => &mut self.y,
            _ => panic!("invalid index {index} into Pos"),
        }
    }
}
