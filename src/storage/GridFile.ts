import { Dependency } from '../grid/sheet/GridRenderDependency';
import { BorderSchema, CellSchema, CellFormatSchema } from '../grid/sheet/gridTypes';
import { v4 as uuid } from 'uuid';
import z from 'zod';
import { debugShowFileIO } from '../debugFlags';
import { DEFAULT_FILE_NAME } from '../constants/app';

const HeadingSchema = z.object({
  id: z.number(),
  size: z.number().optional(),
});
export type Heading = z.infer<typeof HeadingSchema>;

const GridFileDataSchema = z.object({
  cells: z.array(CellSchema),
  formats: z.array(CellFormatSchema),
  columns: z.array(HeadingSchema),
  rows: z.array(HeadingSchema),
  borders: z.array(BorderSchema),
  cell_dependency: z.string(),
  // todo: this goes away when alignment branch is merged
  // because this goes away, we'll accept anything in runtime parsing
  render_dependency: z.any(), // Dependency[];
});
type GridFileDataWithoutDep = z.infer<typeof GridFileDataSchema>;
export type GridFileData = GridFileDataWithoutDep & { render_dependency: Dependency[] };

const GridFileSchemaV1 = GridFileDataSchema.merge(
  z.object({
    version: z.literal('1.0'),
  })
);
export type GridFileV1 = z.infer<typeof GridFileSchemaV1>;

const GridFileSchemaV1_1 = GridFileDataSchema.merge(
  z.object({
    version: z.literal('1.1'),

    // New in 1.1
    modified: z.number(),
    created: z.number(),
    id: z.string().uuid(),
    // Note: this is used inside the app, but is overridden when a file is
    // imported by either the file's name on disk or the name in the URL
    filename: z.string(),
  })
);
type GridFileV1_1 = z.infer<typeof GridFileSchemaV1_1>;

export function upgradeV1toV1_1(file: GridFileV1): GridFileV1_1 {
  const date = Date.now();
  return {
    ...file,
    version: '1.1',
    modified: date,
    created: date,
    id: uuid(),
    filename: DEFAULT_FILE_NAME,
  };
}

export const GridFileSchema = GridFileSchemaV1_1;
export type GridFile = GridFileV1_1;
export type GridFiles = GridFileV1 | GridFileV1_1;

/**
 * Given arbitrary JSON, validate whether it's a valid file format and return
 * the newest format of the file if it is.
 */
export function validateFile(jsonFile: {}): GridFile | null {
  // Ordered by newest first
  const files = [{ schema: GridFileSchemaV1_1 }, { schema: GridFileSchemaV1, updateFn: upgradeV1toV1_1 }];

  // Fn to step up through `files` and upgrade each valid file
  const updateFile = (file: GridFiles, filesIndex: number) => {
    while (filesIndex !== 0) {
      if (debugShowFileIO) console.log('[GridFile] upgrading file version: ' + file.version);
      // @ts-expect-error we know the top one doesn't have an updater function
      file = files[filesIndex].updateFn(jsonFile as GridFiles);
      filesIndex--;
    }
    return file;
  };

  // Small fixes we found in v1 files. To be lenient, we make the fixes ourselves here.
  const v1Fixes = (jsonFile: any) => {
    // If this value is an integer, convert to a string
    if (jsonFile) {
      if (jsonFile.version === 1) {
        jsonFile.version = '1.0';
        // Files created before Feb 2023 didn't have a version key
      } else if (!jsonFile.version) {
        jsonFile.version = '1.0';
      }
    }

    // If this value is missing, add it as an empty string
    if (jsonFile && !jsonFile.cell_dependency) {
      jsonFile.cell_dependency = '';
    }

    // The previous enums for borders were integers but now we use strings
    // So we have to change them all, e.g. from "3" to "dotted"
    // https://github.com/quadratichq/quadratic/pull/308/files#diff-fb2ecd77a7c43aa1f68a862e8866d079391f51b6ae9665059d523221fdf5256fL44-R41
    const enumMapping = {
      0: 'line1',
      1: 'line2',
      2: 'line3',
      3: 'dotted',
      4: 'dashed',
      5: 'double',
    };
    if (jsonFile && jsonFile.borders && jsonFile.borders.length > 0) {
      ['horizontal', 'vertical'].forEach((key) => {
        for (let i = 0; i < jsonFile.borders.length; i++) {
          if (jsonFile.borders[i][key] && typeof jsonFile.borders[i][key].type === 'number') {
            const value: 0 | 1 | 2 | 3 | 4 | 5 = jsonFile.borders[i][key].type;
            jsonFile.borders[i][key].type = enumMapping[value];
          }
        }
      });
    }

    return jsonFile;
  };

  let isValid = false;
  let errors = [];
  for (let index = 0; index < files.length; index++) {
    const { schema } = files[index];
    const result =
      schema.shape.version.value === '1.0' ? schema.safeParse(v1Fixes(jsonFile)) : schema.safeParse(jsonFile);
    if (result.success) {
      jsonFile = updateFile(jsonFile as GridFiles, index);
      isValid = true;
      break;
    } else {
      errors.push({ version: schema.shape.version.value, error: result.error });
    }
  }

  if (!isValid) {
    if (debugShowFileIO) console.log('[GridFile] failed to validate file with zod.', errors);
    return null;
  }

  return jsonFile as GridFile;
}
