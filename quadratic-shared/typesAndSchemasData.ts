import { z } from 'zod';

// Data asset type enum - matches Prisma DataAssetType
export const DataAssetTypeSchema = z.enum(['CSV', 'EXCEL', 'PARQUET', 'PDF', 'JSON', 'OTHER']);
export type DataAssetType = z.infer<typeof DataAssetTypeSchema>;

// Base data asset schema
const DataAssetSchema = z.object({
  uuid: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  type: DataAssetTypeSchema,
  mimeType: z.string(),
  size: z.number(),
  createdDate: z.string().datetime(),
  updatedDate: z.string().datetime(),
});

// List item schema (subset of fields for list views)
const DataAssetListItemSchema = DataAssetSchema.pick({
  uuid: true,
  name: true,
  type: true,
  size: true,
  createdDate: true,
  updatedDate: true,
});

export const ApiSchemasData = {
  /**
   * ===========================================================================
   * Data Assets (under /v0/teams/:uuid/data/*)
   * ===========================================================================
   */

  // List team data assets (returns both team and personal)
  '/v0/teams/:uuid/data.GET.response': z.object({
    data: z.array(DataAssetListItemSchema), // Team data (public to team)
    dataPrivate: z.array(DataAssetListItemSchema), // Personal data (private to user)
  }),

  // Upload data asset (multipart form)
  '/v0/teams/:uuid/data.POST.response': z.object({
    dataAsset: DataAssetSchema.pick({ uuid: true, name: true, type: true }),
  }),

  // Get single data asset
  '/v0/teams/:uuid/data/:dataUuid.GET.response': z.object({
    dataAsset: DataAssetSchema.extend({
      downloadUrl: z.string().url(),
      metadata: z.any().nullable(),
    }),
    isOwner: z.boolean(), // Can they edit/delete?
  }),

  // Update data asset
  '/v0/teams/:uuid/data/:dataUuid.PATCH.request': z.object({
    name: z.string().optional(),
    description: z.string().nullable().optional(),
  }),
  '/v0/teams/:uuid/data/:dataUuid.PATCH.response': z.object({
    dataAsset: DataAssetSchema.pick({ uuid: true, name: true }),
  }),

  // Delete data asset
  '/v0/teams/:uuid/data/:dataUuid.DELETE.response': z.object({
    message: z.string(),
  }),

  // Get presigned download URL
  '/v0/teams/:uuid/data/:dataUuid/download.GET.response': z.object({
    downloadUrl: z.string().url(),
    expiresAt: z.string().datetime(),
  }),
};
