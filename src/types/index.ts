import { Request } from "express";

export interface User {
    id: number;
    email: string;
    password: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: number | string;
    email: string;
    role: string;
  };
}

export interface Post {
    id: string;
    title: string;
    content: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
}