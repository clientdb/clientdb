type EntityRemoveRequest = {
  type: "remove";
  entity: string;
  id: string;
};

type EntityUpdateRequest = {
  type: "update";
  entity: string;
  id: string;
  data: object;
};

type EntityCreateRequest = {
  type: "create";
  entity: string;
  data: object;
};

export type EntityChangeRequest =
  | EntityRemoveRequest
  | EntityUpdateRequest
  | EntityCreateRequest;
