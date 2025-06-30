// todo: remove this
#[allow(dead_code)]
#[derive(Debug, Default, PartialEq)]
pub(crate) struct Sides {
    pub left: bool,
    pub right: bool,
    pub top: bool,
    pub bottom: bool,
}

// todo: remove this
#[allow(dead_code)]
impl Sides {
    pub fn all() -> Self {
        Self {
            left: true,
            right: true,
            top: true,
            bottom: true,
        }
    }

    pub fn left() -> Self {
        Self {
            left: true,
            ..Default::default()
        }
    }
    pub fn right() -> Self {
        Self {
            right: true,
            ..Default::default()
        }
    }
    pub fn top() -> Self {
        Self {
            top: true,
            ..Default::default()
        }
    }
    pub fn bottom() -> Self {
        Self {
            bottom: true,
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test_default() {
        let sides = Sides::default();
        assert!(!sides.left && !sides.right && !sides.top && !sides.bottom);
    }

    #[test]
    fn test_all() {
        let sides = Sides::all();
        assert!(sides.left && sides.right && sides.top && sides.bottom);
    }

    #[test]
    fn test_left() {
        let sides = Sides::left();
        assert!(sides.left && !sides.right && !sides.top && !sides.bottom);
    }

    #[test]
    fn test_right() {
        let sides = Sides::right();
        assert!(!sides.left && sides.right && !sides.top && !sides.bottom);
    }

    #[test]
    fn test_top() {
        let sides = Sides::top();
        assert!(!sides.left && !sides.right && sides.top && !sides.bottom);
    }

    #[test]
    fn test_bottom() {
        let sides = Sides::bottom();
        assert!(!sides.left && !sides.right && !sides.top && sides.bottom);
    }

    #[test]
    fn test_debug() {
        let sides = Sides::all();
        let debug_string = format!("{sides:?}");
        assert_eq!(
            debug_string,
            "Sides { left: true, right: true, top: true, bottom: true }"
        );
    }
}
