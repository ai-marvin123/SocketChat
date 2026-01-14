export interface User {
  id: string;
  name: string;
}

//Hardcoded sample users for MVP

export const users: User[] = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
  { id: "u3", name: "Charlie" },
  { id: "u4", name: "David" },
];
