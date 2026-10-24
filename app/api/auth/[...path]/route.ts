import { auth } from "@reportar/auth";

export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
