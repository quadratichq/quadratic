Example working cell code

```python
cells = await getCells(0, 0, 1, 3)
result = 1
for cell in cells:
    print(cell.value)
    result *= int(cell.value) + 2
result
```

Fill Grid With Data

```typescript
import { useEffect, useRef } from "react";
import { Cell } from "../gridDB/db";
import { UpdateCellsDB } from "../gridDB/UpdateCellsDB";

useEffect(() => {
  function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
  }

  setInterval(() => {
    const offsetx = getRandomInt(0, 100);
    const offsety = getRandomInt(0, 1000);
    var A: Cell[] = [];
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 10; x++) {
        A.push({
          x: x + offsetx,
          y: y + offsety,
          type: "TEXT",
          value: `${x + offsetx},${y + offsety}`,
        });
      }
    }
    UpdateCellsDB(A);
  }, 5000);
}, []);
```
