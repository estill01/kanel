// @generated
// This file is automatically generated by Kanel. Do not modify manually.

import type { FilmId } from './Film';
import type { ColumnType, Selectable, Insertable, Updateable } from 'kysely';

export type InventoryId = number;

/** Represents the table public.inventory */
export default interface InventoryTable {
  inventory_id: ColumnType<InventoryId, InventoryId | null, InventoryId | null>;

  film_id: ColumnType<FilmId, FilmId, FilmId | null>;

  store_id: ColumnType<number, number, number | null>;

  last_update: ColumnType<Date, Date | string | null, Date | string | null>;
}

export type Inventory = Selectable<InventoryTable>;

export type NewInventory = Insertable<InventoryTable>;

export type InventoryUpdate = Updateable<InventoryTable>;
