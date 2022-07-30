export type DeltaType = "put" | "delete";

export interface DeltaRow {
  id: number;
  type: DeltaType;
  entity: string;
  entity_id: string;
  data: any;
  user_id: string;
}

export const DELTA_TABLE_NAME = "_delta";
