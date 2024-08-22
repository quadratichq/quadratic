import { intersects } from '@/app/gridGL/helpers/intersects';
import { Selection } from '@/app/quadratic-core-types';

// Returns whether a Selection overlaps another Selection
export const selectionOverlapsSelection = (s1: Selection, s2: Selection): boolean => {
  if (s1.all || s2.all) return true;

  if ((s1.columns && s2.rows) || (s2.columns && s1.rows)) {
    return true;
  }

  if (s1.columns && s2.columns) {
    if (s1.columns.some((c) => s2.columns?.includes(c))) {
      return true;
    }
  }

  if (s1.rows && s2.rows) {
    if (s1.rows.some((r) => s2.rows?.includes(r))) {
      return true;
    }
  }

  if (s1.rects && s2.rects) {
    for (const rect1 of s1.rects) {
      for (const rect2 of s2.rects) {
        if (intersects.rectRect(rect1, rect2)) {
          return true;
        }
      }
    }
  }

  if (s1.rects) {
    for (const rect1 of s1.rects) {
      if (s2.columns) {
        for (const c of s2.columns) {
          if (c >= rect1.min.x && c <= rect1.max.x) {
            return true;
          }
        }
      }
      if (s2.rows) {
        for (const r of s2.rows) {
          if (r >= rect1.min.y && r <= rect1.max.y) {
            return true;
          }
        }
      }
    }
  }

  if (s2.rects) {
    for (const rect2 of s2.rects) {
      if (s1.columns) {
        for (const c of s1.columns) {
          if (c >= rect2.min.x && c <= rect2.max.x) {
            return true;
          }
        }
      }
      if (s1.rows) {
        for (const r of s1.rows) {
          if (r >= rect2.min.y && r <= rect2.max.y) {
            return true;
          }
        }
      }
    }
  }

  return false;
};
