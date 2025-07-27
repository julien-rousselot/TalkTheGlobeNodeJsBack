export interface User {
    id: string;
    username: string;
    email: string;
    password: string;
}

export interface Post {
    id: string;
    title: string;
    content: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
}