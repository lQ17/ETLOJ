import client from "./client";

export interface ListCategory {
  id: number;
  name: string;
  description?: string | null;
  parentId: number | null;
  sortOrder: number;
  enabled: boolean;
  children?: ListCategory[];
  _count: { items: number };
}
export interface CategoryMembership {
  categoryId: number;
  listId: number;
  sortOrder: number;
  list: { id: number; title: string; isPublic: boolean };
}
export const categoryApi = {
  initialize: () => client.post("/problem-list-categories/initialize"),
  tree: (management = false) => client.get<never, ListCategory[]>(`/problem-list-categories${management ? "/manage" : ""}`),
  create: (data: { name: string; description?: string; parentId?: number; sortOrder?: number; enabled?: boolean }) => client.post("/problem-list-categories", data),
  update: (id: number, data: { name?: string; description?: string; sortOrder?: number; enabled?: boolean }) => client.patch(`/problem-list-categories/${id}`, data),
  items: (id: number) => client.get<never, CategoryMembership[]>(`/problem-list-categories/${id}/items`),
  add: (id: number, listIds: number[]) => client.post<never, { count: number }>(`/problem-list-categories/${id}/items`, { listIds }),
  remove: (id: number, listId: number) => client.delete(`/problem-list-categories/${id}/items/${listId}`),
  sort: (id: number, listIds: number[]) => client.patch(`/problem-list-categories/${id}/items/sort`, { listIds }),
};
