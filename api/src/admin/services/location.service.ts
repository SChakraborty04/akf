import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { groups, locations } from '../../db/schema';
import { conflict, notFound, unprocessable } from '../../lib/errors';

export type LocationFilter = {
  state?: string;
  district?: string;
  block?: string;
  panchayat?: string;
  search?: string;
  isActive?: boolean;
};

export type CreateLocationInput = {
  state: string;
  district: string;
  block: string;
  panchayat: string;
  village: string;
  pincode?: string;
};

export type UpdateLocationInput = Partial<CreateLocationInput> & {
  isActive?: boolean;
  cascadeUpdateGroups?: boolean;
};

/**
 * Lists all location master records with optional cascading filters,
 * search term, and count of associated active SHG groups.
 */
export async function listAdminLocations(db: Db, filters: LocationFilter = {}) {
  const conds: (SQL | undefined)[] = [];

  if (filters.state) conds.push(eq(locations.state, filters.state.trim()));
  if (filters.district) conds.push(eq(locations.district, filters.district.trim()));
  if (filters.block) conds.push(eq(locations.block, filters.block.trim()));
  if (filters.panchayat) conds.push(eq(locations.panchayat, filters.panchayat.trim()));
  if (filters.isActive !== undefined) conds.push(eq(locations.isActive, filters.isActive));

  if (filters.search) {
    const q = `%${filters.search.trim()}%`;
    conds.push(
      or(
        ilike(locations.state, q),
        ilike(locations.district, q),
        ilike(locations.block, q),
        ilike(locations.panchayat, q),
        ilike(locations.village, q),
        ilike(locations.pincode, q),
      ),
    );
  }

  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const locRows = await db
    .select()
    .from(locations)
    .where(whereClause)
    .orderBy(locations.state, locations.district, locations.block, locations.panchayat, locations.village);

  // Retrieve SHG group count per (state, district, block, panchayat)
  const groupCounts = await db
    .select({
      state: groups.state,
      district: groups.district,
      block: groups.block,
      panchayat: groups.panchayat,
      count: count(),
    })
    .from(groups)
    .where(eq(groups.isActive, true))
    .groupBy(groups.state, groups.district, groups.block, groups.panchayat);

  const countMap = new Map<string, number>();
  for (const gc of groupCounts) {
    const key = `${gc.state}|${gc.district}|${gc.block}|${gc.panchayat}`;
    countMap.set(key, Number(gc.count));
  }

  return locRows.map((loc) => {
    const key = `${loc.state}|${loc.district}|${loc.block}|${loc.panchayat}`;
    return {
      ...loc,
      linkedGroupCount: countMap.get(key) || 0,
    };
  });
}

/**
 * Creates a brand new location master entry.
 * Validates State, District, Block, Panchayat, and Village.
 */
export async function createAdminLocation(db: Db, input: CreateLocationInput) {
  const state = input.state?.trim();
  const district = input.district?.trim();
  const block = input.block?.trim();
  const panchayat = input.panchayat?.trim();
  const village = input.village?.trim();
  const pincode = input.pincode?.trim() || null;

  if (!state || !district || !block || !panchayat || !village) {
    throw unprocessable('State, District, Block, Panchayat, and Village are required.', 'MISSING_FIELDS');
  }

  // Check for uniqueness
  const [existing] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.state, state),
        eq(locations.district, district),
        eq(locations.block, block),
        eq(locations.panchayat, panchayat),
        eq(locations.village, village),
      ),
    )
    .limit(1);

  if (existing) {
    throw conflict('A master location with this State, District, Block, Panchayat, and Village already exists.');
  }

  const [created] = await db
    .insert(locations)
    .values({
      state,
      district,
      block,
      panchayat,
      village,
      pincode,
      isActive: true,
    })
    .returning();

  return created;
}

/**
 * Updates an existing location master entry.
 * Optionally cascades updates to registered SHGs matching the previous location.
 */
export async function updateAdminLocation(db: Db, id: string, input: UpdateLocationInput) {
  const [existing] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  if (!existing) {
    throw notFound('Location');
  }

  const patch: Partial<typeof locations.$inferInsert> = {};
  if (input.state !== undefined) patch.state = input.state.trim();
  if (input.district !== undefined) patch.district = input.district.trim();
  if (input.block !== undefined) patch.block = input.block.trim();
  if (input.panchayat !== undefined) patch.panchayat = input.panchayat.trim();
  if (input.village !== undefined) patch.village = input.village.trim();
  if (input.pincode !== undefined) patch.pincode = input.pincode ? input.pincode.trim() : null;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  // Check duplicate if hierarchy fields are modified
  const newState = patch.state ?? existing.state;
  const newDistrict = patch.district ?? existing.district;
  const newBlock = patch.block ?? existing.block;
  const newPanchayat = patch.panchayat ?? existing.panchayat;
  const newVillage = patch.village ?? existing.village;

  if (
    newState !== existing.state ||
    newDistrict !== existing.district ||
    newBlock !== existing.block ||
    newPanchayat !== existing.panchayat ||
    newVillage !== existing.village
  ) {
    const [dup] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.state, newState),
          eq(locations.district, newDistrict),
          eq(locations.block, newBlock),
          eq(locations.panchayat, newPanchayat),
          eq(locations.village, newVillage),
        ),
      )
      .limit(1);

    if (dup && dup.id !== id) {
      throw conflict('Another location already exists with these updated hierarchy values.');
    }
  }

  const [updated] = await db.update(locations).set(patch).where(eq(locations.id, id)).returning();

  // Cascade to groups if requested
  if (input.cascadeUpdateGroups) {
    const groupPatch: Partial<typeof groups.$inferInsert> = {};
    if (patch.state) groupPatch.state = patch.state;
    if (patch.district) groupPatch.district = patch.district;
    if (patch.block) groupPatch.block = patch.block;
    if (patch.panchayat) groupPatch.panchayat = patch.panchayat;
    if (patch.village) groupPatch.village = patch.village;

    if (Object.keys(groupPatch).length > 0) {
      await db
        .update(groups)
        .set(groupPatch)
        .where(
          and(
            eq(groups.state, existing.state),
            eq(groups.district, existing.district),
            eq(groups.block, existing.block),
            eq(groups.panchayat, existing.panchayat),
          ),
        );
    }
  }

  return updated;
}

/**
 * Deletes or deactivates a location master entry.
 */
export async function deleteAdminLocation(db: Db, id: string) {
  const [existing] = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  if (!existing) {
    throw notFound('Location');
  }

  // Check if any active SHGs exist in this hierarchy
  const [linkedGroup] = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(
      and(
        eq(groups.state, existing.state),
        eq(groups.district, existing.district),
        eq(groups.block, existing.block),
        eq(groups.panchayat, existing.panchayat),
        eq(groups.isActive, true),
      ),
    )
    .limit(1);

  if (linkedGroup) {
    // If groups exist, deactivate rather than hard-delete to maintain data integrity
    const [deactivated] = await db.update(locations).set({ isActive: false }).where(eq(locations.id, id)).returning();
    return { ...deactivated, note: `Location has ${linkedGroup.name} attached and was deactivated.` };
  }

  await db.delete(locations).where(eq(locations.id, id));
  return { id, deleted: true };
}
